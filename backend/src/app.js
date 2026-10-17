const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const apiRouter = require('./routes/index');
const { errorHandler } = require('./middlewares/error.middleware');

const app = express();

// Security and utility middlewares
app.use(helmet());
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  credentials: true,
}));
app.use(express.json());

// API Routes
app.use('/api', apiRouter);

// Global Error Handler
app.use(errorHandler);

module.exports = app;

