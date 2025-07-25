const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: "uploads/" });
const { isAuthorized, isAdmin } = require("../middlewares/auth");
const { getFooter, updateFooter } = require("../controllers/footer");

router.get("/get", isAuthorized, isAdmin, getFooter);
router.put("/update", isAuthorized,  isAdmin, upload.single("logo"), updateFooter);

module.exports = router;
