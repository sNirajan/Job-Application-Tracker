const { Router } = require("express");
const controller = require("../controllers/reminders.controller");
const validate = require("../middleware/validate");
const validateUuidParam = require("../middleware/validateUuidParam");
const {
  updateReminderSchema,
  listRemindersSchema,
  followUpsSchema,
} = require("../validators/reminders.schema");

const router = Router();

router.param("reminderId", validateUuidParam);

// All of the user's reminders, across every application
router.get("/", validate(listRemindersSchema, "query"), controller.listForUser);

// Applications that have gone quiet and could use a follow-up
router.get("/follow-ups", validate(followUpsSchema, "query"), controller.followUps);

router.patch("/:reminderId", validate(updateReminderSchema), controller.update);
router.delete("/:reminderId", controller.remove);

module.exports = router;
