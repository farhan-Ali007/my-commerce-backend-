const Order = require("../models/order");
const Product = require("../models/product");
const { v4: uuidv4 } = require("uuid");
const { createNotification } = require("./notification");
const { sendOrderEmailToAdmin } = require("../utils/mailer");

const creatOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      cartSummary,
      totalPrice,
      freeShipping,
      deliveryCharges,
    } = req.body;
    console.log("Coming order from frontend------>", req.body);

    let userId = req.body.userId;
    const isGuest = !userId;

    // Handle guest users
    if (isGuest) {
      userId = req.cookies?.guestId || uuidv4();
      console.log("userId---->", userId);
      if (!req.cookies?.guestId) {
        res.cookie("guestId", userId, {
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
        return res
          .status(404)
          .json({ error: `Product not found: ${item.product}` });
      }
      if (product.stock < item.count) {
        return res
          .status(400)
          .json({ error: `Insufficient stock for product: ${product.title}` });
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
      return res.status(400).json({ error: "Failed to update all products" });
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

    // Create notification for order placement (only for registered users)
    if (!isGuest && userId) {
      try {
        await createNotification(
          userId,
          "order_placed",
          "Order Placed Successfully!",
          `Your order #${savedOrder._id}\\n has been placed successfully.\n We'll notify you when it ships.`,
          savedOrder._id,
          { orderTotal: totalPrice }
        );
      } catch (notificationError) {
        console.error("Error creating order notification:", notificationError);
        // Don't fail the order creation if notification fails
      }
    }

    // Create notifications for all admin users
    try {
      const User = require("../models/user");
      const adminUsers = await User.find({ role: "admin" });

      // Get customer details for admin notification
      let customerName = "Guest User";

      if (!isGuest && userId) {
        const customer = await User.findById(userId);
        if (customer) {
          customerName = customer.username;
        }
      }

      // Create admin notifications
      for (const admin of adminUsers) {
        await createNotification(
          admin._id,
          "admin_order",
          "New Order Received!",
          `New order #${savedOrder._id}\nfrom ${customerName} - Total: $${totalPrice}`,
          savedOrder._id,
          {
            orderId: savedOrder._id,
            customerName,
            orderTotal: totalPrice,
            itemCount: cartSummary.length,
            isGuest: isGuest,
          }
        );
      }

      console.log(
        `Created admin notifications for ${adminUsers.length} admin users`
      );

      // Send email notification to admin
      try {
        // Get product details for email
        const productIds = cartSummary.map((item) => item.productId);
        const products = await Product.find({
          _id: { $in: productIds },
        }).select("title slug price");

        // Map cart items with product details
        const productsWithDetails = cartSummary.map((item) => {
          const product = products.find(
            (p) => p._id.toString() === item.productId
          );
          return {
            ...item,
            title: product?.title || "Unknown Product",
            slug: product?.slug || "product",
            price: product?.price || 0,
          };
        });

        const orderEmail = await sendOrderEmailToAdmin({
          order: savedOrder,
          products: productsWithDetails,
          adminEmail: process.env.ADMIN_EMAIL || "info@etimadmart.com",
        });

        console.log("Order notification email sent to admin", orderEmail);
      } catch (emailError) {
        console.error("Error sending order email to admin:", emailError);
        // Don't fail the order creation if email fails
      }
    } catch (adminNotificationError) {
      console.error(
        "Error creating admin notifications:",
        adminNotificationError
      );
      // Don't fail the order creation if admin notifications fail
    }

    res
      .status(201)
      .json({ message: "Order placed successfully!", order: savedOrder });
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      error: "Failed to create order",
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
      query.push({ orderedBy: userId }); // Only push if valid ObjectId
    }
    if (guestId) {
      query.push({ guestId });
    }

    if (query.length === 0) {
      // If no user ID or guest ID, return an empty array with 200 OK
      return res.status(200).json({ orders: [] });
    }

    const orders = await Order.find({
      $or: query,
    })
      .populate("cartSummary.product")
      .populate("orderedBy", "username mobile")
      .populate("shippingAddress")
      .sort({ orderedAt: -1 });

    res.status(200).json({ orders });
    console.log("My orders------->", orders);
  } catch (error) {
    console.error("Error fetching my orders:", error);
    res.status(500).json({ error: "Failed to fetch orders" });
  }
};

const updateOrderStatus = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { status } = req.body;
    const updatedOrder = await Order.findByIdAndUpdate(
      orderId,
      { status },
      { new: true }
    );
    if (!updatedOrder)
      return res.status(404).json({ error: "Order not found" });

    // Create notification for user when order status changes
    if (updatedOrder.orderedBy) {
      try {
        let notificationType = "order_status";
        let notificationTitle = "Order Status Updated";
        let notificationMessage = `Your order #${orderId}\nstatus has been updated to "${status}".`;

        // Use specific notification types for different statuses
        switch (status) {
          case "shipped":
            notificationType = "order_shipped";
            notificationTitle = "Order Shipped!";
            notificationMessage = `Your order #${orderId}\nhas been shipped and is on its way to you!`;
            break;
          case "delivered":
            notificationType = "order_delivered";
            notificationTitle = "Order Delivered!";
            notificationMessage = `Your order #${orderId}\nhas been delivered successfully!`;
            break;
          case "cancelled":
            notificationType = "order_cancelled";
            notificationTitle = "Order Cancelled";
            notificationMessage = `Your order #${orderId}\nhas been cancelled.`;
            break;
        }

        await createNotification(
          updatedOrder.orderedBy,
          notificationType,
          notificationTitle,
          notificationMessage,
          orderId,
          { orderStatus: status }
        );
      } catch (notificationError) {
        console.error(
          "Error creating status update notification:",
          notificationError
        );
        // Don't fail the status update if notification fails
      }
    }

    res
      .status(200)
      .json({ message: "Order status updated", order: updatedOrder });
  } catch (error) {
    console.error("Error updating order status:", error);
    res.status(500).json({ error: "Failed to update order status" });
  }
};

const getAllOrders = async (req, res) => {
  try {
    const page = parseInt(req.query.page) || 1;
    const limit = parseInt(req.query.limit) || 10;
    const skip = (page - 1) * limit;

    const [orders, total] = await Promise.all([
      Order.find({})
        .populate("cartSummary.product", "title price")
        .populate("orderedBy", "username mobile streetAddress")
        .sort({ orderedAt: -1 })
        .skip(skip)
        .limit(limit),
      Order.countDocuments(),
    ]);
    res.status(200).json({
      success: true,
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.log("Error in getting all orders:", error);
    res.status(500).json({
      message: "Internal server error",
    });
  }
};

const getRecentOrders = async (req, res) => {
  try {
    const last24Hours = new Date();
    last24Hours.setDate(last24Hours.getDate() - 1);

    const recentOrders = await Order.find({ orderedAt: { $gte: last24Hours } })
      .populate("cartSummary.product", "title price")
      .populate("orderedBy", "username mobile streetAddress")
      .sort({ orderedAt: -1 });
    res.status(200).json({
      success: true,
      orders: recentOrders,
    });
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({
      message: "Failed to fetch recent orders",
    });
  }
};
module.exports = {
  creatOrder,
  getMyOrders,
  updateOrderStatus,
  getAllOrders,
  getRecentOrders,
};
