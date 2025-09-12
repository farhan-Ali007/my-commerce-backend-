const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    guestId: { type: String, required: false },
    shippingAddress: {
        fullName: { type: String, required: true },
        streetAddress: { type: String, required: true },
        city: { type: String, required: true },
        mobile: {
            type: String,
            required: true,
            validate: {
                validator: function (v) {
                    // Regex for valid Pakistani mobile numbers
                    return /^((\+92)|(92)|(03))\d{9}$/.test(v);
                },
                message: (props) => `${props.value} is not a valid Pakistani mobile number!`,
            },
        },
        additionalInstructions: { type: String },
    },
    cartSummary: [
        {
            product: { type: mongoose.Schema.Types.ObjectId, ref: 'Product' },
            title: { type: String },
            image: { type: String },
            count: { type: Number, required: true },
            price: { type: Number, required: true },
            selectedVariants: [{ type: mongoose.Schema.Types.Mixed }]
        },
    ],
    deliveryCharges: { type: Number, default: 0 },
    freeShipping: { type: Boolean, default: false },
    totalPrice: { type: Number, required: true },
    status: {
        type: String,
        enum: ['Pending', 'Shipped', 'Delivered', 'Cancelled'],
        default: 'Pending',
    },
    // Order source: which client placed it
    source: {
        type: String,
        enum: ['web', 'mobile', 'unknown' , 'manual'],
        default: 'unknown',
        index: true,
    },
    orderedAt: { type: Date, default: Date.now },
    // Human-friendly incremental order number for external systems (e.g., courier portals)
    orderShortId: { type: Number, index: true },
    // Courier provider metadata (e.g., Leopard Courier Service)
    shippingProvider: {
        provider: { type: String, enum: ['lcs'], required: false },
        pushed: { type: Boolean, default: false },
        trackingNumber: { type: String },
        consignmentNo: { type: String },
        labelUrl: { type: String },
        extra: { type: mongoose.Schema.Types.Mixed },
        pushedAt: { type: Date },
    },
});

module.exports = mongoose.model('Order', orderSchema);
