const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
const compression = require("compression");
const path = require("path");
const { connectDB } = require("./db/connectDb");
const userRouter = require("./routes/user.js");
const productRouter = require("./routes/product.js");
const categoryRouter = require("./routes/category.js");
const subCategoryRouter = require("./routes/subCategory.js");
const tagRouter = require("./routes/tag.js");
const reviewRouter = require("./routes/review.js");
const cartRouter = require("./routes/cart.js");
const orderRouter = require("./routes/order.js");
const searchRouter = require("./routes/search.js");
const topBarRouter = require("./routes/topbar.js");
const footerRouter = require("./routes/footer.js");
const productFeedRouter = require("./routes/productFeed.js");
const bannerRouter = require("./routes/banner.js");
const brandRouter = require("./routes/brand.js");
const sitemapRoute = require("./routes/sitemap");
const dynamicPageRouter = require("./routes/dynamicPage");
const blogRouter = require("./routes/blog");
const notificationRouter = require("./routes/notification.js");
const colorSettingsRouter = require("./routes/colorSettings.js");
const popupRouter = require("./routes/popup.js");
const chatbotRouter = require("./routes/chatbot.js");
const logoRouter = require("./routes/logo.js");
const analyticsRouter = require("./routes/analytics.js");
const courierRouter = require("./routes/courier.js");
const couponRouter = require("./routes/coupon.js");
const pageLayoutRouter = require("./routes/pageLayout.js");
const mediaRouter = require("./routes/media.js");
const trafficRouter = require("./routes/traffic.js");
const homepageRouter = require("./routes/homepage.js");
const postexRouter = require("./routes/postex.js");

dotenv.config();
const app = express();

// Production optimizations
const isProduction = process.env.NODE_ENV === 'production';

// Disable ETag to avoid 304 revalidation for dynamic endpoints
app.set('etag', false);

// Trust proxy in production (for Railway, Heroku, etc.)
if (isProduction) {
  app.set('trust proxy', 1);
}

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        scriptSrc: ["'self'", "'unsafe-inline'", "'unsafe-eval'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        connectSrc: [
          "'self'",
          "https://res.cloudinary.com",
          "https://etimadmart.up.railway.app",
          "https://etimadmart.netlify.app",
          "https://etimadmart.com",
          "https://etimadmart.com/api/v1",
          "https://www.google-analytics.com",
          "https://www.facebook.com",
          "https://*.us-central1.run.app",
          "https://mpc-prod-1-1053047382554.us-central1.run.app",
          "https://mpc-prod-2-1053047382554.us-central1.run.app",
          "https://*.run.app",
          "wss://*.us-central1.run.app",
          "wss://*.run.app",
          "ws://localhost:*",
          "http://localhost:*",
          "https://localhost:*"
        ],
        fontSrc: ["'self'", "https://fonts.gstatic.com", "data:"],
        objectSrc: ["'none'"],
        mediaSrc: ["'self'"],
        frameSrc: ["'self'"],
      },
    },
  })
);

app.use(mongoSanitize());
app.use(xss());

// Enable gzip compression for better performance
app.use(compression({
  filter: (req, res) => {
    if (req.headers['x-no-compression']) {
      return false;
    }
    return compression.filter(req, res);
  },
  level: isProduction ? 6 : 1, // Higher compression in production
  threshold: 1024, // Only compress responses larger than 1KB
}));

// Production caching headers for static assets
if (isProduction) {
  app.use('/uploads', express.static('uploads', {
    maxAge: '1y', // Cache static files for 1 year
    etag: true,
    lastModified: true
  }));
} else {
  app.use('/uploads', express.static('uploads'));
}

// Prevent caching for order endpoints (guest/user specific)
app.use((req, res, next) => {
  if (req.path.startsWith('/api/v1/order')) {
    res.set('Cache-Control', 'no-store');
    res.set('Pragma', 'no-cache');
    res.set('Surrogate-Control', 'no-store');
    res.set('Vary', 'Origin, Cookie, Authorization, X-Guest-Id');
  }
  next();
});

// CORS configuration
app.use(
  cors({
    origin: [
      "http://localhost:5173", 
      "https://etimadmart.com",
      "https://www.etimadmart.com",
      "https://www.etimadmart.com",
      "https://etimadmart.netlify.app",
      "https://dev--etimadmart.netlify.app",
      "https://*.netlify.app"  // Allow all Netlify preview URLs
    ],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: [
      "Content-Type",
      "Authorization",
      "X-Requested-With",
      "X-Client",
      "X-Guest-Id",
      "X-Guest-Id",
      "Accept",
      "Origin",
      "Cookie"
    ],
  })
);

// Ensure preflight requests are handled properly
app.options("*", cors());

// Body parsing middleware
app.use(cookieParser());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.json());

// Static files already configured above with production optimizations

// app.get('/', (req, res) => {
//     res.send("<h1>Hello , welcome back</h1>")
console.log("current running node version------>", process.version);

// Error handling middleware
app.use((err, req, res, next) => {
  if (!isProduction) {
    console.error(err.stack);
  }
  
  res.status(err.status || 500).json({
    status: "error",
    message: isProduction ? "Internal Server Error" : err.message,
    ...(isProduction ? {} : { stack: err.stack })
  });
});

// API Routes
app.use("/api/v1/user", userRouter);
app.use("/api/v1/product", productRouter);
app.use("/api/v1/category", categoryRouter);
app.use("/api/v1/tag", tagRouter);
app.use("/api/v1/review", reviewRouter);
app.use("/api/v1/cart", cartRouter);
app.use("/api/v1/order", orderRouter);
app.use("/api/v1/search", searchRouter);
app.use("/api/v1/sub", subCategoryRouter);
app.use("/api/v1/banner", bannerRouter);
app.use("/api/v1/brand", brandRouter);
app.use("/api/v1/topbar", topBarRouter);
app.use("/api/v1/footer", footerRouter);
app.use("/api/v1/notification", notificationRouter);
app.use("/api/v1/colorSettings", colorSettingsRouter);
app.use("/api/v1/popup", popupRouter);
app.use("/api/v1/chatbot", chatbotRouter);
app.use("/api/v1/logo", logoRouter);
app.use("/api/v1/analytics", analyticsRouter);
app.use("/api/v1/courier", courierRouter);
app.use("/api/v1/coupon", couponRouter);
app.use("/api/v1/pageLayout", pageLayoutRouter);
app.use("/api/v1/media", mediaRouter);
app.use("/api/v1/traffic", trafficRouter);
app.use("/api/v1/postex", postexRouter);
app.use("/api/v1", homepageRouter);

// Register sitemap route BEFORE dynamic page route to avoid conflicts
app.use("/", sitemapRoute);
app.use("/api/v1/page", dynamicPageRouter);
app.use("/api/v1/blog", blogRouter);
app.use("/", productFeedRouter);

// // Serve frontend static files
// app.use(express.static(path.join(__dirname, "../frontend/dist")));

// Catch-all route to serve frontend's index.html for client-side routing
// app.get("*", (req, res) => {
//   res.sendFile(path.resolve(__dirname, "../frontend/dist", "index.html"));
// });

// Health check endpoint
app.get("/health", (req, res) => {
  res.status(200).json({ status: "ok", version: process.version });
});

// Connect to database
connectDB();

// Use cPanel's provided port or fallback to 3000
const port = process.env.PORT || 3600;
// const host = process.env.HOST || '0.0.0.0';
// Start server
app.listen(port, () => {
  console.log(`Server running at http://localhost:${port}`);
  // console.log(`Node.js version: ${process.version}`);
});
