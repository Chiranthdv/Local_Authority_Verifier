import { useEffect, useMemo, useState } from "react";
import api from "../lib/api";
import WorkerCard from "../components/WorkerCard";
import Button from "../components/Button";

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
  const [searchQuery, setSearchQuery] = useState("");

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
    } catch {
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
    setSearchQuery("");
  };

  const handleSearchSubmit = (e) => {
    e.preventDefault();
    // Parse search query to determine if it's a category or location
    const query = searchQuery.trim().toLowerCase();
    const categoryMatch = CATEGORIES.find(cat =>
      cat.label.toLowerCase().includes(query) || cat.value.includes(query)
    );

    if (categoryMatch && categoryMatch.value) {
      setAppliedFilters({ category: categoryMatch.value, location: "" });
      setFilters({ category: categoryMatch.value, location: "" });
    } else {
      setAppliedFilters({ category: "", location: query });
      setFilters({ category: "", location: query });
    }
  };

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      {/* Hero Search Section */}
      <section className="mb-12 text-center">
        <h1 className="text-4xl font-semibold text-white md:text-5xl">Find Verified Workers</h1>
        <p className="mt-4 text-lg text-slate-300">
          Search by service type or location to find trusted, admin-approved professionals
        </p>

        {/* Main Search Input */}
        <form onSubmit={handleSearchSubmit} className="mt-8 max-w-2xl mx-auto">
          <div className="relative">
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Search by service (plumber) or area (Bangalore)"
              className="w-full rounded-2xl border border-white/20 bg-slate-900/80 px-6 py-4 pr-16 text-lg text-white placeholder-slate-400 backdrop-blur-sm focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            />
            <Button
              type="submit"
              size="small"
              className="absolute right-3 top-1/2 -translate-y-1/2"
            >
              Search
            </Button>
          </div>
        </form>

        {/* Helper Text */}
        <div className="mt-6 text-sm text-slate-400">
          <p className="mb-2">
            💡 <strong>How it works:</strong> Enter a service like "plumber" or "electrician", or search by area like "Bangalore" or "Indiranagar"
          </p>
          <p>Only verified workers with admin-approved documents are shown. Results update automatically every 10 seconds.</p>
        </div>
      </section>

      {/* Filters Section */}
      <section className="mb-10 rounded-[2rem] border border-white/10 bg-white/5 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-lg font-semibold text-white">Refine Your Search</h3>
            <p className="text-sm text-slate-400">Use filters for more specific results</p>
          </div>
          {activeFilterLabel && (
            <div className="rounded-full bg-cyan-400/10 px-4 py-2 text-sm text-cyan-200">
              Active: {activeFilterLabel}
            </div>
          )}
        </div>

        <div className="mt-6 grid gap-4 md:grid-cols-3">
          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Service Category</label>
            <select
              value={filters.category}
              onChange={(event) => setFilters((current) => ({ ...current, category: event.target.value }))}
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            >
              {CATEGORIES.map((option) => (
                <option key={option.value || "all"} value={option.value}>{option.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-sm font-medium text-slate-300 mb-2">Location/Area</label>
            <input
              value={filters.location}
              onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              placeholder="e.g., Bangalore, Indiranagar"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div className="flex items-end gap-3">
            <Button
              onClick={applyFilters}
              variant="primary"
            >
              Apply Filters
            </Button>
            <Button
              onClick={resetFilters}
              variant="secondary"
            >
              Clear All
            </Button>
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
          <Button
            onClick={() => fetchWorkers(appliedFilters)}
            variant="primary"
            className="mt-5"
          >
            Try Again
          </Button>
        </div>
      )}

      {!loading && !error && workers.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-14 text-center">
          <div className="mx-auto mb-6 w-16 h-16 rounded-full bg-slate-800 flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="text-2xl font-medium text-white mb-2">No workers found</h3>
          <p className="text-slate-400 mb-6 max-w-md mx-auto">
            We couldn't find any verified workers matching your search criteria. Try adjusting your filters or search terms.
          </p>

          <div className="grid gap-4 md:grid-cols-3 max-w-2xl mx-auto">
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="font-medium text-white mb-2">Try different categories</h4>
              <p className="text-sm text-slate-400">Search for "electrician" or "carpenter" instead</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="font-medium text-white mb-2">Check spelling</h4>
              <p className="text-sm text-slate-400">Make sure location names are spelled correctly</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="font-medium text-white mb-2">Broader search</h4>
              <p className="text-sm text-slate-400">Try searching by city instead of specific area</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col sm:flex-row gap-3 justify-center">
            <Button
              onClick={resetFilters}
              variant="primary"
            >
              Clear All Filters
            </Button>
            <Button
              onClick={() => window.location.reload()}
              variant="secondary"
            >
              Refresh Results
            </Button>
          </div>
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
