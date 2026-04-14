const Notification = require("../models/Notification");
const NotificationOutbox = require("../models/NotificationOutbox");
const { emitToUser } = require("../services/realtime");
const { sendFallbackNotification } = require("./notificationFallback");

function normalizePayload({ userId, requestId, type, title, message }) {
  return {
    userId,
    requestId,
    type,
    title,
    message
  };
}

async function createNotification({ userId, requestId, type, title, message }) {
  const payload = normalizePayload({ userId, requestId, type, title, message });
  const outboxEvent = await NotificationOutbox.create({
    eventType: "notification.dispatch",
    userId: payload.userId,
    requestId: payload.requestId,
    payload,
    status: "pending",
    nextAttemptAt: new Date()
  });

  return outboxEvent;
}

async function ensureNotificationRecord(outboxEvent) {
  const payload = outboxEvent?.payload || {};
  const existing = await Notification.findOne({ sourceOutboxId: outboxEvent._id });
  if (existing) {
    return { notification: existing, createdNow: false };
  }

  try {
    const notification = await Notification.create({
      userId: payload.userId,
      requestId: payload.requestId,
      type: payload.type,
      title: payload.title,
      message: payload.message,
      sourceOutboxId: outboxEvent._id
    });
    return { notification, createdNow: true };
  } catch (error) {
    if (error?.code === 11000) {
      const duplicate = await Notification.findOne({ sourceOutboxId: outboxEvent._id });
      if (duplicate) {
        return { notification: duplicate, createdNow: false };
      }
    }
    throw error;
  }
}

async function deliverNotificationOutboxEvent(outboxEvent) {
  if (!outboxEvent || outboxEvent.eventType !== "notification.dispatch") {
    throw new Error("Unsupported outbox event");
  }

  const payload = outboxEvent.payload || {};
  if (!payload.userId || !payload.type || !payload.title || !payload.message) {
    throw new Error("Outbox payload is incomplete");
  }

  const { notification, createdNow } = await ensureNotificationRecord(outboxEvent);

  const plain = notification.toObject();
  if (createdNow) {
    emitToUser(payload.userId, "notification:new", plain);

    if (payload.requestId) {
      emitToUser(payload.userId, "booking:update", {
        requestId: payload.requestId,
        type: payload.type,
        createdAt: plain.createdAt
      });
    }

    try {
      await sendFallbackNotification(plain);
    } catch (fallbackError) {
      // Delivery fallback is best-effort and must not fail outbox processing.
    }
  }

  return plain;
}

module.exports = {
  createNotification,
  deliverNotificationOutboxEvent
};
