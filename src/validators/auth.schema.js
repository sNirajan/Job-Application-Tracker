const { z } = require("zod");

const registerSchema = z
  .object({
    email: z.email(),
    password: z.string().min(8, "Password must be at least 8 characters"),
    name: z.string().min(1, "Name is required").max(100),
  })
  .strip();

const loginSchema = z
  .object({
    email: z.email(),
    password: z.string().min(1, "Password is required"),
  })
  .strip();

module.exports = { registerSchema, loginSchema };