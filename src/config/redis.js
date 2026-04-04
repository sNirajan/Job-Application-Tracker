/*
 * Redis connection.
 *
 * Same pattern as database.js, one shared connection for the whole app.
 * ioredis handles reconnection automatically if Redis goes down temporarily.
 *
 * In test environment, we don't connect to Redis, tests run without it.
 * This keeps test setup simple and fast.
 */

const Redis = require("ioredis");
const config = require("./index");
const logger = require("../utils/logger");

let redis = null;

if (!config.isTest) {
    redis = new Redis(config.redisUrl, {
        maxRetriesPerRequest: 3,
    });

    redis.on("connect", () => {
        logger.info("Redis connected");
    });

    redis.on("error", (err) => {
        logger.error({ err: err.message }, "Redis connection error");
    });
}

module.exports = redis;