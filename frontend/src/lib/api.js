import axios from "axios";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
const TOKEN_STORAGE_KEY = "token";
let refreshPromise = null;
let hasDispatchedSessionExpired = false;

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true
});

export function getStoredAccessToken() {
  try {
    const token = window.localStorage.getItem(TOKEN_STORAGE_KEY);
    return typeof token === "string" && token.trim() ? token.trim() : "";
  } catch {
    return "";
  }
}

export function setStoredAccessToken(token) {
  if (typeof token !== "string" || !token.trim()) {
    return;
  }

  try {
    window.localStorage.setItem(TOKEN_STORAGE_KEY, token.trim());
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

export function clearStoredAccessToken() {
  try {
    window.localStorage.removeItem(TOKEN_STORAGE_KEY);
  } catch {
    // Ignore storage failures in constrained environments.
  }
}

function dispatchSessionExpired(message = "Session expired. Please sign in again.") {
  if (hasDispatchedSessionExpired) {
    return;
  }

  hasDispatchedSessionExpired = true;
  window.dispatchEvent(new CustomEvent("app:auth:session-expired", {
    detail: { message }
  }));
}

async function refreshAccessToken() {
  if (!refreshPromise) {
    refreshPromise = api.post("/auth/refresh")
      .then((response) => {
        const refreshedToken = response?.data?.accessToken || response?.data?.token || "";
        if (refreshedToken) {
          setStoredAccessToken(refreshedToken);
        }
        return response;
      })
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.request.use((config) => {
  const token = getStoredAccessToken();
  if (!token) {
    return config;
  }

  const headers = config.headers || {};
  if (!headers.Authorization && !headers.authorization) {
    headers.Authorization = `Bearer ${token}`;
    config.headers = headers;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (typeof originalRequest.url === "string" && originalRequest.url.includes("/auth/refresh")) {
      clearStoredAccessToken();
      dispatchSessionExpired(error.response?.data?.error || "Session expired. Please sign in again.");
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      hasDispatchedSessionExpired = false;
      await refreshAccessToken();
      return api(originalRequest);
    } catch (refreshError) {
      clearStoredAccessToken();
      dispatchSessionExpired(refreshError.response?.data?.error || "Session expired. Please sign in again.");
      return Promise.reject(refreshError);
    }
  }
);

export function clearSessionExpiryDispatch() {
  hasDispatchedSessionExpired = false;
}

export default api;
