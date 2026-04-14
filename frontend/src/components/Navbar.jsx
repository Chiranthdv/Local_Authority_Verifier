import { Link, useNavigate } from "react-router-dom";
import { useState } from "react";
import { useAuth } from "../context/AuthContext";

function Navbar() {
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);

  const handleLogout = async () => {
    await logout();
    navigate("/login");
    setProfileDropdownOpen(false);
  };

  const toggleProfileDropdown = () => {
    setProfileDropdownOpen(!profileDropdownOpen);
  };

  const closeDropdown = () => {
    setProfileDropdownOpen(false);
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
              <Link to="/requests/my" className="rounded-full px-4 py-2 hover:bg-white/5">My Requests</Link>
              <div className="relative">
                <button onClick={toggleProfileDropdown} className="rounded-full px-4 py-2 hover:bg-white/5">
                  Profile ▼
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-slate-900 shadow-lg">
                    <Link to="/chats" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">Chats</Link>
                    <Link to="/notifications" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">Notifications</Link>
                    <button onClick={handleLogout} className="block w-full px-4 py-2 text-left hover:bg-white/5">Logout</button>
                  </div>
                )}
              </div>
            </>
          )}

          {user?.role === "worker" && (
            <>
              <Link to="/search" className="rounded-full bg-cyan-500 px-4 py-2 font-medium text-slate-950">
                Find Jobs
              </Link>
              <Link to="/requests/inbox" className="rounded-full px-4 py-2 hover:bg-white/5">Request Inbox</Link>
              <div className="relative">
                <button onClick={toggleProfileDropdown} className="rounded-full px-4 py-2 hover:bg-white/5">
                  Profile ▼
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-slate-900 shadow-lg">
                    <Link to="/worker/onboarding" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">My Profile</Link>
                    <Link to="/chats" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">Chats</Link>
                    <Link to="/notifications" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">Notifications</Link>
                    <button onClick={handleLogout} className="block w-full px-4 py-2 text-left hover:bg-white/5">Logout</button>
                  </div>
                )}
              </div>
            </>
          )}

          {user?.role === "admin" && (
            <>
              <Link to="/admin/dashboard" className="rounded-full px-4 py-2 hover:bg-white/5">Admin Dashboard</Link>
              <div className="relative">
                <button onClick={toggleProfileDropdown} className="rounded-full px-4 py-2 hover:bg-white/5">
                  Profile ▼
                </button>
                {profileDropdownOpen && (
                  <div className="absolute right-0 mt-2 w-48 rounded-lg border border-white/10 bg-slate-900 shadow-lg">
                    <Link to="/notifications" onClick={closeDropdown} className="block px-4 py-2 hover:bg-white/5">Notifications</Link>
                    <button onClick={handleLogout} className="block w-full px-4 py-2 text-left hover:bg-white/5">Logout</button>
                  </div>
                )}
              </div>
            </>
          )}
        </nav>
      </div>
    </header>
  );
}

export default Navbar;
