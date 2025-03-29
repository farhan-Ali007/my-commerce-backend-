const express = require('express')
const router = express.Router()
const { isAuthorized, isAdmin } = require('../middlewares/auth.js');
const { createTag, getAllTags, deleteTag } = require('../controllers/tag');

router.post('/create', isAuthorized, isAdmin, createTag)
router.get('/getAll', isAuthorized, isAdmin, getAllTags)
router.delete('/:id', isAuthorized, isAdmin, deleteTag)

module.exports = router;