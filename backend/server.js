const http = require("http");
const mongoose = require("mongoose");
const path = require("path");
require("dotenv").config({ path: path.join(__dirname, ".env") });
const { app } = require("./app");
const { initRealtime } = require("./services/realtime");
const { startOutboxProcessor, stopOutboxProcessor } = require("./services/outboxProcessor");
const { startDataLifecycleCleanup, stopDataLifecycleCleanup } = require("./services/dataLifecycleCleanup");

const server = http.createServer(app);
const PORT = Number.parseInt(process.env.PORT, 10) || 5001;

mongoose.connect(process.env.MONGO_URI)
  .then(() => {
    console.log("MongoDB Connected");
    startOutboxProcessor();
    startDataLifecycleCleanup();
  })
  .catch((err) => console.log(err));

initRealtime(server);

server.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});

function shutdown() {
  stopOutboxProcessor();
  stopDataLifecycleCleanup();
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);
