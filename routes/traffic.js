const express = require('express');
const router = express.Router();
const { recordVisit, recordProductView, getSummary, getProductSeries } = require('../controllers/traffic');

router.post('/visit', recordVisit);
router.post('/product-view/:productId', recordProductView);
router.get('/summary', getSummary);
router.get('/product/:productId/series', getProductSeries);

module.exports = router;
