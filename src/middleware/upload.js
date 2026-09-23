const multer = require("multer");
const { ValidationError } = require("../utils/errors");

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB

/*
 * Accepts one file in the "file" field and keeps it in memory.
 *
 * Memory is fine at 5 MB: the file is checked, then handed to storage
 * (disk or S3) straight away. Nothing is written until it passes checks.
 */
const multerSingle = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: MAX_FILE_SIZE, files: 1, fields: 5 },
}).single("file");

// Turns multer's own errors into our standard 422 response
function uploadSingleFile(req, res, next) {
  multerSingle(req, res, (err) => {
    if (!err) return next();

    if (err instanceof multer.MulterError) {
      const message =
        err.code === "LIMIT_FILE_SIZE"
          ? "File is too large. The limit is 5 MB"
          : "Upload one file in the 'file' field";
      return next(new ValidationError("Upload failed", [{ field: "file", message }]));
    }

    next(err);
  });
}

module.exports = { uploadSingleFile, MAX_FILE_SIZE };
