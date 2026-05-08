import React from "react";
import { render, screen } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import ProtectedRoute from "./ProtectedRoute";

const { useAuth } = vi.hoisted(() => ({
  useAuth: vi.fn()
}));

vi.mock("../context/AuthContext", () => ({
  useAuth
}));

describe("ProtectedRoute", () => {
  it("redirects unauthenticated users to the login page", () => {
    useAuth.mockReturnValue({
      user: null,
      loading: false
    });

    render(
      <MemoryRouter initialEntries={["/admin/dashboard"]}>
        <Routes>
          <Route
            path="/admin/dashboard"
            element={
              <ProtectedRoute roles={["admin"]}>
                <div>Secret content</div>
              </ProtectedRoute>
            }
          />
          <Route path="/login" element={<div>Login screen</div>} />
        </Routes>
      </MemoryRouter>
    );

    expect(screen.getByText("Login screen")).toBeInTheDocument();
  });
});
