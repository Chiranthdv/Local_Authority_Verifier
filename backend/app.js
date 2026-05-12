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
const client = require("prom-client");

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

// ── Prometheus Metrics Setup ──
const collectDefaultMetrics = client.collectDefaultMetrics;
collectDefaultMetrics({ register: client.register });

const httpRequestDurationMicroseconds =
  client.register.getSingleMetric("http_request_duration_ms") ||
  new client.Histogram({
    name: "http_request_duration_ms",
    help: "Duration of HTTP requests in ms",
    labelNames: ["method", "route", "code"],
    buckets: [0.1, 5, 15, 50, 100, 200, 500, 1000, 2000, 5000]
  });

app.use((req, res, next) => {
  const start = Date.now();
  res.on("finish", () => {
    const duration = Date.now() - start;
    httpRequestDurationMicroseconds
      .labels(req.method, req.route?.path || req.path, res.statusCode)
      .observe(duration);
  });
  next();
});

app.get("/api/metrics", async (req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

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
  const isProduction = process.env.NODE_ENV === "production";
  const errorMessage = isProduction ? "Internal server error" : (err?.message || "Internal server error");
  
  return res.status(statusCode).json({
    error: errorMessage,
    message: errorMessage
  });
});

module.exports = { app };
