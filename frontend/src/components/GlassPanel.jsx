import React from "react";
import { motion } from "framer-motion";

function GlassPanel({
  children,
  className = "",
  as = "div",
  interactive = false,
  ...props
}) {
  const Component = React.useMemo(
    () => (interactive ? motion.create(as) : as),
    [interactive, as]
  );
  const motionProps = interactive
    ? {
        whileHover: {
          y: -4,
          scale: 1.01,
          boxShadow: "var(--shadow-glow)"
        },
        transition: {
          duration: 0.26,
          ease: [0.16, 1, 0.3, 1]
        }
      }
    : {};

  return (
    <Component
      className={`glass-panel ambient-noise relative overflow-hidden rounded-[var(--radius-2xl)] ${className}`.trim()}
      {...motionProps}
      {...props}
    >
      {children}
    </Component>
  );
}

export default GlassPanel;
