const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()

const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "my-comm",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000,
            maxPoolSize: 10
        })
        console.log("DB connected successfully")

        // Handle connection events
        mongoose.connection.on('disconnected', () => {
            console.log('MongoDB disconnected! Attempting to reconnect...')
            connectDB()
        })

        mongoose.connection.on('error', (err) => {
            console.error('MongoDB connection error:', err)
        })

    } catch (error) {
        console.log("Error in connecting DB", error)
        throw error
    }
}

module.exports = { connectDB }