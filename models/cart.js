const mongoose = require('mongoose');

const cartSchema = new mongoose.Schema(
    {
        products: [
            {
                product: {
                    type: mongoose.Schema.Types.ObjectId,
                    ref: "Product",
                    required: true,
                },
                count: {
                    type: Number,
                    required: true,
                    min: 1,
                },
                price: {
                    type: Number,
                    required: true,
                    min: 0,
                },
                image: {
                    type: String,
                    required: false,
                },
                selectedVariants: [
                    {
                        name: {
                            type: String,
                            required: true,
                        },
                        values: {
                            type: Array,
                            default: [],
                            required: true,
                        },
                    },
                ],

            },
        ],
        deliveryCharges: {
            type: Number,
            default: 0,
        },
        cartTotal: {
            type: Number,
            required: true,
            default: 0,
            min: 0,
        },
        orderedBy: {
            type: mongoose.Schema.Types.ObjectId,
            ref: "User",
        },
        guestId: {
            type: String,
            required: false,
        }
    },
    { timestamps: true }
);

// Ensure every cart has either orderedBy OR guestId
cartSchema.pre('save', function (next) {
    if (!this.orderedBy && !this.guestId) {
        return next(new Error('Cart must have either orderedBy or guestId'));
    }
    next();
});

// Index for faster queries
cartSchema.index({ orderedBy: 1 });
cartSchema.index({ guestId: 1 });

const Cart = mongoose.model('Cart', cartSchema);

module.exports = Cart;
