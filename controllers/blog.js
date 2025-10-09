const Blog = require("../models/blog");

// Create a new blog post
const createBlog = async (req, res) => {
  try {
    const {
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      featuredImage,
      author,
      category,
      tags,
      isPublished,
    } = req.body;

    const blog = new Blog({
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      featuredImage,
      author,
      category,
      tags,
      isPublished,
    });

    await blog.save();
    res.status(201).json(blog);
  } catch (err) {
    // Error logged for debugging
    res.status(400).json({ error: err.message });
  }
};

// Get all blog posts (admin - includes drafts)
const getAllBlogs = async (req, res) => {
  try {
    const blogs = await Blog.find().sort({ createdAt: -1 });
    res.json(blogs);
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Get published blog posts (public)
const getPublishedBlogs = async (req, res) => {
  try {
    const { category, tag, limit = 10, page = 1 } = req.query;
    const query = { isPublished: true };

    if (category) query.category = category;
    if (tag) query.tags = tag;

    const skip = (parseInt(page) - 1) * parseInt(limit);

    const blogs = await Blog.find(query)
      .sort({ publishedAt: -1 })
      .limit(parseInt(limit))
      .skip(skip);

    const total = await Blog.countDocuments(query);

    res.json({
      blogs,
      pagination: {
        total,
        page: parseInt(page),
        pages: Math.ceil(total / parseInt(limit)),
      },
    });
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Get single blog post by slug
const getBlogBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    const blog = await Blog.findOne({ slug, isPublished: true });

    if (!blog) return res.status(404).json({ error: "Blog post not found" });

    // Increment view count
    blog.viewCount += 1;
    await blog.save();

    res.json(blog);
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Get single blog post by ID (admin)
const getBlogById = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findById(id);

    if (!blog) return res.status(404).json({ error: "Blog post not found" });

    res.json(blog);
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Update blog post
const updateBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const {
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      featuredImage,
      author,
      category,
      tags,
      isPublished,
    } = req.body;

    const updateData = {
      title,
      slug,
      content,
      excerpt,
      metaDescription,
      featuredImage,
      author,
      category,
      tags,
      isPublished,
      updatedAt: Date.now(),
    };

    // Set publishedAt if publishing for the first time
    const existingBlog = await Blog.findById(id);
    if (isPublished && !existingBlog.isPublished && !existingBlog.publishedAt) {
      updateData.publishedAt = Date.now();
    }

    const blog = await Blog.findByIdAndUpdate(id, updateData, { new: true });

    if (!blog) return res.status(404).json({ error: "Blog post not found" });

    res.json(blog);
  } catch (err) {
    // Error logged for debugging
    res.status(400).json({ error: err.message });
  }
};

// Delete blog post
const deleteBlog = async (req, res) => {
  try {
    const { id } = req.params;
    const blog = await Blog.findByIdAndDelete(id);

    if (!blog) return res.status(404).json({ error: "Blog post not found" });

    res.json({ message: "Blog post deleted successfully" });
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Get all categories (unique)
const getCategories = async (req, res) => {
  try {
    const categories = await Blog.distinct("category");
    res.json(categories);
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

// Get all tags (unique)
const getTags = async (req, res) => {
  try {
    const tags = await Blog.distinct("tags");
    res.json(tags);
  } catch (err) {
    // Error logged for debugging
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  createBlog,
  getAllBlogs,
  getPublishedBlogs,
  getBlogBySlug,
  getBlogById,
  updateBlog,
  deleteBlog,
  getCategories,
  getTags,
};
