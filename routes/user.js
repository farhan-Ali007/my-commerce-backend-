const express = require('express')
const multer = require('multer')
const upload = multer({ dest: "uploads/" })
const { isAuthorized, isAdmin } = require('../middlewares/auth.js')
const { signup, login, logout, getUser, getAllUsers, updateUserRole, deleteUser, updateUserStatus, updateLastActive } = require('../controllers/user.js')
const router = express.Router()


router.post('/signup', upload.single('image'), signup)
router.post('/login', login)
router.get('/logout', logout)
router.get('/current', isAuthorized, getUser)
router.get('/getAll', isAuthorized, isAdmin, getAllUsers)
router.put('/update-role/:id', isAuthorized, isAdmin, updateUserRole)
router.put('/update-status/:id', isAuthorized, isAdmin, updateUserStatus)
router.patch('/last-active', isAuthorized, updateLastActive)
router.delete('/:id', isAuthorized, isAdmin, deleteUser);

module.exports = router;