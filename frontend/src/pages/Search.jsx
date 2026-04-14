import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import WorkerCard from "../components/WorkerCard";

const CATEGORIES = [
  { value: "", label: "All Categories" },
  { value: "plumber", label: "Plumber" },
  { value: "electrician", label: "Electrician" },
  { value: "carpenter", label: "Carpenter" },
  { value: "cleaner", label: "Cleaner" },
  { value: "painter", label: "Painter" },
  { value: "mechanic", label: "Mechanic" },
  { value: "gardener", label: "Gardener" }
];

function Search() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [filters, setFilters] = useState({ category: "", location: "" });
  const [appliedFilters, setAppliedFilters] = useState({ category: "", location: "" });

  const activeFilterLabel = useMemo(() => {
    const categoryLabel = CATEGORIES.find((item) => item.value === appliedFilters.category)?.label;
    const locationLabel = appliedFilters.location ? `Area: ${appliedFilters.location}` : "";
    return [categoryLabel && categoryLabel !== "All Categories" ? categoryLabel : "", locationLabel]
      .filter(Boolean)
      .join(" | ");
  }, [appliedFilters]);

  const fetchWorkers = async (nextFilters = appliedFilters) => {
    try {
      setLoading(true);
      setError("");
      const params = {};
      if (nextFilters.category) params.category = nextFilters.category;
      if (nextFilters.location) params.location = nextFilters.location;
      const { data } = await api.get("/workers/search", { params });
      setWorkers(Array.isArray(data) ? data : []);
    } catch (err) {
      setError("Could not load workers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers(appliedFilters);
    const intervalId = window.setInterval(() => fetchWorkers(appliedFilters), 10000);

    const handleFocus = () => {
      fetchWorkers(appliedFilters);
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, [appliedFilters]);

  const applyFilters = () => {
    const cleaned = {
      category: filters.category.trim().toLowerCase(),
      location: filters.location.trim().toLowerCase()
    };
    setAppliedFilters(cleaned);
  };

  const resetFilters = () => {
    const cleaned = { category: "", location: "" };
    setFilters(cleaned);
    setAppliedFilters(cleaned);
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Worker Discovery</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Search approved workers by category and area.</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            Only admin-approved workers are shown. Open a profile to view full details, rating, experience, and certificates.
          </p>
          {activeFilterLabel && (
            <p className="mt-3 text-sm text-cyan-200">Active filters: {activeFilterLabel}</p>
          )}
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Filters</p>
          <div className="mt-4 grid gap-3">
            <select
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"
            >
              {CATEGORIES.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>

            <input
              value={filters.location}
              onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              placeholder="Area or location (e.g., indiranagar)"
              className="rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100"
            />

            <div className="flex gap-3">
              <button onClick={applyFilters} className="rounded-full bg-cyan-400 px-4 py-2 font-medium text-slate-950">Search</button>
              <button onClick={resetFilters} className="rounded-full border border-white/20 px-4 py-2 text-slate-200">Reset</button>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, index) => (
            <div key={index} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-slate-800/70" />
          ))}
        </div>
      )}

      {!loading && error && (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/8 p-10 text-center">
          <p className="text-lg text-amber-100">Worker list is not available right now.</p>
          <p className="mt-3 text-slate-300">Please make sure backend server and MongoDB are running, then try again.</p>
          <button onClick={() => fetchWorkers(appliedFilters)} className="mt-5 rounded-full bg-white px-5 py-2 text-slate-950">Try Again</button>
        </div>
      )}

      {!loading && !error && workers.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-14 text-center">
          <p className="text-2xl font-medium text-white">No workers found</p>
          <p className="mt-2 text-slate-400">Try changing category or area filters.</p>
        </div>
      )}

      {!loading && !error && workers.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => <WorkerCard key={worker.workerRef || `${worker.name}-${worker.area}`} worker={worker} />)}
        </div>
      )}
    </div>
  );
}

export default Search;
