import { useNavigate } from "react-router-dom";

function getInitials(name) {
  if (!name) return "TL";
  return name
    .split(" ")
    .filter(Boolean)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join("");
}

function sanitizeText(value, fallback) {
  if (typeof value !== "string") {
    return fallback;
  }

  const cleaned = value
    .replace(/[<>]/g, "")
    .trim();

  return cleaned || fallback;
}

function WorkerCard({ worker }) {
  const navigate = useNavigate();
  const name = sanitizeText(worker?.name, "Worker");
  const rating = worker?.rating;
  const experience = worker?.experience || 0;
  const area = sanitizeText(worker?.area, "Location pending");
  const category = sanitizeText(worker?.category, "General");
  const workerRef = worker?.workerRef || "";
  const canOpenProfile = Boolean(workerRef);

  return (
    <button
      onClick={() => {
        if (canOpenProfile) {
          navigate(`/worker/${workerRef}`);
        }
      }}
      disabled={!canOpenProfile}
      className="flex h-full flex-col rounded-3xl border border-white/10 bg-white/5 p-6 text-left shadow-lg transition hover:-translate-y-1 hover:border-cyan-400/50 disabled:cursor-not-allowed disabled:opacity-60"
    >
      <div className="mb-5 flex items-center gap-4">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-gradient-to-br from-cyan-500/30 to-sky-500/10 text-lg font-semibold text-cyan-200 ring-2 ring-cyan-400/30">
          {getInitials(name)}
        </div>

        <div className="min-w-0">
          <div className="text-lg font-semibold text-slate-100">
            <span className="truncate">{name}</span>
          </div>
          <p className="text-sm capitalize text-slate-400">
            {category} | {area}
          </p>
        </div>
      </div>

      <div className="mb-3 flex items-center justify-between text-sm">
        <span className="text-amber-300">
          {rating ? `Rating ${rating}` : "No reviews yet"}
        </span>
        <span className="rounded-full bg-cyan-500/15 px-3 py-1 text-cyan-300">
          {experience} yrs exp
        </span>
      </div>

      <p className="mt-auto text-sm leading-6 text-slate-300">
        Public card data is privacy-filtered. Open profile for protected details.
      </p>
    </button>
  );
}

export default WorkerCard;
