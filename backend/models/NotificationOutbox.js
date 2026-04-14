const mongoose = require("mongoose");

const notificationOutboxSchema = new mongoose.Schema({
  eventType: {
    type: String,
    required: true,
    default: "notification.dispatch"
  },
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
  payload: {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true
    },
    requestId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Job"
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
    }
  },
  status: {
    type: String,
    enum: ["pending", "processing", "failed", "sent", "dead"],
    default: "pending",
    index: true
  },
  attempts: {
    type: Number,
    default: 0
  },
  nextAttemptAt: {
    type: Date,
    default: Date.now,
    index: true
  },
  lockedAt: Date,
  lockedBy: {
    type: String,
    default: ""
  },
  sentAt: Date,
  lastError: {
    type: String,
    default: ""
  },
  deadLetterReason: {
    type: String,
    default: ""
  }
}, { timestamps: true, collection: "notification_outbox" });

notificationOutboxSchema.index({ status: 1, nextAttemptAt: 1, createdAt: 1 });
notificationOutboxSchema.index({ status: 1, lockedAt: 1 });
notificationOutboxSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model("NotificationOutbox", notificationOutboxSchema);
