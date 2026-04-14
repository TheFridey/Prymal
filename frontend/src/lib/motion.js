export const MOTION_EASINGS = {
  standard: [0.22, 1, 0.36, 1],
  smooth: [0.16, 1, 0.3, 1],
  sharp: [0.4, 0, 0.2, 1],
  exit: [0.4, 0, 1, 1],
  ambient: [0.33, 1, 0.68, 1],
};

export const MOTION_DURATIONS = {
  instant: 0.01,
  micro: 0.14,
  fast: 0.2,
  base: 0.32,
  slow: 0.48,
  hero: 0.72,
  cinematic: 1.05,
};

export const MOTION_SPRINGS = {
  snappy: { type: 'spring', stiffness: 340, damping: 28, mass: 0.7 },
  soft: { type: 'spring', stiffness: 210, damping: 24, mass: 0.85 },
  drawer: { type: 'spring', stiffness: 220, damping: 28, mass: 0.92 },
  modal: { type: 'spring', stiffness: 240, damping: 24, mass: 0.88 },
  emphasis: { type: 'spring', stiffness: 260, damping: 20, mass: 0.8 },
};

export const MOTION_STAGGERS = {
  dense: 0.04,
  comfortable: 0.075,
  narrative: 0.12,
};

export function motionDuration(reducedMotion, duration = MOTION_DURATIONS.base) {
  return reducedMotion ? MOTION_DURATIONS.instant : duration;
}

export function revealTransition(reducedMotion, options = {}) {
  return {
    duration: motionDuration(reducedMotion, options.duration ?? MOTION_DURATIONS.base),
    delay: reducedMotion ? 0 : (options.delay ?? 0),
    ease: options.ease ?? MOTION_EASINGS.standard,
  };
}

export function createRevealVariants(reducedMotion, options = {}) {
  const y = reducedMotion ? 0 : (options.y ?? 28);
  const x = reducedMotion ? 0 : (options.x ?? 0);
  const scale = reducedMotion ? 1 : (options.scale ?? 0.985);
  const blur = reducedMotion ? 0 : (options.blur ?? 10);

  return {
    hidden: {
      opacity: 0,
      x,
      y,
      scale,
      filter: `blur(${blur}px)`,
    },
    visible: {
      opacity: 1,
      x: 0,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: revealTransition(reducedMotion, options),
    },
  };
}

export function createListVariants(reducedMotion, options = {}) {
  return {
    hidden: {},
    visible: {
      transition: {
        staggerChildren: reducedMotion ? 0 : (options.staggerChildren ?? MOTION_STAGGERS.comfortable),
        delayChildren: reducedMotion ? 0 : (options.delayChildren ?? 0),
      },
    },
  };
}

export function createPageVariants(reducedMotion) {
  return {
    initial: {
      opacity: 0,
      y: reducedMotion ? 0 : 18,
      scale: reducedMotion ? 1 : 0.992,
      filter: reducedMotion ? 'blur(0px)' : 'blur(10px)',
    },
    animate: {
      opacity: 1,
      y: 0,
      scale: 1,
      filter: 'blur(0px)',
      transition: {
        duration: motionDuration(reducedMotion, MOTION_DURATIONS.slow),
        ease: MOTION_EASINGS.standard,
      },
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : -16,
      scale: reducedMotion ? 1 : 0.994,
      filter: reducedMotion ? 'blur(0px)' : 'blur(8px)',
      transition: {
        duration: motionDuration(reducedMotion, MOTION_DURATIONS.fast),
        ease: MOTION_EASINGS.exit,
      },
    },
  };
}

export function createDrawerVariants(reducedMotion) {
  return {
    hidden: {
      opacity: 0,
      x: reducedMotion ? 0 : -22,
      scale: reducedMotion ? 1 : 0.985,
    },
    visible: {
      opacity: 1,
      x: 0,
      scale: 1,
      transition: reducedMotion
        ? { duration: MOTION_DURATIONS.instant }
        : MOTION_SPRINGS.drawer,
    },
    exit: {
      opacity: 0,
      x: reducedMotion ? 0 : -18,
      scale: reducedMotion ? 1 : 0.99,
      transition: {
        duration: motionDuration(reducedMotion, MOTION_DURATIONS.fast),
        ease: MOTION_EASINGS.exit,
      },
    },
  };
}

export function createModalVariants(reducedMotion) {
  return {
    hidden: {
      opacity: 0,
      y: reducedMotion ? 0 : 28,
      scale: reducedMotion ? 1 : 0.975,
    },
    visible: {
      opacity: 1,
      y: 0,
      scale: 1,
      transition: reducedMotion
        ? { duration: MOTION_DURATIONS.instant }
        : MOTION_SPRINGS.modal,
    },
    exit: {
      opacity: 0,
      y: reducedMotion ? 0 : 18,
      scale: reducedMotion ? 1 : 0.985,
      transition: {
        duration: motionDuration(reducedMotion, MOTION_DURATIONS.fast),
        ease: MOTION_EASINGS.exit,
      },
    },
  };
}

export function createBackdropTransition(reducedMotion, extra = {}) {
  return {
    duration: motionDuration(reducedMotion, extra.duration ?? MOTION_DURATIONS.fast),
    ease: extra.ease ?? MOTION_EASINGS.smooth,
  };
}

export function createHoverLift(reducedMotion, options = {}) {
  if (reducedMotion || options.disabled) {
    return undefined;
  }

  return {
    y: options.y ?? -4,
    scale: options.scale ?? 1.012,
    transition: options.transition ?? MOTION_SPRINGS.soft,
  };
}

export function createTapPress(reducedMotion) {
  return reducedMotion
    ? undefined
    : {
        scale: 0.985,
        transition: { duration: MOTION_DURATIONS.micro, ease: MOTION_EASINGS.sharp },
      };
}

export function createFocusPulse(reducedMotion, accent = 'var(--accent)') {
  if (reducedMotion) {
    return {};
  }

  return {
    boxShadow: `0 0 0 1px color-mix(in srgb, ${accent} 36%, transparent), 0 0 0 8px color-mix(in srgb, ${accent} 10%, transparent)`,
    transition: {
      duration: MOTION_DURATIONS.fast,
      ease: MOTION_EASINGS.standard,
    },
  };
}
