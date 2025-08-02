const express = require('express');
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const { getColorSettings, updateColorSettings, resetColorSettings } = require('../controllers/colorSettings');

const router = express.Router();

// Public route to get current color settings (for frontend)
router.get('/', getColorSettings);

// Admin routes (protected)
router.put('/update',isAuthorized, isAdmin, updateColorSettings);
router.post('/reset', isAuthorized, isAdmin, resetColorSettings);

module.exports = router; 