const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: process.env.VERCEL ? "/tmp/uploads" : "uploads/" });
const { createSub, getAllSubs, deleteSub, editSub, getSubCategoryBySlug } = require('../controllers/subCategory');
const { isAuthorized, isAdmin } = require('../middlewares/auth')

router.post('/create', isAuthorized, isAdmin, upload.single('image'), createSub);
router.get('/all', getAllSubs);
router.get('/:slug', getSubCategoryBySlug);
router.delete('/delete/:id', isAuthorized, isAdmin, deleteSub);
router.put('/edit/:id', isAuthorized, isAdmin, upload.single('image'), editSub);

module.exports = router;