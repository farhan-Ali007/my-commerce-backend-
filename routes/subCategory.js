const express = require('express');
const router = express.Router();
const multer = require('multer');
const upload = multer({ dest: "uploads/" });
const { createSub, getAllSubs, deleteSub, editSub } = require('../controllers/subCategory');
const { isAuthorized, isAdmin } = require('../middlewares/auth')

router.post('/create', isAuthorized, isAdmin, upload.single('image'), createSub);
router.get('/all', getAllSubs);
router.delete('/delete/:id', isAuthorized, isAdmin, deleteSub);
router.put('/edit/:id', isAuthorized, isAdmin, upload.single('image'), editSub);

module.exports = router;