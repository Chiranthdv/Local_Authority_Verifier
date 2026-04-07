const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const mongoose = require("mongoose");

router.get("/", auth, role("admin"), async (req, res) => {
  try {
    const users = await User.find().select("name email role").sort({ createdAt: -1 });
    res.json(users);
  } catch (err) {
    res.status(500).json({ error: "Could not load users" });
  }
});

router.delete("/:id", auth, role("admin"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const deletedUser = await User.findByIdAndDelete(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User and related data deleted" });
  } catch (err) {
    res.status(500).json({ error: "Could not delete user" });
  }
});

module.exports = router;
