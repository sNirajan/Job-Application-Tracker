const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const rateLimiter = require("../middleware/rateLimiter");
const { registerSchema, loginSchema, refreshSchema } = require("../validators/auth.schema");

const router = Router();

// Login gets strict rate limiting: 5 attempts per 15 minutes
const loginLimiter = rateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
    max: 5,
    keyPrefix: "ratelimit:login", // Redis key: "ratelimit:login:192.168.1.1" 
});

const registerLimiter = rateLimiter({
    windowMs: 60 * 60 * 1000,   // 1hour
    max: 3,                     // 3 registrations per hour per IP
    keyPrefix: "ratelimit:register",
});

// without this validate middleware, raw unvalidated input goes straight to our service
router.post("/register", registerLimiter, validate(registerSchema), controller.register);
router.post("/login", loginLimiter, validate(loginSchema), controller.login);
router.post("/refresh", validate(refreshSchema), controller.refreshToken);

module.exports = router;

