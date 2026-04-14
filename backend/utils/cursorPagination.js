const mongoose = require("mongoose");

function parsePositiveInt(value, fallbackValue, maxValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }

  if (Number.isInteger(maxValue) && maxValue > 0) {
    return Math.min(parsed, maxValue);
  }

  return parsed;
}

function encodeCursor(document) {
  if (!document?._id || !document?.createdAt) {
    return null;
  }

  const payload = {
    id: String(document._id),
    createdAt: new Date(document.createdAt).toISOString()
  };
  return Buffer.from(JSON.stringify(payload), "utf8").toString("base64");
}

function decodeCursor(cursor) {
  if (typeof cursor !== "string" || !cursor.trim()) {
    return null;
  }

  try {
    const decoded = Buffer.from(cursor, "base64").toString("utf8");
    const parsed = JSON.parse(decoded);
    if (!parsed || !mongoose.Types.ObjectId.isValid(parsed.id)) {
      return null;
    }

    const createdAt = new Date(parsed.createdAt);
    if (Number.isNaN(createdAt.getTime())) {
      return null;
    }

    return {
      _id: new mongoose.Types.ObjectId(parsed.id),
      createdAt
    };
  } catch (error) {
    return null;
  }
}

function buildDescendingCursorFilter(cursor, createdAtField = "createdAt", idField = "_id") {
  if (!cursor) {
    return {};
  }

  return {
    $or: [
      { [createdAtField]: { $lt: cursor.createdAt } },
      { [createdAtField]: cursor.createdAt, [idField]: { $lt: cursor._id } }
    ]
  };
}

module.exports = {
  parsePositiveInt,
  encodeCursor,
  decodeCursor,
  buildDescendingCursorFilter
};
