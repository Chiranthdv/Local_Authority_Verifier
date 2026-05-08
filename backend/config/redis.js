const Redis = require("ioredis");

const redisUrl = process.env.REDIS_URL || "";
const redisHost = process.env.REDIS_HOST || "127.0.0.1";
const redisPort = Number.parseInt(process.env.REDIS_PORT, 10) || 6379;
const redisPassword = process.env.REDIS_PASSWORD || undefined;
const redisDb = Number.parseInt(process.env.REDIS_DB, 10) || 0;
const redisEnabled = process.env.REDIS_ENABLED !== "false" && process.env.NODE_ENV !== "test";

let hasLoggedFallbackWarning = false;
let redisClient = null;

function buildRedisClient() {
  const connectionOptions = {
    host: redisHost,
    port: redisPort,
    password: redisPassword,
    db: redisDb,
    connectTimeout: 1000,
    lazyConnect: true,
    maxRetriesPerRequest: 1,
    enableReadyCheck: true,
    retryStrategy: (times) => {
      if (times >= 5) {
        return null;
      }
      return Math.min(times * 250, 3000);
    }
  };

  const client = redisUrl ? new Redis(redisUrl, connectionOptions) : new Redis(connectionOptions);

  client.on("ready", () => {
    hasLoggedFallbackWarning = false;
    console.log("[REDIS] connected and ready");
  });

  client.on("reconnecting", (delay) => {
    console.warn(`[REDIS] reconnecting in ${delay}ms`);
  });

  client.on("close", () => {
    console.warn("[REDIS] connection closed");
  });

  client.on("end", () => {
    console.warn("[REDIS] retries exhausted, using in-memory fallback");
  });

  client.on("error", (error) => {
    console.error("[REDIS] client error", error?.message || error);
  });

  client.connect().catch((error) => {
    logRedisFallbackWarning("redis connection", error);
  });

  return client;
}

if (redisEnabled) {
  redisClient = buildRedisClient();
}

function isRedisEnabled() {
  return redisEnabled && Boolean(redisClient);
}

function isRedisReady() {
  return isRedisEnabled() && redisClient.status === "ready";
}

function logRedisFallbackWarning(context, error) {
  if (hasLoggedFallbackWarning) {
    return;
  }

  hasLoggedFallbackWarning = true;
  console.warn(`[REDIS] falling back to in-memory ${context}`);
  if (error) {
    console.warn("[REDIS] fallback reason:", error?.message || error);
  }
}

async function sendRedisCommand(...command) {
  if (!isRedisReady()) {
    throw new Error("Redis is not ready");
  }
  return redisClient.call(command[0], ...command.slice(1));
}

async function closeRedisConnection() {
  if (!redisClient) {
    return;
  }

  try {
    await redisClient.quit();
  } catch {
    redisClient.disconnect();
  }
}

module.exports = {
  redisClient,
  isRedisEnabled,
  isRedisReady,
  sendRedisCommand,
  logRedisFallbackWarning,
  closeRedisConnection
};
