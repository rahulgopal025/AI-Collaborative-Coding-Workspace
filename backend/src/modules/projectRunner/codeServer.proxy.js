/**
 * code-server Reverse Proxy.
 *
 * Provides a complete reverse-proxy for code-server containers:
 *   - All HTTP requests (HTML, JS, CSS, fonts, API calls)
 *   - All subpath routing (e.g. /vscode/*, /stable/*)
 *   - WebSocket upgrades (required for code-server terminal and editor)
 *
 * Access control:
 *   - JWT authentication required
 *   - Project membership verified
 *   - Per-session password injected server-side (never exposed to browser URL bar)
 *
 * Mount point:
 *   /workspace/:projectId/*  →  http://localhost:<container-port>/*
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyToken } = require('../../common/utils/jwt');
const { prisma } = require('../../config/database');
const codeServerService = require('./codeServer.service');
const logger = require('../../common/utils/logger');

/**
 * Create the Express middleware/router for proxying code-server.
 *
 * This must be mounted on the raw http.Server (not just Express app)
 * to support WebSocket upgrades.
 *
 * @param {import('http').Server} httpServer - The raw HTTP server for WebSocket upgrade handling
 * @returns {import('express').Router}
 */
function createCodeServerProxy(httpServer) {
  const express = require('express');
  const router = express.Router();

  /**
   * Authentication + authorization middleware for proxy routes.
   * Verifies JWT from query param or cookie (code-server iframe can't always send headers).
   */
  async function proxyAuth(req, res, next) {
    try {
      // Accept token from: Authorization header, query param, or cookie
      const token =
        req.headers.authorization?.split(' ')[1] ||
        req.query.token ||
        req.cookies?.codecollab_token;

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access workspace',
          code: 'AUTH_REQUIRED',
        });
      }

      const decoded = verifyToken(token);
      const user = await prisma.user.findUnique({
        where: { id: decoded.id },
        select: { id: true, name: true },
      });

      if (!user) {
        return res.status(401).json({
          success: false,
          message: 'User not found',
          code: 'AUTH_USER_NOT_FOUND',
        });
      }

      req.user = user;
      next();
    } catch (err) {
      logger.warn({ error: err.message, path: req.path }, 'Workspace proxy auth failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'AUTH_INVALID_TOKEN',
      });
    }
  }

  /**
   * Verify the user has access to the specific project.
   */
  async function verifyProjectAccess(req, res, next) {
    const { projectId } = req.params;

    if (!projectId || !/^[a-f0-9-]{36}$/i.test(projectId)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid project ID',
        code: 'INVALID_PROJECT_ID',
      });
    }

    // Check project membership
    const membership = await prisma.projectMember.findUnique({
      where: {
        userId_projectId: {
          userId: req.user.id,
          projectId,
        },
      },
    });

    if (!membership) {
      return res.status(403).json({
        success: false,
        message: 'You are not a member of this project',
        code: 'PROJECT_ACCESS_DENIED',
      });
    }

    // Get the running container session
    const session = codeServerService.getSession(projectId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No workspace is running for this project. Start it first via POST /api/project-runner/:projectId/start',
        code: 'WORKSPACE_NOT_RUNNING',
      });
    }

    // Attach session to request for the proxy handler
    req.codeServerSession = session;
    next();
  }

  /**
   * Proxy handler — forwards all requests to the container's code-server.
   * Strips the /workspace/:projectId prefix before forwarding.
   */
  router.use(
    '/workspace/:projectId',
    proxyAuth,
    verifyProjectAccess,
    (req, res, next) => {
      const session = req.codeServerSession;
      const target = `http://127.0.0.1:${session.port}`;

      // Create a dynamic proxy for this specific container
      const proxy = createProxyMiddleware({
        target,
        ws: false, // WebSocket is handled separately below
        changeOrigin: true,
        // Strip /workspace/:projectId from the forwarded path
        pathRewrite: (pathStr) => {
          const projectId = req.params.projectId;
          const prefix = `/workspace/${projectId}`;
          if (pathStr.startsWith(prefix)) {
            return pathStr.slice(prefix.length) || '/';
          }
          return pathStr;
        },
        // Inject the code-server password cookie so the user doesn't need to type it
        onProxyReq: (proxyReq) => {
          // Set the password cookie that code-server expects
          const existingCookies = proxyReq.getHeader('cookie') || '';
          const passwordCookie = `key=${session.password}`;
          if (!existingCookies.includes('key=')) {
            proxyReq.setHeader('cookie', existingCookies ? `${existingCookies}; ${passwordCookie}` : passwordCookie);
          }
        },
        // Fix response headers for iframe embedding
        onProxyRes: (proxyRes) => {
          // Allow embedding in an iframe from our frontend
          delete proxyRes.headers['x-frame-options'];
          proxyRes.headers['content-security-policy'] =
            "frame-ancestors 'self' http://localhost:3000 http://localhost:5000";
        },
        onError: (err, _req, res) => {
          logger.error({ error: err.message }, 'Proxy error');
          if (!res.headersSent) {
            res.status(502).json({
              success: false,
              message: 'Workspace proxy error: ' + err.message,
              code: 'PROXY_ERROR',
            });
          }
        },
      });

      proxy(req, res, next);
    }
  );

  /**
   * Application Preview proxy handler.
   * Forwards requests to the dev server running inside the container (e.g. Vite on 5173, React on 3000).
   * Strips prefix and fixes CSP/X-Frame-Options headers for seamless iframe embedding.
   */
  router.use(
    ['/api/project-runner/:projectId/preview', '/preview/:projectId'],
    proxyAuth,
    verifyProjectAccess,
    (req, res, next) => {
      const session = req.codeServerSession;
      const requestedPort = parseInt(req.query.port, 10) || 5173;
      const targetHostPort = session.previewPorts?.[requestedPort] || (session.port + 100);
      const target = `http://127.0.0.1:${targetHostPort}`;

      const proxy = createProxyMiddleware({
        target,
        ws: false,
        changeOrigin: true,
        pathRewrite: (pathStr) => {
          const match = pathStr.match(/(?:\/api\/project-runner\/[a-f0-9-]{36}\/preview|\/preview\/[a-f0-9-]{36})(.*)/i);
          return match ? match[1] || '/' : pathStr;
        },
        onProxyRes: (proxyRes) => {
          delete proxyRes.headers['x-frame-options'];
          proxyRes.headers['content-security-policy'] =
            "frame-ancestors 'self' http://localhost:3000 http://localhost:5000";
        },
        onError: (err, _req, res) => {
          logger.warn({ error: err.message, target }, 'Preview proxy error (app server may still be starting)');
          if (!res.headersSent) {
            res.status(502).send(`
              <!DOCTYPE html>
              <html>
                <head><title>Preview Starting</title></head>
                <body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;display:flex;flex-direction:column;align-items:center;justify-content:center;height:90vh;background:#1e1e1e;color:#f8f8f2;margin:0;">
                  <div style="background:#252526;border:1px solid #333;padding:24px 32px;border-radius:8px;text-align:center;max-width:420px;">
                    <div style="font-size:24px;margin-bottom:12px;">⏳</div>
                    <h3 style="margin:0 0 8px 0;font-size:16px;color:#ffb86c;">Development Server Starting</h3>
                    <p style="color:#6272a4;font-size:13px;line-height:1.5;margin:0 0 16px 0;">
                      The development server is compiling or starting on port ${requestedPort}.
                      Check the terminal output or click the button below in a few moments.
                    </p>
                    <button onclick="location.reload()" style="background:#bd93f9;color:#1e1e1e;border:none;padding:8px 16px;border-radius:4px;font-weight:600;cursor:pointer;font-size:12px;">
                      Reload Preview
                    </button>
                  </div>
                </body>
              </html>
            `);
          }
        },
      });

      proxy(req, res, next);
    }
  );

  /**
   * WebSocket upgrade handler.
   * Attached to raw HTTP server to handle both code-server and Vite HMR WebSockets.
   */
  if (httpServer) {
    const { createProxyServer } = require('http-proxy');

    httpServer.on('upgrade', async (req, socket, head) => {
      // Check for code-server or app preview path
      const csMatch = req.url.match(/^\/workspace\/([a-f0-9-]{36})(\/.*)?$/i);
      const previewMatch = req.url.match(/^(?:\/api\/project-runner|\/preview)\/([a-f0-9-]{36})(?:\/preview)?(\/.*)?$/i);

      if (!csMatch && !previewMatch) return; // Let Socket.IO handle other paths

      const projectId = csMatch ? csMatch[1] : previewMatch[1];
      const isPreview = Boolean(previewMatch);

      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        const token = url.searchParams.get('token') || req.headers.authorization?.split(' ')[1];

        if (!token) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const decoded = verifyToken(token);

        // Check project membership
        const membership = await prisma.projectMember.findUnique({
          where: {
            userId_projectId: {
              userId: decoded.id,
              projectId,
            },
          },
        });

        if (!membership) {
          socket.write('HTTP/1.1 403 Forbidden\r\n\r\n');
          socket.destroy();
          return;
        }

        const session = codeServerService.getSession(projectId);
        if (!session) {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        let target;
        if (isPreview) {
          const previewPort = session.previewPorts?.[5173] || (session.port + 100);
          target = `ws://127.0.0.1:${previewPort}`;
          req.url = req.url.replace(/^(?:\/api\/project-runner|\/preview)\/[a-f0-9-]{36}(?:\/preview)?/i, '') || '/';
        } else {
          target = `ws://127.0.0.1:${session.port}`;
          const prefix = `/workspace/${projectId}`;
          if (req.url.startsWith(prefix)) {
            req.url = req.url.slice(prefix.length) || '/';
          }
          const existingCookies = req.headers.cookie || '';
          if (!existingCookies.includes('key=')) {
            req.headers.cookie = existingCookies
              ? `${existingCookies}; key=${session.password}`
              : `key=${session.password}`;
          }
        }

        const wsProxy = createProxyServer({ target, ws: true });
        wsProxy.ws(req, socket, head);

        wsProxy.on('error', (err) => {
          logger.warn({ error: err.message, projectId, isPreview }, 'WebSocket proxy error');
          socket.destroy();
        });
      } catch (err) {
        logger.warn({ error: err.message }, 'WebSocket upgrade auth failed');
        socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
        socket.destroy();
      }
    });
  }

  return router;
}

module.exports = { createCodeServerProxy };
