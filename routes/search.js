const express = require('express');
const router = express.Router();

const {
    liveSearch,
    sortByPrice,
    filterByCategory,
    filterByRating,
    filterProductsbyBrands,
    filterByPriceRange,
    filterBySubCategory,
    getMinMaxPrice,
    combinedFilter } = require('../controllers/search');


router.get('/', liveSearch);

router.get('/filter/min-max-price', getMinMaxPrice);

router.get('/filter/price-range', filterByPriceRange);

router.get('/filter/rating', filterByRating);

router.get('/filter/price', sortByPrice);

router.get('/filter/category', filterByCategory);

router.get('/filter/subcategory', filterBySubCategory);

router.get('/filter/combined', combinedFilter);

router.get('/filter/:brand', filterProductsbyBrands);




module.exports = router;
