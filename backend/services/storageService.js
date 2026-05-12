const fs = require("fs");
const path = require("path");
const crypto = require("crypto");

const fsp = fs.promises;

const STORAGE_ROOT = path.resolve(path.join(__dirname, "..", "storage"));
const TEMP_ROOT = path.resolve(path.join(__dirname, "..", "temp"));

function sanitizeSegment(value, fallbackValue) {
  const normalized = String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/(^-+)|(-+$)/g, "");

  return normalized || fallbackValue;
}

function sanitizeFilename(filename) {
  const parsed = path.parse(String(filename || "file"));
  const baseName = sanitizeSegment(parsed.name, "file");
  const extension = String(parsed.ext || "").toLowerCase().replace(/[^a-z0-9.]/g, "");
  return `${baseName}${extension}`;
}

function buildStorageKey(folder, originalName) {
  const safeFolder = sanitizeSegment(folder, "misc");
  const safeFileName = sanitizeFilename(originalName);
  const datePrefix = new Date().toISOString().slice(0, 10);
  const uniquePrefix = `${Date.now()}-${crypto.randomBytes(6).toString("hex")}`;
  return path.posix.join(safeFolder, datePrefix, `${uniquePrefix}-${safeFileName}`);
}

function toPublicUrl(key) {
  return `/storage/${String(key).replace(/\\/g, "/")}`;
}

class LocalStorageProvider {
  async ensureBaseDirectories() {
    await Promise.all([
      fsp.mkdir(STORAGE_ROOT, { recursive: true }),
      fsp.mkdir(TEMP_ROOT, { recursive: true })
    ]);
  }

  async uploadFile(buffer, originalName, mimeType, folder) {
    if (!Buffer.isBuffer(buffer) || buffer.length === 0) {
      throw new Error("uploadFile requires a non-empty file buffer");
    }

    await this.ensureBaseDirectories();

    const key = buildStorageKey(folder, originalName);
    const absolutePath = this.getFilePath(key);
    await fsp.mkdir(path.dirname(absolutePath), { recursive: true });
    await fsp.writeFile(absolutePath, buffer);

    return {
      url: toPublicUrl(key),
      key
    };
  }

  async deleteFile(key) {
    if (!key) {
      return false;
    }

    const absolutePath = this.getFilePath(key);
    try {
      await fsp.unlink(absolutePath);
      return true;
    } catch (error) {
      if (error?.code === "ENOENT") {
        return false;
      }
      throw error;
    }
  }

  getFilePath(key) {
    const normalizedKey = String(key || "").replace(/\\/g, "/").replace(/^\/+/, "");
    const absolutePath = path.resolve(STORAGE_ROOT, normalizedKey);
    if (!absolutePath.startsWith(STORAGE_ROOT)) {
      throw new Error("Invalid storage key");
    }
    return absolutePath;
  }
}

const storageService = new LocalStorageProvider();

module.exports = {
  storageService,
  LocalStorageProvider,
  STORAGE_ROOT,
  TEMP_ROOT,
  toPublicUrl
};
