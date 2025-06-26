const DynamicPage = require("../models/dynamicPage");

const createPage = async (req, res) => {
  try {
    const { title, slug, content, metaDescription, isPublished } = req.body;
    const page = new DynamicPage({
      title,
      slug,
      content,
      metaDescription,
      isPublished,
    });
    await page.save();
    res.status(201).json(page);
  } catch (err) {
    console.log("Error in creating dynamic page.");
    res.status(400).json({ error: err.message });
  }
};

const getAllPages = async (req, res) => {
  try {
    const pages = await DynamicPage.find();
    res.json(pages);
  } catch (err) {
    console.log("Error in getting all dynamic pages.");
    res.status(500).json({ error: err.message });
  }
};

const getPageBySlug = async (req, res) => {
  try {
    const { slug } = req.params;
    // Only return the page if it is published
    const page = await DynamicPage.findOne({ slug, isPublished: true });
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  } catch (err) {
    console.log("Error in getting page by slug");
    res.status(500).json({ error: err.message });
  }
};

const updatePage = async (req, res) => {
  try {
    const { id } = req.params;
    const { title, slug, content, metaDescription, isPublished } = req.body;
    const page = await DynamicPage.findByIdAndUpdate(
      id,
      {
        title,
        slug,
        content,
        metaDescription,
        isPublished,
        updatedAt: Date.now(),
      },
      { new: true }
    );
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json(page);
  } catch (err) {
    console.log("Error in updating dynamic page.")
    res.status(400).json({ error: err.message });
  }
};

const deletePage = async (req, res) => {
  try {
    const { id } = req.params;
    const page = await DynamicPage.findByIdAndDelete(id);
    if (!page) return res.status(404).json({ error: "Page not found" });
    res.json({ message: "Page deleted" });
  } catch (err) {
    console.log("Error in deleting dynamic page")
    res.status(500).json({ error: err.message });
  }
};

module.exports = {createPage , getAllPages , getPageBySlug , updatePage , deletePage}
