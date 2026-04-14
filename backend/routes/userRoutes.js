const express = require("express");
const router = express.Router();
const User = require("../models/User");
const auth = require("../middleware/auth");
const role = require("../middleware/role");
const mongoose = require("mongoose");
const { softDeleteUserById, restoreUserById } = require("../services/userLifecycleService");

router.get("/", auth, role("admin"), async (req, res) => {
  try {
    const includeDeleted = String(req.query.includeDeleted || "").toLowerCase() === "true";
    const query = includeDeleted ? {} : { isDeleted: false };
    const users = await User.find(query).select("name email role isDeleted deletedAt").sort({ createdAt: -1 });
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

    const deletedUser = await softDeleteUserById(req.params.id);

    if (!deletedUser) {
      return res.status(404).json({ error: "User not found" });
    }

    res.json({ message: "User soft-deleted and related data archived/disabled", user: deletedUser });
  } catch (err) {
    res.status(500).json({ error: "Could not delete user" });
  }
});

router.patch("/:id/restore", auth, role("admin"), async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid user id" });
    }

    const restoredUser = await restoreUserById(req.params.id);
    if (!restoredUser) {
      return res.status(404).json({ error: "Deleted user not found" });
    }

    res.json({ message: "User restored", user: restoredUser });
  } catch (err) {
    res.status(500).json({ error: "Could not restore user" });
  }
});

module.exports = router;
