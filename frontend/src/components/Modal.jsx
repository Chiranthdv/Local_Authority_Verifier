import React, { useEffect, useRef } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { backdropVariants, modalVariants } from "../lib/motion";

const sizeStyles = {
  small: "max-w-lg",
  medium: "max-w-3xl",
  large: "max-w-5xl",
  full: "max-w-7xl"
};

function Modal({
  isOpen,
  onClose,
  title,
  children,
  size = "medium",
  showCloseButton = true
}) {
  const modalRef = useRef(null);
  const previousFocusRef = useRef(null);
  const shouldReduceMotion = useReducedMotion();

  useEffect(() => {
    const handleEscape = (event) => {
      if (event.key === "Escape") {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [isOpen, onClose]);

  useEffect(() => {
    if (isOpen) {
      previousFocusRef.current = document.activeElement;
      modalRef.current?.focus();
      document.body.style.overflow = "hidden";
    } else {
      previousFocusRef.current?.focus?.();
      document.body.style.overflow = "unset";
    }

    return () => {
      document.body.style.overflow = "unset";
    };
  }, [isOpen]);

  const handleBackdropClick = (event) => {
    if (event.target === event.currentTarget) {
      onClose();
    }
  };

  return (
    <AnimatePresence>
      {isOpen ? (
        <motion.div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          onClick={handleBackdropClick}
          role="dialog"
          aria-modal="true"
          aria-labelledby="modal-title"
          initial="hidden"
          animate="visible"
          exit="exit"
          variants={shouldReduceMotion ? undefined : backdropVariants}
          style={{
            background: "rgba(2, 8, 23, 0.72)",
            willChange: "opacity, backdrop-filter"
          }}
        >
          <motion.div
            ref={modalRef}
            tabIndex={-1}
            role="document"
            className={`relative w-full ${sizeStyles[size] || sizeStyles.medium}`}
            initial="hidden"
            animate="visible"
            exit="exit"
            variants={shouldReduceMotion ? undefined : modalVariants}
            style={{ willChange: "transform, opacity, filter" }}
          >
            <div className="glass-panel ambient-noise relative overflow-hidden rounded-[var(--radius-2xl)] border border-white/10 shadow-[var(--shadow-xl)]">
              {(title || showCloseButton) ? (
                <div className="flex items-center justify-between border-b border-white/10 px-6 py-5">
                  {title ? (
                    <div>
                      <p className="text-caption">Focused Surface</p>
                      <h2 id="modal-title" className="mt-2 font-display text-2xl font-semibold text-white">
                        {title}
                      </h2>
                    </div>
                  ) : <span />}
                  {showCloseButton ? (
                    <button
                      onClick={onClose}
                      className="grid h-11 w-11 place-items-center rounded-full border border-white/10 bg-white/5 text-slate-300 transition-colors duration-300 hover:border-cyan-300/40 hover:text-white"
                      aria-label="Close modal"
                    >
                      <svg className="h-5 w-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  ) : null}
                </div>
              ) : null}

              <div className="px-6 py-6">{children}</div>
            </div>
          </motion.div>
        </motion.div>
      ) : null}
    </AnimatePresence>
  );
}

export default Modal;
