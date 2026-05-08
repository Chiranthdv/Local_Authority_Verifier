import React from "react";
import { AnimatePresence, motion } from "framer-motion";

function SearchIcon() {
  return (
    <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.8} d="M21 21l-4.35-4.35m1.6-5.15a6.75 6.75 0 11-13.5 0 6.75 6.75 0 0113.5 0z" />
    </svg>
  );
}

function CommandInput({
  value,
  onChange,
  placeholder,
  autoFocus = false,
  onClear,
  className = "",
  ...props
}) {
  return (
    <div className={`glass-panel relative flex min-h-16 items-center rounded-full px-4 ${className}`.trim()}>
      <div className="mr-3 text-cyan-200/80">
        <SearchIcon />
      </div>
      <input
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        autoFocus={autoFocus}
        className="min-h-12 flex-1 bg-transparent text-base text-white placeholder:text-[var(--text-tertiary)] focus:outline-none"
        {...props}
      />
      <AnimatePresence>
        {value ? (
          <motion.button
            key="clear"
            type="button"
            onClick={onClear}
            className="ml-3 grid h-9 w-9 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300"
            initial={{ opacity: 0, scale: 0.7 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.7 }}
            whileHover={{ scale: 1.05, borderColor: "rgba(125,211,252,0.4)" }}
            whileTap={{ scale: 0.96 }}
          >
            <svg className="h-4 w-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </motion.button>
        ) : null}
      </AnimatePresence>
    </div>
  );
}

export default CommandInput;
