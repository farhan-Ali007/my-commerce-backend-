const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
    orderedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User'},
    guestId: { type: String, required: false },
    shippingAddress: {
        fullName: { type: String, required: true },
        city: { type: String, required: true },
        streetAddress: { type: String, required: true },
        apartment: { type: String },
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
        email: { type: String },
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
    orderedAt: { type: Date, default: Date.now },
});

module.exports = mongoose.model('Order', orderSchema);
