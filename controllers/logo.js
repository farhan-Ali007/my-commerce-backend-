const Logo = require("../models/logo");
const { uploadImage, deleteImage } = require("../config/cloudinary");

const createLogo = async (req, res) => {
  try {
    const { isEnable } = req.body;
    const file = req.file;
    if (!file) {
      return res.status(400).json({ message: "Logo is required" });
    }
    const uploadedImage = await uploadImage(file);
    // console.log("Uploaded image", uploadedImage);
    const newLogo = await Logo.create({
      image: uploadedImage.url,
      image_public_id: uploadedImage.public_id,
      isEnable: isEnable,
    });
    return res.status(201).json(newLogo);
  } catch (error) {
    console.error("Error creating logo:", error);
    return res.status(500).json({ message: "Failed to create logo" });
  }
};

const updateLogo = async (req, res) => {
  const { id } = req.params;
  try {
    const { isEnable } = req.body;
    const file = req.file;
    const oldLogo = await Logo.findById(id);

    if (!oldLogo) {
      return res.status(404).json({ message: "Logo not found" });
    }

    let updateData = { isEnable: isEnable };

    // If a new file is uploaded, update the image
    if (file) {
      // Delete old image from cloudinary if it exists
      if (oldLogo.image_public_id) {
        await deleteImage(oldLogo.image_public_id);
      }

      const uploadedImage = await uploadImage(file);
      updateData.image = uploadedImage.url;
      updateData.image_public_id = uploadedImage.public_id;
    }

    const logo = await Logo.findByIdAndUpdate(id, updateData, { new: true });
    return res.status(200).json(logo);
  } catch (error) {
    console.error("Error updating logo:", error);
    return res.status(500).json({ message: "Failed to update logo" });
  }
};

const getUserLogo = async (req, res) => {
  try {
    const logo = await Logo.findOne({ isEnable: true });
    return res.status(200).json({ logo });
  } catch (error) {
    console.error("Error fetching logo:", error);
    return res.status(500).json({ message: "Failed to fetch logos", error });
  }
};

const getAdminLogos = async (req, res) => {
  try {
    const logos = await Logo.find();
    return res.status(200).json({ logos });
  } catch (error) {
    console.error("Error fetching logos:", error);
    return res.status(500).json({ message: "Failed to fetch logos" });
  }
};

const deleteLogo = async (req, res) => {
  const { id } = req.params;
  try {
    const logo = await Logo.findById(id);
    if (logo.image_public_id) {
      await deleteImage(logo.image_public_id);
    }
    await logo.deleteOne();
    return res.status(200).json({ message: "Logo deleted successfully" });
  } catch (error) {
    console.error("Error deleting logo:", error);
    return res.status(500).json({ message: "Failed to delete logo" });
  }
};

module.exports = {
  createLogo,
  updateLogo,
  getUserLogo,
  getAdminLogos,
  deleteLogo,
};
