const IDEMPOTENCY_KEY_PATTERN = /^[A-Za-z0-9._:-]{8,128}$/;

function normalizeIdempotencyKey(rawValue) {
  if (rawValue === undefined || rawValue === null) {
    return "";
  }

  if (Array.isArray(rawValue)) {
    return null;
  }

  if (typeof rawValue !== "string") {
    return null;
  }

  const key = rawValue.trim();
  if (!key) {
    return "";
  }

  if (!IDEMPOTENCY_KEY_PATTERN.test(key)) {
    return null;
  }

  return key;
}

module.exports = (req, res, next) => {
  const rawKey = req.get("Idempotency-Key");
  const idempotencyKey = normalizeIdempotencyKey(rawKey);

  if (idempotencyKey === null) {
    return res.status(400).json({
      error: "Invalid Idempotency-Key header. Use 8-128 chars: letters, numbers, ., _, :, -"
    });
  }

  req.idempotencyKey = idempotencyKey || null;
  return next();
};
