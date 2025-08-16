const { default: mongoose } = require('mongoose');
const Cart = require('../models/cart');
const { v4: uuidv4 } = require('uuid')

const addItemToCart = async (req, res) => {

    const { cart } = req.body;
    let userId = req.body.userId;
    const isGuest = !userId;

    console.log("coming cart---->", cart)
    console.log("Cookies in request--------->", req.cookies);

    if (isGuest) {
        userId = req.cookies?.guestId || uuidv4();
        console.log("userId---->", userId)
        if (!req.cookies?.guestId) {
            res.cookie('guestId', userId, {
                httpOnly: true,
                sameSite: 'None',
                secure: true,
                maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
            });
        }
    }

    try {
        const normalizeImage = (img) => {
            if (!img) return "";
            if (typeof img === 'string') return img;
            if (typeof img === 'object') return img.url || img.secure_url || "";
            return "";
        };

        let userCart;

        if (isGuest) {
            userCart = await Cart.findOne({ guestId: userId });
        } else {
            if (!mongoose.Types.ObjectId.isValid(userId)) {
                return res.status(400).json({ message: 'Invalid user ID' });
            }
            userCart = await Cart.findOne({ orderedBy: userId });
        }

        if (!cart || !Array.isArray(cart.products)) {
            return res.status(400).json({ message: 'Invalid cart data' });
        }
        const deliveryCharges = cart.deliveryCharges || 0;

        const formattedProducts = cart.products.map(item => ({
            product: item.productId,
            count: item.count,
            price: item.price,
            selectedVariants: item.selectedVariants || [],
            image: normalizeImage(item.image), // ensure image is a string URL
        }));

        const cartTotal = formattedProducts.reduce((total, item) => total + item.count * item.price, 0);

        if (userCart) {
            userCart.products = formattedProducts;
            userCart.cartTotal = cartTotal;
            userCart.deliveryCharges = deliveryCharges;
        } else {
            const cartData = {
                products: formattedProducts,
                cartTotal: cartTotal,
                deliveryCharges
            };

            if (isGuest) {
                cartData.guestId = userId;
            } else {
                cartData.orderedBy = userId;
            }

            userCart = new Cart(cartData);
        }

        await userCart.save();

        res.status(200).json({ message: 'Cart saved successfully', cart: userCart, isGuest });
    } catch (error) {
        console.error("Error in saving cart---->", error);
        res.status(500).json({ message: 'Error saving cart', error });
    }
};

const getCart = async (req, res) => {
    const { userId } = req.params;
    const guestId = req.cookies?.guestId;

    console.log("coming userId------>", userId)
    console.log("coming guestId------>", guestId)

    try {
        let cart;
        // Check if we have a valid userId first
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            cart = await Cart.findOne({ orderedBy: userId })
                .populate('products.product', 'title , price , salePrice , category, images , stock');
        }
        // If no userId or no cart found with userId, try guestId
        if (!cart && guestId) {
            cart = await Cart.findOne({ guestId })
                .populate('products.product', 'title , price , salePrice , category, images , stock');
        }

        if (!cart) {
            return res.status(404).json({ message: 'Cart not found' });
        }

        console.log("My cart---------->" , cart)

        res.status(200).json({
            ...cart.toObject(),
            isGuest: !cart.orderedBy
        });
    } catch (error) {
        console.log("Error in getting cart", error);
        res.status(500).json({ message: 'Error fetching cart', error });
    }
};

const clearCart = async (req, res) => {
    const { userId } = req.params;
    const guestId = req.cookies?.guestId;

    try {
        let deleted = false;
        if (userId && mongoose.Types.ObjectId.isValid(userId)) {
            const result = await Cart.deleteMany({ orderedBy: userId });
            if (result.deletedCount > 0) deleted = true;
        }
        if (guestId) {
            const result = await Cart.deleteMany({ guestId });
            if (result.deletedCount > 0) deleted = true;
        }
        if (!deleted) {
            return res.status(404).json({ message: 'Cart not found' });
        }
        console.log('Cart(s) cleared for userId:', userId, 'guestId:', guestId);
        res.status(200).json({ message: 'Cart cleared' });
    } catch (error) {
        res.status(500).json({ message: 'Error clearing cart', error });
    }
};

const mergeGuestCartWithUser = async (req, res) => {
    const { userId } = req.body;
    const guestId = req.cookies?.guestId;

    console.log("coming body------>", req.body)
    console.log("coming userId------>", userId)
    console.log("coming guestId------>", guestId)

    if (!guestId || !userId || !mongoose.Types.ObjectId.isValid(userId)) {
        return res.status(400).json({ message: 'Missing or invalid IDs' });
    }

    try {
        // Get the guest cart
        const guestCart = await Cart.findOne({ guestId });
        if (!guestCart) {
            return res.status(404).json({ message: 'Guest cart not found' });
        }

        // Get or create user cart
        let userCart = await Cart.findOne({ orderedBy: userId });
        if (!userCart) {
            userCart = new Cart({
                orderedBy: userId,
                products: [],
                cartTotal: 0,
                deliveryCharges: 0
            });
        }

        // Merge products from guest cart into user cart
        // This is a simple merge - you might want to add logic to handle duplicates
        const combinedProducts = [...userCart.products];

        for (const guestProduct of guestCart.products) {
            const existingProductIndex = combinedProducts.findIndex(
                p => p.product.toString() === guestProduct.product.toString() &&
                    JSON.stringify(p.selectedVariants) === JSON.stringify(guestProduct.selectedVariants)
            );

            if (existingProductIndex !== -1) {
                // Product exists, update count
                combinedProducts[existingProductIndex].count += guestProduct.count;
            } else {
                // Add new product
                combinedProducts.push(guestProduct);
            }
        }

        // Update user cart
        userCart.products = combinedProducts;
        userCart.cartTotal = combinedProducts.reduce(
            (total, item) => total + item.count * item.price, 0
        );
        userCart.deliveryCharges = Math.max(userCart.deliveryCharges, guestCart.deliveryCharges);

        await userCart.save();

        // Delete guest cart
        await Cart.findOneAndDelete({ guestId });

        // Clear guestId cookie
        res.clearCookie('guestId');

        res.status(200).json({
            message: 'Carts merged successfully',
            cart: userCart
        });
    } catch (error) {
        console.error("Error merging carts:", error);
        res.status(500).json({ message: 'Error merging carts', error });
    }
};


module.exports = { addItemToCart, clearCart, getCart, mergeGuestCartWithUser };