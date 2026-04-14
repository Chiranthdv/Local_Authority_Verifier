import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";
import { connectRealtime, disconnectRealtime } from "../lib/realtime";
import { toast } from "react-toastify";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [token, setToken] = useState(() => localStorage.getItem("token"));
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);

  const clearSession = () => {
    localStorage.removeItem("token");
    setToken(null);
    setUser(null);
  };

  const refreshUser = async () => {
    const storedToken = localStorage.getItem("token");

    if (!storedToken) {
      setUser(null);
      setLoading(false);
      return null;
    }

    try {
      const { data } = await api.get("/auth/me");
      setUser(data);
      return data;
    } catch (error) {
      clearSession();
      if (window.location.pathname !== "/login") {
        window.location.replace("/login");
      }
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    refreshUser();
  }, [token]);

  useEffect(() => {
    if (!token) {
      disconnectRealtime();
      return;
    }

    const socket = connectRealtime(token);
    if (!socket) {
      return;
    }

    const handleNewNotification = (notification) => {
      window.dispatchEvent(new CustomEvent("app:notification:new", { detail: notification }));
      if (notification?.title) {
        toast.info(notification.title, { autoClose: 2000 });
      }
    };

    const handleBookingUpdate = (update) => {
      window.dispatchEvent(new CustomEvent("app:booking:update", { detail: update }));
    };

    const handleChatMessage = (message) => {
      window.dispatchEvent(new CustomEvent("app:chat:message", { detail: message }));
      if (message?.text) {
        toast.info(`New message: ${String(message.text).slice(0, 40)}`, { autoClose: 1500 });
      }
    };

    const handleChatRead = (payload) => {
      window.dispatchEvent(new CustomEvent("app:chat:read", { detail: payload }));
    };

    socket.on("notification:new", handleNewNotification);
    socket.on("booking:update", handleBookingUpdate);
    socket.on("chat:message", handleChatMessage);
    socket.on("chat:read", handleChatRead);

    return () => {
      socket.off("notification:new", handleNewNotification);
      socket.off("booking:update", handleBookingUpdate);
      socket.off("chat:message", handleChatMessage);
      socket.off("chat:read", handleChatRead);
    };
  }, [token]);

  const login = async (nextToken) => {
    localStorage.setItem("token", nextToken);
    setToken(nextToken);
    setLoading(true);
    return refreshUser();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch (error) {
      // Best-effort logout only.
    }

    clearSession();
    disconnectRealtime();
    setLoading(false);
  };

  return (
    <AuthContext.Provider value={{ token, user, loading, login, logout, refreshUser, setUser, clearSession }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
