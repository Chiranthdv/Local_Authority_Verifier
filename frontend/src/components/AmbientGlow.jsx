import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useMouseParallax } from "../hooks/useMouseParallax";

function AmbientOrb({ className, animate, style }) {
  const shouldReduceMotion = useReducedMotion();

  return (
    <motion.div
      aria-hidden="true"
      className={className}
      style={style}
      animate={shouldReduceMotion ? undefined : animate}
      transition={{
        duration: 16,
        ease: "easeInOut",
        repeat: Infinity,
        repeatType: "mirror"
      }}
    />
  );
}

function AmbientGlow() {
  const shouldReduceMotion = useReducedMotion();
  const offset = useMouseParallax(14);

  return (
    <div
      aria-hidden="true"
      className="pointer-events-none fixed inset-0 -z-10 overflow-hidden"
      style={{
        transform: shouldReduceMotion ? undefined : `translate3d(${offset.x * 0.3}px, ${offset.y * 0.3}px, 0)`,
        willChange: "transform"
      }}
    >
      <div className="aurora-bg" />
      <AmbientOrb
        className="absolute left-[-10%] top-[10%] h-[24rem] w-[24rem] rounded-full bg-cyan-400/14 blur-3xl"
        animate={{ x: [0, 40, -20], y: [0, 30, -16], scale: [1, 1.1, 0.98] }}
      />
      <AmbientOrb
        className="absolute right-[-8%] top-[18%] h-[22rem] w-[22rem] rounded-full bg-teal-300/10 blur-3xl"
        animate={{ x: [0, -36, 20], y: [0, -28, 12], scale: [1, 0.95, 1.08] }}
      />
      <AmbientOrb
        className="absolute bottom-[-10%] left-[28%] h-[26rem] w-[26rem] rounded-full bg-sky-500/10 blur-3xl"
        animate={{ x: [0, 26, -18], y: [0, -26, 18], scale: [1, 1.05, 0.94] }}
      />
      <div className="brand-grid absolute inset-0 opacity-[0.08]" />
    </div>
  );
}

export default AmbientGlow;
