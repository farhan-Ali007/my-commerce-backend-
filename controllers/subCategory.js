const SubCategory = require('../models/subCategory.js');
const Category = require('../models/category.js')
const slugify = require('slugify')
const { uploadImage, deleteImage } = require('../config/cloudinary.js');


const createSub = async (req, res) => {
    try {
        const { name, category } = req.body;
        const file = req.file;

        if (!name) return res.status(400).json({ message: "Subcategory name is required." });
        if (!category) return res.status(400).json({ message: "Parent category is required." });

        const existingCategory = await Category.findOne({ name: category });
        if (!existingCategory) return res.status(404).json({ message: "Category not found." });

        const subCategoryName = name.toLowerCase()
        const subCategorySlug = slugify(subCategoryName, { lower: true, strict: true });

        const existingSubCategory = await SubCategory.findOne({
            name:subCategoryName,
            slug:subCategorySlug,
            category: existingCategory._id
        });
        if (existingSubCategory) {
            return res.status(400).json({ message: "Subcategory already exists." });
        }

        let imageUrl = "";
        let imagePublicId = "";
        if (file) {
            try {
                const uploadedImage = await uploadImage(file);
                imageUrl = uploadedImage.url;
                imagePublicId = uploadedImage.public_id;
            } catch (error) {
                console.log("Error uploading subcategory image", error);
            }
        }

        const newSubCategory = new SubCategory({
            name: name.toLowerCase(),
            category: existingCategory._id,
            image: imageUrl,
            imagePublicId: imagePublicId
        });

        await newSubCategory.save();

        res.status(201).json({
            success: true,
            newSubCategory,
            message: "Subcategory created successfully."
        });

    } catch (error) {
        console.log("Error in creating subcategory", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllSubs = async (req, res) => {
    try {
        const subCategories = await SubCategory.find({})
            .populate('category', 'name image')
            .sort({ createdAt: -1 });
        res.status(200).json({
            success: true,
            message: "Subcategories fetched successfully.",
            subCategories
        });
    } catch (error) {
        console.log("Error in fetching subcategories", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const deleteSub = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Subcategory being deleted ----->", id);

        const subCategory = await SubCategory.findById(id);
        if (!subCategory) return res.status(404).json({ message: "Subcategory not found." });

        if (subCategory.imagePublicId) {
            try {
                await deleteImage(subCategory.imagePublicId);
                console.log("Image deleted from Cloudinary successfully.");
            } catch (error) {
                console.log("Error deleting image from Cloudinary", error);

            }
        }
        const deletedSub = await SubCategory.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: "Subcategory deleted.",
            deletedSub
        });

    } catch (error) {
        console.log("Error in deleting subcategory", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { createSub, getAllSubs, deleteSub };
