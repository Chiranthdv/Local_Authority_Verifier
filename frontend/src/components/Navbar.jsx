import React, { useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { AnimatePresence, motion } from "framer-motion";

import { useAuth } from "../context/AuthContext";
import { useUnreadNotifications } from "../hooks/useUnreadNotifications";

function NavBadge({ count }) {
  if (!count) return null;

  return (
    <motion.span
      className="inline-flex min-w-6 items-center justify-center rounded-full border border-cyan-300/40 bg-cyan-300/15 px-1.5 py-0.5 text-[10px] font-semibold text-cyan-50 shadow-[var(--shadow-glow)]"
      initial={{ scale: 0.7, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      transition={{ duration: 0.24, ease: [0.16, 1, 0.3, 1] }}
    >
      {count > 99 ? "99+" : count}
    </motion.span>
  );
}

function Logo() {
  return (
    <Link to="/" className="flex items-center gap-3">
      <motion.span
        className="h-2.5 w-2.5 rounded-full bg-cyan-300 shadow-[0_0_20px_rgba(34,211,238,0.75)]"
        animate={{ opacity: [0.7, 1, 0.7], scale: [1, 1.2, 1] }}
        transition={{ duration: 2.8, repeat: Infinity, ease: "easeInOut" }}
      />
      <div>
        <p className="text-[10px] uppercase tracking-[0.4em] text-[var(--text-tertiary)]">Future Trust</p>
        <p className="font-display text-xl font-semibold tracking-[-0.04em] text-white">
          Trust<span className="gradient-heading">Layer</span>
        </p>
      </div>
    </Link>
  );
}

function MobileDrawer({ open, onClose, items }) {
  return (
    <AnimatePresence>
      {open ? (
        <motion.div
          className="fixed inset-0 z-40 bg-slate-950/70 md:hidden"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          onClick={onClose}
        >
          <motion.div
            className="absolute inset-x-4 bottom-4 rounded-[var(--radius-2xl)] border border-white/10 bg-[rgba(9,14,28,0.92)] p-4 shadow-[var(--shadow-xl)] backdrop-blur-2xl"
            initial={{ y: 24, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 24, opacity: 0 }}
            transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
            onClick={(event) => event.stopPropagation()}
          >
            <div className="mb-4 flex items-center justify-between">
              <Logo />
              <button
                onClick={onClose}
                className="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-white/5 text-white"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            <div className="grid gap-2">
              {items.map((item) => (
                <Link
                  key={item.label}
                  to={item.to}
                  onClick={item.onClick ? async () => { await item.onClick(); onClose(); } : onClose}
                  className="flex items-center justify-between rounded-[var(--radius-xl)] border border-white/8 bg-white/5 px-4 py-3 text-sm text-[var(--text-secondary)]"
                >
                  <span>{item.label}</span>
                  {item.badge ? <NavBadge count={item.badge} /> : null}
                </Link>
              ))}
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

function Navbar() {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, logout } = useAuth();
  const { unreadCount } = useUnreadNotifications();
  const [mobileOpen, setMobileOpen] = useState(false);

  const handleLogout = React.useCallback(async () => {
    await logout();
    navigate("/login");
  }, [logout, navigate]);


  const navItems = useMemo(() => {
    if (!user) {
      return [
        { label: "Find Workers", to: "/search" },
        { label: "Sign In", to: "/login" },
        { label: "Register", to: "/register" }
      ];
    }

    if (user.role === "customer") {
      return [
        { label: "Find Workers", to: "/search" },
        { label: "My Requests", to: "/requests/my" },
        { label: "Notifications", to: "/notifications", badge: unreadCount },
        { label: "My Profile", to: "/profile" },
        { label: "Logout", to: "#", onClick: handleLogout }
      ];
    }

    if (user.role === "worker") {
      return [
        { label: "Dashboard", to: "/worker/onboarding" },
        { label: "Requests", to: "/requests/inbox" },
        { label: "Notifications", to: "/notifications", badge: unreadCount },
        { label: "My Profile", to: "/profile" },
        { label: "Logout", to: "#", onClick: handleLogout }
      ];
    }

      return [
        { label: "Admin", to: "/admin/dashboard" },
        { label: "Notifications", to: "/notifications", badge: unreadCount },
        { label: "My Profile", to: "/profile" },
        { label: "Logout", to: "#", onClick: handleLogout }
      ];
  }, [handleLogout, unreadCount, user]);

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-50 border-b border-white/5 bg-slate-950/80 backdrop-blur-xl shadow-2xl">
        <div className="mx-auto max-w-7xl px-4 py-3 md:px-6">
          <div className="relative">
            <div className="flex items-center justify-between gap-4">
              <Logo />

              <nav className="hidden items-center gap-2 md:flex">
                {navItems.map((item) => {
                  const isActive = item.to !== "#" && location.pathname.startsWith(item.to);
                  return item.onClick ? (
                    <motion.button
                      key={item.label}
                      onClick={item.onClick}
                      className="relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm text-[var(--text-secondary)]"
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      {item.label}
                    </motion.button>
                  ) : (
                    <motion.div
                      key={item.label}
                      whileHover={{ y: -1, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                    >
                      <Link
                        to={item.to}
                        className={`relative inline-flex items-center gap-2 rounded-full px-4 py-2 text-sm transition-colors duration-300 ${isActive ? "bg-white/10 text-white" : "text-[var(--text-secondary)] hover:text-white"}`}
                      >
                        {item.label}
                        {item.badge ? <NavBadge count={item.badge} /> : null}
                        {isActive ? (
                          <motion.span
                            layoutId="nav-active-pill"
                            className="absolute inset-0 -z-10 rounded-full border border-cyan-300/20 bg-cyan-300/10 shadow-[var(--shadow-glow)]"
                          />
                        ) : null}
                      </Link>
                    </motion.div>
                  );
                })}
              </nav>

              <div className="hidden items-center gap-3 md:flex">
                {user ? (
                  <div className="flex items-center gap-3 rounded-full border border-white/10 bg-white/5 px-2 py-1.5">
                    <div className="grid h-10 w-10 place-items-center rounded-full border border-cyan-300/20 bg-cyan-300/10 font-display text-sm font-semibold text-cyan-100">
                      {String(user.name || "U").slice(0, 2).toUpperCase()}
                    </div>
                    <div className="pr-2">
                      <p className="text-xs uppercase tracking-[0.28em] text-[var(--text-tertiary)]">{user.role}</p>
                      <p className="text-sm text-white">{user.name}</p>
                    </div>
                  </div>
                ) : null}
              </div>

              <button
                onClick={() => setMobileOpen(true)}
                className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-white md:hidden"
              >
                <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 7h16M4 12h16M4 17h16" />
                </svg>
              </button>
            </div>
          </div>
        </div>
      </header>

      <MobileDrawer open={mobileOpen} onClose={() => setMobileOpen(false)} items={navItems} />
    </>
  );
}

export default Navbar;
