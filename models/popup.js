const mongoose = require('mongoose');

const popupSchema = new mongoose.Schema({
    title: {
        type: String,
        required: true,
        trim: true,
        maxlength: 100
    },
    content: {
        type: String,
        required: true,
        trim: true,
        maxlength: 500
    },
    image: {
        type: String,
        required: true
    },
    imagePublicId: {
        type: String,
        default: ""
    },
    productLink: {
        type: String,
        trim: true
    },
    buttonText: {
        type: String,
        default: "Shop Now",
        trim: true,
        maxlength: 50
    },
    isActive: {
        type: Boolean,
        default: true
    },
    displaySettings: {
        delay: {
            type: Number,
            default: 3000, // 3 seconds delay
            min: 0,
            max: 30000
        },
        frequency: {
            type: String,
            enum: ['once', 'daily', 'weekly', 'always'],
            default: 'once'
        },
        showOnMobile: {
            type: Boolean,
            default: true
        },
        showOnDesktop: {
            type: Boolean,
            default: true
        }
    },
    targeting: {
        showOnPages: {
            type: [String],
            default: ['all'] // ['all', 'home', 'product', 'category', etc.]
        },
        excludePages: {
            type: [String],
            default: []
        },
        userType: {
            type: String,
            enum: ['all', 'guest', 'registered'],
            default: 'all'
        }
    },
    analytics: {
        impressions: {
            type: Number,
            default: 0
        },
        clicks: {
            type: Number,
            default: 0
        },
        dismissals: {
            type: Number,
            default: 0
        }
    },
    startDate: {
        type: Date,
        default: Date.now
    },
    endDate: {
        type: Date
    }
}, { 
    timestamps: true 
});

// Index for efficient queries
popupSchema.index({ isActive: 1, startDate: 1, endDate: 1 });

// Virtual for click-through rate
popupSchema.virtual('ctr').get(function() {
    if (this.analytics.impressions === 0) return 0;
    return ((this.analytics.clicks / this.analytics.impressions) * 100).toFixed(2);
});

// Method to check if popup should be shown
popupSchema.methods.shouldShow = function(userType = 'guest', currentPage = 'home') {
    // Check if popup is active
    if (!this.isActive) return false;
    
    // Check date range
    const now = new Date();
    if (this.startDate && now < this.startDate) return false;
    if (this.endDate && now > this.endDate) return false;
    
    // Check user type targeting
    if (this.targeting.userType !== 'all' && this.targeting.userType !== userType) {
        return false;
    }
    
    // Check page targeting
    if (this.targeting.showOnPages.length > 0 && !this.targeting.showOnPages.includes('all')) {
        if (!this.targeting.showOnPages.includes(currentPage)) {
            return false;
        }
    }
    
    // Check excluded pages
    if (this.targeting.excludePages.includes(currentPage)) {
        return false;
    }
    
    return true;
};

// Method to increment analytics
popupSchema.methods.incrementAnalytics = function(type) {
    if (type === 'impression') {
        this.analytics.impressions += 1;
    } else if (type === 'click') {
        this.analytics.clicks += 1;
    } else if (type === 'dismissal') {
        this.analytics.dismissals += 1;
    }
    return this.save();
};

module.exports = mongoose.model('Popup', popupSchema);

 