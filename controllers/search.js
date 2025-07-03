const { default: mongoose } = require('mongoose');
const Product = require('../models/product');
const Category = require('../models/category');
const Sub = require('../models/subCategory');
const Tag = require('../models/tag');
const Brand = require('../models/brand');

const liveSearch = async (req, res) => {
    try {
        const { query } = req.query;
        const limit = parseInt(req.query.limit) || 10; 

        if (!query) {
            return res.status(400).json({ message: 'Search query is required.' });
        }

        const products = await Product.find(
            { $text: { $search: query } },
            { score: { $meta: "textScore" } } 
        )
            .populate('category', 'title images category')
            .populate('tags', 'title')
            .sort({ score: { $meta: "textScore" } }) 
            .limit(limit);

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
        const { sort, page = 1, limit = 6 } = req.query;
        console.log("coming query in sortByPrice function:", req.query)

        if (!sort || (sort !== 'asc' && sort !== 'desc')) {
            return res.status(400).json({ message: 'Invalid sort value. Use "asc" or "desc".' });
        }

        const skip = (page - 1) * limit;
        const totalProducts = await Product.countDocuments();
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({})
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort({ price: sort === 'asc' ? 1 : -1 })
            .skip(skip)
            .limit(limit);

        console.log("Products sorted by price:", products.length);
        console.log("total pages ------->", totalPages);
        res.status(200).json({
            success: true,
            message: 'Products sorted by price.',
            currentPage: Number(page),
            totalPages,
            totalProducts,
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
        let { categoryName, page = 1, limit = 6 } = req.query;  //catgeory slug
        console.log("Category name in filterByCategory function:", categoryName);

        if (!categoryName || categoryName.length === 0) {
            return res.status(400).json({ message: 'At least one category name is required.' });
        }

        categoryName = Array.isArray(categoryName)
            ? categoryName.map((name) => name.trim().toLowerCase())
            : categoryName.split(',').map((name) => name.trim().toLowerCase());

        const categories = await Category.find({
            slug: { $in: categoryName.map(name => new RegExp(`^${name}$`, 'i')) },
        });

        if (categories.length === 0) {
            return res.status(404).json({ message: 'No matching categories found.' });
        }

        const categoryIds = categories.map((category) => category._id);
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments({ category: { $in: categoryIds } });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ category: { $in: categoryIds } })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort([['createdAt', 'desc']])
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'Products filtered by categories.',
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products,
        });
    } catch (error) {
        console.error("Error in filtering by category:", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterBySubCategory = async (req, res) => {
    try {
        let { subCategoryName, page = 1, limit = 6 } = req.query;

        if (!subCategoryName || subCategoryName.length === 0) {
            return res.status(400).json({
                success: false,
                message: 'At least one subcategory name is required.'
            });
        }

        const subCategoryNames = Array.isArray(subCategoryName)
            ? subCategoryName.map(name => name.trim())
            : subCategoryName.split(',').map(name => name.trim());

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

        const subcategoryIds = subCategories.map(sub => sub._id);
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments({ subCategory: { $in: subcategoryIds } });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ subCategory: { $in: subcategoryIds } })
            .populate('category', 'name')
            .populate('subCategory', 'name slug')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort([['createdAt', 'desc']])
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'Products filtered by subcategories.',
            currentPage: Number(page),
            totalPages,
            totalProducts,
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
        const { rating, page = 1, limit = 8 } = req.query;

        if (!rating || isNaN(rating) || rating < 1 || rating > 5) {
            return res.status(400).json({ message: 'Invalid rating value. Must be between 1 and 5.' });
        }

        const parsedRating = parseFloat(rating);
        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments({ averageRating: { $gte: parsedRating } });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({ averageRating: { $gte: parsedRating } })
            .sort({ averageRating: 1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'Products filtered by rating.',
            currentPage: Number(page),
            totalPages,
            totalProducts,
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
        const { page = 1, limit = 10 } = req.query;

        const brandData = await Brand.findOne({ name: brand });
        if (!brandData) {
            return res.status(404).json({ success: false, message: "Brand not found" });
        }

        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments({ brand: brandData._id });
        const totalPages = Math.ceil(totalProducts / limit);

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
            .sort([['updatedAt', 'desc'], ['createdAt', 'desc']])
            .skip(skip)
            .limit(limit);

        console.log("Products filtered by brand:", products.length);

        res.status(200).json({
            success: true,
            message: "Products fetched successfully",
            currentPage: Number(page),
            totalPages,
            totalProducts,
            products
        });
    } catch (error) {
        console.error("Error in fetching by brands", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const filterByPriceRange = async (req, res) => {
    try {
        let { minPrice, maxPrice, page = 1, limit = 8 } = req.query;

        minPrice = minPrice ? parseFloat(minPrice) : 0;
        maxPrice = maxPrice ? parseFloat(maxPrice) : Number.MAX_SAFE_INTEGER;

        if (isNaN(minPrice) || isNaN(maxPrice) || minPrice < 0 || maxPrice < 0) {
            return res.status(400).json({ message: 'Invalid price values.' });
        }

        if (minPrice > maxPrice) {
            return res.status(400).json({ message: 'minPrice cannot be greater than maxPrice.' });
        }

        const skip = (page - 1) * limit;

        const totalProducts = await Product.countDocuments({
            price: { $gte: minPrice, $lte: maxPrice }
        });
        const totalPages = Math.ceil(totalProducts / limit);

        const products = await Product.find({
            price: { $gte: minPrice, $lte: maxPrice }
        })
            .populate('category', 'name')
            .populate('tags', 'name')
            .populate('brand', 'name')
            .sort({ price: 1 })
            .skip(skip)
            .limit(limit);

        res.status(200).json({
            success: true,
            message: 'Products filtered by price range.',
            currentPage: Number(page),
            totalPages,
            totalProducts,
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
