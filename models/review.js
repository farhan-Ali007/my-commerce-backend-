const mongoose = require('mongoose');

const reviewSchema = new mongoose.Schema({
    productSlug: {  
        type: String,
        required: true
    },
    reviewerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    email: {
        type: String,
        required: true
    },
    reviewText: {
        type: String,
        required: true,
        minlength: 4,
    },
    rating: {
        type: Number,
        required: true,
        min: 1,
        max: 5
    },
    images: [{
        type: String, // Cloudinary URLs
        default: ""
    }]
}, { timestamps: true });

const Review = mongoose.model('Review', reviewSchema);
module.exports = Review;
