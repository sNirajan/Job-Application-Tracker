/*
 * Redis-backed rate limiter.
 *
 * This is a factory function, we call it with options and it returns
 * a middleware. This way we can create different limiters for different
 * routes:
 *
 *   rateLimiter({ windowMs: 15 * 60 * 1000, max: 5 })  → login (strict)
 *   rateLimiter({ windowMs: 60 * 1000, max: 100 })      → general API (loose)
 *
 * Uses the client's IP address as the identifier. In production behind
 * a load balancer, we'd use req.headers['x-forwarded-for'] instead.
 */

const redis = require("../config/redis");
const { TooManyRequestsError } = require("../utils/errors");

function rateLimiter({ windowMs, max, keyPrefix = "ratelimit" }) {
  // Converts milliseconds to seconds for Redis TTL
  const windowSeconds = Math.floor(windowMs / 1000);

  return async (req, res, next) => {
    // If redis isn't available, let the request through
    // Better to allow requests than to lock everyone out
    if (!redis) return next();

    // Builds the key: "ratelimit:login:192.168.1.1"
    // Each IP + route combo gets its own counter

    const ip = req.ip;
    const key = `${keyPrefix}:${ip}`;

    try {
      // INCR atomically increments the counter and returns the new value.
      // If the key doesn't exist, Redis creates it with value 1.
      // "Atomically" means even if two requests arrive at the exact same
      // millisecond, Redis processes them one at a time. No race conditions.
      const current = await redis.incr(key);

      // First request? Set the expiry window
      // We only set TTL on the first request (current ===1) because
      // setting it on every request would reset the window each time
      if (current === 1) {
        await redis.expire(key, windowSeconds);
      }
      // Tell the client their limits in response headers
      // This is standard practice, clients can adjust their behavior
      res.setHeader("X-RateLimit-Limit", max);
      res.setHeader("X-RateLimit-Remaining", Math.max(0, max - current));

      // Over the limit? Block the request
      if (current > max) {
        // Tell the client how long to wait
        const ttl = await redis.ttl(key);
        res.setHeader("Retry-After", ttl);

        return next(
          new TooManyRequestsError(
            `Too many attempts. Try again in ${ttl} seconds.`,
          ),
        );
      }

      next();
    } catch (err) {
      // Redis error. Let the request through rather than blocking everyone
      next();
    }
  };
}

module.exports = rateLimiter;
