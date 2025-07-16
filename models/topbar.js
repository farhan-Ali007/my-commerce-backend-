const mongoose = require("mongoose");

const topbarSchema = new mongoose.Schema(
  {
    text: {
      type: String,
    },
    isEnable: {
      type: Boolean,
      default: false,
    },
  },
  { timestamps: true }
);

const topBar = mongoose.model("topbar", topbarSchema);
module.exports = topBar;
