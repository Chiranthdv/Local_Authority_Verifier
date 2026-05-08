import React from "react";
import { motion } from "framer-motion";
import { buttonTap } from "../lib/motion";

const sizeStyles = {
  small: "min-h-10 px-4 text-sm rounded-[var(--radius-full)]",
  medium: "min-h-12 px-5 text-sm rounded-[var(--radius-full)]",
  large: "min-h-14 px-7 text-base rounded-[var(--radius-full)]"
};

const variantStyles = {
  primary: "bg-[linear-gradient(135deg,#7dd3fc,#67e8f9_55%,#99f6e4)] text-slate-950 shadow-[var(--shadow-glow)]",
  success: "bg-[linear-gradient(135deg,#7dd3fc,#99f6e4)] text-slate-950 shadow-[var(--glow-mint)]",
  warning: "bg-[linear-gradient(135deg,#fcd34d,#fbbf24)] text-slate-950 shadow-[var(--glow-amber)]",
  danger: "bg-[linear-gradient(135deg,#fb7185,#f43f5e)] text-white shadow-[0_22px_54px_rgba(244,63,94,0.28)]",
  secondary: "border border-white/12 bg-white/[0.06] text-[var(--text-secondary)] shadow-[var(--shadow-sm)]",
  outline: "border border-[var(--border-strong)] bg-transparent text-cyan-100 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)]",
  ghost: "bg-transparent text-[var(--text-secondary)] shadow-none",
  glow: "border border-cyan-300/30 bg-cyan-300/12 text-cyan-50 shadow-[var(--shadow-glow)]"
};

function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" fill="none" viewBox="0 0 24 24">
      <circle className="opacity-25" cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="3" />
      <path className="opacity-90" fill="currentColor" d="M21 12a9 9 0 00-9-9v3a6 6 0 016 6h3z" />
    </svg>
  );
}

const Button = ({
  children,
  variant = "primary",
  size = "medium",
  disabled = false,
  loading = false,
  onClick,
  type = "button",
  as = "button",
  className = "",
  ...props
}) => {
  const Component = motion(as);
  const isButton = as === "button";

  return (
    <Component
      type={isButton ? type : undefined}
      disabled={disabled || loading}
      onClick={onClick}
      className={`relative inline-flex items-center justify-center gap-2 overflow-hidden border font-medium tracking-[0.01em] transition-[transform,box-shadow,border-color,background-color,color] duration-300 ease-[var(--ease-out-expo)] focus:outline-none focus-visible:ring-2 focus-visible:ring-cyan-300/45 disabled:pointer-events-none disabled:opacity-55 ${sizeStyles[size] || sizeStyles.medium} ${variantStyles[variant] || variantStyles.primary} ${className}`.trim()}
      whileHover={!disabled && !loading ? { ...buttonTap.whileHover, boxShadow: "var(--shadow-glow)" } : undefined}
      whileTap={!disabled && !loading ? buttonTap.whileTap : undefined}
      style={{ willChange: "transform, box-shadow" }}
      {...props}
    >
      <span className="pointer-events-none absolute inset-0 bg-[linear-gradient(120deg,transparent,rgba(255,255,255,0.18),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100" />
      {loading ? <Spinner /> : null}
      <span className="relative z-10">{children}</span>
    </Component>
  );
};

export default Button;
