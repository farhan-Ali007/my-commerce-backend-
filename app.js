const express = require("express");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const cookieParser = require("cookie-parser");
const helmet = require("helmet");
const mongoSanitize = require("express-mongo-sanitize");
const xss = require("xss-clean");
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
const notificationRouter = require("./routes/notification.js");

dotenv.config();
const app = express();

// Security Middleware
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        imgSrc: ["'self'", "data:", "blob:", "https://res.cloudinary.com"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
       connectSrc: [
          "'self'",
          "https://res.cloudinary.com",
          "https://etimadmart.up.railway.app",
          "https://etimadmart.netlify.app"
        ],
        objectSrc: ["'none'"],
      },
    },
  })
);

app.use(mongoSanitize());
app.use(xss());

// CORS configuration
app.use(
  cors({
    origin: ["http://localhost:5173", "https://etimadmart.com","https://etimadmart.netlify.app"],
    credentials: true,
    methods: ["GET", "POST", "PUT", "DELETE", "PATCH"],
    allowedHeaders: ["Content-Type", "Authorization"],
  })
);

// Body parsing middleware
app.use(cookieParser());
app.use(bodyParser.json({ limit: "10mb" }));
app.use(express.json());

// app.get('/', (req, res) => {
//     res.send("<h1>Hello , welcome back</h1>")
// })

console.log("current running node version------>", process.version);

// Error handling middleware
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    status: "error",
    message: err.message || "Internal server error",
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
app.use("/", sitemapRoute);
app.use("/", productFeedRouter);
app.use("/api/v1/page", dynamicPageRouter);

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
  console.log(`Node.js version: ${process.version}`);
});
