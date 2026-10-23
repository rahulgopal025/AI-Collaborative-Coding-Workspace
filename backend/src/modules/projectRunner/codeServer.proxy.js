/**
 * code-server Reverse Proxy & Live Application Preview Proxy.
 *
 * Provides a complete reverse-proxy for code-server containers and dev servers:
 *   - All HTTP requests (HTML, JS, CSS, fonts, API calls)
 *   - Subpath routing (/workspace/:projectId/* and /preview/:projectId/*)
 *   - Root-relative Vite asset routing (/@vite/*, /src/*, etc.)
 *   - WebSocket upgrades (code-server and Vite HMR)
 *
 * Access control:
 *   - JWT authentication required (via header, query param, or cookie)
 *   - Project membership verified against PostgreSQL
 *   - Per-session credentials injected server-side
 */

const { createProxyMiddleware } = require('http-proxy-middleware');
const { verifyToken } = require('../../common/utils/jwt');
const { prisma } = require('../../config/database');
const codeServerService = require('./codeServer.service');
const logger = require('../../common/utils/logger');

function getOfflineHtml(requestedPort) {
  return `<!DOCTYPE html>
<html>
  <head>
    <title>Development Server Offline</title>
    <style>
      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        display: flex;
        align-items: center;
        justify-content: center;
        height: 100vh;
        margin: 0;
        background: #18181b;
        color: #f4f4f5;
      }
      .card {
        background: #27272a;
        border: 1px solid #3f3f46;
        padding: 32px;
        border-radius: 12px;
        text-align: center;
        max-width: 440px;
        box-shadow: 0 10px 25px rgba(0,0,0,0.5);
      }
      .icon {
        font-size: 36px;
        margin-bottom: 12px;
      }
      h3 {
        margin: 0 0 10px 0;
        font-size: 18px;
        font-weight: 600;
        color: #fbbf24;
      }
      p {
        color: #a1a1aa;
        font-size: 13px;
        line-height: 1.6;
        margin: 0 0 16px 0;
      }
      .code-badge {
        display: inline-block;
        background: #18181b;
        color: #38bdf8;
        padding: 6px 14px;
        border-radius: 6px;
        font-family: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
        font-size: 13px;
        margin-bottom: 16px;
        border: 1px solid #3f3f46;
      }
      .btn {
        background: #6366f1;
        color: #ffffff;
        border: none;
        padding: 10px 22px;
        border-radius: 6px;
        font-weight: 600;
        cursor: pointer;
        font-size: 13px;
        transition: background 0.2s;
      }
      .btn:hover {
        background: #4f46e5;
      }
    </style>
  </head>
  <body>
    <div class="card">
      <div class="icon">⚡</div>
      <h3>Development Server Offline</h3>
      <p>
        No web server is currently listening on port <strong>${requestedPort}</strong> inside the container.
      </p>
      <div class="code-badge">npm run dev</div>
      <p style="font-size: 12px; color: #71717a;">
        Run the command above in the integrated terminal to start your development server, then reload.
      </p>
      <button class="btn" onclick="location.reload()">Reload Preview</button>
    </div>
  </body>
</html>`;
}

/**
 * Create the Express middleware/router for proxying code-server and live preview.
 *
 * @param {import('http').Server} httpServer - The raw HTTP server for WebSocket upgrade handling
 * @returns {import('express').Router}
 */
