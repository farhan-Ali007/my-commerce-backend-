const express = require('express');
const router = express.Router();
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const {
  saveDraft,
  publishLayout,
  getPublishedBySlug,
  getDraftBySlug,
  getAllLayouts,
  deleteLayout,
} = require('../controllers/pageLayout');

// Admin endpoints
router.post('/draft', isAuthorized, isAdmin, saveDraft);
router.post('/publish', isAuthorized, isAdmin, publishLayout);
router.get('/admin', isAuthorized, isAdmin, getAllLayouts);
router.get('/admin/:slug', isAuthorized, isAdmin, getDraftBySlug);
router.delete('/:id', isAuthorized, isAdmin, deleteLayout);

// Public endpoint - must come last to avoid conflicts
router.get('/:slug', getPublishedBySlug);

module.exports = router;
