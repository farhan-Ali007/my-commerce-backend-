const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: 'uploads/' })
const { isAuthorized, isAdmin } = require(`../middlewares/auth`)
const { createBrand, getAllBrands, deleteBrand } = require('../controllers/brand')

router.post('/create', isAuthorized, isAdmin, upload.single('logo'), createBrand)
router.get('/get-all', getAllBrands)
router.delete('/:id', isAuthorized, isAdmin, deleteBrand)

module.exports = router;