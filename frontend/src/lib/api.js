import axios from "axios";

const baseUrl = import.meta.env.VITE_API_BASE_URL || "/api";
let refreshPromise = null;
let hasDispatchedSessionExpired = false;

const api = axios.create({
  baseURL: baseUrl,
  withCredentials: true
});

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
      .finally(() => {
        refreshPromise = null;
      });
  }

  return refreshPromise;
}

api.interceptors.response.use(
  (response) => response,
  async (error) => {
    const originalRequest = error.config;
    const status = error.response?.status;

    if (status !== 401 || !originalRequest || originalRequest._retry) {
      return Promise.reject(error);
    }

    if (typeof originalRequest.url === "string" && originalRequest.url.includes("/auth/refresh")) {
      dispatchSessionExpired(error.response?.data?.error || "Session expired. Please sign in again.");
      return Promise.reject(error);
    }

    try {
      originalRequest._retry = true;
      hasDispatchedSessionExpired = false;
      await refreshAccessToken();
      return api(originalRequest);
    } catch (refreshError) {
      dispatchSessionExpired(refreshError.response?.data?.error || "Session expired. Please sign in again.");
      return Promise.reject(refreshError);
    }
  }
);

export function clearSessionExpiryDispatch() {
  hasDispatchedSessionExpired = false;
}

export default api;
