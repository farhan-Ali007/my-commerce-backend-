const User = require("../models/user");
const bcrypt = require("bcryptjs");
const generateTokenAndSetCookies = require("../utils/generateToken");

const signup = async (req, res) => {
  try {
    const { username, email, password } = req.body;

    // Check for missing fields first
    if (!email || !password || !username) {
      return res.status(400).json({ message: "Email, username, and password are required." });
    }

    // Check password length
    if (password.length < 6) {
      return res.status(400).json({ message: "Password must be at least 6 characters." });
    }

    // Check if email already exists
    const existingEmail = await User.findOne({ email: email });
    if (existingEmail) {
      return res.status(400).json({ message: "Email already exists." });
    }

    const salt = await bcrypt.genSalt(10);
    const hashedPassword = await bcrypt.hash(password, salt);

    const newUser = new User({
      username,
      email,
      password: hashedPassword,
    });
    await newUser.save();
    const token = generateTokenAndSetCookies(res, newUser._id);

    res.status(200).json({
      success: true,
      token,
      newUser: {
        ...newUser._doc,
        password: undefined,
      },
      message: "User created successfully",
    });
  } catch (error) {
    console.log("Error in signup", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const login = async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password)
      return res.status(400).json({ message: "Email or password required." });

    const user = await User.findOne({ email: email }).exec();

    if (!user) return res.status(404).json({ message: "User not found." });

    const correctPassword = await bcrypt.compare(password, user.password);
    if (!correctPassword)
      return res.status(400).json({ message: "Incorrect password" });
    const token = generateTokenAndSetCookies(res, user._id);

    res.status(200).json({
      success: true,
      token,
      user: {
        ...user._doc,
        password: "********",
      },
      message: "User logged in successfully",
    });
  } catch (error) {
    console.log("Error in user login", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const logout = async (req, res) => {
  try {
    res.clearCookie("token", {
      httpOnly: true,
      sameSite: "None",
      secure: true,
    });
    res.status(200).json({ message: "User logged out successfully" });
  } catch (error) {
    console.log("Error in logging out", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getUser = async (req, res) => {
  try {
    const user = req.user;
    if (!user) return res.status(404).json({ message: "User not found" });
    res.status(200).json({
      success: true,
      user: {
        ...user._doc,
        password: "********",
      },
    });
  } catch (error) {
    console.log("Error in getting current user", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const getAllUsers = async (req, res) => {
  try {
    const loggedInUserId = req.user.id;
    const users = await User.find({ _id: { $ne: loggedInUserId } });

    const sanitizedUsers = users.map((user) => {
      const { password, ...rest } = user._doc;
      return rest;
    });

    res.status(200).json({
      success: true,
      message: "All users fetched successfully",
      users: sanitizedUsers,
    });
  } catch (error) {
    console.error("Error in fetching all users", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const updateUserRole = async (req, res) => {
  try {
    const { id } = req.params;
    const { newRole } = req.body;

    if (newRole !== "user" && newRole !== "admin") {
      return res
        .status(400)
        .json({ message: "Invalid role. Must be 'user' or 'admin'." });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    user.role = newRole;
    await user.save();

    return res.status(200).json({ message: `Role updated to ${newRole}.` });
  } catch (error) {
    console.error("Error in updating user's role:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

const deleteUser = async (req, res) => {
  try {
    const { id } = req.params;
    const user = await User.findByIdAndDelete(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }
    res.status(200).json({ success: true, message: "User deleted successfully." });
  } catch (error) {
    console.error("Error deleting user:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

module.exports = {
  signup,
  login,
  logout,
  getUser,
  getAllUsers,
  updateUserRole,
  deleteUser,
};
