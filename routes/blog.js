const express = require("express");
const router = express.Router();
const {
  createBlog,
  getAllBlogs,
  getPublishedBlogs,
  getBlogBySlug,
  getBlogById,
  updateBlog,
  deleteBlog,
  getCategories,
  getTags,
} = require("../controllers/blog");

// Admin routes
router.post("/", createBlog); // Create blog post
router.get("/admin/all", getAllBlogs); // Get all posts (including drafts)
router.get("/admin/:id", getBlogById); // Get single post by ID
router.put("/:id", updateBlog); // Update blog post
router.delete("/:id", deleteBlog); // Delete blog post

// Public routes
router.get("/published", getPublishedBlogs); // Get published posts with pagination
router.get("/categories", getCategories); // Get all categories
router.get("/tags", getTags); // Get all tags
router.get("/:slug", getBlogBySlug); // Get single published post by slug

module.exports = router;
