const jwt = require('jsonwebtoken');
const User = require('../models/user.js');
const dotenv = require('dotenv');
dotenv.config();

const JWT_SECRET = process.env.JWT_SECRET;

const isAuthorized = async (req, res, next) => {
    const { token } = req.cookies;
    if (!token) {
        return res.status(401).json({ message: 'Access denied. No token provided.' });
    }

    try {
        const decoded = jwt.verify(token, JWT_SECRET);
        req.user = decoded;
        const userId = decoded.userId;
        const user = await User.findById(userId).exec();
        if (!user) {
            return res.status(404).json({ message: 'User not found.' });
        }
        req.user = user;
        next();
    } catch (error) {
        console.log("Error in isAuthorized middleware: ", error);
        res.status(400).json({ message: 'Invalid token.' });
    }
};

const isAdmin = async (req, res, next) => {
    if (req && req.user?.role === "admin") {
        next()
    } else {
        res.status(403).json({ message: "Access denied. You are not the admin" })
    }
}


module.exports = { isAuthorized, isAdmin };
