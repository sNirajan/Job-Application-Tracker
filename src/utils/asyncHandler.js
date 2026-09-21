// Express doesn't catch errors from async functions on its own. Without
// this wrapper a thrown error makes the request hang instead of reaching
// the error handler.
const asyncHandler = (fn) => (req, res, next) =>
  Promise.resolve(fn(req, res, next)).catch(next);

module.exports = asyncHandler;
