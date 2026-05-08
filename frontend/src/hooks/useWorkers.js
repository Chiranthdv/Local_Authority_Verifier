import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function normalizeFilters(filters = {}) {
  return {
    category: typeof filters.category === "string" ? filters.category.trim().toLowerCase() : "",
    location: typeof filters.location === "string" ? filters.location.trim().toLowerCase() : ""
  };
}

async function fetchWorkersSearch(filters) {
  const normalizedFilters = normalizeFilters(filters);
  const params = {};

  if (normalizedFilters.category) {
    params.category = normalizedFilters.category;
  }

  if (normalizedFilters.location) {
    params.location = normalizedFilters.location;
  }

  const { data } = await api.get("/workers/search", { params });
  return Array.isArray(data) ? data : [];
}

async function fetchWorkerProfile(workerRef, role) {
  if (!workerRef) {
    return null;
  }

  const publicRes = await api.get(`/workers/public/${workerRef}`);
  let privateWorker = null;

  if (role === "customer" || role === "admin" || role === "worker") {
    try {
      const privateRes = await api.get(`/workers/private/${workerRef}`);
      privateWorker = privateRes.data;
    } catch {
      privateWorker = null;
    }
  }

  return {
    publicWorker: publicRes.data,
    privateWorker,
    worker: privateWorker || publicRes.data
  };
}

export function useWorkersSearch(filters) {
  const normalizedFilters = normalizeFilters(filters);

  return useQuery({
    queryKey: ["workers", normalizedFilters],
    queryFn: () => fetchWorkersSearch(normalizedFilters),
    refetchInterval: 30 * 1000
  });
}

export function useWorkerProfile(workerRef) {
  const { user } = useAuth();

  return useQuery({
    queryKey: ["worker-profile", workerRef, user?.role || "guest"],
    queryFn: () => fetchWorkerProfile(workerRef, user?.role),
    enabled: Boolean(workerRef),
    staleTime: 5 * 60 * 1000
  });
}

export function useCreateBooking(workerRef) {
  const queryClient = useQueryClient();

  return useMutation({
    mutationFn: async (payload) => {
      const { data } = await api.post("/jobs", payload);
      return data;
    },
    onMutate: async (payload) => {
      const queryKey = ["worker-profile", workerRef];
      await queryClient.cancelQueries({ queryKey });
      const previousSnapshots = queryClient.getQueriesData({ queryKey });

      queryClient.setQueriesData({ queryKey }, (current) => {
        if (!current || typeof current !== "object") {
          return current;
        }

        return {
          ...current,
          optimisticBookingRequest: {
            serviceDate: payload?.serviceDate || "",
            timeSlotCode: payload?.timeSlotCode || "",
            requestedAt: Date.now()
          }
        };
      });

      return { previousSnapshots };
    },
    onError: (_error, _payload, context) => {
      for (const [queryKey, previousValue] of context?.previousSnapshots || []) {
        queryClient.setQueryData(queryKey, previousValue);
      }
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-profile", workerRef] });
      queryClient.invalidateQueries({ queryKey: ["worker-bookings", workerRef] });
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: ["worker-profile", workerRef] });
    }
  });
}
