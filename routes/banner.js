const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: process.env.VERCEL ? '/tmp/uploads' : 'uploads/' })
const { isAuthorized, isAdmin } = require('../middlewares/auth.js')
const { addBanner, updateBanner, getBanners, deleteBanner , getBannersForAdmin } = require('../controllers/banner.js')

router.post('/add', isAuthorized, isAdmin, upload.single("image"), addBanner);
router.get('/all', getBanners);

router.get('/admin/all', getBannersForAdmin);
router.put('/:id', isAuthorized, isAdmin, upload.single("image"), updateBanner)
router.delete('/:id', isAuthorized, isAdmin, deleteBanner)

module.exports = router;