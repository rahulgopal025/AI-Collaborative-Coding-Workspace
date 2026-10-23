const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const cookieParser = require('cookie-parser');
const apiRouter = require('./routes/index');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Security and utility middlewares
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
  crossOriginResourcePolicy: false,
  crossOriginOpenerPolicy: false,
  referrerPolicy: { policy: 'no-referrer-when-downgrade' },
  frameguard: false,
}));
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));

// API Routes
app.use('/api', apiRouter);

/**
 * Mount the code-server reverse proxy on the app and HTTP server.
 * Called from server.js after the HTTP server is created.
 *
 * @param {import('http').Server} httpServer
 */
app.mountCodeServerProxy = function (httpServer) {
  const { createCodeServerProxy } = require('./modules/projectRunner/codeServer.proxy');
  const proxyRouter = createCodeServerProxy(httpServer);
  // Mount BEFORE the error handler so proxy routes are accessible
  app.use(proxyRouter);
};

// Global Error Handler
app.use(errorHandler);

module.exports = app;
