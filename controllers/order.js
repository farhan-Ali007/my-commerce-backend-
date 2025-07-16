const Order = require('../models/order');
const Product = require('../models/product');
const { v4: uuidv4 } = require('uuid')

const creatOrder = async (req, res) => {
    try {
        const { shippingAddress, cartSummary, totalPrice, freeShipping, deliveryCharges } = req.body;
        console.log("Coming order from frontend------>", req.body);

        let userId = req.body.userId;
        const isGuest = !userId;

        // Handle guest users
        if (isGuest) {
            userId = req.cookies?.guestId || uuidv4();
            console.log("userId---->", userId);
            if (!req.cookies?.guestId) {
                res.cookie('guestId', userId, {
                    maxAge: 30 * 24 * 60 * 60 * 1000, 
                    httpOnly: true,
                });
            }
        }

        // Validate stock before proceeding
        for (const item of cartSummary) {
            console.log("Checking stock for product:", item.productId);
            const product = await Product.findById(item.productId);
            if (!product) {
                return res.status(404).json({ error: `Product not found: ${item.product}` });
            }
            if (product.stock < item.count) {
                return res.status(400).json({ error: `Insufficient stock for product: ${product.title}` });
            }
        }

        // Update product stock and sold count using bulkWrite
        const bulkOperations = cartSummary.map((item) => ({
            updateOne: {
                filter: { _id: item.productId },
                update: {
                    $inc: {
                        stock: -item.count,
                        sold: item.count,
                    },
                },
            },
        }));

        const bulkWriteResult = await Product.bulkWrite(bulkOperations);

        // Check if all products were updated successfully
        if (bulkWriteResult.modifiedCount !== cartSummary.length) {
            return res.status(400).json({ error: 'Failed to update all products' });
        }

        // Create a new order
        const newOrder = new Order({
            orderedBy: isGuest ? null : userId,
            guestId: isGuest ? userId : null,
            shippingAddress,
            cartSummary,
            totalPrice,
            freeShipping,
            deliveryCharges,
        });

        const savedOrder = await newOrder.save();
        // if (isGuest) {
        //     await Cart.findOneAndDelete({ guestId: userId });
        // } else {
        //     await Cart.findOneAndDelete({ orderedBy: userId });
        // }

        res.status(201).json({ message: 'Order placed successfully!', order: savedOrder });
    } catch (error) {
        console.error('Error creating order:', error);
        res.status(500).json({
            error: 'Failed to create order',
            details: error.message,
        });
    }
};

const getMyOrders = async (req, res) => {
    try {
        let { userId } = req.params;
        const guestId = req.cookies?.guestId;

        console.log("userId---->", userId);
        console.log("guestId---->", guestId);

        // Ensure userId is a valid MongoDB ObjectId or null
        const query = [];
        if (userId && userId.length === 24) {
            query.push({ orderedBy: userId });  // Only push if valid ObjectId
        }
        if (guestId) {
            query.push({ guestId });
        }

        if (query.length === 0) {
            // If no user ID or guest ID, return an empty array with 200 OK
            return res.status(200).json({ orders: [] });
        }

        const orders = await Order.find({
            $or: query
        })
            .populate('cartSummary.product')
            .populate('orderedBy', 'username email')
            .populate('shippingAddress')
            .sort({ orderedAt: -1 });

        res.status(200).json({ orders });
        console.log("My orders------->", orders)
    } catch (error) {
        console.error('Error fetching my orders:', error);
        res.status(500).json({ error: 'Failed to fetch orders' });
    }
};


const updateOrderStatus = async (req, res) => {
    try {
        const { orderId } = req.params;
        const { status } = req.body;
        const updatedOrder = await Order.findByIdAndUpdate(orderId, { status }, { new: true });
        if (!updatedOrder) return res.status(404).json({ error: 'Order not found' });
        res.status(200).json({ message: 'Order status updated', order: updatedOrder });
    } catch (error) {
        console.error('Error updating order status:', error);
        res.status(500).json({ error: 'Failed to update order status' });
    }
};

const getAllOrders = async (req, res) => {
    try {
        const page = parseInt(req.query.page) || 1;
        const limit = parseInt(req.query.limit) || 10;
        const skip = (page - 1) * limit;

        const [orders, total] = await Promise.all([
            Order.find({})
                .populate('cartSummary.product', 'title price')
                .populate('orderedBy', 'username email streetAddress')
                .sort({ orderedAt: -1 })
                .skip(skip)
                .limit(limit),
            Order.countDocuments()
        ]);
        res.status(200).json({
            success: true,
            orders,
            total,
            page,
            totalPages: Math.ceil(total / limit)
        });
    } catch (error) {
        console.log("Error in getting all orders:", error);
        res.status(500).json({
            message: "Internal server error"
        });
    }
}

const getRecentOrders = async (req, res) => {
    try {
        const last24Hours = new Date();
        last24Hours.setDate(last24Hours.getDate() - 1);

        const recentOrders = await Order.find({ orderedAt: { $gte: last24Hours } })
            .populate('cartSummary.product', 'title price')
            .populate('orderedBy', 'username email streetAddress')
            .sort({ orderedAt: -1 });
        res.status(200).json({
            success: true,
            orders: recentOrders,
        });
    } catch (error) {
        console.error('Error fetching recent orders:', error);
        res.status(500).json({
            message: 'Failed to fetch recent orders',
        });
    }
};
module.exports = { creatOrder, getMyOrders, updateOrderStatus, getAllOrders, getRecentOrders }
