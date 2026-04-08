const { z } = require("zod");
const { STATUSES } = require("../utils/statusMachine");

const createApplicationSchema = z
  .object({
    company: z.string().min(1, "Company name is required").max(255),
    role: z.string().min(1, "Role is required").max(255),
    url: z.url().optional(),
    status: z.enum(STATUSES).default("wishlist"),
    salary_min: z.number().int().positive().optional(),
    salary_max: z.number().int().positive().optional(),
    location: z.string().max(255).optional(),
    notes: z.string().optional(),
    applied_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
  })
  .strip();

const updateApplicationSchema = z
  .object({
    company: z.string().min(1).max(255).optional(),
    role: z.string().min(1).max(255).optional(),
    url: z.url().optional(),
    salary_min: z.number().int().positive().optional(),
    salary_max: z.number().int().positive().optional(),
    location: z.string().max(255).optional(),
    notes: z.string().optional(),
    applied_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
  })
  .strip();

const transitionStatusSchema = z
  .object({
    status: z.enum(STATUSES),
    notes: z.string().optional(),
  })
  .strip();

const listApplicationsSchema = z
  .object({
    page: z.coerce.number().int().positive().optional().default(1),
    per_page: z.coerce.number().int().min(1).max(100).optional().default(20),
    status: z.enum(STATUSES).optional(),
    company: z.string().optional(),
    sort: z
      .enum(["created_at", "updated_at", "applied_at", "company"])
      .optional()
      .default("created_at"),
    order: z.enum(["asc", "desc"]).optional().default("desc"),
  })
  .strip();

module.exports = {
  createApplicationSchema,
  updateApplicationSchema,
  transitionStatusSchema,
  listApplicationsSchema,
};
