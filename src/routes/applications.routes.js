const { Router } = require("express");
const controller = require("../controllers/applications.controller");
const validate = require("../middleware/validate");
const {
  createApplicationSchema,
  updateApplicationSchema,
  transitionStatusSchema,
  listApplicationsSchema,
} = require("../validators/applications.schema");
const router = Router();

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

module.exports = router;
