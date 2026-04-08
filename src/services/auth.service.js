const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const db = require("../config/database");
const redis = require("../config/redis");
const config = require("../config");
const { ConflictError, UnauthorizedError } = require("../utils/errors");
const logger = require("../utils/logger");

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
 * Generates both tokens and stores the refresh token in Redis in the next function.
 *
 * By storing refresh tokens in Redis, we can:
 * 1. Invalidate specific tokens on logout
 * 2. Implement rotation (old token deleted, new one stored)
 * 3. Detect stolen tokens (if the old one is used after rotation)
 */

function generateTokens(userId) {
  const accessToken = jwt.sign({ sub: userId }, config.jwt.accessSecret, {
    expiresIn: config.jwt.accessExpiresIn,
  });

  const refreshToken = jwt.sign({ sub: userId }, config.jwt.refreshSecret, {
    expiresIn: config.jwt.refreshExpiresIn,
  });

  return { accessToken, refreshToken };
}

/*
 * Stores a refresh token in Redis with the same TTL as the token itself.
 * Key format: refresh:{userId}:{tokenId}
 * This allows one user to have multiple active sessions (phone + laptop).
 */

async function storeRefreshToken(userId, refreshToken) {
  if (redis) {
    try {
      // Use the token's iat (issued at) as a unique identifier
      const decoded = jwt.decode(refreshToken);
      const key = `refresh:${userId}:${decoded.iat}`;
      // Store for 7 days (match refresh token lifetime)
      await redis.set(key, refreshToken, "EX", 7 * 24 * 60 * 60);
    } catch (err) {
      logger.warn(
        { err: err.message },
        "Failed to store refresh token in Redis",
      );
    }
  }
}

/* Removes a specific refresh token from Redis.
 * Called during logout and refresh token rotation
 */

async function removeRefreshToken(userId, refreshToken) {
  if (redis) {
    try {
      const decoded = jwt.decode(refreshToken);
      const key = `refresh:${userId}:${decoded.iat}`;
      await redis.del(key);
    } catch (err) {
      logger.warn(
        { err: err.message },
        "Failed to remove refresh token from Redis",
      );
    }
  }
}

/*
 * Checks if a refresh token is still active in Redis
 * Returns false if it was already used (rotation) or invalidated (logout)
 */

async function isRefreshTokenActive(userId, refreshToken) {
  if (!redis) return true; // Skips check if redis is down
  try {
    const decoded = jwt.decode(refreshToken);
    const key = `refresh:${userId}:${decoded.iat}`;
    const stored = await redis.get(key);
    return stored === refreshToken;
  } catch {
    return true; // Fail open, shouldn't lock users our if Redis is down
  }
}

async function login(data) {
  const user = await db("users").where({ email: data.email }).first();
  if (!user) throw new UnauthorizedError("Invalid email or password");

  const match = await bcrypt.compare(data.password, user.password_hash);
  if (!match) throw new UnauthorizedError("Invalid email or password");

  const { accessToken, refreshToken } = generateTokens(user.id);

  // Stores refresh token in Redis for server-side tracking
  await storeRefreshToken(user.id, refreshToken);

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

/*
* Refresh token with rotation:
* 1. Verify the old refresh token (signature + expiry)
* 2. Check it's still active in Redis (not already used or revoked)
* 3. Delete the old refresh token from Redis
* 4. Generate new tokens (both access AND refresh)
* 5. Store the new refresh token in Redis

* If someone uses an old refresh token that was already rotated,
* it won't be in Redis, we reject it. This detects token theft.
*/

async function refresh(oldRefreshToken) {
  try {
    const decoded = jwt.verify(oldRefreshToken, config.jwt.refreshSecret);
    const userId = decoded.sub;

    // Is this token still active? If it was already used or revoked, reject it
    const active = await isRefreshTokenActive(userId, oldRefreshToken);
    if (!active) {
      logger.warn(
        { userId },
        "Attempted reuse of rotated/revoked refresh token",
      );
      // Potential token theft, invalidate All refresh tokens for this user
      await removeAllRefreshTokens(userId);
      throw new UnauthorizedError("Token has been revoked");
    }

    // Rotate: delete old token, generate new pair, store new refresh token
    await removeRefreshToken(userId, oldRefreshToken);
    const { accessToken, refreshToken } = generateTokens(userId);
    await storeRefreshToken(userId, refreshToken);

    return { accessToken, refreshToken };
  } catch (err) {
    if (err instanceof UnauthorizedError) throw err;
    throw new UnauthorizedError("Invalid or expired refresh token");
  }
}

/*
 * Removes ALL refresh tokens for a user.
 * Called when token theft is detected, nuclear option.
 */

async function removeAllRefreshTokens(userId) {
  if (redis) {
    try {
      const keys = await redis.keys(`refresh:${userId}:*`);
      if (keys.length > 0) {
        await redis.del(...keys);
      }
      logger.info({ userId }, "All refresh tokens invalidated");
    } catch (err) {
      logger.warn({ err: err.message }, "Failed to remove all refresh tokens");
    }
  }
}

/*
 * Logout: remove the specific refresh token from Redis.
 * Even if someone has the cookie value, it won't work anymore.
 */

async function logout(userId, refreshToken) {
  if (refreshToken) {
    await removeRefreshToken(userId, refreshToken);
  }
  logger.info({ userId }, "User logged out");
}

async function getMe(userId) {
  const user = await db("users")
    .where({ id: userId })
    .select("id", "email", "name", "created_at")
    .first();

  if (!user) {
    throw new UnauthorizedError("User not found");
  }
  return user;
}

module.exports = { register, login, refresh, logout, getMe };
