const {
  TIME_SLOTS,
  isValidObjectId,
  normalizeDateOnly,
  formatDateKey,
  normalizeStatus,
  getStatusFilter,
  buildSlotLockKey,
  isPastServiceDate
} = require("../../utils/bookingValidation");

describe("Booking validation helpers", () => {
  test("validates MongoDB object ids correctly", () => {
    expect(isValidObjectId("507f1f77bcf86cd799439011")).toBe(true);
    expect(isValidObjectId("not-a-valid-id")).toBe(false);
  });

  test("normalizes date-only values to UTC midnight", () => {
    const date = normalizeDateOnly("2026-04-15T14:30:00Z");
    expect(date.toISOString()).toBe("2026-04-15T00:00:00.000Z");
  });

  test("formats date keys correctly", () => {
    const date = new Date(Date.UTC(2026, 3, 15));
    expect(formatDateKey(date)).toBe("2026-04-15");
  });

  test("normalizes status values to lowercase strings", () => {
    expect(normalizeStatus(" PENDING ")).toBe("pending");
    expect(normalizeStatus(null)).toBe("");
  });

  test("getStatusFilter returns pending filter for pending status", () => {
    expect(getStatusFilter("pending")).toEqual({ status: { $in: ["pending", "requested"] } });
  });

  test("buildSlotLockKey composes a stable lock key", () => {
    const key = buildSlotLockKey({ workerId: "abc", serviceDate: new Date(Date.UTC(2026, 3, 15)), timeSlotCode: "SLOT_06_10" });
    expect(key).toBe("abc:2026-04-15:SLOT_06_10");
  });

  test("isPastServiceDate returns false for today or future dates", () => {
    const tomorrow = new Date();
    tomorrow.setUTCDate(tomorrow.getUTCDate() + 1);
    expect(isPastServiceDate(tomorrow)).toBe(false);
  });
});
