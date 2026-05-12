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

  it("shows deleted users on demand and restores them", { timeout: 20000 }, async () => {
    render(<AdminDashboard />);

    // Wait for "All Users" button to appear and click it
    const allUsersBtn = await screen.findByRole("button", { name: /all users/i });
    await userEvent.click(allUsersBtn);

    // Should NOT show deleted user initially
    expect(screen.queryByText("Deleted User")).not.toBeInTheDocument();

    // Check "Show deleted users" checkbox
    const checkbox = await screen.findByLabelText(/show deleted users/i);
    await userEvent.click(checkbox);

    // Now it should show
    expect(await screen.findByText("Deleted User")).toBeInTheDocument();

    // Click Restore button
    const restoreBtn = await screen.findByRole("button", { name: /restore/i });
    await userEvent.click(restoreBtn);

    // Wait for modal and confirm
    expect(await screen.findByRole("heading", { name: /restore user/i })).toBeInTheDocument();
    const confirmBtn = await screen.findByRole("button", { name: "Restore User" });
    await userEvent.click(confirmBtn);

    await waitFor(() => expect(apiMock.patch).toHaveBeenCalledWith("/users/user-deleted/restore"));
  });
});
