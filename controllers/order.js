const Order = require("../models/order");
const Product = require("../models/product");
const Counter = require("../models/counter");
const { v4: uuidv4 } = require("uuid");
const { createNotification } = require("./notification");
const { sendOrderEmailToAdmin } = require("../utils/mailer");
const User = require("../models/user");
const Coupon = require("../models/coupon");

const creatOrder = async (req, res) => {
  try {
    const {
      shippingAddress,
      cartSummary,
      totalPrice,
      freeShipping,
      deliveryCharges,
      couponCode,
      couponType,
      discountAmount,
    } = req.body;
    console.log("Coming order from frontend------>", req.body);

    let userId = req.body.userId;
    const isGuest = !userId;

    // Handle guest users
   if (isGuest) {
      userId = req.cookies?.guestId || uuidv4();
      console.log("userId---->", userId);
      if (!req.cookies?.guestId) {
        const isProd = process.env.NODE_ENV === "production";
        res.cookie("guestId", userId, {
          maxAge: 30 * 24 * 60 * 60 * 1000,
          httpOnly: true,
          path: "/",
          sameSite: isProd ? "none" : "lax",
          secure: isProd,
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

    // Determine order source (web/mobile/manual/unknown)
    const clientHeader = (req.get("X-Client") || "").toLowerCase();
    let source = "unknown";
    if (clientHeader === "mobile") source = "mobile";
    else if (clientHeader === "web") source = "web";
    else if (clientHeader === "manual") source = "manual";
    else {
      const ua = (req.get("User-Agent") || "").toLowerCase();
      // Simple UA heuristic fallback
      if (
        ua.includes("mozilla") ||
        ua.includes("chrome") ||
        ua.includes("safari")
      ) {
        source = "web";
      }
    }

    // Generate incremental short order id (starts at 1000)
    const seqDoc = await Counter.findOneAndUpdate(
      { _id: "order" },
      { $inc: { seq: 1 } },
      { new: true, upsert: true }
    );
    const orderShortId = (seqDoc?.seq || 0) + 1000;

    // Create a new order
    const newOrder = new Order({
      orderedBy: isGuest ? null : userId,
      guestId: isGuest ? userId : null,
      shippingAddress,
      cartSummary,
      totalPrice,
      freeShipping,
      deliveryCharges,
      couponCode: couponCode || undefined,
      couponType: couponType || undefined,
      discountAmount: Number(discountAmount || 0),
      source,
      orderShortId,
    });

    const savedOrder = await newOrder.save();
    // Increment coupon usage if applied (best-effort, do not block response)
    if (couponCode) {
      try {
        await Coupon.updateOne(
          { code: String(couponCode).toUpperCase().trim() },
          { $inc: { usedCount: 1 } }
        );
      } catch (e) {
        console.warn('Failed to increment coupon usedCount:', e?.message || e);
      }
    }
    res
      .status(201)
      .json({
        message: "Order placed successfully!",
        order: savedOrder,
        // Expose guestId in response so frontend can persist when 3P cookies are blocked
        guestId: isGuest ? userId : undefined,
      });

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
          `New order #${savedOrder._id}\nfrom ${customerName} - Total: Rs.${totalPrice}`,
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
        }).select("title slug price salePrice images");

        // Build a lookup map for robust matching
        const productMap = new Map(products.map((p) => [p._id.toString(), p]));

        // Map cart items with product details (title, slug, image, price/salePrice)
        const productsWithDetails = cartSummary.map((item) => {
          // Determine product id key robustly (supports productId, product, _id, nested)
          const rawId =
            item?.productId ?? item?.product ?? item?._id ?? item?.product?._id;
          const key =
            rawId && rawId.toString ? rawId.toString() : String(rawId);
          const product = productMap.get(key);

          // Derive first image URL from either string or object form
          let firstImageUrl = null;
          if (Array.isArray(product?.images) && product.images.length > 0) {
            const first = product.images[0];
            firstImageUrl =
              typeof first === "string" ? first : first?.url || null;
          }

          const title = item?.title ?? product?.title ?? "Unknown Product";
          const imageUrl = item?.image ?? firstImageUrl;
          const salePrice = Number(
            item?.price != null
              ? item.price
              : product?.salePrice ?? product?.price ?? 0
          );
          const price = Number(product?.price ?? item?.price ?? salePrice ?? 0);

          return {
            ...item,
            title,
            slug: product?.slug || "product",
            price,
            salePrice,
            count: Number(item?.count ?? 1),
            imageUrl,
          };
        });

        const adminEmail = process.env.ADMIN_EMAIL || "info@my.etimadmart.com";

        // Mailer currently disabled. Uncomment to enable sending admin emails.
        // const result = await sendOrderEmailToAdmin({
        //   order: savedOrder,
        //   products: productsWithDetails,
        //   adminEmail: adminEmail,
        // });
        // console.log("Email sent to admin:", result);
        console.log("Admin email send skipped (mailer disabled)");
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
  } catch (error) {
    console.error("Error creating order:", error);
    res.status(500).json({
      error: "Failed to create order",
      details: error.message,
    });
  }
};

// Admin: Update order details (shipping address fields and additional instructions) when order is still editable
const updateOrderDetails = async (req, res) => {
  try {
    const { orderId } = req.params;
    const { shippingAddress } = req.body;

    if (!orderId) return res.status(400).json({ error: "orderId is required" });
    if (!shippingAddress || typeof shippingAddress !== 'object') {
      return res.status(400).json({ error: "shippingAddress payload is required" });
    }

    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: "Order not found" });

    // Guard: allow editing only if order is Pending and not pushed to courier
    if (order.status !== 'Pending') {
      return res.status(400).json({ error: "Only Pending orders can be edited" });
    }
    if (order?.shippingProvider?.pushed) {
      return res.status(400).json({ error: "Order already pushed to courier; cannot edit" });
    }

    // Whitelist fields to update
    const next = {
      fullName: shippingAddress.fullName ?? order.shippingAddress.fullName,
      streetAddress: shippingAddress.streetAddress ?? order.shippingAddress.streetAddress,
      city: shippingAddress.city ?? order.shippingAddress.city,
      mobile: shippingAddress.mobile ?? order.shippingAddress.mobile,
      additionalInstructions: shippingAddress.additionalInstructions ?? order.shippingAddress.additionalInstructions,
    };

    // Basic validation
    if (!next.fullName || !next.streetAddress || !next.city || !next.mobile) {
      return res.status(400).json({ error: "Missing required shipping fields" });
    }

    order.shippingAddress = next;
    const saved = await order.save();
    return res.status(200).json({ success: true, order: saved });
  } catch (error) {
    console.error('Error updating order details:', error);
    return res.status(500).json({ error: 'Failed to update order details' });
  }
};

