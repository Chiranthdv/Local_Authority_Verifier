const Notification = require("../models/Notification");
const NotificationOutbox = require("../models/NotificationOutbox");
const Conversation = require("../models/Conversation");
const Message = require("../models/Message");
const Job = require("../models/Job");

let cleanupTimer = null;
let cleanupRunning = false;

function toPositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function daysAgo(days) {
  const now = Date.now();
  return new Date(now - (days * 24 * 60 * 60 * 1000));
}

async function runDataLifecycleCleanup() {
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;

  try {
    const hiddenNotificationRetentionDays = toPositiveInt(process.env.CLEANUP_HIDDEN_NOTIFICATION_RETENTION_DAYS, 30);
    const disabledConversationRetentionDays = toPositiveInt(process.env.CLEANUP_DISABLED_CONVERSATION_RETENTION_DAYS, 60);
    const outboxRetentionDays = toPositiveInt(process.env.CLEANUP_OUTBOX_RETENTION_DAYS, 30);
    const oldJobArchiveDays = toPositiveInt(process.env.CLEANUP_OLD_JOB_ARCHIVE_DAYS, 90);

    const hiddenNotificationCutoff = daysAgo(hiddenNotificationRetentionDays);
    const disabledConversationCutoff = daysAgo(disabledConversationRetentionDays);
    const outboxCutoff = daysAgo(outboxRetentionDays);
    const oldJobCutoff = daysAgo(oldJobArchiveDays);

    await Notification.deleteMany({
      isHidden: true,
      hiddenAt: { $lte: hiddenNotificationCutoff }
    });

    await NotificationOutbox.deleteMany({
      status: { $in: ["sent", "dead"] },
      updatedAt: { $lte: outboxCutoff }
    });

    const disabledConversations = await Conversation.find({
      isDisabled: true,
      disabledAt: { $lte: disabledConversationCutoff }
    }).select("_id");

    const disabledConversationIds = disabledConversations.map((item) => item._id);
    if (disabledConversationIds.length) {
      await Message.deleteMany({ conversationId: { $in: disabledConversationIds } });
      await Conversation.deleteMany({ _id: { $in: disabledConversationIds } });
    }

    await Job.updateMany(
      {
        isArchived: false,
        status: { $in: ["completed", "cancelled", "rejected"] },
        updatedAt: { $lte: oldJobCutoff }
      },
      {
        $set: {
          isArchived: true,
          archivedAt: new Date(),
          archivedReason: "periodic_lifecycle_cleanup"
        }
      }
    );
  } finally {
    cleanupRunning = false;
  }
}

function startDataLifecycleCleanup() {
  if (cleanupTimer) {
    return;
  }

  const intervalMs = toPositiveInt(process.env.CLEANUP_INTERVAL_MS, 6 * 60 * 60 * 1000);
  cleanupTimer = setInterval(() => {
    void runDataLifecycleCleanup();
  }, intervalMs);

  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  void runDataLifecycleCleanup();
}

function stopDataLifecycleCleanup() {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

module.exports = {
  startDataLifecycleCleanup,
  stopDataLifecycleCleanup,
  runDataLifecycleCleanup
};
