const os = require("os");
const NotificationOutbox = require("../models/NotificationOutbox");
const { deliverNotificationOutboxEvent } = require("../utils/notifications");

const PROCESSOR_NAME = `${os.hostname()}-pid-${process.pid}`;
const DEFAULT_POLL_INTERVAL_MS = 2000;
const DEFAULT_BATCH_SIZE = 20;
const DEFAULT_MAX_ATTEMPTS = 8;
const DEFAULT_LOCK_TTL_MS = 90 * 1000;
const DEFAULT_BASE_RETRY_MS = 1000;
const DEFAULT_MAX_RETRY_MS = 5 * 60 * 1000;

let pollingTimer = null;
let isProcessing = false;

function toPositiveInt(input, fallbackValue) {
  const parsed = Number.parseInt(input, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function getProcessorConfig() {
  return {
    pollIntervalMs: toPositiveInt(process.env.NOTIFICATION_OUTBOX_POLL_MS, DEFAULT_POLL_INTERVAL_MS),
    batchSize: Math.min(toPositiveInt(process.env.NOTIFICATION_OUTBOX_BATCH_SIZE, DEFAULT_BATCH_SIZE), 100),
    maxAttempts: Math.max(toPositiveInt(process.env.NOTIFICATION_OUTBOX_MAX_ATTEMPTS, DEFAULT_MAX_ATTEMPTS), 2),
    lockTtlMs: toPositiveInt(process.env.NOTIFICATION_OUTBOX_LOCK_TTL_MS, DEFAULT_LOCK_TTL_MS),
    baseRetryMs: toPositiveInt(process.env.NOTIFICATION_OUTBOX_BASE_RETRY_MS, DEFAULT_BASE_RETRY_MS),
    maxRetryMs: toPositiveInt(process.env.NOTIFICATION_OUTBOX_MAX_RETRY_MS, DEFAULT_MAX_RETRY_MS)
  };
}

function computeRetryDelayMs(attempts, config) {
  const exponent = Math.max(attempts - 1, 0);
  const delay = config.baseRetryMs * (2 ** exponent);
  return Math.min(delay, config.maxRetryMs);
}

async function claimNextOutboxEvent(config) {
  const now = new Date();
  const staleLockBefore = new Date(now.getTime() - config.lockTtlMs);

  return NotificationOutbox.findOneAndUpdate(
    {
      $or: [
        {
          status: { $in: ["pending", "failed"] },
          nextAttemptAt: { $lte: now }
        },
        {
          status: "processing",
          lockedAt: { $lte: staleLockBefore }
        }
      ]
    },
    {
      $set: {
        status: "processing",
        lockedAt: now,
        lockedBy: PROCESSOR_NAME,
        lastError: ""
      },
      $inc: { attempts: 1 }
    },
    {
      returnDocument: "after",
      sort: { nextAttemptAt: 1, createdAt: 1 }
    }
  );
}

async function markOutboxAsSent(outboxEvent) {
  await NotificationOutbox.updateOne(
    { _id: outboxEvent._id },
    {
      $set: {
        status: "sent",
        sentAt: new Date(),
        lockedAt: null,
        lockedBy: "",
        nextAttemptAt: null,
        deadLetterReason: "",
        lastError: ""
      }
    }
  );
}

async function markOutboxAsFailed(outboxEvent, error, config) {
  const message = error?.message ? String(error.message).slice(0, 500) : "Unknown delivery error";
  const shouldDeadLetter = outboxEvent.attempts >= config.maxAttempts;
  const retryAt = new Date(Date.now() + computeRetryDelayMs(outboxEvent.attempts, config));

  await NotificationOutbox.updateOne(
    { _id: outboxEvent._id },
    {
      $set: {
        status: shouldDeadLetter ? "dead" : "failed",
        deadLetterReason: shouldDeadLetter ? "max_attempts_reached" : "",
        nextAttemptAt: shouldDeadLetter ? null : retryAt,
        lockedAt: null,
        lockedBy: "",
        lastError: message
      }
    }
  );
}

async function processOneOutboxEvent(config) {
  const outboxEvent = await claimNextOutboxEvent(config);
  if (!outboxEvent) {
    return false;
  }

  try {
    await deliverNotificationOutboxEvent(outboxEvent);
    await markOutboxAsSent(outboxEvent);
  } catch (error) {
    await markOutboxAsFailed(outboxEvent, error, config);
  }

  return true;
}

async function processOutboxBatch() {
  if (isProcessing) {
    return;
  }

  isProcessing = true;
  const config = getProcessorConfig();

  try {
    for (let count = 0; count < config.batchSize; count += 1) {
      const hadWork = await processOneOutboxEvent(config);
      if (!hadWork) {
        break;
      }
    }
  } catch (error) {
    // Keep the worker alive; errors are tracked per event.
  } finally {
    isProcessing = false;
  }
}

function startOutboxProcessor() {
  if (pollingTimer) {
    return;
  }

  const config = getProcessorConfig();
  pollingTimer = setInterval(() => {
    void processOutboxBatch();
  }, config.pollIntervalMs);

  // Do not hold process open only for this timer.
  if (typeof pollingTimer.unref === "function") {
    pollingTimer.unref();
  }

  void processOutboxBatch();
}

function stopOutboxProcessor() {
  if (!pollingTimer) {
    return;
  }

  clearInterval(pollingTimer);
  pollingTimer = null;
}

module.exports = {
  startOutboxProcessor,
  stopOutboxProcessor,
  processOutboxBatch
};
