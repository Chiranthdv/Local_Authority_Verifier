import React from "react";
import { motion } from "framer-motion";
import { Navigate, useLocation } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="page-shell flex min-h-[60vh] items-center justify-center">
        <motion.div
          className="glass-panel grid h-28 w-28 place-items-center rounded-full"
          animate={{ rotate: 360 }}
          transition={{ duration: 2.4, repeat: Infinity, ease: "linear" }}
        >
          <div className="grid h-16 w-16 place-items-center rounded-full border border-cyan-300/30 bg-cyan-300/10 shadow-[var(--shadow-glow)]">
            <div className="h-6 w-6 rounded-full bg-cyan-200" />
          </div>
        </motion.div>
      </div>
    );
  }

  if (!user) {
    return <Navigate to="/login" state={{ from: location.pathname }} replace />;
  }

  if (roles && !roles.includes(user.role)) {
    return <Navigate to="/" replace />;
  }

  return children;
}

export default ProtectedRoute;
