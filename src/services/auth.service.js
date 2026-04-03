const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const config = require("../config");
const { ConflictError, UnauthorizedError } = require("../utils/errors");
const logger = require("../utils/logger");
const { access } = require("node:fs");

/*
 * Registers a new user.
 *
 * Checks for duplicate email, hashes the password so the plain text
 * is never stored, inserts the user, and returns their info
 */

async function register(data) {
  const existing = await db("users").where({ email: data.email }).first();
  if (existing) throw new ConflictError("Email already registered");
  const hashedPassword = await bcrypt.hash(data.password, 10); // 10 is the salting round
  const [user] = await db("users")
    .insert({
      email: data.email,
      name: data.name,
      password_hash: hashedPassword,
    })
    .returning(["id", "email", "name", "created_at"]);

  logger.info({ userId: user.id, email: user.email }, "User registered");
  return user;
}

/*
 * Logs in a user and returns JWT tokens.
 *
 * The error message is intentionally vague  "Invalid email or password"
 * for BOTH wrong email and wrong password. Telling an attacker
 * "email not found" confirms which half they got right.
 *
 * Returns two tokens:
 *  1. Access token (15 min) : sent with every request to prove identity
 *  2. Refresh token (7 days) : used to get a new access token when it expires
 */

async function login(data) {
  const user = await db("users").where({ email: data.email }).first();
  if (!user) throw new UnauthorizedError("Invalid email or password");

  // bcrypt.compare hashes what the user typed and checks it against
  // the stored hash. Returns true/false. Never compares plain text.
  const match = await bcrypt.compare(data.password, user.password_hash);
  if (!match) throw new UnauthorizedError("Invalid email or password");

  // jwt.sign creates a token with the user's ID embedded inside.
  // "sub" is a standard JWT field meaning "subject" who this token is for.
  // The secret key is what makes the token unforgeable, only our server knows it.
  const accessToken = jwt.sign({ sub: user.id }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

  const refreshToken = jwt.sign({ sub: user.id }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  logger.info({ userId: user.id, email: user.email }, "User logged in");

  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
    },
    accessToken,
    refreshToken,
  };
}

async function refresh(data) {
  try {
    // verifies the refresh token, same idea as auth middleware
    // but using refreshSecret, not accessSecret
    const decoded = jwt.verify(data.refreshToken, config.jwt.refreshSecret);

    // The token is valid. decoded.sub is the user ID
    // Generates a fresh access token
    const accessToken = jwt.sign(
      { sub: decoded.sub },
      config.jwt.accessSecret,
      { expiresIn: config.jwt.accessExpiresIn },
    );

    return { accessToken };
  } catch (err) {
    // console.log("REFRESH ERROR:", err.message);
    // Token is expired, tampered with, or garbage
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}
module.exports = { register, login, refresh };
