const express = require('express')
const router = express.Router()
const { isAuthorized } = require('../middlewares/auth');
const { addItemToCart, getCart, clearCart, mergeGuestCartWithUser } = require('../controllers/cart');

router.post('/merge', isAuthorized, mergeGuestCartWithUser)
router.post('/add', addItemToCart)
router.get('/:userId', getCart)
router.delete('/empty/:userId', clearCart);

module.exports = router;