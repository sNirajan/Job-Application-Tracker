const { z } = require("zod");
const { STATUSES } = require("../utils/statusMachine");

// Only web links. A plain webUrl() also accepts "javascript:..." which
// would run code when the saved link is clicked.
// salary columns are Postgres integers (max ~2.1 billion); anything past
// this is a typo and would otherwise crash the insert with a 500.
const salary = () =>
  z.number().int().positive().max(1_000_000_000, "Salary looks too high");

const webUrl = () => z.url({ protocol: /^https?$/, message: "Enter a valid http(s) URL" });

const createApplicationSchema = z
  .object({
    company: z.string().min(1, "Company name is required").max(255),
    role: z.string().min(1, "Role is required").max(255),
    url: webUrl().optional(),
    status: z.enum(STATUSES).default("wishlist"),
    salary_min: salary().optional(),
    salary_max: salary().optional(),
    location: z.string().max(255).optional(),
    notes: z.string().optional(),
    applied_at: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format")
      .optional(),
  })
  .strip();

// Fields can be sent as null to clear them (e.g. removing a salary).
const dateString = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, "Date must be YYYY-MM-DD format");

const updateApplicationSchema = z
  .object({
    company: z.string().min(1).max(255).optional(),
    role: z.string().min(1).max(255).optional(),
    url: webUrl().nullable().optional(),
    salary_min: salary().nullable().optional(),
    salary_max: salary().nullable().optional(),
    location: z.string().max(255).nullable().optional(),
    notes: z.string().nullable().optional(),
    applied_at: dateString.nullable().optional(),
  })
  .strip()
  .refine(
    (data) =>
      data.salary_min == null ||
      data.salary_max == null ||
      data.salary_min <= data.salary_max,
    {
      message: "Minimum salary can't be more than maximum salary",
      path: ["salary_max"],
    },
  );

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
