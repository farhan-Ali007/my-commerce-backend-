const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: process.env.VERCEL ? "/tmp/uploads" : "uploads/" });
const { isAuthorized, isAdmin } = require("../middlewares/auth");
const { getFooter, updateFooter } = require("../controllers/footer");

router.get("/get", getFooter);
router.put("/update", isAuthorized,  isAdmin, upload.single("logo"), updateFooter);

module.exports = router;
