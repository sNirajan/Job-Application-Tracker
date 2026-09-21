const { z } = require("zod");

// Full ISO timestamp with timezone, e.g. 2026-09-28T09:00:00.000Z,
// so "9am" means the user's 9am no matter where the server runs.
const remindAt = z.iso.datetime({ offset: true, message: "Enter a valid date and time" });

const createReminderSchema = z
  .object({
    remind_at: remindAt,
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strip();

const updateReminderSchema = z
  .object({
    completed: z.boolean().optional(),
    remind_at: remindAt.optional(),
    note: z.string().trim().max(500).nullable().optional(),
  })
  .strip();

const listRemindersSchema = z
  .object({
    status: z.enum(["open", "done"]).optional().default("open"),
  })
  .strip();

const followUpsSchema = z
  .object({
    days: z.coerce.number().int().min(1).max(90).optional().default(7),
  })
  .strip();

module.exports = {
  createReminderSchema,
  updateReminderSchema,
  listRemindersSchema,
  followUpsSchema,
};
