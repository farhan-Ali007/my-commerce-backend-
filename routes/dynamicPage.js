const express = require("express");
const router = express.Router();
const {
  createPage,
  getAllPages,
  getPageBySlug,
  updatePage,
  deletePage,
} = require("../controllers/dynamicPage");

router.post("/", createPage);

router.get("/", getAllPages);

router.get("/:slug", getPageBySlug);

router.put("/:id", updatePage);

router.delete("/:id", deletePage);

module.exports = router;
