const mongoose = require("mongoose");

const logoSchema = new mongoose.Schema({
    image: {
        type: String
    },
    image_public_id: {
        type: String
    },
    isEnable: {
        type: Boolean,
        default: false
    }
}, { timestamps: true })

const Logo = mongoose.model("Logo", logoSchema)
module.exports = Logo