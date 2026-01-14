const express = require("express");
const router = express.Router();
const multer = require("multer");
const upload = multer({ dest: process.env.VERCEL ? "/tmp/uploads" : "uploads/" });
const { isAuthorized, isAdmin } = require("../middlewares/auth");
const {
  createCategory,
  getAllCategories,
  deleteCategory,
  updateMenuStatus,
  editCategory,
  getMenuCategories,
} = require("../controllers/category");

router.post(
  "/create",
  isAuthorized,
  isAdmin,
  upload.single("image"),
  createCategory
);
router.get("/getAll", getAllCategories);
router.get("/menu", getMenuCategories);
router.put("/menu/:id", isAuthorized, isAdmin, updateMenuStatus);
router.put("/edit/:id", isAuthorized, isAdmin, upload.single("image"), editCategory);
router.delete("/:id", isAuthorized, isAdmin, deleteCategory);

module.exports = router;
