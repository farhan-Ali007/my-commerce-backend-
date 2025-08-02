const express = require('express')
const router = express.Router()
const { isAuthorized, isAdmin } = require('../middlewares/auth');
const { creatOrder, getMyOrders, getAllOrders, updateOrderStatus, getRecentOrders } = require('../controllers/order');

router.get('/all', isAuthorized, isAdmin, getAllOrders)
router.get('/recents', isAuthorized, isAdmin, getRecentOrders)
router.post('/create', creatOrder)
router.get('/:userId', getMyOrders)
router.patch('/:orderId', isAuthorized, isAdmin, updateOrderStatus)

module.exports = router;