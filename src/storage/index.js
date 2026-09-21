/*
 * File storage for uploaded documents.
 *
 * Two drivers share one interface so the rest of the app never cares
 * where files live:
 *
 *   save(key, buffer, mimeType)   store a file
 *   remove(key)                   delete a file (missing files are ignored)
 *   sendFile(res, doc)            deliver a file to the browser
 *
 * - local: files on disk. Used in development and tests.
 * - s3:    files in an S3 bucket. Used in production. The browser is
 *          redirected to a short-lived signed URL, so file bytes never
 *          pass through the API server.
 */

const config = require("../config");
const logger = require("../utils/logger");

// Containers lose their disk on every deploy, so local storage in
// production would silently lose uploaded files.
if (config.isProduction && config.storage.driver !== "s3") {
  logger.warn(
    "STORAGE_DRIVER is not 's3' in production. Uploaded files will be lost on redeploy.",
  );
}

const driver =
  config.storage.driver === "s3" ? require("./s3") : require("./local");

module.exports = driver;
