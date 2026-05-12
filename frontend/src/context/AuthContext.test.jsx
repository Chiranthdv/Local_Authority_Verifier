import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { AuthProvider, useAuth } from "./AuthContext";

const {
  apiMock,
  connectRealtime,
  disconnectRealtime,
  toastInfo,
  clearSessionExpiryDispatch,
  getStoredAccessToken,
  clearStoredAccessToken
} = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  connectRealtime: vi.fn(() => ({
    on: vi.fn(),
    off: vi.fn()
  })),
  disconnectRealtime: vi.fn(),
  toastInfo: vi.fn(),
  clearSessionExpiryDispatch: vi.fn(),
  getStoredAccessToken: vi.fn(() => null),
  clearStoredAccessToken: vi.fn()
}));

vi.mock("../lib/api", () => ({
  default: apiMock,
  clearSessionExpiryDispatch,
  getStoredAccessToken,
  clearStoredAccessToken
}));

vi.mock("../lib/realtime", () => ({
  connectRealtime,
  disconnectRealtime
}));

vi.mock("react-toastify", () => ({
  toast: {
    info: toastInfo
  }
}));

function AuthHarness() {
  const { user, loading, login, logout, refreshUser, sessionActive } = useAuth();

  return (
    <div>
      <p>{loading ? "loading" : "ready"}</p>
      <p>{sessionActive ? "active" : "inactive"}</p>
      <p>{user ? user.name : "no-user"}</p>
      <button onClick={() => login()}>Login</button>
      <button onClick={() => logout()}>Logout</button>
      <button onClick={() => refreshUser()}>Refresh</button>
    </div>
  );
}

describe("AuthContext", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    connectRealtime.mockClear();
    disconnectRealtime.mockClear();
    toastInfo.mockClear();
    clearSessionExpiryDispatch.mockClear();
    window.sessionStorage.clear();
  });

  it("loads the current session, refreshes, and logs out cleanly", { timeout: 20000 }, async () => {
    apiMock.get
      .mockResolvedValueOnce({ data: { _id: "user-1", name: "Alice", role: "customer" } })
      .mockResolvedValueOnce({ data: { _id: "user-1", name: "Alice Updated", role: "customer" } })
      .mockResolvedValueOnce({ data: { _id: "user-1", name: "Alice Updated", role: "customer" } });
    apiMock.post.mockResolvedValue({ data: { message: "ok" } });

    render(
      <AuthProvider>
        <AuthHarness />
      </AuthProvider>
    );

    await waitFor(() => expect(screen.getByText("Alice")).toBeInTheDocument());
    expect(screen.getByText("active")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Refresh" }));
    await waitFor(() => expect(screen.getByText("Alice Updated")).toBeInTheDocument());

    await userEvent.click(screen.getByRole("button", { name: "Login" }));
    await waitFor(() => expect(apiMock.get).toHaveBeenCalledTimes(3));

    await userEvent.click(screen.getByRole("button", { name: "Logout" }));
    await waitFor(() => expect(apiMock.post).toHaveBeenCalledWith("/auth/logout"));
    expect(screen.getByText("inactive")).toBeInTheDocument();
    expect(screen.getByText("no-user")).toBeInTheDocument();
    expect(disconnectRealtime).toHaveBeenCalled();
  });
});
