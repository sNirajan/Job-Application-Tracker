const Redis = require("ioredis");
const config = require("./index");
const logger = require("../utils/logger");

let redis = null;

if (!config.isTest) {
  const redisUrl = config.redisUrl;
  const options = {
    maxRetriesPerRequest: 3,
    retryStrategy: (times) => {
      if (times > 5) return null; // Stop retrying after 5 attempts
      return Math.min(times * 500, 2000);
    },
  };

  // Upstash and other cloud Redis providers use rediss:// (TLS)
  if (redisUrl.startsWith("rediss://")) {
    options.tls = { rejectUnauthorized: false };
  }

  redis = new Redis(redisUrl, options);

  redis.on("connect", () => {
    logger.info("Redis connected");
  });

  redis.on("error", (err) => {
    logger.error({ err: err.message }, "Redis connection error");
  });
}

module.exports = redis;