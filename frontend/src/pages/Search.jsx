import { useMemo, useState } from "react";
import WorkerCard from "../components/WorkerCard";
import Button from "../components/Button";
import { useWorkersSearch } from "../hooks/useWorkers";

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
  const [filters, setFilters] = useState({ category: "", location: "" });
  const [appliedFilters, setAppliedFilters] = useState({ category: "", location: "" });
  const [searchQuery, setSearchQuery] = useState("");
  const {
    data: workers = [],
    isLoading: loading,
    isError,
    refetch
  } = useWorkersSearch(appliedFilters);

  const activeFilterLabel = useMemo(() => {
    const categoryLabel = CATEGORIES.find((item) => item.value === appliedFilters.category)?.label;
    const locationLabel = appliedFilters.location ? `Area: ${appliedFilters.location}` : "";
    return [categoryLabel && categoryLabel !== "All Categories" ? categoryLabel : "", locationLabel]
      .filter(Boolean)
      .join(" | ");
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

  const handleSearchSubmit = (event) => {
    event.preventDefault();
    const query = searchQuery.trim().toLowerCase();
    const categoryMatch = CATEGORIES.find((category) =>
      category.label.toLowerCase().includes(query) || category.value.includes(query)
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
      <section className="mb-12">
        <div className="flex flex-col items-center text-center">
          <h1 className="text-4xl font-semibold text-white md:text-5xl">Verified Local Professionals</h1>
          <p className="mt-4 max-w-2xl text-lg text-slate-300">
            TrustLayer is a secure marketplace connecting you with skilled workers who have been 
            manually verified for safety and quality.
          </p>
        </div>

        <div className="mt-12 grid gap-6 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center transition-all hover:bg-white/8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-cyan-400/10 text-cyan-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12l2 2 4-4m5.618-4.016A11.955 11.955 0 0112 2.944a11.955 11.955 0 01-8.618 3.04A12.02 12.02 0 003 9c0 5.591 3.824 10.29 9 11.622 5.176-1.332 9-6.03 9-11.622 0-1.042-.133-2.052-.382-3.016z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Manual Verification</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              We personally verify government IDs and trade certificates of every worker before they join.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center transition-all hover:bg-white/8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-emerald-400/10 text-emerald-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Secure Contact</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Your data is safe. Contact details are only visible to logged-in customers for approved bookings.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/5 bg-white/5 p-8 text-center transition-all hover:bg-white/8">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-amber-400/10 text-amber-400">
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.175 0l-3.976 2.888c-.783.57-1.838-.197-1.539-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.382-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z" />
              </svg>
            </div>
            <h3 className="mb-2 text-lg font-semibold text-white">Trust Scores</h3>
            <p className="text-sm leading-relaxed text-slate-400">
              Our algorithm calculates trust scores based on reviews, history, and document quality.
            </p>
          </div>
        </div>
      </section>

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
            <label className="mb-2 block text-sm font-medium text-slate-300">Service Category</label>
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
            <label className="mb-2 block text-sm font-medium text-slate-300">Location/Area</label>
            <input
              value={filters.location}
              onChange={(event) => setFilters((current) => ({ ...current, location: event.target.value }))}
              placeholder="e.g., Bangalore, Indiranagar"
              className="w-full rounded-2xl border border-white/10 bg-slate-900 px-4 py-3 text-slate-100 placeholder-slate-400 focus:border-cyan-400 focus:outline-none focus:ring-2 focus:ring-cyan-400/20"
            />
          </div>

          <div className="flex items-end gap-3">
            <Button onClick={applyFilters} variant="primary">
              Apply Filters
            </Button>
            <Button onClick={resetFilters} variant="secondary">
              Clear All
            </Button>
          </div>
        </div>
      </section>

      {loading && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {[1, 2, 3, 4, 5, 6].map((id) => (
            <div key={`search-skeleton-${id}`} className="h-72 animate-pulse rounded-3xl border border-white/10 bg-slate-800/70" />
          ))}
        </div>
      )}

      {!loading && isError && (
        <div className="rounded-3xl border border-amber-400/20 bg-amber-400/8 p-10 text-center">
          <p className="text-lg text-amber-100">Worker list is not available right now.</p>
          <p className="mt-3 text-slate-300">Please make sure the backend server and MongoDB are running, then try again.</p>
          <Button onClick={() => refetch()} variant="primary" className="mt-5">
            Try Again
          </Button>
        </div>
      )}

      {!loading && !isError && workers.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-14 text-center">
          <div className="mx-auto mb-6 flex h-16 w-16 items-center justify-center rounded-full bg-slate-800">
            <svg className="h-8 w-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z" />
            </svg>
          </div>
          <h3 className="mb-2 text-2xl font-medium text-white">No workers found</h3>
          <p className="mx-auto mb-6 max-w-md text-slate-400">
            We could not find any verified workers matching your search criteria. Try adjusting your filters or search terms.
          </p>

          <div className="mx-auto grid max-w-2xl gap-4 md:grid-cols-3">
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="mb-2 font-medium text-white">Try different categories</h4>
              <p className="text-sm text-slate-400">Search for "electrician" or "carpenter" instead.</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="mb-2 font-medium text-white">Check spelling</h4>
              <p className="text-sm text-slate-400">Make sure location names are spelled correctly.</p>
            </div>
            <div className="rounded-xl bg-slate-800/50 p-4">
              <h4 className="mb-2 font-medium text-white">Broader search</h4>
              <p className="text-sm text-slate-400">Try searching by city instead of a specific area.</p>
            </div>
          </div>

          <div className="mt-8 flex flex-col justify-center gap-3 sm:flex-row">
            <Button onClick={resetFilters} variant="primary">
              Clear All Filters
            </Button>
            <Button onClick={() => refetch()} variant="secondary">
              Refresh Results
            </Button>
          </div>
        </div>
      )}

      {!loading && !isError && workers.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => <WorkerCard key={worker.workerRef || `${worker.name}-${worker.area}`} worker={worker} />)}
        </div>
      )}
    </div>
  );
}

export default Search;
