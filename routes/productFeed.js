const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const { format } = require('@fast-csv/format');

// Helper to get brand name if populated
function getBrandName(brand) {
  if (!brand) return '';
  if (typeof brand === 'string') return brand;
  return brand.name || brand.title || '';
}

function stripHtml(html) {
  if (!html) return '';
  return html.replace(/<[^>]*>?/gm, '');
}

// Normalize an image entry to a URL string
function toUrl(img) {
  if (!img) return '';
  if (typeof img === 'string') return img;
  if (typeof img === 'object' && img.url) return img.url;
  return '';
}

// Normalize an array of images to an array of URL strings
function toUrls(arr) {
  if (!Array.isArray(arr)) return [];
  return arr.map(toUrl).filter(Boolean);
}

router.get('/product-feed.csv', async (req, res) => {
  try {
    // Populate brand, category, and subCategory to get their names
    const products = await Product.find({})
      .populate('brand', 'name title')
      .populate('category', 'name title')
      .populate('subCategory', 'name title')
      .exec();

    // Determine the maximum number of images for any product
    let maxAdditionalImages = 0;
    products.forEach(product => {
      const numAdditional = (product.images && product.images.length > 1) ? product.images.length - 1 : 0;
      if (numAdditional > maxAdditionalImages) maxAdditionalImages = numAdditional;
    });

    // Prepare headers
    const headers = [
        'title',
        'id',
        'price',
        'sale price',
        'condition',
        'availability',
        'channel',
        'feed label',
        'language',
        'additional image link',
        'all clicks',
        'brand',
        'canonical link',
        'description',
        'google product category',
        'identifier exists',
        'image link',
        'item group id',
        'link',
        'mpn',
        'product type',
        'shipping(country)',
        'update type'
      ];
    for (let i = 0; i < maxAdditionalImages; i++) {
      headers.push(i === 0 ? 'additional_image_link' : `additional_image_link_${i}`);
    }
    headers.push('price', 'availability', 'brand', 'condition');

    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="product-feed.csv"');

    const csvStream = format({ headers });
    csvStream.pipe(res);

    products.forEach(product => {
      // Build Google product category string
      let googleCategory = '';
      if (product.category && product.category.title) {
        googleCategory += product.category.title;
      }
      if (product.subCategory && product.subCategory.title) {
        googleCategory += (googleCategory ? ' > ' : '') + product.subCategory.title;
      }
      const row = {
        title: product.title,
        id: product._id,
        price: `${product.price} PKR`,
        'sale price': product.salePrice ? `${product.salePrice} PKR` : '',
        condition: 'new',
        availability: product.stock > 0 ? 'in stock' : 'out of stock',
        channel: 'online',
        'feed label': '', // set if you use feed labels
        language: 'en',
        'additional image link': Array.isArray(product.images) && product.images.length > 1 ? toUrls(product.images.slice(1)).join(',') : '',
        'all clicks': '', // leave blank or fill if you track this
        brand: getBrandName(product.brand),
        'canonical link': `https://etimadmart.com/product/${product.slug}`,
        description: stripHtml(product.longDescription || product.description),
        'google product category': googleCategory,
        'identifier exists': 'FALSE', // or 'TRUE' if you have GTIN/MPN
        'image link': Array.isArray(product.images) && product.images.length > 0 ? toUrl(product.images[0]) : '',
        'item group id': '', // set if you have product groups/variants
        link: `https://etimadmart.com/product/${product.slug}`,
        mpn: '', // set if you have manufacturer part number
        'product type': googleCategory, // Use the same as google product category for now
        'shipping(country)': 'PK',
        'update type': '', // set if you use this
      };
      // Add additional images
      if (Array.isArray(product.images) && product.images.length > 1) {
        product.images.slice(1).forEach((img, idx) => {
          row[idx === 0 ? 'additional_image_link' : `additional_image_link_${idx}`] = toUrl(img);
        });
      }
      csvStream.write(row);
    });

    csvStream.end();
  } catch (err) {
    res.status(500).send('Error generating product feed');
  }
});

module.exports = router; 