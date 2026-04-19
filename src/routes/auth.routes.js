const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const rateLimiter = require("../middleware/rateLimiter");
const { registerSchema, loginSchema } = require("../validators/auth.schema");
const auth = require("../middleware/auth");

const router = Router();

// Login gets strict rate limiting: 5 attempts per 15 minutes
const loginLimiter = rateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes in milliseconds
  max: 30,
  keyPrefix: "ratelimit:login", // Redis key: "ratelimit:login:192.168.1.1"
});

const registerLimiter = rateLimiter({
  windowMs: 60 * 60 * 1000, // 1hour
  max: 30, // 30 registrations per hour per IP, just for testing, in production we might want to lower this
  keyPrefix: "ratelimit:register",
});

// without this validate middleware, raw unvalidated input goes straight to our service
router.post(
  "/register",
  registerLimiter,
  validate(registerSchema),
  controller.register,
);
router.post("/login", loginLimiter, validate(loginSchema), controller.login);
router.post("/refresh", controller.refreshToken);
router.post("/logout", auth, controller.logout);
router.get("/me", auth, controller.getMe);

module.exports = router;
