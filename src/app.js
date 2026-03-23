const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');

const app = express();

// --- Global Middleware (runs on EVERY request, in order) ---
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(requestId);

if (!config.isTest) {
  app.use(pinoHttp({
    logger,
    customProps: (req) => ({ requestId: req.id }),
  }));
}

// --- TEMPORARY: Fake user for Phase 1 ---
// Phase 2 replaces this with real JWT auth middleware.
app.use((req, res, next) => {
  req.userId = '00000000-0000-0000-0000-000000000001';
  next();
});

// --- Routes ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// todo: register application routes here in the next step

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'NOT_FOUND',
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// --- Error handler (MUST be last always) ---
app.use(errorHandler);

module.exports = app;