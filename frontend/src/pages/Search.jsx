import { useEffect, useState } from "react";
import api from "../lib/api";
import WorkerCard from "../components/WorkerCard";

function Search() {
  const [workers, setWorkers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  const fetchWorkers = async () => {
    try {
      setLoading(true);
      setError("");
      const { data } = await api.get("/workers");
      setWorkers(data);
    } catch (err) {
      setError("Could not load workers.");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchWorkers();
    const intervalId = window.setInterval(fetchWorkers, 10000);

    const handleFocus = () => {
      fetchWorkers();
    };

    window.addEventListener("focus", handleFocus);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener("focus", handleFocus);
    };
  }, []);

  return (
    <div className="mx-auto max-w-7xl px-6 py-10">
      <section className="mb-10 grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
        <div>
          <p className="text-sm uppercase tracking-[0.35em] text-cyan-300">Available Workers</p>
          <h2 className="mt-3 text-3xl font-semibold text-white md:text-4xl">Browse all worker profiles in one place.</h2>
          <p className="mt-3 max-w-3xl leading-7 text-slate-400">
            For now, this page shows all categories together. Open a worker card to see profile details, bio, rating, trust score, and contact information.
          </p>
        </div>

        <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
          <p className="text-sm uppercase tracking-[0.3em] text-slate-400">About Workers</p>
          <div className="mt-4 space-y-3 text-slate-300">
            <p>Newly added workers appear here as cards.</p>
            <p>You can compare bio, location, rating, and status visually.</p>
            <p>Later we can add category filters again after the base flow is stable.</p>
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
          <button onClick={fetchWorkers} className="mt-5 rounded-full bg-white px-5 py-2 text-slate-950">Try Again</button>
        </div>
      )}

      {!loading && !error && workers.length === 0 && (
        <div className="rounded-3xl border border-white/10 bg-white/5 p-14 text-center">
          <p className="text-2xl font-medium text-white">No workers added yet</p>
          <p className="mt-2 text-slate-400">Create a worker profile from another account and it will show here.</p>
        </div>
      )}

      {!loading && !error && workers.length > 0 && (
        <div className="grid gap-6 sm:grid-cols-2 xl:grid-cols-3">
          {workers.map((worker) => <WorkerCard key={worker._id} worker={worker} />)}
        </div>
      )}
    </div>
  );
}

export default Search;
