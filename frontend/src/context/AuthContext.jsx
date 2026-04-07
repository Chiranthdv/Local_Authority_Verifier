import { createContext, useContext, useEffect, useState } from "react";
import api from "../lib/api";

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
