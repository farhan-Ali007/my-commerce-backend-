const nodemailer = require("nodemailer");

// Create transporter (production-hardened)
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpSecureEnv = String(process.env.SMTP_SECURE || "").toLowerCase();
// Use secure for port 465 or explicit SMTP_SECURE=true
const smtpSecure = smtpSecureEnv === "true" || smtpPort === 465;

const transporter = nodemailer.createTransport({
  host: smtpHost,
  port: smtpPort,
  secure: smtpSecure,
  // Some providers behind PaaS block long-lived SMTP pools; keep small and configurable
  pool: process.env.SMTP_POOL ? process.env.SMTP_POOL === "true" : true,
  maxConnections: Number(process.env.SMTP_MAX_CONNECTIONS || 2),
  maxMessages: Number(process.env.SMTP_MAX_MESSAGES || 50),
  rateDelta: Number(process.env.SMTP_RATE_DELTA || 60_000),
  rateLimit: Number(process.env.SMTP_RATE_LIMIT || 100),
  // Timeouts to avoid hanging the request forever
  connectionTimeout: Number(process.env.SMTP_CONNECTION_TIMEOUT || 10_000),
  greetingTimeout: Number(process.env.SMTP_GREETING_TIMEOUT || 10_000),
  socketTimeout: Number(process.env.SMTP_SOCKET_TIMEOUT || 20_000),
  // For STARTTLS on 587, some providers require this
  requireTLS: process.env.SMTP_REQUIRE_TLS === "true",
  // Allow opting out of TLS verification in tricky hosting environments (not recommended)
  tls: process.env.SMTP_IGNORE_TLS_ERRORS === "true" ? { rejectUnauthorized: false } : undefined,
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send order notification email to admin
const sendOrderEmailToAdmin = async ({ order, products, adminEmail }) => {
  try {
    // Create product table rows HTML (email-friendly)
    const frontendUrl = process.env.BASE_URL;
    const productRows = products
      .map((item) => {
        const qty = Number(item?.count ?? 1);
        const unit = Number(item?.salePrice ?? item?.price ?? 0);
        const mrp = item?.price != null ? Number(item.price) : null;
        const lineTotal = unit * qty;
        const title = item?.title || "Unknown Product";
        const slug = item?.slug || "product";

        return `
          <tr>
            <td style="padding:10px;border-bottom:1px solid #ececec;">
              ${
                item?.imageUrl
                  ? `<img src="${item.imageUrl}" alt="${title}" width="64" height="64" style="display:block;border:1px solid #eee;border-radius:4px;object-fit:cover;" />`
                  : `<div style=\"width:64px;height:64px;border:1px solid #eee;border-radius:4px;background:#f5f5f5;\"></div>`
              }
            </td>
            <td style="padding:10px;border-bottom:1px solid #ececec;">
              <a href="${frontendUrl}/product/${slug}" target="_blank" style="color:#0b5ed7;text-decoration:none;font-weight:600;line-height:1.3;">${title}</a>
            </td>
            <td align="center" style="padding:10px;border-bottom:1px solid #ececec;color:#333;white-space:nowrap;">${qty}</td>
            <td align="right" style="padding:10px;border-bottom:1px solid #ececec;color:#333;white-space:nowrap;">
              Rs.${unit.toLocaleString()}${
                mrp != null && unit !== mrp
                  ? ` <span style="color:#9aa0a6;text-decoration:line-through;margin-left:6px;">Rs.${mrp.toLocaleString()}</span>`
                  : ""
              }
            </td>
            <td align="right" style="padding:10px;border-bottom:1px solid #ececec;color:#111;font-weight:600;white-space:nowrap;">Rs.${
              lineTotal.toLocaleString()
            }</td>
          </tr>
        `;
      })
      .join("");

    // Build subject suffix from product titles
    const subjectFirstTitle =
      products?.[0]?.title || products?.[0]?.slug || "Order";
    const subjectExtraCount = Math.max((products?.length || 0) - 1, 0);
    const subjectSuffix =
      subjectExtraCount > 0
        ? `${subjectFirstTitle} +${subjectExtraCount} more`
        : subjectFirstTitle;

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 640px; margin:0 auto; padding:20px; color:#202124;">
        <h2 style="color:#202124; border-bottom:2px solid #0b5ed7; padding-bottom:10px; margin:0 0 16px;">🛒 New Order Received</h2>

        <div style="background:#f8f9fa; padding:16px; border-radius:6px; margin:16px 0;">
          <h3 style="color:#202124; margin:0 0 10px;">Customer Information</h3>
          <p style="margin:4px 0;"><strong>Full Name:</strong> ${order.shippingAddress.fullName}</p>
          <p style="margin:4px 0;"><strong>Phone:</strong> ${order.shippingAddress?.mobile}</p>
          <p style="margin:4px 0;"><strong>City:</strong> ${order.shippingAddress?.city}</p>
          <p style="margin:4px 0;"><strong>Address:</strong> ${order.shippingAddress?.streetAddress}</p>
          <p style="margin:8px 0 0; border-top:1px solid #e0e0e0; padding-top:8px;"><strong>Order Date:</strong> ${new Date(order.orderedAt).toLocaleString()}</p>
        </div>

        <div style="margin:16px 0;">
          <h3 style="color:#202124; margin:0 0 8px;">📦 Products Ordered</h3>
          <table role="presentation" cellpadding="0" cellspacing="0" width="100%" style="border-collapse:collapse;background:#ffffff;border:1px solid #e0e0e0;border-radius:6px;overflow:hidden;">
            <thead>
              <tr style="background:#f1f3f4;">
                <th align="left" style="padding:10px;border-bottom:1px solid #e0e0e0;font-size:13px;color:#5f6368; font-weight:600; width:76px;">Item</th>
                <th align="left" style="padding:10px;border-bottom:1px solid #e0e0e0;font-size:13px;color:#5f6368; font-weight:600;">Product</th>
                <th align="center" style="padding:10px;border-bottom:1px solid #e0e0e0;font-size:13px;color:#5f6368; font-weight:600; width:70px;">Qty</th>
                <th align="right" style="padding:10px;border-bottom:1px solid #e0e0e0;font-size:13px;color:#5f6368; font-weight:600; width:120px;">Unit</th>
                <th align="right" style="padding:10px;border-bottom:1px solid #e0e0e0;font-size:13px;color:#5f6368; font-weight:600; width:120px;">Total</th>
              </tr>
            </thead>
            <tbody>
              ${productRows}
            </tbody>
          </table>
        </div>

        <div style="background:#e8f5e8; padding:16px; border-radius:6px; margin:16px 0;">
          <h3 style="color:#202124; margin:0 0 10px;">💰 Order Summary</h3>
          <p style="margin:4px 0;"><strong>Total Amount:</strong> Rs.${order.totalPrice.toLocaleString()}</p>
          <p style="margin:4px 0;"><strong>Delivery Charges:</strong> ${order.freeShipping ? "Free Shipping" : `Rs.${order.deliveryCharges.toLocaleString()}`}</p>
        </div>

        <div style="text-align:center; margin-top:24px;">
          <a href="${process.env.BASE_URL}/admin/orders" style="background:#0b5ed7; color:#ffffff; padding:12px 20px; text-decoration:none; border-radius:6px; display:inline-block;">View Order in Admin Panel</a>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Etimad Mart Orders" <${process.env.EMAIL_USERNAME}>`,
      to:
        adminEmail || process.env.ADMIN_EMAIL || "info@my.etimadmart.com",
      subject: `📦 OrderMail: New Order #${
        order._id
      } - Rs.${order.totalPrice.toLocaleString()} - ${subjectSuffix}`,
      html: html,
    };

    const result = await transporter.sendMail(mailOptions);
    return result;
  } catch (error) {
    console.error("Failed to send order email to admin:", error);
    throw error;
  }
};

module.exports = { sendOrderEmailToAdmin };
