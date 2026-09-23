/*
 * File storage for uploaded documents.
 *
 * Two drivers share one interface so the rest of the app never cares
 * where files live:
 *
 *   save(key, buffer, mimeType)   store a file
 *   remove(key)                   delete a file (missing files are ignored)
 *   read(key)                     get a file's bytes (used for previews)
 *   sendFile(res, doc)            send a file to the browser as a download
 *
 * - local: files on disk. Used in development and tests.
 * - s3:    files in an S3 bucket. Used in production. The browser is
 *          redirected to a short-lived signed URL, so file bytes never
 *          pass through the API server.
 */

const config = require("../config");
const logger = require("../utils/logger");

// Refuse to start with a storage setup that would lose files. A failed
// start is loud (the deploy fails and the old version keeps running);
// quietly writing resumes to a container's disk is not.
if (config.isProduction && !process.env.STORAGE_DRIVER) {
  throw new Error(
    "STORAGE_DRIVER must be set in production ('s3', or 'local' with a persistent volume)",
  );
}
if (config.storage.driver === "s3" && !config.storage.s3Bucket) {
  throw new Error("S3_BUCKET must be set when STORAGE_DRIVER is 's3'");
}
if (config.isProduction && config.storage.driver === "local") {
  logger.warn(
    { uploadDir: config.storage.localDir },
    "Using local file storage in production. Make sure this folder is on a persistent volume.",
  );
}

const driver =
  config.storage.driver === "s3" ? require("./s3") : require("./local");

module.exports = driver;
