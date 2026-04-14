const express = require("express");
const mongoose = require("mongoose");
const cors = require("cors");
const helmet = require("helmet");
const rateLimit = require("express-rate-limit");
const http = require("http");
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
const { initRealtime } = require("./services/realtime");
const { startOutboxProcessor, stopOutboxProcessor } = require("./services/outboxProcessor");
const { startDataLifecycleCleanup, stopDataLifecycleCleanup } = require("./services/dataLifecycleCleanup");

const app = express();
const server = http.createServer(app);
const authLimiter = rateLimit({ windowMs: 15 * 60 * 1000, max: 20 });
const trustProxy = Number.parseInt(process.env.TRUST_PROXY_HOPS || "0", 10);

if (Number.isInteger(trustProxy) && trustProxy > 0) {
  app.set("trust proxy", trustProxy);
}

app.use(helmet());
app.use(cors({ origin: process.env.CLIENT_URL || "http://localhost:5173", credentials: true }));
app.use(express.json());
app.use("/api/auth", authLimiter, authRoutes);
app.use("/api/workers", workerRoutes);
app.use("/api/documents", documentRoutes);
app.use("/api/jobs", jobRoutes);
app.use("/api/reviews", reviewRoutes);
app.use("/api/users", userRoutes);
app.use("/api/notifications", notificationRoutes);
app.use("/api/chats", chatRoutes);

app.get("/", (req, res) => {
  res.send("API is running");
});

initRealtime(server);

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    startOutboxProcessor();
    startDataLifecycleCleanup();
  })
  .catch((err) => console.log(err));

server.listen(process.env.PORT || 5000 ,() => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
  console.log("New Line Added");
});

function shutdown() {
  stopOutboxProcessor();
  stopDataLifecycleCleanup();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
