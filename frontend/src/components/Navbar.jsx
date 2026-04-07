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

        <nav className="flex items-center gap-3 text-sm text-slate-200">
          {!user && <Link to="/search" className="rounded-full px-4 py-2 hover:bg-white/5">Explore</Link>}
          {!user && <Link to="/login" className="rounded-full px-4 py-2 hover:bg-white/5">Sign In</Link>}
          {!user && <Link to="/register" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">Register</Link>}

          {user?.role === "customer" && <Link to="/search" className="rounded-full px-4 py-2 hover:bg-white/5">Explore</Link>}
          {user?.role === "customer" && <Link to="/" className="rounded-full px-4 py-2 hover:bg-white/5">My Reviews</Link>}

          {user?.role === "worker" && <Link to="/worker/onboarding" className="rounded-full px-4 py-2 hover:bg-white/5">My Profile</Link>}
          {user?.role === "worker" && <Link to="/" className="rounded-full px-4 py-2 hover:bg-white/5">My Reviews</Link>}

          {user?.role === "admin" && <Link to="/admin/dashboard" className="rounded-full px-4 py-2 hover:bg-white/5">Admin Dashboard</Link>}

          {user && (
            <button onClick={handleLogout} className="rounded-full border border-white/15 px-4 py-2 hover:bg-white/5">
              Logout
            </button>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
