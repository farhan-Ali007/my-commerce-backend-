const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()

let connectionPromise = null
let listenersAttached = false

const connectDB = async () => {
    try {
        if (mongoose.connection.readyState === 1) {
            return
        }

        if (!process.env.MONGO_URI) {
            throw new Error('MONGO_URI is not set')
        }

        if (connectionPromise) {
            await connectionPromise
            return
        }

        connectionPromise = mongoose.connect(process.env.MONGO_URI, {
            dbName: "my-comm",
            useNewUrlParser: true,
            useUnifiedTopology: true,
            serverSelectionTimeoutMS: 5000,
            socketTimeoutMS: 45000,
            heartbeatFrequencyMS: 10000,
            maxPoolSize: 10
        })

        await connectionPromise
        console.log("DB connected successfully")

        // Handle connection events
        if (!listenersAttached) {
            listenersAttached = true

            mongoose.connection.on('disconnected', () => {
                connectionPromise = null
                console.log('MongoDB disconnected! Attempting to reconnect...')
                connectDB().catch(() => {})
            })

            mongoose.connection.on('error', (err) => {
                console.error('MongoDB connection error:', err)
            })
        }

    } catch (error) {
        console.log("Error in connecting DB", error)
        connectionPromise = null
        throw error
    }
}

module.exports = { connectDB }