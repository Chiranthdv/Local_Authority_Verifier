import React from "react";
import { render, screen } from "@testing-library/react";
import { BrowserRouter } from "react-router-dom";
import { describe, expect, it, vi } from "vitest";
import Navbar from "./Navbar";

// Mock AuthContext
vi.mock("../context/AuthContext", () => ({
  useAuth: () => ({
    user: null,
    logout: vi.fn()
  })
}));

// Mock UnreadNotifications
vi.mock("../hooks/useUnreadNotifications", () => ({
  useUnreadNotifications: () => ({ unreadCount: 0 })
}));

describe("Navbar Component", () => {
  it("renders the brand name", () => {
    render(
      <BrowserRouter>
        <Navbar />
      </BrowserRouter>
    );

    expect(screen.getAllByText(/Trust/i)[0]).toBeInTheDocument();
  });
});
