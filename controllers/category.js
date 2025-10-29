const Category = require('../models/category.js')
const { uploadImage, deleteImage } = require('../config/cloudinary.js')
const Sub = require('../models/subCategory.js')
const slugify = require('slugify');

const createCategory = async (req, res) => {
    try {
        const { name, metaDescription, alt } = req.body;
        const file = req.file;
        if (!name)
            return res.status(400).json({ message: "Category name is required." })

        const categoryName = name.toLowerCase();
        const categorySlug = slugify(categoryName, { lower: true, strict: true });

        if (!file)
            return res.status(400).json({ message: "Category image is required." })

        let imageUrl = "";
        let imagePublicId = "";
        try {
            const uploadedImage = await uploadImage(file);
            imageUrl = uploadedImage.url;
            imagePublicId = uploadedImage.public_id;
        } catch (error) {
            return res.status(500).json({ message: "Failed to upload category image." });
        }

        const newCategory = new Category({
            name: categoryName,
            slug: categorySlug,
            Image: imageUrl,
            alt: typeof alt === 'string' ? alt.trim() : "",
            metaDescription: metaDescription || "",
            imagePublicId: imagePublicId || ""
        });
        await newCategory.save();

        return res.status(200).json({
            success: true,
            newCategory,
            message: "Category created."
        });

    } catch (error) {
        console.log("Error in creating category", error);
        return res.status(500).json({ message: "Internal server error" });
    }
}

const getAllCategories = async (req, res) => {
    try {
        // Fetch all categories
        const categories = await Category.find({})
            .select("name slug Image alt menu metaDescription")
            .sort({ createdAt: -1 });

        // For each category, populate its subcategories
        const categoriesWithSubcategories = await Promise.all(
            categories.map(async (category) => {
                const subcategories = await Sub.find({ category: category._id }).select("name slug ");
                return {
                    ...category.toObject(),
                    subcategories
                };
            })
        );

        res.status(200).json({
            success: true,
            message: "Categories fetched successfully",
            categories: categoriesWithSubcategories
        });
    } catch (error) {
        console.log("Error in fetching all categories", error);
        res.status(500).json({ message: "Internal server error." });
    }
};

const deleteCategory = async (req, res) => {
    try {
        const { id } = req.params;
        console.log("Category id being deleting----->", id)

        const category = await Category.findById(id)

        if (!category)
            return res.status(404).json({ message: "Category not found" })

        // Delete image from Cloudinary if exists
        if (category.imagePublicId) {
            try {
                await deleteImage(category.imagePublicId);
            } catch (cloudErr) {
                console.log("Error deleting image from Cloudinary", cloudErr);
            }
        }

        const deletedCategory = await Category.findByIdAndDelete(id)

        res.status(200).json({
            success: true,
            message: "Category deleted",
            deletedCategory
        })

    } catch (error) {
        console.log("Error in deleting category", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

const updateMenuStatus = async (req, res) => {
    try {
        const { id } = req.params;
        const { menu } = req.body;

        // Validate input
        if (typeof menu !== 'boolean') {
            return res.status(400).json({ message: "Invalid menu status" });
        }

        const category = await Category.findByIdAndUpdate(
            id,
            { menu },
            { new: true, runValidators: true }
        );

        if (!category) {
            return res.status(404).json({ message: "Category not found" });
        }

        res.status(200).json({
            success: true,
            message: `Menu status ${menu ? 'enabled' : 'disabled'}`,
            category,
        });
    } catch (error) {
        console.error("Error updating menu status", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getMenuCategories = async (req, res) => {
    try {
        const categories = await Category.find({ menu: true })
        const categoriesWithSubcategories = await Promise.all(
            categories.map(async (category) => {
                const subcategories = await Sub.find({ category: category._id }).select("name slug");
                return {
                    ...category.toObject(),
                    subcategories
                };
            })
        );

        res.status(200).json({ success: true, categories: categoriesWithSubcategories });
    } catch (error) {
        console.error("Error fetching menu categories:", error);
        res.status(500).json({ success: false, message: "Failed to fetch menu categories" });
    }
};

const editCategory = async (req, res) => {
    try {
        const { id } = req.params;
        const { name, metaDescription , alt } = req.body;
        let updateData = {};
        const category = await Category.findById(id);

        if (!category) return res.status(404).json({ message: "Category not found" });

        if (name) {
            const lower = name.toLowerCase();
            updateData.name = lower;
            updateData.slug = slugify(lower, { lower: true, strict: true });
        }
        if (metaDescription !== undefined) {
            updateData.metaDescription = metaDescription;
        }
        if (alt !== undefined) {
            updateData.alt = String(alt).trim();
        }
        if (req.file) {
            // Delete previous image from Cloudinary
            if (category.imagePublicId) {
                await deleteImage(category.imagePublicId); // You need to implement this function
            }
            const uploadedImage = await uploadImage(req.file);
            updateData.Image = uploadedImage.url;
            updateData.imagePublicId = uploadedImage.public_id;
        }
        const updatedCategory = await Category.findByIdAndUpdate(id, updateData, { new: true });
        if (!updatedCategory) return res.status(404).json({ message: "Category not found" });
        res.status(200).json({ success: true, updatedCategory, message: "Category updated." });
    } catch (error) {
        console.log("Error in editing category", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

module.exports = { createCategory, getAllCategories, deleteCategory, updateMenuStatus, getMenuCategories, editCategory }