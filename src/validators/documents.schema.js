const { z } = require("zod");

// Only the text fields of the multipart form. The file itself is checked
// by multer (size) and the documents service (real file type).
const uploadDocumentSchema = z
  .object({
    kind: z.enum(["resume", "cover_letter", "other"]).optional().default("resume"),
  })
  .strip();

module.exports = { uploadDocumentSchema };
