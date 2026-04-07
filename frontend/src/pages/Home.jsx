import { useNavigate } from "react-router-dom";
function Home() {
  const navigate = useNavigate();

  return (
    <div>
      <section className="mx-auto max-w-7xl px-6 pt-8 pb-12">
        <div className="overflow-hidden rounded-[2.5rem] border border-white/10 bg-[radial-gradient(circle_at_top_left,#164e63,#020617_58%)] shadow-2xl">
          <div className="grid gap-10 px-8 py-12 lg:grid-cols-[1.2fr_0.8fr] lg:px-12">
            <div>
              <p className="mb-4 text-sm uppercase tracking-[0.45em] text-cyan-300">Trusted Local Hiring</p>
              <h1 className="max-w-3xl text-4xl font-semibold leading-tight text-white md:text-6xl">
                Find verified workers with real reviews, visible badge points, and simple contact details.
              </h1>
              <p className="mt-6 max-w-2xl text-lg leading-8 text-slate-300">
                TrustLayer helps customers discover skilled plumbers, electricians, carpenters, cleaners, and more.
                Instead of guessing, you can compare worker profiles using ratings, review history, badge level, and location.
              </p>

              <div className="mt-8 flex flex-wrap gap-4">
                <button
                  onClick={() => {
                    navigate("/search");
                  }}
                  className="rounded-full bg-cyan-400 px-6 py-3 font-medium text-slate-950"
                >
                  Browse Workers
                </button>
                <button
                  onClick={() => navigate("/register")}
                  className="rounded-full border border-white/15 px-6 py-3 text-slate-100 hover:bg-white/5"
                >
                  Join as Worker
                </button>
              </div>
            </div>

            <div className="grid gap-4 self-end">
              <div className="rounded-[2rem] border border-cyan-400/20 bg-cyan-400/10 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-cyan-300">How It Works</p>
                <p className="mt-3 text-slate-200">1. Search by category and score.</p>
                <p className="mt-2 text-slate-200">2. Open the full worker profile.</p>
                <p className="mt-2 text-slate-200">3. Contact directly and review after the job.</p>
              </div>

              <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
                <p className="text-sm uppercase tracking-[0.3em] text-slate-400">Why Customers Use It</p>
                <p className="mt-3 text-slate-300">
                  Badge points highlight reliable workers. Reviews give context. Verification helps reduce fake or incomplete profiles.
                </p>
              </div>
            </div>
          </div>
        </div>

        <div className="mt-10 grid gap-5 md:grid-cols-3">
          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Verified Profiles</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Customers can check worker category, location, trust score, rating, and detailed profile information before deciding.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Transparent Reviews</h2>
            <p className="mt-3 leading-7 text-slate-400">
              After work is complete, customers leave star ratings and comments so future customers can choose with more confidence.
            </p>
          </div>

          <div className="rounded-[2rem] border border-white/10 bg-white/5 p-6">
            <h2 className="text-xl font-semibold text-white">Direct Contact</h2>
            <p className="mt-3 leading-7 text-slate-400">
              Logged-in customers can view the worker phone number on the profile page and contact them directly for the job.
            </p>
          </div>
        </div>
      </section>

    </div>
  );
}

export default Home;
