const { Router } = require("express");
const controller = require("../controllers/auth.controller");
const validate = require("../middleware/validate");
const { registerSchema, loginSchema, refreshSchema } = require("../validators/auth.schema");

const router = Router();

// without this validate middleware, raw unvalidated input goes straight to our service
router.post("/register", validate(registerSchema), controller.register);
router.post("/login", validate(loginSchema), controller.login);
router.post("/refresh", validate(refreshSchema), controller.refreshToken);

module.exports = router;

