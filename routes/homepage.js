const express = require('express');
const router = express.Router();
const Product = require('../models/product');
const Category = require('../models/category');
const Brand = require('../models/brand');
const Banner = require('../models/banner');
const Topbar = require('../models/topbar');

// Cache for homepage data (in-memory cache for Railway)
let homepageCache = null;
let cacheTimestamp = null;
const CACHE_DURATION = 5 * 60 * 1000; // 5 minutes

// Combined homepage data endpoint - Single API call for all homepage content
router.get('/homepage-data', async (req, res) => {
  try {
    // Parse pagination parameters from query
    const featuredPage = parseInt(req.query.featuredPage, 10) || 1;
    const featuredLimit = parseInt(req.query.featuredLimit, 10) || 8;
    const newPage = parseInt(req.query.newPage, 10) || 1;
    const newLimit = parseInt(req.query.newLimit, 10) || 8;
    const bestPage = parseInt(req.query.bestPage, 10) || 1;
    const bestLimit = parseInt(req.query.bestLimit, 10) || 5;
    
    // Create cache key based on pagination params
    const cacheKey = `${featuredPage}-${featuredLimit}-${newPage}-${newLimit}-${bestPage}-${bestLimit}`;
    
    // Check cache first (with pagination-specific cache)
    const now = Date.now();
    if (homepageCache && homepageCache.cacheKey === cacheKey && cacheTimestamp && (now - cacheTimestamp) < CACHE_DURATION) {
      return res.json({
        success: true,
        cached: true,
        data: homepageCache.data
      });
    }

    console.log(`Fetching fresh homepage data with pagination: Featured(${featuredPage}/${featuredLimit}), New(${newPage}/${newLimit}), Best(${bestPage}/${bestLimit})`);
    const startTime = Date.now();

    // Use Promise.all for parallel execution - much faster than sequential
    const [
      banners,
      categories,
      brands,
      featuredProducts,
      newProducts,
      bestSellers,
      activeTopbar,
      menuCats
    ] = await Promise.all([
      // Banners - schema uses isActive
      Banner.find({ isActive: true })
        .select('image link isActive')
        .limit(5)
        .lean(), // Use lean() for better performance

      // Categories - schema doesn't have 'active'; select correct image field 'Image'
      Category.find({})
        .select('name slug Image menu')
        .limit(12)
        .lean(),

      // Brands - schema doesn't have 'active'; select correct logo field
      Brand.find({})
        .select('name slug logo')
        .limit(10)
        .lean(),

      // Featured Products - with pagination
      getProductsByTag('featured', featuredLimit, { createdAt: -1 }, featuredPage),

      // New Products - recent products with pagination
      getProductsByTag('new', newLimit, { createdAt: -1 }, newPage),

      // Best Sellers - with pagination
      getProductsByTag('best seller', bestLimit, {}, bestPage),

      // Topbar active text(s)
      Topbar.findOne({ isEnable: true }).select('text isEnable').lean(),

      // Menu categories for navbar/menu
      Category.find({ menu: true })
        .select('name slug Image menu')
        .limit(30)
        .lean()
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
      topbar: activeTopbar || null,
      menuCategories: menuCats || [],
      featuredProducts: featuredProducts?.products || featuredProducts || [],
      newProducts: newProducts?.products || newProducts || [],
      bestSellers: bestSellers?.products || bestSellers || [],
      showcaseCategories: {
        'trimmers-and-shavers': showcaseCategories[0] || [],
        'mehndi-stickers': showcaseCategories[1] || [],
        'beauty-and-personal-care': showcaseCategories[2] || []
      },
      // Include pagination metadata from the helper functions
      metadata: {
        featuredProducts: {
          currentPage: featuredProducts?.currentPage || 1,
          totalPages: featuredProducts?.totalPages || 1,
          totalProducts: featuredProducts?.totalProducts || (featuredProducts?.products?.length || 0),
          limit: featuredProducts?.limit || 8
        },
        newProducts: {
          currentPage: newProducts?.currentPage || 1,
          totalPages: newProducts?.totalPages || 1,
          totalProducts: newProducts?.totalProducts || (newProducts?.products?.length || 0),
          limit: newProducts?.limit || 8
        },
        bestSellers: {
          currentPage: bestSellers?.currentPage || 1,
          totalPages: bestSellers?.totalPages || 1,
          totalProducts: bestSellers?.totalProducts || (bestSellers?.products?.length || 0),
          limit: bestSellers?.limit || 5
        }
      }
    };

    // Cache the response with cache key
    homepageCache = {
      cacheKey,
      data: responseData
    };
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

// Helper function to get products by tag name with pagination info
async function getProductsByTag(tagName, limit = 8, sort = {}, page = 1) {
  try {
    const Tag = require('../models/tag');
    const tag = await Tag.findOne({ name: new RegExp(tagName, 'i') }).lean();
    
    if (!tag) {
      console.log(`Tag "${tagName}" not found, returning empty array`);
      return {
        products: [],
        totalProducts: 0,
        totalPages: 0,
        currentPage: page,
        limit: limit
      };
    }

    // Get total count for pagination
    const totalProducts = await Product.countDocuments({ tags: { $in: [tag._id] } });
    const totalPages = Math.ceil(totalProducts / limit);
    const skip = (page - 1) * limit;

    const query = Product.find({ tags: { $in: [tag._id] } })
      .populate('categories', 'name slug')
      .populate('brand', 'name slug')
      .select('title price salePrice images slug stock averageRating')
      .skip(skip)
      .limit(limit)
      .lean();

    if (Object.keys(sort).length > 0) {
      query.sort(sort);
    }

    const products = await query;

    return {
      products,
      totalProducts,
      totalPages,
      currentPage: page,
      limit
    };
  } catch (error) {
    console.error('Error fetching products by tag:', tagName, error);
    return {
      products: [],
      totalProducts: 0,
      totalPages: 0,
      currentPage: 1,
      limit
    };
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
  console.log('Homepage cache cleared manually');
  res.json({ success: true, message: 'Homepage cache cleared' });
});

// Auto-clear cache on server restart
homepageCache = null;
cacheTimestamp = null;

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({ 
    status: 'ok', 
    timestamp: Date.now(),
    cacheStatus: homepageCache ? 'cached' : 'empty'
  });
});

module.exports = router;
