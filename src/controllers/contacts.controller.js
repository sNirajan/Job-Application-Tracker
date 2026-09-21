const contactService = require("../services/contacts.service");
const asyncHandler = require("../utils/asyncHandler");

const list = asyncHandler(async (req, res) => {
  const contacts = await contactService.listContacts(req.userId, req.params.id);
  res.json({ data: contacts });
});

const create = asyncHandler(async (req, res) => {
  const contact = await contactService.createContact(
    req.userId,
    req.params.id,
    req.validated,
  );
  res.status(201).json({ data: contact });
});

const update = asyncHandler(async (req, res) => {
  const contact = await contactService.updateContact(
    req.userId,
    req.params.id,
    req.params.contactId,
    req.validated,
  );
  res.json({ data: contact });
});

const remove = asyncHandler(async (req, res) => {
  await contactService.deleteContact(req.userId, req.params.id, req.params.contactId);
  res.status(204).send();
});

module.exports = { list, create, update, remove };
