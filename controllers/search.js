const { default: mongoose } = require('mongoose');
const Product = require('../models/product');
const Category = require('../models/category');
const Sub = require('../models/subCategory');
const Tag = require('../models/tag');
const Brand = require('../models/brand');

const liveSearch = async (req, res) => {
    try {
        const { query } = req.query;

        if (!query) {
            return res.status(400).json({ message: 'Search query is required.' });
        }

        const products = await Product.find({
            $text: { $search: query }
        })
            .populate('category', 'title images category')
            .populate('tags', 'title')
            .sort([['createdAt', 'desc']]);

        res.status(200).json({
            success: true,
            message: 'Search results fetched successfully.',
            products
        });
    } catch (error) {
        console.error("Error in live search:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const sortByPrice = async (req, res) => {
    try {
        const { sort } = req.query;

        if (!sort || (sort !== 'asc' && sort !== 'desc')) {
            return res.status(400).json({ message: 'Invalid sort value. Use "asc" or "desc".' });
        }

        const products = await Product.find({})
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort({ price: sort === 'asc' ? 1 : -1 });

        res.status(200).json({
            success: true,
            message: 'Products sorted by price.',
            products
        });
    } catch (error) {
        console.error("Error in filtering by price:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getMinMaxPrice = async (req, res) => {
    try {
        console.log("Inside getMinMaxPrice function👍👍👍👍👍👍");
        const minMax = await Product.aggregate([
            {
                $group: {
                    _id: null,
                    minPrice: { $min: "$price" },
                    maxPrice: { $max: "$price" }
                }
            }
        ]);

        if (minMax.length === 0) {
            return res.status(404).json({ message: "No products found." });
        }

        res.status(200).json({
            success: true,
            minPrice: minMax[0].minPrice,
            maxPrice: minMax[0].maxPrice
        });

    } catch (error) {
        console.error("Error fetching min and max price:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterByCategory = async (req, res) => {
    try {
        let { categoryName } = req.query;
        // console.log("Category slug from frontend----->", categoryName);


        if (!categoryName || categoryName.length === 0) {
            return res.status(400).json({ message: 'At least one category name is required.' });
        }

        // Normalize category names from the query (trim and lowercase)
        categoryName = Array.isArray(categoryName)
            ? categoryName.map((name) => name.trim().toLowerCase())
            : categoryName.split(',').map((name) => name.trim().toLowerCase());
        // console.log("Normalized category names----->", categoryName);

        const categories = await Category.find({
            slug: { $in: categoryName.map(name => new RegExp(`^${name}$`, 'i')) },
        });

        if (categories.length === 0) {
            return res.status(404).json({ message: 'No matching categories found.' });
        }

        // Extract the category IDs
        const categoryIds = categories.map((category) => category._id);
        // console.log("Category IDs found----->", categoryIds);

        // Fetch products matching the category IDs
        const products = await Product.find({
            category: { $in: categoryIds }
        })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort([['createdAt', 'desc']]);

        console.log(`Products found by ${categoryName}------>`, products.length);

        res.status(200).json({
            success: true,
            message: 'Products filtered by categories.',
            products,
        });
    } catch (error) {
        console.error("Error in filtering by category:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterBySubCategory = async (req, res) => {
    try {
        let { subCategoryName } = req.query;

        if (!subCategoryName || subCategoryName.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one subcategory name is required.'
            });
        }

        // Convert to array if it's a string
        const subCategoryNames = Array.isArray(subCategoryName)
            ? subCategoryName.map(name => name.trim())
            : subCategoryName.split(',').map(name => name.trim());

        // Find subcategories with case-insensitive matching
        const subCategories = await Sub.find({
            $or: [
                { name: { $in: subCategoryNames } },
                { slug: { $in: subCategoryNames } }
            ]
        });

        if (!subCategories || subCategories.length === 0) {
            return res.status(404).json({
                success: false,
                message: 'No matching subcategories found.'
            });
        }

        // Extract the subcategory IDs
        const subcategoryIds = subCategories.map(sub => sub._id);

        // Fetch products matching the subcategory IDs
        const products = await Product.find({
            subCategory: { $in: subcategoryIds }
        })
            .populate('category', 'name')
            .populate('subCategory', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort([['createdAt', 'desc']]);

        res.status(200).json({
            success: true,
            message: 'Products filtered by subcategories.',
            products,
            subCategories: subCategories.map(sub => ({
                _id: sub._id,
                name: sub.name,
                slug: sub.slug
            }))
        });
    } catch (error) {
        console.error("Error in filtering by subcategory:", error);
        res.status(500).json({
            success: false,
            message: "Internal server error",
            error: error.message
        });
    }
};

const filterByRating = async (req, res) => {
    try {
        const { rating } = req.query;
        console.log("coming rating from frontend---->", rating);

        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Invalid rating value. Must be between 1 and 5.' });
        }

        // Convert rating to a number
        const parsedRating = parseFloat(rating);

        // Use aggregation to filter products by the existing averageRating field
        const products = await Product.find({
            averageRating: { $gte: parsedRating } // Filter based on existing averageRating field
        })
            .sort({ averageRating: 1 })
            .exec();

        console.log("Products found----->", products);
        res.status(200).json({
            success: true,
            message: 'Products filtered by rating.',
            products
        });
    } catch (error) {
        console.error("Error in filtering by rating:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterProductsbyBrands = async (req, res) => {
    try {
        const { brand } = req.params;
        console.log("Brand name from frontend---->", brand);
        const brandData = await Brand.findOne({ name: brand });
        if (!brandData) {
            return res.status(404).json({ success: false, message: "Brand not found" });
        }

        const products = await Product.find({ brand: brandData._id })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .populate({
                path: 'reviews',
                select: 'rating reviewText',
                populate: {
                    path: 'reviewerId',
                    select: 'name email'
                }
            })
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']]);

        res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            products
        });
    } catch (error) {
        console.log("Error in fetching by brands", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterByPriceRange = async (req, res) => {
    try {
        let { minPrice, maxPrice } = req.query;

        console.log("minPrice---->", minPrice);
        console.log("maxPrice---->", maxPrice);

        // Convert to numbers and set default values if not provided
        minPrice = minPrice ? parseFloat(minPrice) : 0;
        maxPrice = maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER;

        if (isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice < 0) {
            return res.status(400).json({ message: 'Invalid price values.' });
        }

        if (minPrice > maxPrice) {
            return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice.' });
        }

        const products = await Product.find({
            price: { $gte: minPrice, $lte: maxPrice }
        })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort({ price: 1 });

        res.status(200).json({
            success: true,
            message: 'Products filtered by price range.',
            products
        });

    } catch (error) {
        console.error("Error in filtering by price range:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};




module.exports = {
    liveSearch,
    sortByPrice,
    filterByCategory,
    filterBySubCategory,
    filterByRating,
    filterProductsbyBrands,
    filterByPriceRange,
    getMinMaxPrice
};
