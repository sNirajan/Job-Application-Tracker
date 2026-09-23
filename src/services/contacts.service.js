const db = require("../config/database");
const { NotFoundError } = require("../utils/errors");
const logger = require("../utils/logger");
const { assertOwnsApplication } = require("./ownership");

async function listContacts(userId, applicationId) {
  await assertOwnsApplication(userId, applicationId);

  return db("contacts")
    .where({ application_id: applicationId })
    .orderBy("created_at", "asc")
    .select("*");
}

async function createContact(userId, applicationId, data) {
  await assertOwnsApplication(userId, applicationId);

  const [contact] = await db("contacts")
    .insert({ ...data, application_id: applicationId })
    .returning("*");

  logger.info({ userId, applicationId, contactId: contact.id }, "Contact created");
  return contact;
}

async function updateContact(userId, applicationId, contactId, data) {
  await assertOwnsApplication(userId, applicationId);

  const [contact] = await db("contacts")
    .where({ id: contactId, application_id: applicationId })
    .update({ ...data, updated_at: db.fn.now() })
    .returning("*");

  if (!contact) throw new NotFoundError("Contact not found");
  return contact;
}

async function deleteContact(userId, applicationId, contactId) {
  await assertOwnsApplication(userId, applicationId);

  const deleted = await db("contacts")
    .where({ id: contactId, application_id: applicationId })
    .del();

  if (deleted === 0) throw new NotFoundError("Contact not found");
  logger.info({ userId, applicationId, contactId }, "Contact deleted");
}

module.exports = { listContacts, createContact, updateContact, deleteContact };
