import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import api from "../lib/api";
import { useAuth } from "../context/AuthContext";

function getBadgeLabel(score, status) {
  if (status !== "approved") return "Awaiting Review";
  if (score <= 30) return "Rising";
  if (score <= 60) return "Trusted";
  if (score <= 85) return "Expert";
  return "Elite";
}

function getInitials(name) {
  if (!name) return "TL";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function WorkerProfile() {
  const { id } = useParams();
  const { user } = useAuth();
  const [worker, setWorker] = useState(null);
  const [loading, setLoading] = useState(true);
  const [reviewForm, setReviewForm] = useState({ rating: 5, comment: "" });
  const [showModal, setShowModal] = useState(false);
  const [reviewError, setReviewError] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [imageFailed, setImageFailed] = useState(false);

  const loadWorker = async () => {
    try {
      setLoading(true);
      const { data } = await api.get(`/workers/${id}`);
      setWorker(data);
      setImageFailed(false);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadWorker();
  }, [id]);

  if (loading) {
    return <div className="mx-auto min-h-[50vh] max-w-6xl animate-pulse rounded-3xl bg-slate-800/60" />;
  }

  if (!worker) {
    return <div className="text-center text-slate-300">Worker not found.</div>;
  }

  const photoUrl = worker.photoUrl ? `http://localhost:5000/${String(worker.photoUrl).replace(/\\/g, "/")}` : "";
  const showImage = Boolean(photoUrl) && !imageFailed;
  const score = worker.verificationStatus === "approved" ? (worker.trustScore || 0) : 0;

  const submitReview = async (event) => {
    event.preventDefault();
    setReviewError("");
    setSubmitting(true);

    try {
      await api.post("/reviews", { workerId: worker.userId._id, ...reviewForm });
      setShowModal(false);
      setReviewForm({ rating: 5, comment: "" });
      await loadWorker();
    } catch (error) {
      setReviewError(error.response?.data?.error || "Could not submit review");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10">
      <section className="grid gap-8 rounded-[2rem] border border-white/10 bg-white/5 p-8 lg:grid-cols-[280px_1fr]">
        {showImage ? (
          <img
            src={photoUrl}
            alt={worker.userId.name}
            onError={() => setImageFailed(true)}
            className="h-72 w-full rounded-[2rem] object-cover"
          />
        ) : (
          <div className="flex h-72 w-full items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-500/20 to-sky-500/5 text-6xl font-semibold text-cyan-200">
            {getInitials(worker.userId.name)}
          </div>
        )}

        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-4xl font-semibold text-white">{worker.userId.name}</h1>
            {worker.verificationStatus === "approved" && <span className="rounded-full bg-emerald-500/15 px-3 py-1 text-emerald-300">Verified ✓</span>}
          </div>
          <p className="mt-3 text-slate-300">{worker.category} • {worker.location} • ₹{worker.hourlyRate || 0}/hr</p>
          {user?.role === "customer" && worker.phone && <p className="mt-3 text-cyan-300">Phone: {worker.phone}</p>}
          <p className="mt-6 max-w-3xl leading-7 text-slate-300">{worker.bio || "This worker has not added a bio yet."}</p>

          <div className="mt-6 grid gap-4 md:grid-cols-2">
            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Badge Level</p>
              <p className="mt-2 text-2xl text-white">{worker.badgeLevel || getBadgeLabel(score, worker.verificationStatus)}</p>
              <div className="mt-3 h-2 rounded-full bg-slate-800">
                <div className="h-2 rounded-full bg-gradient-to-r from-cyan-400 via-sky-500 to-emerald-400" style={{ width: `${score}%` }} />
              </div>
            </div>

            <div className="rounded-2xl bg-slate-900/70 p-4">
              <p className="text-sm uppercase tracking-[0.2em] text-slate-400">Rating</p>
              <p className="mt-2 text-2xl text-white">{worker.averageRating ? `★ ${worker.averageRating}` : "No reviews yet"}</p>
              <p className="mt-2 text-slate-400">{worker.reviewCount} total reviews</p>
            </div>
          </div>
        </div>
      </section>

      <section className="mt-10 grid gap-8 lg:grid-cols-2">
        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold text-white">Past Work</h2>
            {user?.role === "customer" && (
              <button onClick={() => setShowModal(true)} className="rounded-full bg-cyan-400 px-4 py-2 font-medium text-slate-950">
                Leave a Review
              </button>
            )}
          </div>
          <div className="mt-4 space-y-3">
            {worker.reviews.length === 0 && <p className="text-slate-400">Completed work will appear here once customers leave reviews.</p>}
            {worker.reviews.map((review) => (
              <div key={review._id} className="rounded-2xl bg-slate-900/70 p-4 text-slate-300">
                {review.comment}
              </div>
            ))}
          </div>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <h2 className="text-2xl font-semibold text-white">Reviews</h2>
          <div className="mt-4 space-y-4">
            {worker.reviews.length === 0 && <p className="text-slate-400">No reviews yet.</p>}
            {worker.reviews.map((review) => (
              <article key={review._id} className="rounded-2xl bg-slate-900/70 p-4">
                <div className="flex items-center justify-between">
                  <p className="font-medium text-white">{review.customerId?.name || "Anonymous"}</p>
                  <p className="text-amber-300">{"★".repeat(review.rating)}{"☆".repeat(5 - review.rating)}</p>
                </div>
                <p className="mt-2 text-slate-300">{review.comment}</p>
                <p className="mt-3 text-sm text-slate-500">{new Date(review.createdAt).toLocaleDateString()}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {showModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4">
          <form onSubmit={submitReview} className="w-full max-w-lg rounded-[2rem] border border-white/10 bg-slate-900 p-6">
            <h3 className="text-2xl font-semibold text-white">Leave a Review</h3>
            <div className="mt-4 flex gap-2">
              {[1, 2, 3, 4, 5].map((star) => (
                <button
                  key={star}
                  type="button"
                  onClick={() => setReviewForm((current) => ({ ...current, rating: star }))}
                  className={`text-3xl ${reviewForm.rating >= star ? "text-amber-300" : "text-slate-600"}`}
                >
                  ★
                </button>
              ))}
            </div>
            <textarea
              value={reviewForm.comment}
              onChange={(event) => setReviewForm((current) => ({ ...current, comment: event.target.value }))}
              minLength={10}
              required
              placeholder="Tell future customers about the work quality"
              className="mt-4 min-h-40 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3"
            />
            {reviewError && <p className="mt-3 text-sm text-rose-300">{reviewError}</p>}
            <div className="mt-5 flex gap-3">
              <button disabled={submitting} className="rounded-full bg-cyan-400 px-5 py-2 font-medium text-slate-950 disabled:opacity-60">
                {submitting ? "Submitting..." : "Submit Review"}
              </button>
              <button type="button" onClick={() => setShowModal(false)} className="rounded-full border border-white/10 px-5 py-2 text-slate-300">
                Cancel
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

export default WorkerProfile;
