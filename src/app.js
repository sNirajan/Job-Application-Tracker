const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const cookieParser = require("cookie-parser");
const pinoHttp = require("pino-http");

const config = require("./config");
const logger = require("./utils/logger");
const requestId = require("./middleware/requestId");
const errorHandler = require("./middleware/errorHandler");
const csrfProtection = require("./middleware/csrf");
const applicationRoutes = require("./routes/applications.routes");
const statsRoutes = require("./routes/stats.routes");
const authRoutes = require("./routes/auth.routes");
const auth = require("./middleware/auth");

const app = express();

// --- Global Middleware (runs on EVERY request, in order) ---
app.use(helmet());

// Allowed origins for CORS, must be specific, not * with credentials
const allowedOrigins = [
  "http://localhost:3000",
  "http://localhost:3001",
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(helmet());
app.set("trust proxy", 1); 
app.use(
  cors({
    origin: allowedOrigins,
    credentials: true, // Required for cookies to be sent cross-origin
  }),
);

app.use(express.json({ limit: "10mb" }));
app.use(cookieParser());
app.use(requestId);

if (!config.isTest) {
  app.use(
    pinoHttp({
      logger,
      customProps: (req) => ({ requestId: req.id }),
    }),
  );
}

// CSRF protection on all state-changing requests
// Runs after CORS (which blocks unauthorized origins)
// and after cookieParser (which parses cookies)
app.use(csrfProtection);

// --- Public Routes (no token needed) ---
app.get("/health", (req, res) => {
  res.json({ status: "ok", timestamp: new Date().toISOString() });
});

app.use("/api/v1/auth", authRoutes);

// --- Protected Routes (token required) 
app.use("/api/v1/applications", auth, applicationRoutes);
app.use("/api/v1/stats", auth, statsRoutes);

// --- 404 handler ---
app.use((req, res) => {
  res.status(404).json({
    error: {
      code: "NOT_FOUND",
      message: `Route ${req.method} ${req.path} not found`,
    },
  });
});

// --- Error handler (MUST be last always) ---
app.use(errorHandler);

module.exports = app;
