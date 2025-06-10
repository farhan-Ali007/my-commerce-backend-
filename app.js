const express = require('express')
const cors = require('cors')
const dotenv = require('dotenv')
const bodyParser = require('body-parser')
const cookieParser = require('cookie-parser')
const helmet = require('helmet')
const rateLimit = require('express-rate-limit')
const mongoSanitize = require('express-mongo-sanitize')
const xss = require('xss-clean')
const { connectDB } = require('./db/connectDb')
const userRouter = require('./routes/user.js')
const productRouter = require('./routes/product.js')
const categoryRouter = require('./routes/category.js')
const subCategoryRouter = require('./routes/subCategory.js')
const tagRouter = require('./routes/tag.js')
const reviewRouter = require('./routes/review.js')
const cartRouter = require('./routes/cart.js')
const orderRouter = require('./routes/order.js')
const searchRouter = require('./routes/search.js')
const bannerRouter = require('./routes/banner.js')
const brandRouter = require('./routes/brand.js')

dotenv.config()
const app = express();

// Security Middleware
app.use(helmet())
app.use(mongoSanitize())
app.use(xss())

// Rate limiting
const limiter = rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100 // limit each IP to 100 requests per windowMs
});
app.use('/api/', limiter);

// CORS configuration
app.use(cors({
    origin: ['http://localhost:5173', 'https://etimad.netlify.app'],
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
    allowedHeaders: ['Content-Type', 'Authorization']
})) 

// Body parsing middleware
app.use(cookieParser())
app.use(bodyParser.json({ limit: "10mb" }))
app.use(express.json())

// app.get('/', (req, res) => {
//     res.send("<h1>Hello , welcome back</h1>")
// })

console.log("current running node version------>" , process.version)

// Error handling middleware
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(err.status || 500).json({
        status: 'error',
        message: err.message || 'Internal server error'
    });
});

// API Routes
app.use('/api/v1/user', userRouter);
app.use('/api/v1/product', productRouter)
app.use('/api/v1/category', categoryRouter)
app.use('/api/v1/tag', tagRouter)
app.use('/api/v1/review', reviewRouter)
app.use('/api/v1/cart', cartRouter)
app.use('/api/v1/order', orderRouter)
app.use('/api/v1/search', searchRouter)
app.use('/api/v1/sub', subCategoryRouter)
app.use('/api/v1/banner', bannerRouter)
app.use('/api/v1/brand', brandRouter)

// Health check endpoint
app.get('/health', (req, res) => {
    res.status(200).json({ status: 'ok', version: process.version });
});

// Connect to database
connectDB();

const port = process.env.PORT || 3600;
app.listen(port, () => {
    console.log(`Server is running on port ${port}`)
})