const ColorSettings = require('../models/colorSettings');

// Get current color settings
const getColorSettings = async (req, res) => {
    try {
        let settings = await ColorSettings.findOne();
        
        // If no settings exist, create default ones
        if (!settings) {
            settings = new ColorSettings();
            await settings.save();
        }
        
        res.status(200).json({
            success: true,
            message: 'Color settings fetched successfully',
            settings
        });
    } catch (error) {
        console.error('Error fetching color settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Update color settings (admin only)
const updateColorSettings = async (req, res) => {
    try {
        const { primary, secondary } = req.body;
        
        // Validate hex color format
        const hexColorRegex = /^#([A-Fa-f0-9]{6}|[A-Fa-f0-9]{3})$/;
        
        if (primary && !hexColorRegex.test(primary)) {
            return res.status(400).json({ 
                message: 'Invalid primary color format. Use format: #RRGGBB or #RGB' 
            });
        }
        
        if (secondary && !hexColorRegex.test(secondary)) {
            return res.status(400).json({ 
                message: 'Invalid secondary color format. Use format: #RRGGBB or #RGB' 
            });
        }
        
        let settings = await ColorSettings.findOne();
        
        if (!settings) {
            settings = new ColorSettings();
        }
        
        // Update only provided colors
        if (primary) settings.primary = primary;
        if (secondary) settings.secondary = secondary;
        
        await settings.save();
        
        res.status(200).json({
            success: true,
            message: 'Color settings updated successfully',
            settings
        });
    } catch (error) {
        console.error('Error updating color settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

// Reset to default colors
const resetColorSettings = async (req, res) => {
    try {
        let settings = await ColorSettings.findOne();
        
        if (!settings) {
            settings = new ColorSettings();
        } else {
            // Reset to default values
            settings.primary = "#000000";
            settings.secondary = "#FFB727";
        }
        
        await settings.save();
        
        res.status(200).json({
            success: true,
            message: 'Color settings reset to default successfully',
            settings
        });
    } catch (error) {
        console.error('Error resetting color settings:', error);
        res.status(500).json({ message: 'Internal server error' });
    }
};

module.exports = {
    getColorSettings,
    updateColorSettings,
    resetColorSettings
}; 