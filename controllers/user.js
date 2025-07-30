const User = require("../models/user");
const bcrypt = require("bcryptjs");
const generateTokenAndSetCookies = require("../utils/generateToken");
const { createNotification } = require('./notification');

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

    try {
      await createNotification(
        user._id,
        'role_change', // or use a new type like 'role_change' if you want
        'Role Changed',
        `Your account role has been changed to "${newRole}" by an admin.`,
        null,
        { newRole }
      );
    } catch (notificationError) {
      console.error('Error creating role change notification:', notificationError);
    }

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

// Update user status
const updateUserStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['active', 'inactive', 'suspended'].includes(status)) {
      return res.status(400).json({ 
        message: "Invalid status. Must be 'active', 'inactive', or 'suspended'." 
      });
    }

    const user = await User.findById(id);
    if (!user) {
      return res.status(404).json({ message: "User not found." });
    }

    const oldStatus = user.status;
    user.status = status;
    user.lastActive = new Date();
    await user.save();

    // Create notification for status change
    try {
      let title, message;
      switch (status) {
        case 'suspended':
          title = 'Account Suspended';
          message = 'Your account has been suspended. Please contact support for more information.';
          break;
        case 'inactive':
          title = 'Account Deactivated';
          message = 'Your account has been deactivated. You can reactivate it by contacting support.';
          break;
        case 'active':
          title = 'Account Reactivated';
          message = 'Your account has been reactivated. Welcome back!';
          break;
      }
      
      // Create notification for the user whose status was changed
      await createNotification(
        user._id,
        'user_status',
        title,
        message,
        null,
        { oldStatus, newStatus: status }
      );
      
      // Create notification for the admin who made the change
      const adminId = req.user.id;
      if (adminId && adminId.toString() !== user._id.toString()) {
        await createNotification(
          adminId,
          'user_status',
          'User Status Updated',
          `You have updated ${user.username}'s status to ${status}.`,
          null,
          { targetUser: user.username, oldStatus, newStatus: status }
        );
      }
    } catch (notificationError) {
      console.error('Error creating status notification:', notificationError);
      // Don't fail the status update if notification fails
    }

    res.status(200).json({ 
      success: true, 
      message: `User status updated to ${status}.`,
      user: {
        ...user._doc,
        password: undefined
      }
    });
  } catch (error) {
    console.error("Error in updating user's status:", error);
    res.status(500).json({ message: "Internal server error" });
  }
};

// Update user's last active timestamp
const updateLastActive = async (req, res) => {
  try {
    const userId = req.user.id;
    await User.findByIdAndUpdate(userId, { lastActive: new Date() });
    res.status(200).json({ success: true, message: "Last active updated." });
  } catch (error) {
    console.error("Error updating last active:", error);
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
  updateUserStatus,
  updateLastActive,
};
