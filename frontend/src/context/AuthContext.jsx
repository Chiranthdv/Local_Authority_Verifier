import React, { createContext, useContext, useEffect, useState } from "react";
import api, {
  clearSessionExpiryDispatch,
  clearStoredAccessToken,
  getStoredAccessToken
} from "../lib/api";
import { connectRealtime, disconnectRealtime } from "../lib/realtime";
import { toast } from "react-toastify";

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [sessionActive, setSessionActive] = useState(false);
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sessionExpiredMessage, setSessionExpiredMessage] = useState("");

  const clearSession = (options = {}) => {
    const { redirectToLogin = false, sessionExpired = false, message = "" } = options;

    setSessionActive(false);
    setUser(null);
    disconnectRealtime();
    clearStoredAccessToken();

    if (sessionExpired && message) {
      setSessionExpiredMessage(message);
      try {
        window.sessionStorage.setItem("auth_notice", message);
      } catch {
        // Ignore storage errors in constrained environments.
      }
    }

    if (redirectToLogin && window.location.pathname !== "/login") {
      const nextLocation = sessionExpired ? "/login?reason=session-expired" : "/login";
      window.location.assign(nextLocation);
    }
  };

  const refreshUser = async () => {
    try {
      clearSessionExpiryDispatch();
      const { data } = await api.get("/auth/me");
      setUser(data);
      setSessionActive(true);
      setSessionExpiredMessage("");
      return data;
    } catch {
      setUser(null);
      setSessionActive(false);
      return null;
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const token = getStoredAccessToken();
    if (token) {
      refreshUser();
    } else {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const handleSessionExpired = (event) => {
      const message = event.detail?.message || "Session expired. Please sign in again.";
      toast.info(message, { autoClose: 2500 });
      clearSession({
        redirectToLogin: true,
        sessionExpired: true,
        message
      });
      setLoading(false);
    };

    window.addEventListener("app:auth:session-expired", handleSessionExpired);
    return () => {
      window.removeEventListener("app:auth:session-expired", handleSessionExpired);
    };
  }, []);

  useEffect(() => {
    if (!sessionActive) {
      disconnectRealtime();
      return;
    }

    const socket = connectRealtime();
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
  }, [sessionActive]);

  const login = async () => {
    clearSessionExpiryDispatch();
    setSessionActive(true);
    setLoading(true);
    setSessionExpiredMessage("");
    return refreshUser();
  };

  const logout = async () => {
    try {
      await api.post("/auth/logout");
    } catch {
      // Best-effort logout only.
    }

    clearSession();
    setLoading(false);
  };

  const authValue = React.useMemo(() => ({
    token: getStoredAccessToken() || null,
    user,
    loading,
    login,
    logout,
    refreshUser,
    setUser,
    clearSession,
    sessionActive,
    sessionExpiredMessage
  }), [user, loading, sessionActive, sessionExpiredMessage]);

  return (
    <AuthContext.Provider value={authValue}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  return useContext(AuthContext);
}