// Admin: Delete an order if still Pending and not pushed to courier
const deleteOrder = async (req, res) => {
  try {
    const { orderId } = req.params;
    if (!orderId) return res.status(400).json({ error: 'orderId is required' });
    const order = await Order.findById(orderId);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    if (order.status !== 'Pending') {
      return res.status(400).json({ error: 'Only Pending orders can be deleted' });
    }
    if (order?.shippingProvider?.pushed) {
      return res.status(400).json({ error: 'Order already pushed to courier; cannot delete' });
    }

    await Order.deleteOne({ _id: orderId });
    return res.status(200).json({ success: true });
  } catch (error) {
    console.error('Error deleting order:', error);
    return res.status(500).json({ error: 'Failed to delete order' });
  }
};

const getMyOrders = async (req, res) => {
  try {
    let { userId } = req.params;
    // Accept guestId from cookie OR explicit header/query for environments where 3P cookies are blocked
    const guestId =
      req.cookies?.guestId ||
      req.get("X-Guest-Id") ||
      req.query.guestId;

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

    const orders = await Order.find({ $or: query })
      .populate({
        path: "orderedBy",
        select: "name email phoneNumber address city zipCode",
      })
      .populate({
        path: "cartSummary.product",
        select: "title slug price salePrice images",
      })
      .sort({ orderedAt: -1 });

    res.set("Cache-Control", "no-store");
    res.set("Vary", "Origin, Cookie, Authorization, X-Guest-Id");
    res.status(200).json({ orders });
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

    // Use aggregation pipeline like searchOrders to ensure all fields are included
    const pipeline = [
      { $match: { orderedAt: { $gte: last24Hours } } },
      { $sort: { orderedAt: -1 } },
      {
        $project: {
          orderedBy: 1,
          guestId: 1,
          shippingAddress: 1,
          cartSummary: 1,
          deliveryCharges: 1,
          freeShipping: 1,
          totalPrice: 1,
          status: 1,
          source: 1,
          orderedAt: 1,
        },
      },
    ];

    const recentOrders = await Order.aggregate(pipeline);
    
    // Populate product and user data
    const idsInOrder = recentOrders.map((d) => d._id);
    let populatedOrders = [];
    if (idsInOrder.length) {
      const found = await Order.find({ _id: { $in: idsInOrder } })
        .populate("cartSummary.product", "title price")
        .populate("orderedBy", "username mobile streetAddress");
      const map = new Map(found.map((o) => [String(o._id), o]));
      populatedOrders = idsInOrder.map((id) => map.get(String(id))).filter(Boolean);
    }

    res.status(200).json({
      success: true,
      orders: populatedOrders,
    });
  } catch (error) {
    console.error("Error fetching recent orders:", error);
    res.status(500).json({
      message: "Failed to fetch recent orders",
    });
  }
};

