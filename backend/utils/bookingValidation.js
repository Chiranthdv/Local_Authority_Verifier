const mongoose = require("mongoose");

const TIME_SLOTS = {
  SLOT_06_10: { code: "SLOT_06_10", label: "06:00-10:00", startHour: 6, endHour: 10 },
  SLOT_10_14: { code: "SLOT_10_14", label: "10:00-14:00", startHour: 10, endHour: 14 },
  SLOT_14_18: { code: "SLOT_14_18", label: "14:00-18:00", startHour: 14, endHour: 18 },
  SLOT_18_22: { code: "SLOT_18_22", label: "18:00-22:00", startHour: 18, endHour: 22 }
};

function isValidObjectId(id) {
  return mongoose.Types.ObjectId.isValid(id);
}

function normalizeDateOnly(input) {
  if (!input) return null;
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) return null;
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function formatDateKey(date) {
  return date.toISOString().slice(0, 10);
}

function normalizeStatus(input) {
  return typeof input === "string" ? input.trim().toLowerCase() : "";
}

function getStatusFilter(status) {
  const normalized = normalizeStatus(status);
  if (!normalized) return {};
  if (normalized === "pending") return { status: { $in: ["pending", "requested"] } };
  return { status: normalized };
}

function buildSlotLockKey({ workerId, serviceDate, timeSlotCode }) {
  if (!workerId || !serviceDate || !timeSlotCode) return null;
  return `${workerId}:${formatDateKey(serviceDate)}:${timeSlotCode}`;
}

function getTodayUtcDate() {
  const now = new Date();
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

function isPastServiceDate(serviceDate) {
  return serviceDate < getTodayUtcDate();
}

module.exports = {
  TIME_SLOTS,
  isValidObjectId,
  normalizeDateOnly,
  formatDateKey,
  normalizeStatus,
  getStatusFilter,
  buildSlotLockKey,
  isPastServiceDate
};
