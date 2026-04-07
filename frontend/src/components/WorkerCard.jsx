import { useState } from "react";
import { useNavigate } from "react-router-dom";

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

function WorkerCard({ worker }) {
  const navigate = useNavigate();
  const name = worker?.userId?.name || "Worker";
  const statusLabel = worker?.verificationStatus || "pending";
  const actualScore = worker?.trustScore || 0;
  const bioExcerpt = worker?.bio?.length > 100 ? `${worker.bio.slice(0, 100)}...` : worker?.bio || "No bio added yet.";
  const photoUrl = worker?.photoUrl ? `http://localhost:5000/${String(worker.photoUrl).replace(/\\/g, "/")}` : "";
  const [imageFailed, setImageFailed] = useState(false);
  const showImage = Boolean(photoUrl) && !imageFailed;

  return (
    <button
      onClick={() => navigate(`/worker/${worker._id}`)}
      className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg transition hover:-translate-y-1 hover:border-cyan-400/50"
    >
      <div className="mb-5 flex items-center gap-4">
        {showImage ? (
          <img
            src={photoUrl}
            alt={name}
            onError={() => setImageFailed(true)}
            className="h-16 w-16 rounded-full object-cover ring-2 ring-cyan-400/30"
          />
        ) : (
          <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-sky-500/10 text-lg font-semibold text-cyan-200 ring-2 ring-cyan-400/30">
            {getInitials(name)}
          </div>
        )}

        <div className="min-w-0">
          <div className="flex items-center gap-2 text-lg font-semibold text-slate-100">
            <span className="truncate">{name}</span>
            {statusLabel === "approved" && <span className="text-emerald-400">✓</span>}
          </div>
          <p className="text-sm capitalize text-slate-400">
            {worker?.category || "General"} • {worker?.location || "Location pending"}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">
          {getBadgeLabel(actualScore, statusLabel)}
        </span>
        <span className="text-amber-300">
          {worker?.averageRating ? `★ ${worker.averageRating}` : "No reviews yet"}
        </span>
      </div>

      <div className="mb-4 flex items-center justify-between text-xs uppercase tracking-[0.2em] text-slate-400">
        <span>Status</span>
        <span className={`rounded-full px-3 py-1 ${statusLabel === "approved" ? "bg-emerald-500/15 text-emerald-300" : "bg-amber-500/15 text-amber-200"}`}>
          {statusLabel}
        </span>
      </div>

      <p className="mt-auto text-sm leading-6 text-slate-300">{bioExcerpt}</p>
    </button>
  );
}

export default WorkerCard;
