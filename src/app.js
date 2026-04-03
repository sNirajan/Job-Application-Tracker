const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const pinoHttp = require('pino-http');

const config = require('./config');
const logger = require('./utils/logger');
const requestId = require('./middleware/requestId');
const errorHandler = require('./middleware/errorHandler');
const applicationRoutes = require('./routes/applications.routes');
const statsRoutes = require("./routes/stats.routes");
const authRoutes = require("./routes/auth.routes");
const auth = require("./middleware/auth");

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

// --- Public Routes (no token needed) ---
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.use('/api/v1/auth', authRoutes);

// --- Protected Routes (token required) ---
// auth middleware runs BEFORE these routes, verifies the JWT,
// and sets req.userId. If the token is missing or invalid,
// the request never reaches these routes — it gets a 401.
app.use('/api/v1/applications', auth, applicationRoutes);
app.use('/api/v1/stats', auth, statsRoutes);


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