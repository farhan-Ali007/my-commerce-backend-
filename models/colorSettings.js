const mongoose = require('mongoose');

const colorSettingsSchema = new mongoose.Schema({
    primary: {
        type: String,
        default: "#000000",
        required: true
    },
    secondary: {
        type: String,
        default: "#FFB727",
        required: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ColorSettings', colorSettingsSchema); 