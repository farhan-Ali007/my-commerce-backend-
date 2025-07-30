const express = require('express');
const router = express.Router();
const {
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount
} = require('../controllers/notification');
const { isAuthorized } = require('../middlewares/auth');

// All routes require authentication
router.use(isAuthorized);

// Get user notifications
router.get('/user/:userId', getUserNotifications);

// Get unread count
router.get('/unread/:userId', getUnreadCount);

// Mark notification as read
router.patch('/read/:notificationId', markAsRead);

// Mark all notifications as read
router.patch('/read-all/:userId', markAllAsRead);

// Delete notification
router.delete('/:notificationId', deleteNotification);

module.exports = router; 