const Banner = require("../models/banner.js");
const { uploadImage, deleteImage } = require("../config/cloudinary.js");

const addBanner = async (req, res) => {
    try {
        const file = req.file
        if (!file) {
            return res.status(400).json({ message: "Image file is required" });
        }

        const { link, isActive, alt } = req.body;
        // console.log("Coming body----->", req.body);
        // console.log("Coming image------>", file)
        const uploadedImage = await uploadImage(file, "banner");

        const parsedIsActive = (typeof isActive === 'string')
            ? ['true', '1', 'on', 'yes'].includes(isActive.toLowerCase())
            : !!isActive;

        const newBanner = new Banner({
            image: uploadedImage.url,
            imagePublicId: uploadedImage.public_id,
            link,
            isActive: parsedIsActive,
            alt: typeof alt === 'string' ? alt.trim() : ''
        });

        await newBanner.save();
        res.status(201).json({ message: "Banner created successfully", newBanner });
    } catch (error) {
        console.log("Error in adding banner", error)
        res.status(500).json({ message: "Server Error", error: error.message });
    }
};

const getBannersForAdmin = async (req, res) => {
    try {
        const banners = await Banner.find({});
        res.status(200).json(banners);
    } catch (error) {
        console.log("Error in fetching banners", error)
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
        const { link, isActive, alt } = req.body;

        const banner = await Banner.findById(id);
        if (!banner) {
            return res.status(404).json({ message: "Banner not found" });
        }

        let updatedImage = banner.image;
        let updatedPublicId = banner.imagePublicId;

        if (req.file) {
            await deleteImage(banner.imagePublicId);
            const uploadedImage = await uploadImage(req.file, "banner");
            updatedImage = uploadedImage.url;
            updatedPublicId = uploadedImage.public_id;
        }


        const updateDoc = { image: updatedImage, imagePublicId: updatedPublicId };
        if (link !== undefined) updateDoc.link = link;
        if (isActive !== undefined) {
            const parsed = (typeof isActive === 'string')
                ? ['true', '1', 'on', 'yes'].includes(isActive.toLowerCase())
                : !!isActive;
            updateDoc.isActive = parsed;
        }
        if (alt !== undefined) updateDoc.alt = String(alt).trim();

        const updatedBanner = await Banner.findByIdAndUpdate(
            id,
            updateDoc,
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

module.exports = { addBanner, updateBanner, getBanners, deleteBanner , getBannersForAdmin };
