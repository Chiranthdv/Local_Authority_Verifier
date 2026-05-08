import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { beforeEach, describe, expect, it, vi } from "vitest";
import AdminDashboard from "./AdminDashboard";

const { apiMock } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  }
}));

vi.mock("../lib/api", () => ({
  default: apiMock
}));

const dashboardResponse = {
  data: {
    stats: {
      workerVerification: { pending: 1, approved: 2 },
      documents: { pending: 1 },
      jobs: { open: 3 }
    },
    pendingApplications: []
  }
};

const usersResponse = {
  data: [
    {
      _id: "user-active",
      name: "Active User",
      email: "active@example.com",
      role: "customer",
      isDeleted: false
    },
    {
      _id: "user-deleted",
      name: "Deleted User",
      email: "deleted@example.com",
      role: "worker",
      isDeleted: true
    }
  ]
};

describe("AdminDashboard", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    apiMock.get
      .mockResolvedValueOnce(dashboardResponse)
      .mockResolvedValueOnce(usersResponse)
      .mockResolvedValueOnce(dashboardResponse)
      .mockResolvedValueOnce(usersResponse);
    apiMock.patch.mockResolvedValue({
      data: {
        message: "User restored"
      }
    });
  });

  it("shows deleted users on demand and restores them", async () => {
    render(<AdminDashboard />);

    await waitFor(() => expect(screen.getByText("All Users")).toBeInTheDocument());
    await userEvent.click(screen.getByRole("button", { name: "All Users" }));

    expect(screen.queryByText("Deleted User")).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole("checkbox", { name: /show deleted users/i }));
    expect(await screen.findByText("Deleted User")).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Restore" }));
    expect(screen.getByRole("heading", { name: "Restore User" })).toBeInTheDocument();

    await userEvent.click(screen.getByRole("button", { name: "Restore User" }));

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith("/users/user-deleted/restore"));
  });
});
