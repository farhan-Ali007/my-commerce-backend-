const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: process.env.VERCEL ? "/tmp/uploads" : "uploads/" })

const { isAdmin, isAuthorized } = require('../middlewares/auth')
const {getRedirectsByTo} = require('../controllers/redirect')
const {
    createProduct,
    getAllProducts,
    deleteProduct,
    updateProduct,
    getMyProducts,
    getRelatedProducts,
    getBestSellers,
    getProductBySlug,
    getProductsBySubCategory,
    getFeaturedProducts,
    getNewArrivals,
    uploadDescriptionImage
} = require('../controllers/product')

// 🟢 Place specific routes BEFORE dynamic ones
router.get('/getAll', getAllProducts)
router.get('/my-products', isAuthorized, isAdmin, getMyProducts)
router.get('/best-sellers', getBestSellers)
router.get('/sub/:subCategory', getProductsBySubCategory)
router.get('/related/:categoryId/:excludeProductId', getRelatedProducts)
router.get('/featured', getFeaturedProducts)
router.get('/new-arrivals', getNewArrivals)
router.get('/redirects', getRedirectsByTo);

// New endpoint for long description image upload
router.post('/upload-description-image', upload.single('image'), uploadDescriptionImage)

// 🟢 Dynamic routes should come LAST
router.get('/:slug', getProductBySlug);
router.put('/:slug', isAuthorized, isAdmin, upload.fields([
    { name: 'images', maxCount: 30 },
    { name: 'variantImages', maxCount: 500 },
    { name: 'volumeTierImages', maxCount: 200 }
]), updateProduct)
router.delete('/:id', isAuthorized, isAdmin, deleteProduct)

// 🟢 Post routes
router.post('/create', isAuthorized, isAdmin, upload.fields([
    { name: 'images', maxCount: 30 },
    { name: 'variantImages', maxCount: 500 },
    { name: 'volumeTierImages', maxCount: 200 }
]), createProduct);

module.exports = router;
