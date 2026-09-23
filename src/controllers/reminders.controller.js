const reminderService = require("../services/reminders.service");
const asyncHandler = require("../utils/asyncHandler");

// --- Under /applications/:id/reminders ---

const listForApplication = asyncHandler(async (req, res) => {
  const reminders = await reminderService.listForApplication(req.userId, req.params.id);
  res.json({ data: reminders });
});

const create = asyncHandler(async (req, res) => {
  const reminder = await reminderService.createReminder(
    req.userId,
    req.params.id,
    req.validated,
  );
  res.status(201).json({ data: reminder });
});

// --- Under /reminders ---

const listForUser = asyncHandler(async (req, res) => {
  const reminders = await reminderService.listForUser(req.userId, req.validated);
  res.json({ data: reminders });
});

const followUps = asyncHandler(async (req, res) => {
  const suggestions = await reminderService.getFollowUps(req.userId, req.validated);
  res.json({ data: suggestions });
});

const update = asyncHandler(async (req, res) => {
  const reminder = await reminderService.updateReminder(
    req.userId,
    req.params.reminderId,
    req.validated,
  );
  res.json({ data: reminder });
});

const remove = asyncHandler(async (req, res) => {
  await reminderService.deleteReminder(req.userId, req.params.reminderId);
  res.status(204).send();
});

module.exports = { listForApplication, create, listForUser, followUps, update, remove };
