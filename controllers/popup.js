const Popup = require('../models/popup');
const { uploadImage, deleteImage } = require('../config/cloudinary');

// Get all popups (admin)
const getAllPopups = async (req, res) => {
    try {
        const popups = await Popup.find().sort({ createdAt: -1 });
        
        res.status(200).json({
            success: true,
            message: 'Popups fetched successfully',
            popups
        });
    } catch (error) {
        console.error('Error fetching popups:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Get active popup for current page/user (public)
const getActivePopup = async (req, res) => {
    try {
        const { page = 'home', userType = 'guest' } = req.query;
        
        // Get all active popups
        const popups = await Popup.find({ isActive: true });
        
        // Filter popups based on targeting rules
        const eligiblePopups = popups.filter(popup => {
            return popup.shouldShow(userType, page);
        });
        
        if (eligiblePopups.length === 0) {
            return res.status(200).json({
                success: true,
                message: 'No active popups for this page/user',
                popup: null
            });
        }
        
        // Select the most recent popup (or implement priority logic)
        const selectedPopup = eligiblePopups[0];
        
        // Increment impression count
        await selectedPopup.incrementAnalytics('impression');
        
        res.status(200).json({
            success: true,
            message: 'Active popup fetched successfully',
            popup: selectedPopup
        });
    } catch (error) {
        console.error('Error fetching active popup:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Create new popup (admin)
const createPopup = async (req, res) => {
    try {
        const {
            title,
            content,
            productLink,
            buttonText,
            isActive,
            displaySettings,
            targeting,
            startDate,
            endDate
        } = req.body;

        // Validate required fields
        if (!title || !content) {
            return res.status(400).json({
                success: false,
                message: 'Title and content are required'
            });
        }

        // Parse JSON strings if they are strings
        let parsedDisplaySettings = {};
        let parsedTargeting = {};

        try {
            parsedDisplaySettings = typeof displaySettings === 'string' 
                ? JSON.parse(displaySettings) 
                : displaySettings || {};
        } catch (error) {
            console.log('Error parsing displaySettings:', error);
            parsedDisplaySettings = {};
        }

        try {
            parsedTargeting = typeof targeting === 'string' 
                ? JSON.parse(targeting) 
                : targeting || {};
        } catch (error) {
            console.log('Error parsing targeting:', error);
            parsedTargeting = {};
        }

        // Handle image upload
        let imageUrl = '';
        let imagePublicId = '';
        if (req.file) {
            try {
                const uploadedImage = await uploadImage(req.file);
                imageUrl = uploadedImage.url;
                imagePublicId = uploadedImage.public_id;
            } catch (error) {
                console.log("Error in uploading popup image:", error);
                return res.status(400).json({
                    success: false,
                    message: 'Failed to upload image'
                });
            }
        }

        const popup = new Popup({
            title,
            content,
            image: imageUrl,
            imagePublicId: imagePublicId,
            productLink,
            buttonText,
            isActive: isActive !== undefined ? isActive : true,
            displaySettings: {
                delay: parsedDisplaySettings?.delay || 3000,
                frequency: parsedDisplaySettings?.frequency || 'once',
                showOnMobile: parsedDisplaySettings?.showOnMobile !== undefined ? parsedDisplaySettings.showOnMobile : true,
                showOnDesktop: parsedDisplaySettings?.showOnDesktop !== undefined ? parsedDisplaySettings.showOnDesktop : true
            },
            targeting: {
                showOnPages: parsedTargeting?.showOnPages || ['all'],
                excludePages: parsedTargeting?.excludePages || [],
                userType: parsedTargeting?.userType || 'all'
            },
            startDate: startDate || new Date(),
            endDate: endDate || null
        });

        await popup.save();

        res.status(201).json({
            success: true,
            message: 'Popup created successfully',
            popup
        });
    } catch (error) {
        console.error('Error creating popup:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Update popup (admin)
const updatePopup = async (req, res) => {
    try {
        const { id } = req.params;
        const updateData = req.body;

        // Find popup
        const popup = await Popup.findById(id);
        if (!popup) {
            return res.status(404).json({
                success: false,
                message: 'Popup not found'
            });
        }

        // Parse JSON strings if they are strings
        if (updateData.displaySettings && typeof updateData.displaySettings === 'string') {
            try {
                updateData.displaySettings = JSON.parse(updateData.displaySettings);
            } catch (error) {
                console.log('Error parsing displaySettings in update:', error);
                delete updateData.displaySettings;
            }
        }

        if (updateData.targeting && typeof updateData.targeting === 'string') {
            try {
                updateData.targeting = JSON.parse(updateData.targeting);
            } catch (error) {
                console.log('Error parsing targeting in update:', error);
                delete updateData.targeting;
            }
        }

        // Handle image upload if new image provided
        if (req.file) {
            // Delete previous image from Cloudinary if exists
            if (popup.imagePublicId) {
                try {
                    await deleteImage(popup.imagePublicId);
                } catch (cloudErr) {
                    console.log("Error deleting previous image from Cloudinary:", cloudErr);
                }
            }

            // Upload new image
            try {
                const uploadedImage = await uploadImage(req.file);
                updateData.image = uploadedImage.url;
                updateData.imagePublicId = uploadedImage.public_id;
            } catch (error) {
                console.log("Error in uploading popup image:", error);
                return res.status(400).json({
                    success: false,
                    message: 'Failed to upload image'
                });
            }
        }

        // Update popup
        const updatedPopup = await Popup.findByIdAndUpdate(
            id,
            updateData,
            { new: true, runValidators: true }
        );

        res.status(200).json({
            success: true,
            message: 'Popup updated successfully',
            popup: updatedPopup
        });
    } catch (error) {
        console.error('Error updating popup:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Delete popup (admin)
const deletePopup = async (req, res) => {
    try {
        const { id } = req.params;

        const popup = await Popup.findById(id);
        if (!popup) {
            return res.status(404).json({
                success: false,
                message: 'Popup not found'
            });
        }

        // Delete image from Cloudinary if exists
        if (popup.imagePublicId) {
            try {
                await deleteImage(popup.imagePublicId);
            } catch (cloudErr) {
                console.log("Error deleting image from Cloudinary:", cloudErr);
            }
        }

        const deletedPopup = await Popup.findByIdAndDelete(id);

        res.status(200).json({
            success: true,
            message: 'Popup deleted successfully'
        });
    } catch (error) {
        console.error('Error deleting popup:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Toggle popup status (admin)
const togglePopupStatus = async (req, res) => {
    try {
        const { id } = req.params;

        const popup = await Popup.findById(id);
        if (!popup) {
            return res.status(404).json({
                success: false,
                message: 'Popup not found'
            });
        }

        popup.isActive = !popup.isActive;
        await popup.save();

        res.status(200).json({
            success: true,
            message: `Popup ${popup.isActive ? 'activated' : 'deactivated'} successfully`,
            popup
        });
    } catch (error) {
        console.error('Error toggling popup status:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Track popup interaction (public)
const trackPopupInteraction = async (req, res) => {
    try {
        const { id } = req.params;
        const { type } = req.body; // 'click' or 'dismissal'

        if (!['click', 'dismissal'].includes(type)) {
            return res.status(400).json({
                success: false,
                message: 'Invalid interaction type'
            });
        }

        const popup = await Popup.findById(id);
        if (!popup) {
            return res.status(404).json({
                success: false,
                message: 'Popup not found'
            });
        }

        await popup.incrementAnalytics(type);

        res.status(200).json({
            success: true,
            message: 'Interaction tracked successfully'
        });
    } catch (error) {
        console.error('Error tracking popup interaction:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Get popup analytics (admin)
const getPopupAnalytics = async (req, res) => {
    try {
        const { id } = req.params;

        const popup = await Popup.findById(id);
        if (!popup) {
            return res.status(404).json({
                success: false,
                message: 'Popup not found'
            });
        }

        const analytics = {
            impressions: popup.analytics.impressions,
            clicks: popup.analytics.clicks,
            dismissals: popup.analytics.dismissals,
            ctr: popup.ctr,
            totalInteractions: popup.analytics.clicks + popup.analytics.dismissals
        };

        res.status(200).json({
            success: true,
            message: 'Analytics fetched successfully',
            analytics
        });
    } catch (error) {
        console.error('Error fetching popup analytics:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

// Get all popups analytics summary (admin)
const getPopupsAnalyticsSummary = async (req, res) => {
    try {
        const popups = await Popup.find();
        
        const summary = popups.map(popup => ({
            id: popup._id,
            title: popup.title,
            isActive: popup.isActive,
            impressions: popup.analytics.impressions,
            clicks: popup.analytics.clicks,
            dismissals: popup.analytics.dismissals,
            ctr: popup.ctr,
            createdAt: popup.createdAt
        }));

        res.status(200).json({
            success: true,
            message: 'Analytics summary fetched successfully',
            summary
        });
    } catch (error) {
        console.error('Error fetching analytics summary:', error);
        res.status(500).json({ 
            success: false,
            message: 'Internal server error' 
        });
    }
};

module.exports = {
    getAllPopups,
    getActivePopup,
    createPopup,
    updatePopup,
    deletePopup,
    togglePopupStatus,
    trackPopupInteraction,
    getPopupAnalytics,
    getPopupsAnalyticsSummary
}; 