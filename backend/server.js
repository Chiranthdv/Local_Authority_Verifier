const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app } = require("./app");
const { initRealtime } = require("./services/realtime");
const { startOutboxProcessor, stopOutboxProcessor } = require("./services/outboxProcessor");
const { startDataLifecycleCleanup, stopDataLifecycleCleanup } = require("./services/dataLifecycleCleanup");

const server = http.createServer(app);
const BASE_PORT = Number.parseInt(process.env.PORT, 10) || 5001;
const MAX_PORT_ATTEMPTS = Number.parseInt(process.env.MAX_PORT_ATTEMPTS, 10) || 10;
const HOST = process.env.HOST || "0.0.0.0";
let currentPort = BASE_PORT;
let attemptCount = 0;

const mongoUri = process.env.MONGO_URI || "mongodb://mongo:27017/app";
mongoose.set("bufferCommands", false);

function tryListen(port) {
  currentPort = port;
  attemptCount += 1;
  server.listen(port, HOST);
}

server.on("listening", () => {
  const address = server.address();
  const activePort = typeof address === "object" && address ? address.port : currentPort;
  const activeHost = typeof address === "object" && address ? address.address : HOST;
  console.log(`Server running on ${activeHost}:${activePort}`);
});

server.on("error", (error) => {
  if (error.code === "EADDRINUSE") {
    if (attemptCount >= MAX_PORT_ATTEMPTS) {
      console.error(
        `No free port found after ${MAX_PORT_ATTEMPTS} attempts starting at ${BASE_PORT}.`
      );
      console.error("Run one of these commands to inspect/stop the blocking process:");
      console.error('  netstat -ano | findstr :5000');
      console.error('  netstat -ano | findstr :5001');
      console.error('  taskkill /PID <PID> /F');
      process.exit(1);
    }

    const nextPort = currentPort + 1;
    console.warn(`Port ${currentPort} is in use, trying ${nextPort}...`);
    tryListen(nextPort);
    return;
  }
  throw error;
});

async function bootstrap() {
  try {
    await mongoose.connect(mongoUri, { serverSelectionTimeoutMS: 10000 });
    console.log("MongoDB Connected");

    startOutboxProcessor();
    startDataLifecycleCleanup();
    initRealtime(server);
    tryListen(BASE_PORT);
  } catch (err) {
    console.error("MongoDB connection failed. Server not started.");
    console.error(err?.message || err);
    process.exit(1);
  }
}

bootstrap();

function shutdown(signal) {
  console.log(`Shutting down server due to ${signal}`);
  stopOutboxProcessor();
  stopDataLifecycleCleanup();
  server.close(async () => {
    try {
      await mongoose.connection.close();
    } catch (err) {
      console.error("Error while closing MongoDB connection", err?.message || err);
    } finally {
      process.exit(0);
    }
  });
}

process.once("SIGINT", () => shutdown("SIGINT"));
process.once("SIGTERM", () => shutdown("SIGTERM"));
process.once("SIGUSR2", () => {
  shutdown("SIGUSR2");
  process.kill(process.pid, "SIGUSR2");
});
