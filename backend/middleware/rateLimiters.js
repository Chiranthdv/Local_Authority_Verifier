const rateLimit = require("express-rate-limit");

function toPositiveInt(value, fallbackValue) {
  const parsed = Number.parseInt(value, 10);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return fallbackValue;
  }
  return parsed;
}

function buildLimiter({
  windowMs,
  max,
  message,
  keyGenerator,
  skipSuccessfulRequests = false
}) {
  return rateLimit({
    windowMs,
    max,
    standardHeaders: true,
    legacyHeaders: false,
    skipSuccessfulRequests,
    keyGenerator,
    message: { error: message }
  });
}

function ipKeyGenerator(req) {
  return String(req.ip || req.headers["x-forwarded-for"] || "unknown-ip");
}

function userKeyGenerator(req) {
  const userId = req.user?.userId;
  if (userId) {
    return `user:${String(userId)}`;
  }
  return `ip:${ipKeyGenerator(req)}`;
}

const bookingWindowMs = toPositiveInt(process.env.RATE_LIMIT_BOOKING_WINDOW_MS, 60 * 1000);
const chatWindowMs = toPositiveInt(process.env.RATE_LIMIT_CHAT_WINDOW_MS, 60 * 1000);
const reviewWindowMs = toPositiveInt(process.env.RATE_LIMIT_REVIEW_WINDOW_MS, 10 * 60 * 1000);
const loginWindowMs = toPositiveInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS, 15 * 60 * 1000);

const bookingIpLimiter = buildLimiter({
  windowMs: bookingWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_BOOKING_IP_MAX, 20),
  message: "Too many booking attempts from this IP. Try again shortly."
});

const bookingUserLimiter = buildLimiter({
  windowMs: bookingWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_BOOKING_USER_MAX, 10),
  message: "Too many booking attempts from this account. Slow down.",
  keyGenerator: userKeyGenerator
});

const chatIpLimiter = buildLimiter({
  windowMs: chatWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_CHAT_IP_MAX, 120),
  message: "Too many chat messages from this IP. Try again shortly."
});

const chatUserLimiter = buildLimiter({
  windowMs: chatWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_CHAT_USER_MAX, 60),
  message: "Too many chat messages from this account. Slow down.",
  keyGenerator: userKeyGenerator
});

const reviewIpLimiter = buildLimiter({
  windowMs: reviewWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_REVIEW_IP_MAX, 20),
  message: "Too many review submissions from this IP. Try later."
});

const reviewUserLimiter = buildLimiter({
  windowMs: reviewWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_REVIEW_USER_MAX, 8),
  message: "Too many review submissions from this account. Try later.",
  keyGenerator: userKeyGenerator
});

const loginIpLimiter = buildLimiter({
  windowMs: loginWindowMs,
  max: toPositiveInt(process.env.RATE_LIMIT_LOGIN_IP_MAX, 20),
  message: "Too many failed login attempts from this IP. Try again later.",
  skipSuccessfulRequests: true
});

module.exports = {
  bookingIpLimiter,
  bookingUserLimiter,
  chatIpLimiter,
  chatUserLimiter,
  reviewIpLimiter,
  reviewUserLimiter,
  loginIpLimiter
};
