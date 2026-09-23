const db = require("../config/database");
const { NotFoundError } = require("../utils/errors");

/*
 * Makes sure an application exists AND belongs to this user.
 *
 * Contacts, reminders and documents all hang off an application, so every
 * one of their endpoints runs this first. Someone who guesses another
 * user's application id gets the same "not found" as a missing one.
 */
async function assertOwnsApplication(userId, applicationId) {
  const application = await db("applications")
    .where({ id: applicationId, user_id: userId })
    .first("id", "company", "role");

  if (!application) {
    throw new NotFoundError("Application not found");
  }

  return application;
}

module.exports = { assertOwnsApplication };
