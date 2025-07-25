const Footer = require("../models/footer");
const {uploadImage , deleteImage} = require('../config/cloudinary')

// Get footer data
const getFooter = async (req, res) => {
  try {
    const footer = await Footer.findOne();
    if (!footer) {
      return res.status(404).json({ message: "Footer not found." });
    }
    res.status(200).json({ footer });
  } catch (error) {
    console.error("Error fetching footer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

// Update footer data (with optional logo upload)
const updateFooter = async (req, res) => {
  try {
    let updateData = { ...req.body };

    // Parse JSON fields if they are strings
    if (typeof updateData.quickLinks === "string") {
      updateData.quickLinks = JSON.parse(updateData.quickLinks);
    }
    if (typeof updateData.contactInfo === "string") {
      updateData.contactInfo = JSON.parse(updateData.contactInfo);
    }
    if (typeof updateData.socialLinks === "string") {
      updateData.socialLinks = JSON.parse(updateData.socialLinks);
    }

    // Handle logo upload if file is present
    if (req.file) {
      const result = await uploadImage(req.file, "footer");
      updateData.logoUrl = result.url;
    }

    // Find and update the footer (assume only one footer doc)
    const footer = await Footer.findOneAndUpdate({}, updateData, {
      new: true,
      upsert: true, // create if not exists
    });

    res.status(200).json({ message: "Footer updated.", footer });
  } catch (error) {
    console.error("Error updating footer:", error);
    res.status(500).json({ message: "Internal server error." });
  }
};

module.exports = {
  getFooter,
  updateFooter,
};