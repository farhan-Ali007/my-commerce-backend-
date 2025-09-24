const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Category = require('../models/category');
const Brand = require('../models/brand');
const Banner = require('../models/banner');

// Cache for homepage data (in-memory cache for Railway)
let homepageCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Combined homepage data endpoint - Single API call for all homepage content
router.get('/homepage-data', async (req, res) => {
  try {
    // Check cache first
    const now = Date.now();
    if (homepageCache && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        cached: true,
        data: homepageCache
      });
    }

    console.log('Fetching fresh homepage data...');
    const startTime = Date.now();

    // Use Promise.all for parallel execution - much faster than sequential
    const [
      banners,
      categories,
      brands,
      featuredProducts,
      newProducts,
      bestSellers
    ] = await Promise.all([
      // Banners - limit to active ones
      Banner.find({ active: true })
        .select('image link alt active')
        .limit(5)
        .lean(), // Use lean() for better performance

      // Categories - get main categories only
      Category.find({ active: true })
        .select('name slug image description')
        .limit(12)
        .lean(),

      // Brands - active brands only
      Brand.find({ active: true })
        .select('name slug image')
        .limit(10)
        .lean(),

      // Featured Products - optimized query
      getProductsByTag('featured', 8),

      // New Products - recent products  
      getProductsByTag('new', 8, { createdAt: -1 }),

      // Best Sellers
      getProductsByTag('best seller', 8)
    ]);

    // Get showcase category products in parallel
    const showcaseCategories = await Promise.all([
      getProductsByCategory('trimmers-and-shavers', 4),
      getProductsByCategory('mehndi-stickers', 4),
      getProductsByCategory('beauty-and-personal-care', 4)
    ]);

    const responseData = {
      banners: banners || [],
      categories: categories || [],
      brands: brands || [],
      featuredProducts: featuredProducts || [],
      newProducts: newProducts || [],
      bestSellers: bestSellers || [],
      showcaseCategories: {
        'trimmers-and-shavers': showcaseCategories[0] || [],
        'mehndi-stickers': showcaseCategories[1] || [],
        'beauty-and-personal-care': showcaseCategories[2] || []
      }
    };

    // Cache the response
    homepageCache = responseData;
    cacheTimestamp = now;

    const endTime = Date.now();
    console.log(`Homepage data fetched in ${endTime - startTime}ms`);

    res.json({
      success: true,
      cached: false,
      fetchTime: endTime - startTime,
      data: responseData
    });

  } catch (error) {
    console.error('Homepage data error:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Failed to load homepage data',
      error: process.env.NODE_ENV === 'development' ? error.message : undefined
    });
  }
});

// Helper function to get products by tag name
async function getProductsByTag(tagName, limit = 8, sort = {}) {
  try {
    const Tag = require('../models/tag');
    const tag = await Tag.findOne({ name: new RegExp(tagName, 'i') }).lean();
    
    if (!tag) {
      console.log(`Tag "${tagName}" not found, returning empty array`);
      return [];
    }

    const query = Product.find({ tags: { $in: [tag._id] } })
      .populate('categories', 'name slug')
      .populate('brand', 'name slug')
      .select('title price salePrice images slug stock averageRating')
      .limit(limit)
      .lean();

    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }

    return await query;
  } catch (error) {
    console.error('Error fetching products by tag:', tagName, error);
    return [];
  }
}

// Helper function to get products by category slug
async function getProductsByCategory(categorySlug, limit = 4) {
  try {
    const category = await Category.findOne({ slug: categorySlug }).lean();
    if (!category) return [];

    const products = await Product.find({ 
      categories: category._id 
    })
      .populate('categories', 'name slug')
      .populate('brand', 'name slug')
      .select('title price salePrice images slug stock averageRating')
      .limit(limit)
      .lean();

    return products;
  } catch (error) {
    console.error('Error fetching category products:', categorySlug, error);
    return [];
  }
}

// Clear cache endpoint (for admin use)
router.post('/clear-cache', (req, res) => {
  homepageCache = null;
  cacheTimestamp = null;
  res.json({ success: true, message: 'Homepage cache cleared' });
});

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    cacheStatus: homepageCache ? 'cached' : 'empty'
  });
});

module.exports = router;
