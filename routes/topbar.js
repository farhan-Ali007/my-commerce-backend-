const express = require("express");
const router = express.Router();

const {
  addBarText,
  updateBarText,
  getAllBarTexts,
  deleteBarText,
  getActiveBars,
} = require("../controllers/topbar");
const { isAuthorized, isAdmin } = require("../middlewares/auth");

router.get("/actives", getActiveBars);
router.post("/add", isAuthorized, isAdmin, addBarText);
router.get("/all", isAuthorized, isAdmin, getAllBarTexts);
router.put("/:id", isAuthorized, isAdmin, updateBarText);
router.delete("/:id", isAuthorized, isAdmin, deleteBarText);

module.exports = router;
