const express = require('express')
const router = express.Router()
const multer = require('multer')
const upload = multer({ dest: "uploads/" })
const { isAuthorized, isAdmin } = require('../middlewares/auth')
const { createCategory, getAllCategories, deleteCategory } = require('../controllers/category')


router.post('/create', isAuthorized, isAdmin, upload.single('image'), createCategory)
router.get("/getAll", getAllCategories)
router.delete('/:id', isAuthorized, isAdmin, deleteCategory)

module.exports = router;