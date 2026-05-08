import { io } from "socket.io-client";

let socketInstance = null;

function getBackendUrl() {
  const envBase = import.meta.env.VITE_API_BASE_URL;
  if (typeof envBase === "string" && envBase.trim()) {
    return envBase.replace(/\/api\/?$/, "");
  }
  return "http://localhost:5001";
}

export function connectRealtime() {
  if (socketInstance && socketInstance.connected) {
    return socketInstance;
  }

  if (socketInstance) {
    socketInstance.disconnect();
  }

  socketInstance = io(getBackendUrl(), {
    transports: ["websocket", "polling"],
    withCredentials: true
  });
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
