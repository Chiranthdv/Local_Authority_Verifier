import React from "react";
import { useAuth } from "../context/AuthContext";
import { motion } from "framer-motion";

function CustomerProfile() {
  const { user } = useAuth();

  if (!user) return null;

  return (
    <div className="mx-auto max-w-3xl px-6 py-12">
      <motion.div 
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        className="rounded-[2.5rem] border border-white/10 bg-white/5 p-10 shadow-2xl backdrop-blur-xl"
      >
        <div className="flex items-center gap-6 mb-10">
          <div className="grid h-24 w-24 place-items-center rounded-full border-2 border-cyan-400/30 bg-cyan-400/10 text-4xl font-bold text-cyan-100">
            {user.name.slice(0, 2).toUpperCase()}
          </div>
          <div>
            <p className="text-sm uppercase tracking-[0.4em] text-cyan-300">Customer Account</p>
            <h1 className="text-4xl font-semibold text-white">{user.name}</h1>
          </div>
        </div>

        <div className="grid gap-6 md:grid-cols-2">
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Email Address</p>
            <p className="text-lg text-white font-medium">{user.email}</p>
          </div>

          <div className="rounded-3xl border border-white/5 bg-white/5 p-6">
            <p className="text-xs uppercase tracking-widest text-slate-400 mb-1">Account Role</p>
            <p className="text-lg text-white capitalize font-medium">{user.role}</p>
          </div>
        </div>

        <div className="mt-6 grid gap-6 md:grid-cols-3">
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2">Member Since</p>
            <p className="text-2xl font-semibold text-white">2026</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2">Total Bookings</p>
            <p className="text-2xl font-semibold text-white">Verified</p>
          </div>
          <div className="rounded-3xl border border-white/5 bg-white/5 p-6 text-center">
            <p className="text-[10px] uppercase tracking-widest text-cyan-400 mb-2">Account Status</p>
            <div className="flex items-center justify-center gap-2">
              <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
              <p className="text-sm font-medium text-white">Active</p>
            </div>
          </div>
        </div>

        <div className="mt-10 p-6 rounded-3xl border border-cyan-400/20 bg-cyan-400/5">
          <p className="text-cyan-300 text-sm">
            As a customer, you can browse verified workers, book services, and chat with professionals. 
            All your requests are managed in the "My Requests" section.
          </p>
        </div>
      </motion.div>
    </div>
  );
}

export default CustomerProfile;
