const mongoose = require('mongoose')
const tagSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        unique: true,
    }
}, { timestamps: true })

const Tag = mongoose.model('Tags', tagSchema)
module.exports = Tag;