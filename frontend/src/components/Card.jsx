import React from "react";
import { motion, useReducedMotion } from "framer-motion";
import { cardHover } from "../lib/motion";

const elevationClasses = {
  sm: "shadow-sm",
  md: "shadow-md",
  lg: "shadow-lg"
};

function Card({
  children,
  className = "",
  elevation = "md",
  glass = true,
  interactive = false,
  as = "div",
  ...props
}) {
  const shouldReduceMotion = useReducedMotion();
  const Component = React.useMemo(
    () => (interactive ? motion.create(as) : as),
    [interactive, as]
  );

  return (
    <Component
      className={`${glass ? "glass-panel" : "bg-[var(--bg-elevated)]"} ambient-noise relative overflow-hidden rounded-[var(--radius-2xl)] border border-[var(--border-subtle)] ${elevationClasses[elevation] || elevationClasses.md} ${className}`.trim()}
      initial={interactive && !shouldReduceMotion ? "rest" : undefined}
      animate={interactive && !shouldReduceMotion ? "rest" : undefined}
      whileHover={interactive && !shouldReduceMotion ? "hover" : undefined}
      variants={interactive && !shouldReduceMotion ? cardHover : undefined}
      {...props}
    >
      {children}
    </Component>
  );
}

export default Card;
