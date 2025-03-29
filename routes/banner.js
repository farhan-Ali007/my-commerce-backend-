const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
const { isAuthorized, isAdmin } = require('../middlewares/auth.js')
const { addBanner, updateBanner, getBanners, deleteBanner } = require('../controllers/banner.js')

router.post('/add', isAuthorized, isAdmin, upload.single("image"), addBanner);
router.get('/all', getBanners);
router.put('/:id', isAuthorized, isAdmin, upload.single("image"), updateBanner)
router.delete('/:id', isAuthorized, isAdmin, deleteBanner)

module.exports = router;