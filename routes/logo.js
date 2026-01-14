const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: process.env.VERCEL ? "/tmp/uploads" : "uploads/" });
const { isAuthorized, isAdmin } = require("../middlewares/auth");
const {
  createLogo,
  updateLogo,
  getUserLogo,
  getAdminLogos,
  deleteLogo,
} = require("../controllers/logo");

router.post("/create",isAuthorized, isAdmin ,upload.single("image"), createLogo);
router.put("/:id",isAuthorized , isAdmin,upload.single("image"), updateLogo);
router.get("/user", getUserLogo);
router.get("/admin", isAuthorized, isAdmin, getAdminLogos);
router.delete("/:id", isAuthorized, isAdmin, deleteLogo);

module.exports = router;
