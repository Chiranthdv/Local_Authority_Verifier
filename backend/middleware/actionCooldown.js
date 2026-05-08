const cooldownStore = new Map();
let lastCleanupAt = Date.now();
const {
  isRedisReady,
  redisClient,
  logRedisFallbackWarning
} = require("../config/redis");

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

function getMemoryCooldown(key) {
  cleanupCooldownStore();
  const now = Date.now();
  const existing = cooldownStore.get(key);
  if (!existing || existing.expiresAt <= now) {
    cooldownStore.delete(key);
    return { allowed: true, remainingSeconds: 0 };
  }

  const remainingSeconds = Math.max(1, Math.ceil((existing.expiresAt - now) / 1000));
  return { allowed: false, remainingSeconds };
}

function setMemoryCooldown(key, ttlSeconds) {
  const ttlMs = ttlSeconds * 1000;
  cooldownStore.set(key, { expiresAt: Date.now() + ttlMs });
  return { allowed: true, remainingSeconds: 0 };
}

function buildCooldownKey(userId, actionType) {
  return `cooldown:${userId}:${actionType}`;
}

async function checkCooldown(userId, actionType, seconds) {
  const ttlSeconds = Math.max(1, toPositiveInt(seconds, 5));
  if (!userId || !actionType) {
    return { allowed: true, remainingSeconds: 0 };
  }

  const key = buildCooldownKey(userId, actionType);

  if (isRedisReady()) {
    try {
      const setResult = await redisClient.set(key, "1", "EX", ttlSeconds, "NX");
      if (setResult === "OK") {
        return { allowed: true, remainingSeconds: 0 };
      }

      const ttl = await redisClient.ttl(key);
      return {
        allowed: false,
        remainingSeconds: Math.max(1, Number.isInteger(ttl) ? ttl : ttlSeconds)
      };
    } catch (error) {
      logRedisFallbackWarning("cooldown middleware", error);
    }
  }

  const memoryState = getMemoryCooldown(key);
  if (!memoryState.allowed) {
    return memoryState;
  }

  return setMemoryCooldown(key, ttlSeconds);
}

function createActionCooldownMiddleware({
  cooldownMs,
  actionType,
  actionTypeGenerator,
  keyGenerator,
  message
}) {
  const ttlMs = toPositiveInt(cooldownMs, 5000);

  return async (req, res, next) => {
    const userId = req.user?.userId;
    if (!userId) {
      return next();
    }

    let resolvedActionType = "";
    if (typeof actionTypeGenerator === "function") {
      resolvedActionType = String(actionTypeGenerator(req) || "").trim();
    } else if (typeof actionType === "string") {
      resolvedActionType = actionType.trim();
    } else if (typeof keyGenerator === "function") {
      const legacyKey = String(keyGenerator(req) || "").trim();
      if (legacyKey) {
        resolvedActionType = legacyKey.startsWith(`${userId}:`)
          ? legacyKey.slice(userId.length + 1)
          : legacyKey.replace(/^.+?:/, "");
      }
    }

    if (!resolvedActionType) {
      return next();
    }

    const result = await checkCooldown(userId, resolvedActionType, Math.ceil(ttlMs / 1000));
    if (!result.allowed) {
      const retryAfterSeconds = result.remainingSeconds;
      res.set("Retry-After", String(retryAfterSeconds));
      return res.status(429).json({
        error: message,
        retryAfterSeconds
      });
    }

    return next();
  };
}

module.exports = {
  checkCooldown,
  createActionCooldownMiddleware
};
