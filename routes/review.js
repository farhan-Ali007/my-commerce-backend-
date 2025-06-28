const { createReview, getAllReviews,  getReviewsBySlug } = require('../controllers/review');

const express = require('express')
const router = express.Router()
const { isAuthorized } = require('../middlewares/auth')
const multer = require('multer');
const upload = multer({ dest: "uploads/" });

router.post('/create/:productSlug/:reviewerId', isAuthorized, upload.array('images', 5), createReview)
router.get('/all', getAllReviews)
router.get('/:slug', getReviewsBySlug)

module.exports = router;