import React from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter, Route, Routes } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import WorkerProfile from "./WorkerProfile";

const { apiMock, useAuth, mockUseWorkerProfile, mockMutateAsync } = vi.hoisted(() => ({
  apiMock: {
    get: vi.fn(),
    post: vi.fn(),
    patch: vi.fn(),
    put: vi.fn(),
    delete: vi.fn()
  },
  useAuth: vi.fn(),
  mockUseWorkerProfile: vi.fn(),
  mockMutateAsync: vi.fn()
}));

vi.mock("../lib/api", () => ({
  default: apiMock
}));

vi.mock("../context/AuthContext", () => ({
  useAuth
}));

vi.mock("../hooks/useWorkers", () => ({
  useWorkerProfile: (...args) => mockUseWorkerProfile(...args),
  useCreateBooking: () => ({
    mutateAsync: mockMutateAsync,
    isPending: false
  })
}));

const workerPayload = {
  publicWorker: {
    name: "Ravi Kumar",
    category: "electrician",
    area: "Indiranagar",
    hourlyRate: 400,
    experience: 5,
    bio: "Skilled home electrician.",
    rating: 4.8,
    reviewCount: 12
  },
  privateWorker: {
    workerUserId: "worker-user-1",
    verificationStatus: "approved",
    phone: "9999999999",
    certificates: [],
    reviews: []
  }
};

describe("WorkerProfile", () => {
  beforeEach(() => {
    apiMock.get.mockReset();
    apiMock.post.mockReset();
    apiMock.patch.mockReset();
    apiMock.put.mockReset();
    apiMock.delete.mockReset();
    mockMutateAsync.mockReset();
    apiMock.get.mockResolvedValue({ data: [{ code: "morning", label: "Morning" }] });
    mockUseWorkerProfile.mockReturnValue({
      data: workerPayload,
      isLoading: false,
      refetch: vi.fn()
    });
  });

  it("shows booking actions for customers", async () => {
    useAuth.mockReturnValue({
      user: { _id: "customer-1", role: "customer" }
    });

    render(
      <MemoryRouter initialEntries={["/worker/ref-1"]}>
        <Routes>
          <Route path="/worker/:id" element={<WorkerProfile />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith("/jobs/time-slots"));
    expect(screen.getByRole("button", { name: "Request Service" })).toBeInTheDocument();
  });

  it("hides booking actions for workers", async () => {
    useAuth.mockReturnValue({
      user: { _id: "worker-1", role: "worker" }
    });

    render(
      <MemoryRouter initialEntries={["/worker/ref-1"]}>
        <Routes>
          <Route path="/worker/:id" element={<WorkerProfile />} />
        </Routes>
      </MemoryRouter>
    );

    await waitFor(() => expect(apiMock.get).toHaveBeenCalledWith("/jobs/time-slots"));
    expect(screen.queryByRole("button", { name: "Request Service" })).not.toBeInTheDocument();
  });
});
