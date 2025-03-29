const mongoose = require('mongoose')
const dotenv = require('dotenv')
dotenv.config()


const connectDB = async () => {
    try {
        await mongoose.connect(process.env.MONGO_URI, {
            dbName: "my-comm",
        })
        console.log("DB connected successfully")
    } catch (error) {
        console.log("Error in connecting DB", error)
        process.exit(1)
    }
}

module.exports = { connectDB }