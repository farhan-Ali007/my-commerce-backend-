const mongoose = require('mongoose')
const slugify = require('slugify');


const categorySchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    },
    slug: {
        type: String,
        unique: true
    },
    Image: {
        type: String,
        default: ""
    }
}, { timestamps: true })

// Generate slug before saving
categorySchema.pre('save', function (next) {
    if (this.isModified('name')) {
        this.slug = slugify(this.name, { lower: true, strict: true });
    }
    next();
});


const Category = mongoose.model('Categories', categorySchema)
module.exports = Category;