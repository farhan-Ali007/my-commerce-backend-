const mongoose = require('mongoose');

const counterSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // name of the sequence, e.g., 'order'
  seq: { type: Number, default: 0 },  // start from 0; code applies a +1000 offset
});

module.exports = mongoose.model('Counter', counterSchema);
