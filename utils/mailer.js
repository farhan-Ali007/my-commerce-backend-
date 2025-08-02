const nodemailer = require("nodemailer");

// Create transporter (you'll need to add SMTP credentials to .env)
const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST || "smtp.gmail.com",
  port: process.env.SMTP_PORT || 587,
  secure: false, // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USERNAME,
    pass: process.env.EMAIL_PASSWORD,
  },
});

// Send order notification email to admin
const sendOrderEmailToAdmin = async ({ order, products, adminEmail }) => {
  try {
    // Create product links HTML
    const frontendUrl = process.env.BASE_URL || "https://etimadmart.com";
    const productLinks = products
      .map(
        (item) => `
      <li style="margin-bottom: 10px; padding: 10px; border: 1px solid #eee; border-radius: 5px;">
        <a href="${frontendUrl}/product/${
          item.slug || "product"
        }" target="_blank" style="color: #007bff; text-decoration: none; font-weight: bold;">
          ${item.title}
        </a>
        <br>
        <span style="color: #666; font-size: 14px;">
          Quantity: ${item.count} | Price: Rs.${item.price.toLocaleString()}
        </span>
      </li>
    `
      )
      .join("");

    const html = `
      <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px;">
        <h2 style="color: #333; border-bottom: 2px solid #007bff; padding-bottom: 10px;">
          🛒 New Order Received
        </h2>
        
        <div style="background: #f8f9fa; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">Customer Information</h3>
          <p><strong>Full Name:</strong> ${order.shippingAddress.fullName}</p>
          <p><strong>Phone:</strong> ${order.shippingAddress.mobile}</p>
          <p><strong>City:</strong> ${order.shippingAddress.city}</p>
          <p><strong>Address:</strong> ${
            order.shippingAddress.streetAddress
          }</p>
          <p><strong>Order ID:</strong> ${order._id}</p>
          <p><strong>Order Date:</strong> ${new Date(
            order.createdAt
          ).toLocaleString()}</p>
        </div>

        <div style="margin: 20px 0;">
          <h3 style="color: #333;">📦 Products Ordered</h3>
          <ul style="list-style: none; padding: 0;">
            ${productLinks}
          </ul>
        </div>

        <div style="background: #e8f5e8; padding: 15px; border-radius: 5px; margin: 20px 0;">
          <h3 style="color: #333; margin-top: 0;">💰 Order Summary</h3>
          <p><strong>Total Amount:</strong> Rs.${order.totalPrice.toLocaleString()}</p>
          <p><strong>Delivery Charges:</strong> ${
            order.freeShipping
              ? "Free Shipping"
              : `Rs.${order.deliveryCharges.toLocaleString()}`
          }</p>
          <p><strong>Customer Type:</strong> ${
            order.orderedBy === "guest" ? "Guest User" : "Registered User"
          }</p>
        </div>

        <div style="text-align: center; margin-top: 30px;">
          <a href="${
            process.env.BASE_URL
          }/admin/orders" style="background: #007bff; color: white; padding: 12px 24px; text-decoration: none; border-radius: 5px; display: inline-block;">
            View Order in Admin Panel
          </a>
        </div>
      </div>
    `;

    const mailOptions = {
      from: `"Etimad Mart Orders" <${process.env.EMAIL_USERNAME}>`,
      to: adminEmail || process.env.ADMIN_EMAIL || "info@etimadmart.com",
      subject: `📦 OrderMail: New Order #${
        order._id
      } - Rs.${order.totalPrice.toLocaleString()}`,
      html: html,
    };

    const result = await transporter.sendMail(mailOptions);
    console.log(
      "Order notification email sent successfully:",
      result.messageId
    );
    return result;
  } catch (error) {
    console.error("Failed to send order email to admin:", error);
    throw error;
  }
};

module.exports = { sendOrderEmailToAdmin };
