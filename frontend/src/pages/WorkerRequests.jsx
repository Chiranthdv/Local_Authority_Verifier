import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import api from "../lib/api";

const STATUS_OPTIONS = ["all", "pending", "accepted", "rejected", "completed", "cancelled"];

function WorkerRequests() {
  const navigate = useNavigate();
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("pending");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [rejectReasons, setRejectReasons] = useState({});

  const loadRequests = async (nextStatus = status) => {
    try {
      setLoading(true);
      setError("");
      const params = nextStatus !== "all" ? { status: nextStatus } : {};
      const { data } = await api.get("/jobs/my-inbox", { params });
      setRequests(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError("Could not load worker inbox.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadRequests(status);

    const handleBookingUpdate = () => {
      loadRequests(status);
    };

    window.addEventListener("app:booking:update", handleBookingUpdate);

    return () => {
      window.removeEventListener("app:booking:update", handleBookingUpdate);
    };
  }, [status]);

  const acceptRequest = async (id) => {
    try {
      await api.patch(`/jobs/${id}/accept`);
      await loadRequests(status);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not accept request.");
    }
  };

  const rejectRequest = async (id) => {
    const reason = (rejectReasons[id] || "").trim();
    if (!reason) {
      setError("Please enter rejection reason.");
      return;
    }

    try {
      await api.patch(`/jobs/${id}/reject`, { reason });
      setRejectReasons((current) => ({ ...current, [id]: "" }));
      await loadRequests(status);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not reject request.");
    }
  };

  const completeRequest = async (id) => {
    try {
      await api.patch(`/jobs/${id}/complete`);
      await loadRequests(status);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not complete request.");
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-white">Worker Request Inbox</h1>
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-2 text-slate-200"
        >
          {STATUS_OPTIONS.map((option) => (
            <option key={option} value={option}>{option}</option>
          ))}
        </select>
      </div>

      {error && <p className="mb-4 rounded-2xl border border-rose-300/30 bg-rose-500/10 px-4 py-2 text-rose-200">{error}</p>}
      {loading && <div className="h-40 animate-pulse rounded-3xl bg-white/5" />}

      {!loading && requests.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-10 text-center text-slate-300">
          No requests found.
        </div>
      )}

      {!loading && requests.length > 0 && (
        <div className="space-y-4">
          {requests.map((item) => (
            <article key={item._id} className="rounded-3xl border border-white/10 bg-white/5 p-5">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-semibold text-white">{item.customerId?.name || "Customer"}</h2>
                <span className="rounded-full bg-slate-900/70 px-3 py-1 text-sm capitalize text-slate-200">{item.status}</span>
              </div>
              <p className="mt-2 text-slate-300">Date: {item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : "NA"}</p>
              <p className="mt-1 text-slate-300">Slot: {item.timeSlotLabel || item.timeSlotCode || "NA"}</p>
              <p className="mt-1 text-slate-300">Address: {item.address || "NA"}</p>
              {item.description && <p className="mt-1 text-slate-400">{item.description}</p>}
              {item.rejectionReason && <p className="mt-2 text-rose-300">Reason: {item.rejectionReason}</p>}

              {["pending", "requested"].includes(item.status) && (
                <div className="mt-3">
                  <textarea
                    value={rejectReasons[item._id] || ""}
                    onChange={(event) => setRejectReasons((current) => ({ ...current, [item._id]: event.target.value }))}
                    placeholder="Reason (required only if rejecting)"
                    className="w-full rounded-2xl border border-white/10 bg-slate-900 px-3 py-2 text-slate-200"
                  />
                  <div className="mt-3 flex flex-wrap gap-3">
                    <button onClick={() => acceptRequest(item._id)} className="rounded-full bg-emerald-400 px-4 py-2 text-sm font-medium text-slate-950">
                      Accept
                    </button>
                    <button onClick={() => rejectRequest(item._id)} className="rounded-full bg-rose-400 px-4 py-2 text-sm font-medium text-slate-950">
                      Reject
                    </button>
                  </div>
                </div>
              )}

              {item.status === "accepted" && (
                <div className="mt-3 flex flex-wrap gap-3">
                  <button
                    onClick={() => completeRequest(item._id)}
                    className="rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
                  >
                    Mark Completed
                  </button>
                  <button
                    onClick={() => navigate(`/chats?customerId=${item.customerId?._id || ""}`)}
                    className="rounded-full border border-cyan-300/40 px-4 py-2 text-sm text-cyan-200"
                  >
                    Open Chat
                  </button>
                </div>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}

export default WorkerRequests;
