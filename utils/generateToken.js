const jwt = require('jsonwebtoken')
const dotenv = require('dotenv')
dotenv.config()

const JWT_SECRET = process.env.JWT_SECRET;

const generateTokenAndSetCookies = (res, userId) => {

    try {
        const token = jwt.sign({ userId }, JWT_SECRET, { expiresIn: "7d" })
        res.cookie('token', token, {
            httpOnly: true,
            sameSite: 'Lax',
            secure: process.env.NODE_ENV === 'production',
            maxAge: 604800000
        })
        return token;
    } catch (error) {
        console.log("Error in generating token", error)
    }
}

module.exports = generateTokenAndSetCookies;