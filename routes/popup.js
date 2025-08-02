const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: "uploads/" });

// Import controller functions
const {
    getAllPopups,
    getActivePopup,
    createPopup,
    updatePopup,
    deletePopup,
    togglePopupStatus,
    trackPopupInteraction,
    getPopupAnalytics,
    getPopupsAnalyticsSummary
} = require('../controllers/popup');

// Import middleware
const { isAuthorized, isAdmin } = require('../middlewares/auth');

// ===== PUBLIC ROUTES (No authentication required) =====

// GET /api/v1/popup/active - Get active popup for current page/user
router.get('/active', getActivePopup);

// POST /api/v1/popup/:id/track - Track popup interaction (click/dismissal)
router.post('/:id/track', trackPopupInteraction);

// ===== ADMIN ROUTES (Authentication required) =====

// GET /api/v1/popup - Get all popups (admin only)
router.get('/', isAuthorized, isAdmin, getAllPopups);

// POST /api/v1/popup - Create new popup (admin only)
router.post('/', isAuthorized, isAdmin, upload.single('image'), createPopup);

// PUT /api/v1/popup/:id - Update popup (admin only)
router.put('/:id', isAuthorized, isAdmin, upload.single('image'), updatePopup);

// DELETE /api/v1/popup/:id - Delete popup (admin only)
router.delete('/:id', isAuthorized, isAdmin, deletePopup);

// PATCH /api/v1/popup/:id/toggle - Toggle popup status (admin only)
router.patch('/:id/toggle', isAuthorized, isAdmin, togglePopupStatus);

// GET /api/v1/popup/:id/analytics - Get popup analytics (admin only)
router.get('/:id/analytics', isAuthorized, isAdmin, getPopupAnalytics);

// GET /api/v1/popup/analytics/summary - Get all popups analytics summary (admin only)
router.get('/analytics/summary', isAuthorized, isAdmin, getPopupsAnalyticsSummary);

module.exports = router; 