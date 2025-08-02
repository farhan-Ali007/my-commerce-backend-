const mongoose = require('mongoose')

const brandSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true
    },
    slug: {
        type: String,
        required: true,
        unique: true
    },
    logo: {
        type: String
    },
    logo_public_id: {
        type: String
    },
}, { timestamps: true })


const Brand = mongoose.model('Brand', brandSchema)
module.exports = Brand;