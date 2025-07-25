const mongoose = require('mongoose');

const redirectSchema = new mongoose.Schema({
  from: { type: String, required: true }, // old slug or URL
  to: { type: String, required: true },   // new slug, category, or custom URL
  count: { type: Number, default: 0 },    // how many times this redirect was used
  type: { type: String, default: 'product' }, // e.g., 'product', 'category', 'custom'
}, {
  timestamps: true
});

const Redirect = mongoose.models.Redirect || mongoose.model('Redirect', redirectSchema);

module.exports = Redirect;
