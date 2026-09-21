const { Router } = require("express");
const controller = require("../controllers/applications.controller");
const contacts = require("../controllers/contacts.controller");
const reminders = require("../controllers/reminders.controller");
const documents = require("../controllers/documents.controller");
const validate = require("../middleware/validate");
const validateUuidParam = require("../middleware/validateUuidParam");
const { uploadSingleFile } = require("../middleware/upload");
const {
  createApplicationSchema,
  updateApplicationSchema,
  transitionStatusSchema,
  listApplicationsSchema,
} = require("../validators/applications.schema");
const { createContactSchema, updateContactSchema } = require("../validators/contacts.schema");
const { createReminderSchema } = require("../validators/reminders.schema");
const { uploadDocumentSchema } = require("../validators/documents.schema");

const router = Router();

router.param("id", validateUuidParam);
router.param("contactId", validateUuidParam);
router.param("documentId", validateUuidParam);

router.get("/", validate(listApplicationsSchema, "query"), controller.list);

router.post("/", validate(createApplicationSchema), controller.create);

router.get("/:id", controller.get);

router.get("/:id/timeline", controller.getTimeline);

router.patch("/:id", validate(updateApplicationSchema), controller.update);

router.delete("/:id", controller.remove);


router.patch(
  "/:id/status",
  validate(transitionStatusSchema),
  controller.transitionStatus,
);

// --- Contacts ---
router.get("/:id/contacts", contacts.list);
router.post("/:id/contacts", validate(createContactSchema), contacts.create);
router.patch("/:id/contacts/:contactId", validate(updateContactSchema), contacts.update);
router.delete("/:id/contacts/:contactId", contacts.remove);

// --- Reminders (listing across all applications lives under /reminders) ---
router.get("/:id/reminders", reminders.listForApplication);
router.post("/:id/reminders", validate(createReminderSchema), reminders.create);

// --- Documents (multer runs first so the form's text fields are in req.body) ---
router.get("/:id/documents", documents.list);
router.post(
  "/:id/documents",
  uploadSingleFile,
  validate(uploadDocumentSchema),
  documents.upload,
);
router.get("/:id/documents/:documentId/download", documents.download);
router.delete("/:id/documents/:documentId", documents.remove);

module.exports = router;
