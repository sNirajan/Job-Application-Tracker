const logger = require('../utils/logger');
const { AppError } = require('../utils/errors');

// eslint-disable-next-line no-unused-vars
function errorHandler(err, req, res, next) {
  if (err instanceof AppError) {
    logger.warn(
      { requestId: req.id, statusCode: err.statusCode, code: err.code, path: req.path },
      err.message
    );

    return res.status(err.statusCode).json({
      error: {
        code: err.code,
        message: err.message,
        ...(err.details && { details: err.details }),
      },
    });
  }

  logger.error(
    { requestId: req.id, err, path: req.path },
    'Unhandled error'
  );

  return res.status(500).json({
    error: {
      code: 'INTERNAL_ERROR',
      message: 'Something went wrong',
    },
  });
}

module.exports = errorHandler;