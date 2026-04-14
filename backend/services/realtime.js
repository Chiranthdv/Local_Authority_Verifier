const { Server } = require("socket.io");
const jwt = require("jsonwebtoken");

let ioInstance = null;
const socketsByUser = new Map();

function extractToken(socket) {
  const authToken = socket.handshake?.auth?.token;
  if (typeof authToken === "string" && authToken.trim()) {
    return authToken.trim();
  }

  const authHeader = socket.handshake?.headers?.authorization;
  if (typeof authHeader === "string" && authHeader.startsWith("Bearer ")) {
    return authHeader.split(" ")[1];
  }

  return "";
}

function initRealtime(httpServer) {
  if (ioInstance) {
    return ioInstance;
  }

  ioInstance = new Server(httpServer, {
    cors: {
      origin: process.env.CLIENT_URL || "http://localhost:5173",
      credentials: true
    },
    transports: ["websocket", "polling"]
  });

  ioInstance.use((socket, next) => {
    try {
      const token = extractToken(socket);
      if (!token || !process.env.JWT_SECRET) {
        return next(new Error("Unauthorized"));
      }

      const payload = jwt.verify(token, process.env.JWT_SECRET);
      socket.user = { userId: String(payload.userId), role: payload.role };
      return next();
    } catch (error) {
      return next(new Error("Unauthorized"));
    }
  });

  ioInstance.on("connection", (socket) => {
    const userId = socket.user?.userId;
    if (!userId) {
      socket.disconnect();
      return;
    }

    socket.join(`user:${userId}`);
    if (!socketsByUser.has(userId)) {
      socketsByUser.set(userId, new Set());
    }
    socketsByUser.get(userId).add(socket.id);

    socket.emit("realtime:ready", {
      connected: true,
      userId,
      activeConnections: socketsByUser.get(userId).size
    });

    socket.on("disconnect", () => {
      const bucket = socketsByUser.get(userId);
      if (!bucket) {
        return;
      }

      bucket.delete(socket.id);
      if (bucket.size === 0) {
        socketsByUser.delete(userId);
      }
    });
  });

  return ioInstance;
}

function emitToUser(userId, eventName, payload) {
  if (!ioInstance || !userId || !eventName) {
    return false;
  }

  ioInstance.to(`user:${String(userId)}`).emit(eventName, payload);
  return true;
}

module.exports = {
  initRealtime,
  emitToUser
};
