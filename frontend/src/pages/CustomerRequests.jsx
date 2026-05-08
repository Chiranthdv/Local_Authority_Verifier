import { useEffect, useState } from "react";
import api from "../lib/api";

const STATUS_OPTIONS = ["all", "pending", "accepted", "rejected", "completed", "cancelled"];

function CustomerRequests() {
  const [requests, setRequests] = useState([]);
  const [status, setStatus] = useState("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [reviewTarget, setReviewTarget] = useState(null);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState("");

  const loadRequests = async (nextStatus = status) => {
    try {
      setLoading(true);
      setError("");
      const params = nextStatus !== "all" ? { status: nextStatus } : {};
      const { data } = await api.get("/jobs/my-requests", { params });
      setRequests(Array.isArray(data) ? data : []);
    } catch (loadError) {
      setError("Could not load your requests.");
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

  const cancelRequest = async (id) => {
    try {
      await api.patch(`/jobs/${id}/cancel`);
      await loadRequests(status);
    } catch (actionError) {
      setError(actionError.response?.data?.error || "Could not cancel request.");
    }
  };

  const openReviewModal = (requestItem) => {
    setReviewTarget(requestItem);
    setReviewForm({ rating: 5, comment: "" });
    setReviewError("");
    setReviewModalOpen(true);
  };

  const submitReview = async (event) => {
    event.preventDefault();
    if (!reviewTarget) return;

    setSubmittingReview(true);
    setReviewError("");

    try {
      await api.post("/reviews", {
        jobId: reviewTarget._id,
        rating: reviewForm.rating,
        comment: reviewForm.comment
      });

      setReviewModalOpen(false);
      setReviewTarget(null);
      await loadRequests(status);
    } catch (actionError) {
      setReviewError(actionError.response?.data?.error || "Could not submit review.");
    } finally {
      setSubmittingReview(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between gap-4">
        <h1 className="text-3xl font-semibold text-white">My Service Requests</h1>
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
                <h2 className="text-xl font-semibold text-white">{item.workerId?.name || "Worker"}</h2>
                <span className="rounded-full bg-slate-900/70 px-3 py-1 text-sm capitalize text-slate-200">{item.status}</span>
              </div>
              <p className="mt-2 text-slate-300">Date: {item.serviceDate ? new Date(item.serviceDate).toLocaleDateString() : "NA"}</p>
              <p className="mt-1 text-slate-300">Slot: {item.timeSlotLabel || item.timeSlotCode || "NA"}</p>
              <p className="mt-1 text-slate-300">Address: {item.address || "NA"}</p>
              {item.description && <p className="mt-1 text-slate-400">{item.description}</p>}
              {item.rejectionReason && <p className="mt-2 text-rose-300">Reason: {item.rejectionReason}</p>}

              {["pending", "requested"].includes(item.status) && (
                <button
                  onClick={() => cancelRequest(item._id)}
                  className="mt-3 rounded-full bg-rose-400 px-4 py-2 text-sm font-medium text-slate-950"
                >
                  Cancel Request
                </button>
              )}

              {item.status === "accepted" && (
                <button
                  onClick={() => navigate(`/chats?workerId=${item.workerId?._id || ""}`)}
                  className="mt-3 rounded-full border border-cyan-300/40 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-400/10"
                >
                  💬 Open Chat
                </button>
              )}

              {item.status === "completed" && !item.hasReview && (
                <button
                  onClick={() => openReviewModal(item)}
                  className="mt-3 rounded-full bg-cyan-400 px-4 py-2 text-sm font-medium text-slate-950"
                >
                  Leave Review
                </button>
              )}

              {item.status === "completed" && item.hasReview && (
                <p className="mt-3 text-sm text-emerald-300">
                  Review submitted: {"\u2605"} {item.submittedRating}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {reviewModalOpen && reviewTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <form onSubmit={submitReview} className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold text-white">Rate Completed Job</h3>
            <p className="mt-2 text-sm text-slate-400">
              Worker: {reviewTarget.workerId?.name || "Worker"}
            </p>
            <div className="mt-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm((current) => ({ ...current, rating: star }))}
                  className={`text-3xl ${reviewForm.rating >= star ? "text-amber-300" : "text-slate-600"}`}
                >
                  {"\u2605"}
                </button>
              ))}
            </div>
            <textarea
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
              placeholder="Optional feedback about service quality"
              className="mt-4 min-h-28 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />
            {reviewError && <p className="mt-3 text-sm text-rose-300">{reviewError}</p>}
            <div className="mt-5 flex gap-3">
              <button disabled={submittingReview} className="rounded-full bg-cyan-400 px-5 py-2 font-medium text-slate-950 disabled:opacity-60">
                {submittingReview ? "Submitting..." : "Submit Review"}
              </button>
              <button type="button" onClick={() => setReviewModalOpen(false)} className="rounded-full border border-white/10 px-5 py-2 text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default CustomerRequests;
