const Product = require('../models/product');
const Review = require('../models/review')
const { uploadImage } = require('../config/cloudinary');

const createReview = async (req, res) => {
    try {
        const { productSlug, reviewerId } = req.params;
        const { email, reviewText, rating } = req.body;
        let imageUrls = [];

        // Handle multiple image uploads
        if (req.files && req.files.length > 0) {
            for (const file of req.files) {
                const uploaded = await uploadImage(file, "review");
                imageUrls.push(uploaded.url);
            }
        }

        if (!email) return res.status(400).json({ message: "Email required" });
        if (!reviewText) return res.status(400).json({ message: "ReviewText required" });
        if (!rating) return res.status(400).json({ message: "rating required" });
        if (rating < 1) return res.status(400).json({ message: "Rating must be at least 1" });

        const newReview = new Review({ productSlug, reviewerId, email, reviewText, rating, images: imageUrls });
        await newReview.save();

        const product = await Product.findOne({ slug: productSlug });
        if (!product) {
            return res.status(404).json({ message: "Product not found" });
        }

        product.reviews.push(newReview._id);
        await product.save();

        res.status(200).json({
            success: true,
            newReview,
            message: "Review submitted successfully"
        });
    } catch (error) {
        console.log("Error in creating review ", error);
        res.status(500).json({ message: "Internal server error" });
    }
};

const getAllReviews = async (req, res) => {
    try {
        const reviews = await Review.find({})
            .populate('reviewerId', 'username , profilePic')
            .populate('productId', 'title')
            .sort([['createdAt', "desc"]])

        res.status(200).json({
            success: true,
            reviews
        })
    } catch (error) {
        console.log("Error in fething reviews", error)
        res.status(500).json({ message: "Internal server error" })
    }
}

const getReviewsBySlug = async (req, res) => {
    try {
        const { slug } = req.params;
        // console.log("Coming slug from frontend----->", slug)

        if (!slug)
            return res.status(400).json({ message: "Slug is required" });

        const reviews = await Review.find({ productSlug: slug })
            .populate('reviewerId', 'username profilePic');


        res.status(200).json({
            success: true,
            reviews
        });
    } catch (error) {
        console.log("Error in fetching reviews by slug", error);
        res.status(500).json({ message: "Internal server error" });
    }
};


module.exports = { createReview, getAllReviews, getReviewsBySlug, }