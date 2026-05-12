import React from "react";
import { motion } from "framer-motion";
import Card from "./Card";
import { staggerItem } from "../lib/motion";

function StatCard({
  label,
  value,
  icon,
  tone = "cyan",
  detail = "",
  className = ""
}) {
  const toneGlows = {
    mint: "shadow-[var(--glow-mint)]",
    amber: "shadow-[var(--glow-amber)]",
    cyan: "shadow-[var(--glow-cyan)]"
  };
  const glowClass = toneGlows[tone] || toneGlows.cyan;

  return (
    <motion.div variants={staggerItem}>
      <Card interactive className={`p-5 ${glowClass} ${className}`.trim()}>
        <div className="flex items-start justify-between gap-4">
          <div>
            <p className="text-caption">{label}</p>
            <motion.p
              className="mt-4 font-display text-[clamp(2rem,2.4vw,3rem)] font-semibold tracking-[-0.05em] text-white"
              initial={{ opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
            >
              {value}
            </motion.p>
            {detail ? (
              <p className="mt-3 text-sm text-[var(--text-muted)]">{detail}</p>
            ) : null}
          </div>
          <div className="grid h-12 w-12 place-items-center rounded-2xl border border-white/10 bg-white/10 text-cyan-200">
            {icon}
          </div>
        </div>
        <div className="mt-6 h-1.5 overflow-hidden rounded-full bg-white/5">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-cyan-300 via-sky-300 to-teal-200"
            initial={{ scaleX: 0, transformOrigin: "left center" }}
            animate={{ scaleX: 1 }}
            transition={{ duration: 0.9, ease: [0.16, 1, 0.3, 1], delay: 0.1 }}
          />
        </div>
      </Card>
    </motion.div>
  );
}

export default StatCard;
