const Category = require('../models/category.js')
const { uploadImage } = require('../config/cloudinary.js')
const Sub = require('../models/subCategory.js')
const slugify = require('slugify');

const createCategory = async (req, res) => {
    try {

        const { name } = req.body;
        const file = req.file;
        if (!name)
            return res.status(400).json({ message: "Category name is required." })

        const categoryName = name.toLowerCase();
        const categorySlug = slugify(categoryName, { lower: true, strict: true });


        if (!file)
            return res.status(400).json({ message: "Categiry image is required." })

        let imageUrl;

        try {
            const uploadedImage = await uploadImage(file)
            imageUrl = uploadedImage.url
        } catch (error) {
            console.log("Error in uploading category image")
        }

        const newCategory = new Category({
            name: categoryName,
            slug: categorySlug,
            Image: imageUrl
        })
        await newCategory.save()

        res.status(200).json({
            success: true,
            newCategory,
            message: "Category created."
        })

    } catch (error) {
        console.log("Error in creating category", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

const getAllCategories = async (req, res) => {
    try {
        // Fetch all categories
        const categories = await Category.find({}).select("name slug Image");

        // For each category, populate its subcategories
        const categoriesWithSubcategories = await Promise.all(
            categories.map(async (category) => {
                const subcategories = await Sub.find({ category: category._id }).select("name slug");
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
        console.log("Category being deleting----->", id)

        const category = await Category.findById(id)

        if (!category)
            return res.status(404).json({ message: "Category not found" })

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

module.exports = { createCategory, getAllCategories, deleteCategory, }