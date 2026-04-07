const express = require("express");
const jwt = require("jsonwebtoken");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const WorkerProfile = require("../models/WorkerProfile");

router.post("/register", async (req, res) => {
  try {
    const { name, email, password, role } = req.body;

    if (!name || !email || !password || !role) {
      return res.status(400).json({ error: "All fields are required" });
    }

    const user = new User({ name, email, password, role });
    await user.save();

    res.status(201).json({
      message: "User registered",
      user: {
        _id: user._id,
        name: user.name,
        email: user.email,
        role: user.role
      }
    });
  } catch (err) {
    if (err.code === 11000) {
      return res.status(409).json({ error: "Email already registered" });
    }

    res.status(500).json({ error: "Could not register user" });
  }
});

router.post("/login", async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: "Email and password are required" });
    }

    if (!process.env.JWT_SECRET) {
      return res.status(500).json({ error: "JWT_SECRET is missing in backend/.env" });
    }

    const user = await User.findOne({ email, password });

    if (!user) {
      return res.status(400).json({ error: "Invalid credentials" });
    }

    const token = jwt.sign(
      { userId: user._id, role: user.role },
      process.env.JWT_SECRET,
      { expiresIn: "7d" }
    );

    const workerProfile = user.role === "worker"
      ? await WorkerProfile.findOne({ userId: user._id }).select("_id")
      : null;

    res.json({
      token,
      role: user.role,
      name: user.name,
      hasProfile: Boolean(workerProfile),
      workerProfileId: workerProfile?._id ?? null
    });
  } catch (err) {
    res.status(500).json({ error: "Could not login" });
  }
});

router.post("/logout", (req, res) => {
  res.json({ message: "Logged out" });
});

router.get("/me", auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.userId).select("_id name email role");

    if (!user) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json(user);
  } catch (err) {
    res.status(500).json({ error: "Could not load profile" });
  }
});

module.exports = router;
