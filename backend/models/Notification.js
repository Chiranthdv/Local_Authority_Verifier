const mongoose = require("mongoose");

const notificationSchema = new mongoose.Schema({
  userId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "User",
    required: true,
    index: true
  },
  requestId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Job"
  },
  sourceOutboxId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "NotificationOutbox",
    index: true,
    unique: true,
    sparse: true
  },
  type: {
    type: String,
    enum: ["request_created", "request_accepted", "request_rejected", "request_completed", "request_cancelled", "chat_message"],
    required: true
  },
  title: {
    type: String,
    required: true
  },
  message: {
    type: String,
    required: true
  },
  isRead: {
    type: Boolean,
    default: false
  },
  readAt: Date,
  isHidden: {
    type: Boolean,
    default: false,
    index: true
  },
  hiddenAt: Date,
  hiddenReason: {
    type: String,
    default: ""
  }
}, { timestamps: true });

notificationSchema.index({ userId: 1, isRead: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isHidden: 1, createdAt: -1 });
notificationSchema.index({ userId: 1, isHidden: 1, isRead: 1, createdAt: -1, _id: -1 });
notificationSchema.index({ requestId: 1, createdAt: -1 });

module.exports = mongoose.model("Notification", notificationSchema);
