/*
 * Stats routes.
 * No validation middleware needed as these endpoints take no input,
 * they just read data for the authenticated user.
 */

const { Router } = require("express");
const controller = require("../controllers/stats.controller");

const router = Router();

router.get("/overview", controller.overview);
router.get("/weekly", controller.weekly);

module.exports = router;