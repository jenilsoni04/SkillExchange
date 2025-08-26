const express = require("express");
const bcrypt = require("bcryptjs");
const jwt = require("jsonwebtoken");
const User = require("../models/User");
const sendEmail = require("../utils/sendEmail");
const authMiddleware = require("../middleware/authMiddleware");

const router = express.Router();

router.post("/register", async (req, res) => {
  try {
    const {
      name,
      email,
      password,
      skillsHave = [],
      skillsWant = [],
    } = req.body;

    if (skillsHave.length > 3 || skillsWant.length > 3) {
      return res
        .status(400)
        .json({ message: "Maximum 3 skills allowed per field." });
    }

    let user = await User.findOne({ email });
    if (user) return res.status(400).json({ message: "User already exists" });

    const hashedPassword = await bcrypt.hash(password, 10);
    const verificationCode = String(
      Math.floor(100000 + Math.random() * 900000)
    );

    user = new User({
      name,
      email,
      password: hashedPassword,
      verificationCode,
      skillsHave,
      skillsWant,
    });

    await user.save();
    await sendEmail(
      email,
      "Verify Your Email",
      `Your verification code is: ${verificationCode}`
    );

    res
      .status(200)
      .json({ message: "Verification email sent.", userId: user._id });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/login", async (req, res) => {
  try {
    console.log("Received request body:", req.body);

    const { email, password } = req.body;
    if (!email || !password) {
      return res
        .status(400)
        .json({ message: "Email and password are required" });
    }

    let user = await User.findOne({ email });

    if (!user) return res.status(400).json({ message: "Invalid credentials" });

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch)
      return res.status(400).json({ message: "Invalid credentials" });

    const token = jwt.sign({ userId: user._id }, process.env.JWT_SECRET, {
      expiresIn: "7d",
    });

    console.log("token : ", token);
    const decoded = jwt.verify(token, process.env.JWT_SECRET);

    console.log(decoded);

    res.status(200).json({ message: "Login Success", token, user });
  } catch (error) {
    console.error("Server error:", error);
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.get("/me", authMiddleware, async (req, res) => {
  try {
    const user = await User.findById(req.user._id).select("-password");
    res.json(user);
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

router.post("/verify", async (req, res) => {
  try {
    const { userId, verificationCode } = req.body;
    console.log("userId:", userId);
    const user = await User.findById(userId);
    if (!user) return res.status(400).json({ message: "User not found" });

    console.log("User verificationCode:", user.verificationCode);
    console.log("Received verificationCode:", verificationCode);

    if (user.verificationCode !== verificationCode) {
      return res.status(400).json({ message: "Invalid verification code" });
    }

    user.isVerified = true;
    user.verificationCode = null;
    await user.save();

    return res.status(200).json({ message: "Email verified successfully!" });
  } catch (error) {
    res.status(500).json({ message: "Server error", error: error.message });
  }
});

module.exports = router;
