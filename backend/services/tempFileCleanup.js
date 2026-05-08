const fs = require("fs");
const path = require("path");
const { TEMP_ROOT } = require("./storageService");

const fsp = fs.promises;

let cleanupTimer = null;
let cleanupRunning = false;

function toPositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

async function ensureTempRoot() {
  await fsp.mkdir(TEMP_ROOT, { recursive: true });
}

async function runTempFileCleanup() {
  if (cleanupRunning) {
    return;
  }

  cleanupRunning = true;

  try {
    await ensureTempRoot();
    const retentionMs = toPositiveInt(process.env.TEMP_FILE_RETENTION_MS, 60 * 60 * 1000);
    const cutoff = Date.now() - retentionMs;
    const entries = await fsp.readdir(TEMP_ROOT, { withFileTypes: true });

    for (const entry of entries) {
      const absolutePath = path.join(TEMP_ROOT, entry.name);

      if (entry.isDirectory()) {
        continue;
      }

      const stats = await fsp.stat(absolutePath);
      if (stats.mtimeMs <= cutoff) {
        await fsp.unlink(absolutePath).catch(() => {});
      }
    }
  } finally {
    cleanupRunning = false;
  }
}

function startTempFileCleanup() {
  if (cleanupTimer) {
    return;
  }

  const intervalMs = toPositiveInt(process.env.TEMP_FILE_CLEANUP_INTERVAL_MS, 60 * 60 * 1000);
  cleanupTimer = setInterval(() => {
    void runTempFileCleanup();
  }, intervalMs);

  if (typeof cleanupTimer.unref === "function") {
    cleanupTimer.unref();
  }

  void runTempFileCleanup();
}

function stopTempFileCleanup() {
  if (!cleanupTimer) {
    return;
  }

  clearInterval(cleanupTimer);
  cleanupTimer = null;
}

module.exports = {
  runTempFileCleanup,
  startTempFileCleanup,
  stopTempFileCleanup
};
