const db = require("../config/database");
const { NotFoundError } = require("../utils/errors");
const logger = require("../utils/logger");
const { assertOwnsApplication } = require("./ownership");

// Stages where you're waiting to hear back, so a follow-up makes sense.
const ACTIVE_STATUSES = ["applied", "phone_screen", "technical", "onsite", "offer"];

async function listForApplication(userId, applicationId) {
  await assertOwnsApplication(userId, applicationId);

  return db("reminders")
    .where({ application_id: applicationId })
    .orderByRaw("completed_at IS NOT NULL, remind_at ASC")
    .select("*");
}

async function createReminder(userId, applicationId, { remind_at, note }) {
  await assertOwnsApplication(userId, applicationId);

  const [reminder] = await db("reminders")
    .insert({ application_id: applicationId, remind_at, note: note ?? null })
    .returning("*");

  logger.info({ userId, applicationId, reminderId: reminder.id }, "Reminder created");
  return reminder;
}

/*
 * All of a user's reminders across every application, with the company
 * and role attached so the dashboard can show them without extra calls.
 *
 * "open" = not done yet, soonest first (overdue ones end up on top).
 * "done" = most recently completed first.
 */
async function listForUser(userId, { status }) {
  const query = db("reminders as r")
    .join("applications as a", "a.id", "r.application_id")
    .where("a.user_id", userId)
    .select(
      "r.*",
      "a.company",
      "a.role",
      "a.status as application_status",
    );

  if (status === "done") {
    return query.whereNotNull("r.completed_at").orderBy("r.completed_at", "desc").limit(50);
  }

  return query.whereNull("r.completed_at").orderBy("r.remind_at", "asc");
}

// Reminders are reached through their application, so the join on
// user_id is the ownership check.
async function findOwnedReminder(userId, reminderId) {
  const reminder = await db("reminders as r")
    .join("applications as a", "a.id", "r.application_id")
    .where({ "r.id": reminderId, "a.user_id": userId })
    .first("r.*");

  if (!reminder) throw new NotFoundError("Reminder not found");
  return reminder;
}

async function updateReminder(userId, reminderId, { completed, remind_at, note }) {
  await findOwnedReminder(userId, reminderId);

  const changes = { updated_at: db.fn.now() };
  if (completed !== undefined) changes.completed_at = completed ? db.fn.now() : null;
  if (remind_at !== undefined) changes.remind_at = remind_at;
  if (note !== undefined) changes.note = note;

  const [reminder] = await db("reminders")
    .where({ id: reminderId })
    .update(changes)
    .returning("*");

  return reminder;
}

async function deleteReminder(userId, reminderId) {
  await findOwnedReminder(userId, reminderId);
  await db("reminders").where({ id: reminderId }).del();
  logger.info({ userId, reminderId }, "Reminder deleted");
}

/*
 * Follow-up suggestions, worked out when asked instead of by a background job.
 *
 * An application needs a follow-up when it's still in play, nothing has
 * changed on it for `days` days, and there's no open reminder for it yet.
 * Computing this on read means no scheduler to run and nothing to go stale.
 */
async function getFollowUps(userId, { days }) {
  const rows = await db("applications as a")
    .where("a.user_id", userId)
    .whereIn("a.status", ACTIVE_STATUSES)
    .where("a.updated_at", "<", db.raw("NOW() - make_interval(days => ?)", [days]))
    .whereNotExists(
      db("reminders as r")
        .whereRaw("r.application_id = a.id")
        .whereNull("r.completed_at"),
    )
    .orderBy("a.updated_at", "asc")
    .select(
      "a.id",
      "a.company",
      "a.role",
      "a.status",
      "a.updated_at",
      db.raw("FLOOR(EXTRACT(EPOCH FROM (NOW() - a.updated_at)) / 86400)::int AS days_idle"),
    );

  return rows;
}

module.exports = {
  listForApplication,
  createReminder,
  listForUser,
  updateReminder,
  deleteReminder,
  getFollowUps,
};
