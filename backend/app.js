const express = require("express");
const cors = require("cors");
const helmet = require("helmet");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });

const authRoutes = require("./routes/authRoutes");
const workerRoutes = require("./routes/workerRoutes");
const documentRoutes = require("./routes/documentRoutes");
const jobRoutes = require("./routes/jobRoutes");
const reviewRoutes = require("./routes/reviewRoutes");
const userRoutes = require("./routes/userRoutes");
const notificationRoutes = require("./routes/notificationRoutes");
const chatRoutes = require("./routes/chatRoutes");
const adminRoutes = require("./routes/adminRoutes");
const { buildLimiter } = require("./middleware/rateLimiters");

const app = express();
const trustProxy = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);
const authRateLimitMax = Number.parseInt(
  process.env.AUTH_RATE_LIMIT_MAX || (process.env.NODE_ENV === "production" ? "20" : "100"),
  10
);

const authLimiter = buildLimiter({
  windowMs: 15 * 60 * 1000,
  max: Number.isFinite(authRateLimitMax) ? authRateLimitMax : 20,
  message: "Too many login attempts. Please try again later.",
  prefix: "rl:auth:global:"
});

if (Number.isInteger(trustProxy) && trustProxy > 0) {
  app.set("trust proxy", trustProxy);
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/worker", workerRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chats", chatRoutes);
app.use("/api/admin", adminRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

app.use((err, req, res, next) => {
  console.error("[EXPRESS ERROR]", {
    path: req.originalUrl,
    method: req.method,
    message: err?.message
  });

  if (res.headersSent) {
    return next(err);
  }

  const statusCode = Number.isInteger(err?.statusCode) ? err.statusCode : 500;
  return res.status(statusCode).json({
    error: err?.message || "Internal server error",
    message: err?.message || "Internal server error"
  });
});

module.exports = { app };
