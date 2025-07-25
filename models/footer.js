const mongoose = require("mongoose");

const footerSchema = new mongoose.Schema({
  logoUrl: { type: String, required: true }, // Footer logo image URL
  aboutText: { type: String, required: true }, // Tagline or about text
  quickLinks: [
    {
      label: { type: String, required: true }, // e.g. "About Us"
      url: { type: String, required: true }    // e.g. "/about"
    }
  ],
  contactInfo: {
    address: { type: String, required: true },
    whatsapp: { type: String }, // e.g. "0307-1111832"
    phone: { type: String },
    email: { type: String }
  },
  socialLinks: [
    {
      icon: { type: String, required: true }, // e.g. "facebook", "instagram", "tiktok"
      url: { type: String, required: true }
    }
  ],
  copyright: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model("Footer", footerSchema);
