/*
 * Stats controller.
 * Same thin pattern as applications (pull userId, call service, send response) */

const statsService = require("../services/stats.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

const overview = asyncHandler(async (req, res) => {
  const stats = await statsService.getOverview(req.userId);
  res.json({ data: stats });
});

const weekly = asyncHandler(async (req, res) => {
  const stats = await statsService.getWeekly(req.userId);
  res.json({ data: stats });
});

module.exports = { overview, weekly };