const { NotFoundError } = require("../utils/errors");

const UUID_PATTERN =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/*
 * For router.param(): a malformed id can't match any row, so answer 404
 * right away instead of letting Postgres throw an "invalid uuid" error
 * that would surface as a 500.
 */
function validateUuidParam(req, res, next, value) {
  if (!UUID_PATTERN.test(value)) {
    return next(new NotFoundError("Resource not found"));
  }
  next();
}

module.exports = validateUuidParam;
