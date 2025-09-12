const express = require('express');
const router = express.Router();
const { 
  pushSelectedToLCS, 
  trackLcsByCn, 
  resolveOrderLcsCity,
  listLcsCitySuggestions,
  listAllLcsCities,
} = require('../controllers/courier');
const { isAuthorized, isAdmin } = require('../middlewares/auth');

// POST /api/v1/courier/lcs/push
router.post('/lcs/push', isAuthorized, isAdmin, pushSelectedToLCS);
// GET /api/v1/courier/lcs/track/:cn
router.get('/lcs/track/:cn', isAuthorized, isAdmin, trackLcsByCn);
router.post('/lcs/resolve-city', isAuthorized, isAdmin, resolveOrderLcsCity);
router.get('/lcs/suggest', isAuthorized, isAdmin, listLcsCitySuggestions);
router.get('/lcs/cities', isAuthorized, isAdmin, listAllLcsCities);

module.exports = router;
