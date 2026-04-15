import { io } from "socket.io-client";

let socketInstance = null;

function getBackendUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase.replace(/\/api\/?$/, "");
  }
  return "http://localhost:5000";
}

export function connectRealtime(token) {
  if (!token) {
    return null;
  }

  if (socketInstance && socketInstance.connected && socketInstance.authToken === token) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = io(getBackendUrl(), {
    auth: { token },
    transports: ["websocket", "polling"],
    withCredentials: true
  });
  socketInstance.authToken = token;
  return socketInstance;
}

export function getRealtimeSocket() {
  return socketInstance;
}

export function disconnectRealtime() {
  if (socketInstance) {
    socketInstance.disconnect();
    socketInstance = null;
  }
}
