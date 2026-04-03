/*
 * Auth middleware.
 *
 * This replaces the fake user middleware from Phase 1.
 * It reads the JWT from the Authorization header, verifies it,
 * and sets req.userId so the rest of the app knows who's making
 * the request. If the token is missing, expired, or tampered with,
 * the request is rejected with 401 Unauthorized.
 *
 * The Authorization header format is: "Bearer eyJhbGciOi..."
 * "Bearer" is just a convention, it tells the server "what follows is a token."
 */

const jwt = require("jsonwebtoken");
const config = require("../config");
const { UnauthorizedError } = require("../utils/errors");

function auth(req, res, next) {
  // Gets the header which looks like "Bearer eyJhbGci0i...."
  const header = req.headers.authorization;

  if (!header) {
    throw new UnauthorizedError("No token provided");
  }

  // Extracts the token, splits "Bearer eyJhbG..." into ["Bearer", "eyJhbG..."]
  // and takes the second part
  const parts = header.split(" ");

  if (parts.length !== 2 || parts[0] !== "Bearer") {
    throw new UnauthorizedError(
      "Invalid token format. Expected: Bearer <token>",
    );
  }

  const token = parts[1];

  try {
    // Verifies the token, jwt.verify does three things:
    // Checks the signature (was this token created with our secret key)
    // Checks expiration (has the 15-minute window passed)
    // Decodes the payload (extracts {sub: "user-id-here"})
    // If any of these fail, it throws an error
    const decoded = jwt.verify(token, config.jwt.accessSecret);

    // Sets req.userId from the token's "sub" (subject) field
    // receives userId and scopes all queries to this user

    req.userId = decoded.sub;

    next();
  } catch (err) {
    // Token is expired, tampered with, or just garbage
    // We don't tell the client WHy it failed, that leaks information
    throw new UnauthorizedError("Invalid or expired token");
  }
}

module.exports = auth;
