import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  const handleLogout = async () => {
    await logout();
    navigate("/login");
  };

  return (
    <header className="fixed top-0 z-50 w-full border-b border-white/10 bg-slate-950/75 backdrop-blur-xl">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-semibold tracking-[0.2em] text-slate-100">
          Trust<span className="text-cyan-400">Layer</span>
        </Link>

        <nav className="flex items-center gap-4 text-sm text-slate-200">
          {!user && (
            <>
              <Link to="/search" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">
                Find Workers
              </Link>
              <Link to="/login" className="rounded-full px-4 py-2 hover:bg-white/5">Sign In</Link>
              <Link to="/register" className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">Register</Link>
            </>
          )}

          {user?.role === "customer" && (
            <>
              <Link to="/search" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">
                Find Workers
              </Link>
              <button onClick={handleLogout} className="rounded-full px-4 py-2 hover:bg-white/5">Logout</button>
            </>
          )}

          {user?.role === "worker" && (
            <>
              <Link to="/worker/onboarding" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">
                Dashboard
              </Link>
              <Link to="/requests/inbox" className="rounded-full px-4 py-2 hover:bg-white/5">Requests</Link>
              <button onClick={handleLogout} className="rounded-full px-4 py-2 hover:bg-white/5">Logout</button>
            </>
          )}

          {user?.role === "admin" && (
            <>
              <Link to="/admin/dashboard" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">
                Admin Dashboard
              </Link>
              <button onClick={handleLogout} className="rounded-full px-4 py-2 hover:bg-white/5">Logout</button>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
