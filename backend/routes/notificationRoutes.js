const express = require("express");
const mongoose = require("mongoose");
const router = express.Router();
const Notification = require("../models/Notification");
const auth = require("../middleware/auth");
const {
  parsePositiveInt,
  decodeCursor,
  encodeCursor,
  buildDescendingCursorFilter
} = require("../utils/cursorPagination");

const DEFAULT_NOTIFICATION_LIMIT = 20;
const MAX_NOTIFICATION_LIMIT = 100;

router.get("/me", auth, async (req, res) => {
  try {
    const unreadOnly = String(req.query.unread || "").toLowerCase() === "true";
    const limit = parsePositiveInt(req.query.limit, DEFAULT_NOTIFICATION_LIMIT, MAX_NOTIFICATION_LIMIT);
    const cursor = req.query.cursor ? decodeCursor(req.query.cursor) : null;
    if (req.query.cursor && !cursor) {
      return res.status(400).json({ error: "Invalid cursor" });
    }

    const query = { userId: req.user.userId, isHidden: false };
    const cursorFilter = buildDescendingCursorFilter(cursor, "createdAt", "_id");
    const queryWithCursor = { ...query, ...cursorFilter };

    if (unreadOnly) {
      queryWithCursor.isRead = false;
    }

    const rows = await Notification.find(queryWithCursor)
      .select("_id userId requestId type title message isRead readAt createdAt updatedAt")
      .sort({ createdAt: -1, _id: -1 })
      .limit(limit + 1)
      .lean();

    const hasMore = rows.length > limit;
    const notifications = hasMore ? rows.slice(0, limit) : rows;
    const nextCursor = hasMore ? encodeCursor(notifications[notifications.length - 1]) : null;

    res.json({
      items: notifications,
      notifications,
      nextCursor,
      hasMore,
      limit
    });
  } catch (err) {
    res.status(500).json({ error: "Could not load notifications" });
  }
});

router.patch("/:id/read", auth, async (req, res) => {
  try {
    if (!mongoose.Types.ObjectId.isValid(req.params.id)) {
      return res.status(400).json({ error: "Invalid notification id" });
    }

    const notification = await Notification.findOneAndUpdate(
      { _id: req.params.id, userId: req.user.userId, isHidden: false },
      { isRead: true, readAt: new Date() },
      { returnDocument: "after" }
    );

    if (!notification) {
      return res.status(404).json({ error: "Notification not found" });
    }

    res.json(notification);
  } catch (err) {
    res.status(500).json({ error: "Could not update notification" });
  }
});

router.patch("/read-all", auth, async (req, res) => {
  try {
    await Notification.updateMany(
      { userId: req.user.userId, isRead: false, isHidden: false },
      { isRead: true, readAt: new Date() }
    );

    res.json({ message: "Notifications marked as read" });
  } catch (err) {
    res.status(500).json({ error: "Could not update notifications" });
  }
});

module.exports = router;