function createCodeServerProxy(httpServer) {
  const express = require('express');
  const router = express.Router();

  // Active verified preview sessions cache to enable cross-origin iframe subresource routing
  const activePreviewSessions = new Map(); // projectId -> { user, port, lastActive }
  let lastActiveProjectId = null;

  /**
   * Authentication + authorization middleware for proxy routes.
   * Verifies JWT from query param, header, or cookie (iframes cannot send headers).
   */
  async function proxyAuth(req, res, next) {
    try {
      let token =
        req.headers.authorization?.split(' ')[1] ||
        req.query.token ||
        req.cookies?.codecollab_token;

      if (!token && req.headers.referer) {
        try {
          const refUrl = new URL(req.headers.referer);
          token = refUrl.searchParams.get('token');
        } catch {}
      }

      if (!token) {
        return res.status(401).json({
          success: false,
          message: 'Authentication required to access workspace or preview',
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
      logger.warn({ error: err.message, path: req.path }, 'Proxy auth failed');
      return res.status(401).json({
        success: false,
        message: 'Invalid or expired token',
        code: 'AUTH_INVALID_TOKEN',
      });
    }
  }

  /**
   * Verify the user has access to the specific project and ensure container session.
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

    // Get or adopt the running container session
    const session = await codeServerService.ensureSession(projectId);
    if (!session) {
      return res.status(404).json({
        success: false,
        message: 'No workspace is running for this project. Start it first via POST /api/project-runner/:projectId/start',
        code: 'WORKSPACE_NOT_RUNNING',
      });
    }

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

      const proxy = createProxyMiddleware({
        target,
        ws: false,
        changeOrigin: true,
        pathRewrite: (pathStr) => {
          const projectId = req.params.projectId;
          const prefix = `/workspace/${projectId}`;
          if (pathStr.startsWith(prefix)) {
            return pathStr.slice(prefix.length) || '/';
          }
          return pathStr;
        },
        on: {
          proxyReq: (proxyReq) => {
            const existingCookies = proxyReq.getHeader('cookie') || '';
            const passwordCookie = `key=${session.password}`;
            if (!existingCookies.includes('key=')) {
              proxyReq.setHeader('cookie', existingCookies ? `${existingCookies}; ${passwordCookie}` : passwordCookie);
            }
          },
          proxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            proxyRes.headers['content-security-policy'] =
              "frame-ancestors 'self' http://localhost:3000 http://localhost:5000";
          },
          error: (err, _req, res) => {
            logger.error({ error: err.message }, 'Workspace proxy error');
            if (res && !res.headersSent) {
              if (typeof res.writeHead === 'function') {
                res.writeHead(502, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ success: false, message: 'Workspace proxy error: ' + err.message }));
              } else if (typeof res.status === 'function') {
                res.status(502).json({ success: false, message: 'Workspace proxy error: ' + err.message });
              }
            }
          },
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
      const { projectId } = req.params;
      const session = req.codeServerSession;
      const requestedPort = parseInt(req.query.port, 10) || 5173;
      const targetHostPort = session.previewPorts?.[requestedPort] || (session.port + 100);
      const target = `http://127.0.0.1:${targetHostPort}`;

      // Register this active verified preview session
      activePreviewSessions.set(projectId, {
        user: req.user,
        port: requestedPort,
        lastActive: Date.now(),
      });
      lastActiveProjectId = projectId;

      // Set cookies so subsequent subresource requests from iframe route correctly
      const token =
        req.headers.authorization?.split(' ')[1] ||
        req.query.token ||
        req.cookies?.codecollab_token;

      if (token) {
        res.cookie('codecollab_token', token, { path: '/', sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
      }
      res.cookie('codecollab_preview_project', projectId, { path: '/', sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });
      res.cookie('codecollab_preview_port', String(requestedPort), { path: '/', sameSite: 'lax', maxAge: 24 * 60 * 60 * 1000 });

      // Ensure root URL has trailing slash so relative paths resolve correctly
      const cleanPath = req.path;
      if (
        (cleanPath === `/preview/${projectId}` || cleanPath === `/api/project-runner/${projectId}/preview`) &&
        !req.originalUrl.split('?')[0].endsWith('/')
      ) {
        const queryPart = req.url.includes('?') ? '?' + req.url.split('?')[1] : '';
        return res.redirect(301, `${req.baseUrl || ''}${cleanPath}/${queryPart}`);
      }

      const sendOfflineResponse = (clientRes) => {
        if (!clientRes || clientRes.headersSent) return;
        const html = getOfflineHtml(requestedPort);
        if (typeof clientRes.writeHead === 'function') {
          clientRes.writeHead(502, { 'Content-Type': 'text/html' });
          clientRes.end(html);
        } else if (typeof clientRes.status === 'function') {
          clientRes.status(502).send(html);
        }
      };

      const proxy = createProxyMiddleware({
        target,
        ws: false,
        changeOrigin: true,
        pathRewrite: (pathStr) => {
          const match = pathStr.match(/(?:\/api\/project-runner\/[a-f0-9-]{36}\/preview|\/preview\/[a-f0-9-]{36})(.*)/i);
          return match ? match[1] || '/' : pathStr;
        },
        on: {
          proxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            proxyRes.headers['content-security-policy'] =
              "frame-ancestors 'self' http://localhost:3000 http://localhost:5000";
            proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
          },
          error: (err, _req, clientRes) => {
            logger.warn({ error: err.message, target }, 'Preview proxy error (app server may still be starting)');
            sendOfflineResponse(clientRes);
          },
        },
      });

      proxy(req, res, next);
    }
  );

  /**
   * Root-relative asset interceptor for Vite/Webpack dev servers.
   * Vite subresources (e.g. /@vite/client, /@react-refresh, /src/main.jsx) are requested
   * at the root level by the browser inside the iframe.
   * This middleware resolves the originating project from cookies, referer, or active preview session.
   */
  router.use(async (req, res, next) => {
    // Skip if path is handled by other explicit routers
    if (
      req.path.startsWith('/workspace/') ||
      req.path.startsWith('/preview/') ||
      req.path.startsWith('/api/') ||
      req.path.startsWith('/socket.io/')
    ) {
      return next();
    }

    // Resolve projectId from referer FIRST (most reliable for iframe subresources), then query, then cookie
    let projectId = null;
    if (req.headers.referer) {
      const refMatch = req.headers.referer.match(/(?:\/preview|\/api\/project-runner)\/([a-f0-9-]{36})/i);
      if (refMatch) projectId = refMatch[1];
    }
    if (!projectId && req.query.projectId && /^[a-f0-9-]{36}$/i.test(req.query.projectId)) {
      projectId = req.query.projectId;
    }
    if (!projectId) {
      projectId = req.cookies?.codecollab_preview_project;
    }
    if (!projectId) {
      if (activePreviewSessions.size === 1) {
        projectId = activePreviewSessions.keys().next().value;
      } else {
        projectId = lastActiveProjectId;
      }
    }

    if (!projectId) {
      return next();
    }

    const previewSession = activePreviewSessions.get(projectId);

    // Verify token from header, query, cookie, referer URL, or active session
    let token =
      req.headers.authorization?.split(' ')[1] ||
      req.query.token ||
      req.cookies?.codecollab_token;

    if (!token && req.headers.referer) {
      try {
        const refUrl = new URL(req.headers.referer);
        token = refUrl.searchParams.get('token');
      } catch {}
    }

    let authenticatedUser = null;
    if (token) {
      try {
        const decoded = verifyToken(token);
        const membership = await prisma.projectMember.findUnique({
          where: {
            userId_projectId: {
              userId: decoded.id,
              projectId,
            },
          },
        });
        if (membership) authenticatedUser = decoded;
      } catch {}
    }

    if (!authenticatedUser && previewSession) {
      // User was already verified on initial /preview/:projectId/ page load
      authenticatedUser = previewSession.user;
    }

    if (!authenticatedUser) {
      return next();
    }

    try {
      const session = await codeServerService.ensureSession(projectId);
      if (!session) {
        return next();
      }

      const port = parseInt(req.cookies?.codecollab_preview_port, 10) || previewSession?.port || 5173;
      const targetHostPort = session.previewPorts?.[port] || (session.port + 100);
      const target = `http://127.0.0.1:${targetHostPort}`;

      const assetProxy = createProxyMiddleware({
        target,
        ws: false,
        changeOrigin: true,
        on: {
          proxyRes: (proxyRes) => {
            delete proxyRes.headers['x-frame-options'];
            proxyRes.headers['content-security-policy'] =
              "frame-ancestors 'self' http://localhost:3000 http://localhost:5000";
            proxyRes.headers['cross-origin-resource-policy'] = 'cross-origin';
          },
          error: (err, _req, clientRes) => {
            logger.debug({ error: err.message, path: req.path }, 'Preview asset error');
            if (clientRes && !clientRes.headersSent) {
              if (typeof clientRes.writeHead === 'function') {
                clientRes.writeHead(502);
                clientRes.end();
              } else if (typeof clientRes.status === 'function') {
                clientRes.status(502).end();
              }
            }
          },
        },
      });

      return assetProxy(req, res, next);
    } catch {
      return next();
    }
  });

  /**
   * WebSocket upgrade handler.
   * Attached to raw HTTP server to handle both code-server and Vite HMR WebSockets.
   */
  if (httpServer) {
    const { createProxyServer } = require('http-proxy');

    httpServer.on('upgrade', async (req, socket, head) => {
      // Let Socket.IO handle /socket.io/
      if (req.url.startsWith('/socket.io/')) return;

      const csMatch = req.url.match(/^\/workspace\/([a-f0-9-]{36})(\/.*)?$/i);
      const previewMatch = req.url.match(/^(?:\/api\/project-runner|\/preview)\/([a-f0-9-]{36})(?:\/preview)?(\/.*)?$/i);

      let projectId = csMatch ? csMatch[1] : (previewMatch ? previewMatch[1] : null);
      let isViteHmr = false;

      // Check cookie or referer or active sessions for Vite HMR connections (which connect to / or /@vite-hmr)
      if (!projectId) {
        const cookies = req.headers.cookie || '';
        const cookieMatch = cookies.match(/codecollab_preview_project=([a-f0-9-]{36})/);
        if (cookieMatch) {
          projectId = cookieMatch[1];
          isViteHmr = true;
        } else if (req.headers.referer) {
          const refMatch = req.headers.referer.match(/(?:\/preview|\/api\/project-runner)\/([a-f0-9-]{36})/i);
          if (refMatch) {
            projectId = refMatch[1];
            isViteHmr = true;
          }
        } else if (activePreviewSessions.has(lastActiveProjectId)) {
          projectId = lastActiveProjectId;
          isViteHmr = true;
        }
      }

      if (!projectId) return;

      const previewSession = activePreviewSessions.get(projectId);

      try {
        const url = new URL(req.url, `http://${req.headers.host}`);
        let token =
          url.searchParams.get('token') ||
          req.headers.authorization?.split(' ')[1] ||
          req.headers.cookie?.match(/codecollab_token=([^;]+)/)?.[1]?.trim();

        if (!token && req.headers.referer) {
          try {
            const refUrl = new URL(req.headers.referer);
            token = refUrl.searchParams.get('token');
          } catch {}
        }

        let authorized = false;
        if (token) {
          const decoded = verifyToken(token);
          const membership = await prisma.projectMember.findUnique({
            where: {
              userId_projectId: {
                userId: decoded.id,
                projectId,
              },
            },
          });
          if (membership) authorized = true;
        }

        if (!authorized && isViteHmr && previewSession) {
          authorized = true;
        }

        if (!authorized) {
          socket.write('HTTP/1.1 401 Unauthorized\r\n\r\n');
          socket.destroy();
          return;
        }

        const session = await codeServerService.ensureSession(projectId);
        if (!session) {
          socket.write('HTTP/1.1 404 Not Found\r\n\r\n');
          socket.destroy();
          return;
        }

        let target;
        if (isViteHmr || previewMatch) {
          const cookies = req.headers.cookie || '';
          const portMatch = cookies.match(/codecollab_preview_port=(\d+)/);
          const port = portMatch ? parseInt(portMatch[1], 10) : (previewSession?.port || 5173);
          const previewPort = session.previewPorts?.[port] || (session.port + 100);
          target = `ws://127.0.0.1:${previewPort}`;
          if (previewMatch) {
            req.url = req.url.replace(/^(?:\/api\/project-runner|\/preview)\/[a-f0-9-]{36}(?:\/preview)?/i, '') || '/';
          }
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
          logger.warn({ error: err.message, projectId, isViteHmr }, 'WebSocket proxy error');
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
