const Notification = require('../models/notification');
const User = require('../models/user');
const Order = require('../models/order');

// Create a notification
const createNotification = async (recipientId, type, title, message, orderId = null, metadata = {}) => {
    try {
        const notification = new Notification({
            recipient: recipientId,
            type,
            title,
            message,
            orderId,
            metadata
        });
        
        await notification.save();
        return notification;
    } catch (error) {
        console.error('Error creating notification:', error);
        throw error;
    }
};

// Get user notifications
const getUserNotifications = async (req, res) => {
    try {
        const { userId } = req.params;
        const { page = 1, limit = 20, unreadOnly = false } = req.query;
        
        const skip = (page - 1) * limit;
        
        let query = { recipient: userId };
        if (unreadOnly === 'true') {
            query.isRead = false;
        }
        
        const notifications = await Notification.find(query)
            .populate('orderId', 'orderId totalPrice status')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(parseInt(limit));
            
        const total = await Notification.countDocuments(query);
        const unreadCount = await Notification.countDocuments({ 
            recipient: userId, 
            isRead: false 
        });
        
        res.status(200).json({
            success: true,
            notifications,
            total,
            unreadCount,
            currentPage: parseInt(page),
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.error('Error fetching notifications:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to fetch notifications' 
        });
    }
};

// Mark notification as read
const markAsRead = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.body;
        
        const notification = await Notification.findOneAndUpdate(
            { _id: notificationId, recipient: userId },
            { isRead: true },
            { new: true }
        );
        
        if (!notification) {
            return res.status(404).json({ 
                success: false, 
                message: 'Notification not found' 
            });
        }
        
        res.status(200).json({
            success: true,
            notification
        });
    } catch (error) {
        console.error('Error marking notification as read:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to mark notification as read' 
        });
    }
};

// Mark all notifications as read
const markAllAsRead = async (req, res) => {
    try {
        const { userId } = req.params;
        
        await Notification.updateMany(
            { recipient: userId, isRead: false },
            { isRead: true }
        );
        
        res.status(200).json({
            success: true,
            message: 'All notifications marked as read'
        });
    } catch (error) {
        console.error('Error marking all notifications as read:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to mark notifications as read' 
        });
    }
};

// Delete notification
const deleteNotification = async (req, res) => {
    try {
        const { notificationId } = req.params;
        const { userId } = req.body;
        
        const notification = await Notification.findOneAndDelete({
            _id: notificationId,
            recipient: userId
        });
        
        if (!notification) {
            return res.status(404).json({ 
                success: false, 
                message: 'Notification not found' 
            });
        }
        
        res.status(200).json({
            success: true,
            message: 'Notification deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting notification:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to delete notification' 
        });
    }
};

// Get unread count
const getUnreadCount = async (req, res) => {
    try {
        const { userId } = req.params;
        
        const unreadCount = await Notification.countDocuments({
            recipient: userId,
            isRead: false
        });
        
        res.status(200).json({
            success: true,
            unreadCount
        });
    } catch (error) {
        console.error('Error getting unread count:', error);
        res.status(500).json({ 
            success: false, 
            message: 'Failed to get unread count' 
        });
    }
};

module.exports = {
    createNotification,
    getUserNotifications,
    markAsRead,
    markAllAsRead,
    deleteNotification,
    getUnreadCount
}; 