// Live search and sorting for orders (admin)
// Query params:
// q: search term (matches shippingAddress.fullName, shippingAddress.mobile, orderedBy.username, orderedBy.mobile)
// status: filter by order status (Pending|Shipped|Delivered|Cancelled)
// sortBy: 'status' | 'orderedAt' (default 'orderedAt')
// sortOrder: 'asc' | 'desc' (default 'desc' for orderedAt, 'asc' for status)
// page, limit: pagination
const searchOrders = async (req, res) => {
  try {
    const {
      q = "",
      status,
      sortBy = "orderedAt",
      sortOrder,
    } = req.query;

    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    // Build dynamic aggregation
    const matchStage = {};
    if (status) {
      matchStage.status = status;
    }

    // Default sort
    let sortStage = {};
    if (sortBy === "status") {
      // Custom sort order for status
      const orderDir = (sortOrder || "asc").toLowerCase() === "desc" ? -1 : 1;
      sortStage = { statusOrder: orderDir, orderedAt: -1 };
    } else {
      const orderDir = (sortOrder || "desc").toLowerCase() === "asc" ? 1 : -1;
      sortStage = { orderedAt: orderDir };
    }

    const pipeline = [
      // Join user for searching by username/mobile
      {
        $lookup: {
          from: "users",
          localField: "orderedBy",
          foreignField: "_id",
          as: "orderedByUser",
        },
      },
      { $unwind: { path: "$orderedByUser", preserveNullAndEmptyArrays: true } },
      // Status filter (if any)
      { $match: matchStage },
      // Add status order for custom sorting
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Pending"] }, then: 1 },
                { case: { $eq: ["$status", "Shipped"] }, then: 2 },
                { case: { $eq: ["$status", "Delivered"] }, then: 3 },
                { case: { $eq: ["$status", "Cancelled"] }, then: 4 },
              ],
              default: 99,
            },
          },
        },
      },
    ];

    // Text search (case-insensitive) on name/mobile (shipping address and user)
    const trimmedQ = String(q).trim();
    if (trimmedQ) {
      const regex = new RegExp(trimmedQ.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      pipeline.push({
        $match: {
          $or: [
            { "shippingAddress.fullName": { $regex: regex } },
            { "shippingAddress.mobile": { $regex: regex } },
            { "orderedByUser.username": { $regex: regex } },
            { "orderedByUser.mobile": { $regex: regex } },
          ],
        },
      });
    }

    pipeline.push(
      { $sort: sortStage },
      {
        $facet: {
          data: [
            { $skip: skip },
            { $limit: limit },
            // Project minimal fields plus user preview
            {
              $project: {
                orderedBy: 1,
                guestId: 1,
                shippingAddress: 1,
                cartSummary: 1,
                deliveryCharges: 1,
                freeShipping: 1,
                totalPrice: 1,
                status: 1,
                source: 1,
                orderedAt: 1,
                orderedByPreview: {
                  _id: "$orderedByUser._id",
                  username: "$orderedByUser.username",
                  mobile: "$orderedByUser.mobile",
                  streetAddress: "$orderedByUser.streetAddress",
                },
              },
            },
          ],
          totalCount: [{ $count: "count" }],
        },
      }
    );

    const aggResult = await Order.aggregate(pipeline);
    const data = aggResult?.[0]?.data || [];
    const total = aggResult?.[0]?.totalCount?.[0]?.count || 0;

    // Optionally populate product titles like getAllOrders
    // We'll re-fetch by ids to leverage existing populate logic while preserving pagination order
    const idsInOrder = data.map((d) => d._id);
    let populatedOrders = [];
    if (idsInOrder.length) {
      const found = await Order.find({ _id: { $in: idsInOrder } })
        .populate("cartSummary.product", "title price")
        .populate("orderedBy", "username mobile streetAddress");
      const map = new Map(found.map((o) => [String(o._id), o]));
      populatedOrders = idsInOrder.map((id) => map.get(String(id))).filter(Boolean);
    }

    res.status(200).json({
      success: true,
      orders: populatedOrders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error searching orders:", error);
    res.status(500).json({ message: "Failed to search orders" });
  }
};

// Sort orders by status (admin)
// Query params:
// status: optional exact status to filter (Pending|Shipped|Delivered|Cancelled)
// order: 'asc' (Pending→Cancelled) or 'desc' (Cancelled→Pending). Default 'asc'
// page, limit: pagination
const sortOrdersByStatus = async (req, res) => {
  try {
    const { status, order = "asc" } = req.query;
    const page = parseInt(req.query.page, 10) || 1;
    const limit = parseInt(req.query.limit, 10) || 10;
    const skip = (page - 1) * limit;

    const matchStage = {};
    if (status) matchStage.status = status;

    const direction = String(order).toLowerCase() === "desc" ? -1 : 1;

    const pipeline = [
      { $match: matchStage },
      {
        $addFields: {
          statusOrder: {
            $switch: {
              branches: [
                { case: { $eq: ["$status", "Pending"] }, then: 1 },
                { case: { $eq: ["$status", "Shipped"] }, then: 2 },
                { case: { $eq: ["$status", "Delivered"] }, then: 3 },
                { case: { $eq: ["$status", "Cancelled"] }, then: 4 },
              ],
              default: 99,
            },
          },
        },
      },
      { $sort: { statusOrder: direction, orderedAt: -1 } },
      {
        $facet: {
          data: [ { $skip: skip }, { $limit: limit } ],
          totalCount: [ { $count: "count" } ]
        }
      }
    ];

    const agg = await Order.aggregate(pipeline);
    const data = agg?.[0]?.data || [];
    const total = agg?.[0]?.totalCount?.[0]?.count || 0;

    // Populate to match other responses
    const ids = data.map((d) => d._id);
    let orders = [];
    if (ids.length) {
      const found = await Order.find({ _id: { $in: ids } })
        .populate("cartSummary.product", "title price")
        .populate("orderedBy", "username mobile streetAddress");
      const map = new Map(found.map((o) => [String(o._id), o]));
      orders = ids.map((id) => map.get(String(id))).filter(Boolean);
    }

    res.status(200).json({
      success: true,
      orders,
      total,
      page,
      totalPages: Math.ceil(total / limit),
    });
  } catch (error) {
    console.error("Error sorting orders by status:", error);
    res.status(500).json({ message: "Failed to sort orders by status" });
  }
};
module.exports = {
  creatOrder,
  getMyOrders,
  updateOrderStatus,
  getAllOrders,
  getRecentOrders,
  searchOrders,
  sortOrdersByStatus,
  updateOrderDetails,
  deleteOrder,
};
