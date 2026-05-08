export const transitionPresets = {
  fast: { duration: 0.24, ease: [0.16, 1, 0.3, 1] },
  base: { duration: 0.38, ease: [0.16, 1, 0.3, 1] },
  slow: { duration: 0.65, ease: [0.85, 0, 0.15, 1] }
};

export const staggerContainer = {
  hidden: {},
  show: {
    transition: {
      staggerChildren: 0.08,
      delayChildren: 0.05
    }
  }
};

export const staggerItem = {
  hidden: { opacity: 0, y: 18, filter: "blur(10px)" },
  show: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: transitionPresets.base
  }
};

export const pageVariants = {
  initial: { opacity: 0, y: 28, filter: "blur(10px)" },
  animate: {
    opacity: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.52,
      ease: [0.16, 1, 0.3, 1],
      staggerChildren: 0.06,
      delayChildren: 0.04
    }
  },
  exit: {
    opacity: 0,
    y: -18,
    filter: "blur(8px)",
    transition: {
      duration: 0.22,
      ease: [0.7, 0, 0.84, 0]
    }
  }
};

export const cardHover = {
  rest: {
    scale: 1,
    y: 0,
    boxShadow: "var(--shadow-md)",
    transition: transitionPresets.base
  },
  hover: {
    scale: 1.02,
    y: -6,
    boxShadow: "var(--shadow-glow)",
    transition: transitionPresets.fast
  }
};

export const buttonTap = {
  whileHover: { scale: 1.02, y: -1 },
  whileTap: { scale: 0.98, y: 0 }
};

export const modalVariants = {
  hidden: {
    opacity: 0,
    scale: 0.94,
    y: 20,
    filter: "blur(10px)"
  },
  visible: {
    opacity: 1,
    scale: 1,
    y: 0,
    filter: "blur(0px)",
    transition: {
      duration: 0.34,
      ease: [0.16, 1, 0.3, 1]
    }
  },
  exit: {
    opacity: 0,
    scale: 0.96,
    y: 10,
    filter: "blur(6px)",
    transition: {
      duration: 0.18,
      ease: [0.7, 0, 0.84, 0]
    }
  }
};

export const backdropVariants = {
  hidden: { opacity: 0, backdropFilter: "blur(0px)" },
  visible: {
    opacity: 1,
    backdropFilter: "blur(8px)",
    transition: transitionPresets.fast
  },
  exit: {
    opacity: 0,
    backdropFilter: "blur(0px)",
    transition: { duration: 0.16, ease: "linear" }
  }
};
