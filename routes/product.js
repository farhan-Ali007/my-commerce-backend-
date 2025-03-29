const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: "uploads/" })

const { isAdmin, isAuthorized } = require('../middlewares/auth')

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
} = require('../controllers/product')

// 🟢 Place specific routes BEFORE dynamic ones
router.get('/my-products', isAuthorized, isAdmin, getMyProducts)
router.get('/getAll', getAllProducts)
router.get('/best-sellers', getBestSellers)
router.get('/sub/:subCategory', getProductsBySubCategory)
router.get('/related/:categoryId/:excludeProductId', getRelatedProducts)

// 🟢 Dynamic routes should come LAST
router.get('/:slug', getProductBySlug);
router.put('/:slug', isAuthorized, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'variantImages', maxCount: 10 }]), updateProduct)
router.delete('/:id', isAuthorized, isAdmin, deleteProduct)

// 🟢 Post routes
router.post('/create', isAuthorized, isAdmin, upload.fields([{ name: 'images', maxCount: 10 }, { name: 'variantImages', maxCount: 10 }]), createProduct);

module.exports = router;
