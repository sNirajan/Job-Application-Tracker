/*
 * CSRF protection middleware.
 *
 * SameSite=Lax on cookies is our primary defense, browsers won't
 * send cookies on cross-site POST requests.
 *
 * This middleware is our second layer. It checks that state-changing
 * requests (POST, PATCH, DELETE) include a custom header that only
 * our frontend sets. Browsers block cross-site JavaScript from setting
 * custom headers (CORS preflight would block it), so an attacker's
 * form can't include this header.
 *
 * GET requests are exempt because they should never change state.
 */

const { UnauthorizedError } = require("../utils/errors");

function csrfProtection(req, res, next) {
  // Skip safe methods — GET, HEAD, OPTIONS don't change state
  const safeMethods = ["GET", "HEAD", "OPTIONS"];
  if (safeMethods.includes(req.method)) {
    return next();
  }

  // Check for our custom header, only our frontend sends this
  // Browsers prevent cross-origin JavaScript from setting custom headers
  // without a CORS preflight, which our CORS config would block
  const csrfHeader = req.headers["x-requested-with"];
  if (csrfHeader !== "XMLHttpRequest") {
    // Also check Origin header as a fallback
    const origin = req.headers.origin;
    const allowedOrigins = [
      "http://localhost:3000",
      "http://localhost:3001",
      process.env.FRONTEND_URL,
    ].filter(Boolean);

    if (!origin || !allowedOrigins.includes(origin)) {
      throw new UnauthorizedError("CSRF validation failed");
    }
  }

  next();
}

module.exports = csrfProtection;