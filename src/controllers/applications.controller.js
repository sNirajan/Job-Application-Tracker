/*
 * Applications controller.
 *
 * This is the thinnest layer in the app. Each function does exactly 3 things:
 * 1. Pull data from the request (params, body, user)
 * 2. Call the service
 * 3. Send the response
 *
 *
 * Every function is wrapped in asyncHandler because Express doesn't catch
 * errors from async functions on its own,  without it, a thrown error
 * makes the request hang forever instead of reaching the error handler.
 */

const applicationService = require("../services/applications.service");

const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

// 201 = "I created something new." Different from 200 = "Here's what you asked for."
const create = asyncHandler(async (req, res) => {
  const application = await applicationService.createApplication(
    req.userId,
    req.validated
  );
  res.status(201).json({ data: application });
});

// list already returns { data, pagination } from the service, so no wrapping needed
const list = asyncHandler(async (req, res) => {
  const result = await applicationService.listApplications(
    req.userId,
    req.validated
  );
  res.json(result);
});

const get = asyncHandler(async (req, res) => {
  const application = await applicationService.getApplication(
    req.userId,
    req.params.id
  );
  res.json({ data: application });
});

const update = asyncHandler(async (req, res) => {
  const application = await applicationService.updateApplication(
    req.userId,
    req.params.id,
    req.validated
  );
  res.json({ data: application });
});

const transitionStatus = asyncHandler(async (req, res) => {
  const application = await applicationService.transitionStatus(
    req.userId,
    req.params.id,
    req.validated
  );
  res.json({ data: application });
});

// 204 = "Success, nothing to send back." Standard response for DELETE.
const remove = asyncHandler(async (req, res) => {
  await applicationService.deleteApplication(
    req.userId,
    req.params.id
  );
  res.status(204).send();
});

const getTimeline = asyncHandler(async (req, res) => {
  const events = await applicationService.getTimeline(
    req.userId,
    req.params.id
  );
  res.json({ data: events });
});

module.exports = { create, list, get, update, transitionStatus, remove, getTimeline };