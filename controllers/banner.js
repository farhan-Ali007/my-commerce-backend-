const Banner = require("../models/banner.js");
const { uploadImage, deleteImage } = require("../config/cloudinary.js");

const addBanner = async (req, res) => {
    try {
        const file = req.file
        if (!file) {
            return res.status(400).json({ message: "Image file is required" });
        }

        const { link, isActive } = req.body;
        // console.log("Coming body----->", req.body);
        // console.log("Coming image------>", file)
        const uploadedImage = await uploadImage(file, "banner");

        const newBanner = new Banner({
            image: uploadedImage.url,
            imagePublicId: uploadedImage.public_id,
            link,
            isActive: isActive || true,
        });

        await newBanner.save();
        res.status(201).json({ message: "Banner created successfully", newBanner });
    } catch (error) {
        console.log("Error in adding banner", error)
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getBanners = async (req, res) => {
    try {
        const banners = await Banner.find({isActive:true});
        res.status(200).json(banners);
    } catch (error) {
        console.log("Error in fetching banners", error)
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const updateBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const { link, isActive } = req.body;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ message: "Banner not found" });
        }

        let updatedImage = banner.image;
        let updatedPublicId = banner.publicId;

        if (req.file) {
            await deleteImage(banner.imagePublicId);
            const uploadedImage = await uploadImage(req.file, "banner");
            updatedImage = uploadedImage.url;
            updatedPublicId = uploadedImage.public_id;
        }


        const updatedBanner = await Banner.findByIdAndUpdate(
            id,
            { image: updatedImage, imagePublicId: updatedPublicId, link, isActive: isActive },
            { new: true }
        );

        res.status(200).json({ message: "Banner updated successfully", updatedBanner });
    } catch (error) {
        console.log("Error in updating banner", error)
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const deleteBanner = async (req, res) => {
    try {
        const { id } = req.params;
        const banner = await Banner.findById(id);

        if (!banner) {
            return res.status(404).json({ message: "Banner not found" });
        }
        console.log("Banner----->", banner)
        await deleteImage(banner.imagePublicId);
        await banner.deleteOne();

        res.status(200).json({ message: "Banner deleted successfully" });
    } catch (error) {
        console.log("Error in deleting banner", error)
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

module.exports = { addBanner, updateBanner, getBanners, deleteBanner };
