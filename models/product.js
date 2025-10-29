const mongoose = require('mongoose');
const slugify = require('slugify');

const variantValueSchema = new mongoose.Schema({
    value: {
        type: String,
        required: true,
    },
    image: {
        type: String,
        default: null,
    },
    alt: {
        type: String,
        default: "",
        trim: true,
    },
    price: Number
});

const variantSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
    },
    values: [variantValueSchema],
});

const productSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
    },
    slug: {
        type: String,
        unique: true,
    },
    description: {
        type: String,
        required: true,
        trim: true,
    },
    longDescription: {
        type: String,
        required: true,
        trim: true,
    },
    metaDescription: {
        type: String,
        trim: true,
        default: ""
    },
    price: {
        type: Number,
        required: true,
        min: 0,
    },
    salePrice: {
        type: Number,
        trim: true,
        min: 0,
        validate: {
            validator: function (value) {
                return this.price ? value <= this.price : true;
            },
            message: 'Sale price must be less than or equal to the original price.',
        },
    },
    specialOfferEnabled: {
        type: Boolean,
        default: false,
    },
    specialOfferPrice: {
        type: Number,
        min: 0,
    },
    specialOfferStart: {
        type: Date,
    },
    specialOfferEnd: {
        type: Date,
    },
    weight: {
        type: String,
        trim: true,
    },
    categories: [{
        required: true,
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Categories',
    }],
    subCategory: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'SubCategory',
    },
    stock: {
        type: Number,
        required: true,
        min: 0,
    },
    sold: {
        type: Number,
        default: 0,
    },
    freeShipping: {
        type: Boolean,
        default: false,
    },
    deliveryCharges: {
        type: Number,
        default: 0,
    },
    brand: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Brand',
    },
    tags: [
        {
            required: true,
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Tags',
        },
    ],
    variants: [variantSchema],
    images: [
        {
            url: {
                type: String,
                required: true
            },
            public_id: {
                type: String,
                required: true
            },
            alt: {
                type: String,
                default: "",
                trim: true,
            }
        }
    ],
    averageRating: {
        type: Number,
    },
    reviews: [
        {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'Review',
        },
    ],
    faqs: [
        new mongoose.Schema({
            question: { type: String, required: true, trim: true },
            answer: { type: String, required: true, trim: true },
        }, { _id: false })
    ],
    creator: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Volume pricing tiers
    volumeTierEnabled: {
        type: Boolean,
        default: false,
    },
    volumeTiers: [
        new mongoose.Schema({
            quantity: { type: Number, required: true, min: 1 },
            price: { type: Number, required: true, min: 0 },
            image: { type: String, default: null },
        }, { _id: false })
    ],
}, {
    timestamps: true,
});

// **Pre-save Middleware**: Set delivery charges automatically
productSchema.pre('save', function (next) {
    // Generate slug if it's a new product or title is modified and slug is not set
    if (!this.slug) {
        this.slug = slugify(this.title, { lower: true, strict: true });
    }
    this.deliveryCharges = this.freeShipping ? 0 : 250;
    next();
});

productSchema.index({ title: 'text', description: 'text' });

const Product = mongoose.models.Product || mongoose.model('Product', productSchema);

module.exports = Product;