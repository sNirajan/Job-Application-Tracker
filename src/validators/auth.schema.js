const { z } = require("zod");

const registerSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8, "Password must be atleast 8 characters"),
    name: z.string().min(1, "Name is required").max(100),
  })
  .strip();

const loginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1, "Password is required"),
  })
  .strip();

const refreshSchema = z
  .object({
    refreshToken: z.string().min(1, "Refresh token is required"),
  })
  .strip();

module.exports = { registerSchema, loginSchema, refreshSchema };
