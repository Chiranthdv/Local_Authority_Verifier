const cooldownStore = new Map();
let lastCleanupAt = Date.now();

function toPositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function cleanupCooldownStore() {
  const now = Date.now();
  if (now - lastCleanupAt < 60 * 1000) {
    return;
  }

  lastCleanupAt = now;
  for (const [key, value] of cooldownStore.entries()) {
    if (!value || value.expiresAt <= now) {
      cooldownStore.delete(key);
    }
  }
}

function createActionCooldownMiddleware({
  cooldownMs,
  keyGenerator,
  message
}) {
  const ttlMs = toPositiveInt(cooldownMs, 5000);

  return (req, res, next) => {
    cleanupCooldownStore();

    const key = keyGenerator(req);
    if (!key) {
      return next();
    }

    const now = Date.now();
    const existing = cooldownStore.get(key);
    if (existing && existing.expiresAt > now) {
      const retryAfterSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: message,
        retryAfterSeconds
      });
    }

    cooldownStore.set(key, { expiresAt: now + ttlMs });
    return next();
  };
}

module.exports = {
  createActionCooldownMiddleware
};
