import { forwardRef, useEffect } from 'react';
import {
  AnimatePresence,
  LazyMotion,
  MotionConfig,
  domAnimation,
  m,
  useReducedMotion,
} from 'framer-motion';
import {
  createBackdropTransition,
  createDrawerVariants,
  createFocusPulse,
  createHoverLift,
  createListVariants,
  createModalVariants,
  createPageVariants,
  createRevealVariants,
  createTapPress,
} from '../design-system/motion';

export function MotionProvider({ children }) {
  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 920px)');
    document.documentElement.setAttribute('data-prymal-motion', 'force');
    const syncMotionDepth = () => {
      document.body.classList.toggle('motion-depth-low', mediaQuery.matches);
      document.body.classList.toggle('motion-depth-high', !mediaQuery.matches);
    };

    syncMotionDepth();
    mediaQuery.addEventListener('change', syncMotionDepth);
    return () => {
      mediaQuery.removeEventListener('change', syncMotionDepth);
      document.documentElement.removeAttribute('data-prymal-motion');
    };
  }, []);

  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export function usePrymalReducedMotion() {
  const systemReducedMotion = useReducedMotion() ?? false;

  if (typeof window !== 'undefined') {
    const forced = window.localStorage.getItem('prymal.motion');
    if (forced === 'off') {
      return true;
    }
    if (forced === 'on') {
      return false;
    }
    return false;
  }
  return systemReducedMotion;
}

export function MotionPresence({ children, ...props }) {
  return <AnimatePresence {...props}>{children}</AnimatePresence>;
}

export function MotionPage({ children, className = '', style, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      className={`motion-page${className ? ` ${className}` : ''}`}
      style={style}
      initial="initial"
      animate="animate"
      exit="exit"
      variants={createPageVariants(reducedMotion)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function MotionSection({
  children,
  className = '',
  style,
  once = true,
  amount = 0.2,
  delay = 0,
  reveal = {},
  ...props
}) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      className={`motion-section${className ? ` ${className}` : ''}`}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once, amount }}
      variants={createRevealVariants(reducedMotion, { ...reveal, delay })}
      {...props}
    >
      {children}
    </m.div>
  );
}

export const MotionList = forwardRef(function MotionList(
  {
    children,
    className = '',
    style,
    staggerChildren,
    delayChildren,
    ...props
  },
  ref,
) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      ref={ref}
      className={`motion-list${className ? ` ${className}` : ''}`}
      style={style}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.12 }}
      variants={createListVariants(reducedMotion, { staggerChildren, delayChildren })}
      {...props}
    >
      {children}
    </m.div>
  );
});

export function MotionListItem({ children, className = '', reveal = {}, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      className={`motion-list-item${className ? ` ${className}` : ''}`}
      variants={createRevealVariants(reducedMotion, { y: 18, blur: 6, ...reveal })}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function MotionCard({
  children,
  className = '',
  style,
  hover = true,
  accent,
  ...props
}) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      className={`motion-card${className ? ` ${className}` : ''}`}
      style={{
        '--motion-card-accent': accent ?? 'var(--accent)',
        ...style,
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.18 }}
      variants={createRevealVariants(reducedMotion, { y: 20, blur: 8 })}
      whileHover={createHoverLift(reducedMotion, { disabled: !hover })}
      whileTap={createTapPress(reducedMotion)}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function MotionPanel({ children, className = '', style, accent, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.section
      className={`motion-panel${className ? ` ${className}` : ''}`}
      style={{
        '--motion-panel-accent': accent ?? 'var(--accent)',
        ...style,
      }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.15 }}
      variants={createRevealVariants(reducedMotion, { y: 18, blur: 8 })}
      {...props}
    >
      {children}
    </m.section>
  );
}

export function MotionStat({ children, className = '', accent, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
      className={`motion-stat${className ? ` ${className}` : ''}`}
      style={{ '--motion-stat-accent': accent ?? 'var(--accent)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.2 }}
      variants={createRevealVariants(reducedMotion, { y: 14, blur: 6 })}
      whileHover={createHoverLift(reducedMotion, { y: -3, scale: 1.01 })}
      {...props}
    >
      {children}
    </m.div>
  );
}

export function MotionTimelineItem({ children, className = '', accent, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.article
      className={`motion-timeline-item${className ? ` ${className}` : ''}`}
      style={{ '--motion-timeline-accent': accent ?? 'var(--accent)' }}
      initial="hidden"
      whileInView="visible"
      viewport={{ once: true, amount: 0.22 }}
      variants={createRevealVariants(reducedMotion, { x: -18, y: 0, blur: 8 })}
      {...props}
    >
      {children}
    </m.article>
  );
}

export function MotionTooltip({ children, visible, className = '', ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <MotionPresence initial={false}>
      {visible ? (
        <m.div
          className={`motion-tooltip${className ? ` ${className}` : ''}`}
          initial={{ opacity: 0, y: reducedMotion ? 0 : 6, scale: reducedMotion ? 1 : 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: reducedMotion ? 0 : 4, scale: reducedMotion ? 1 : 0.985 }}
          transition={{ duration: reducedMotion ? 0.01 : 0.18 }}
          {...props}
        >
          {children}
        </m.div>
      ) : null}
    </MotionPresence>
  );
}

export function MotionDrawer({
  open,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  backdropLabel = 'Close panel',
  ...props
}) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <MotionPresence initial={false}>
      {open ? (
        <>
          <m.button
            type="button"
            aria-label={backdropLabel}
            className={backdropClassName}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={createBackdropTransition(reducedMotion)}
          />
          <div className="motion-drawer-shell">
            <m.aside
              className={`motion-drawer${className ? ` ${className}` : ''}`}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={createDrawerVariants(reducedMotion)}
              {...props}
            >
              {children}
            </m.aside>
          </div>
        </>
      ) : null}
    </MotionPresence>
  );
}

export function MotionModal({
  open,
  onClose,
  children,
  className = '',
  backdropClassName = '',
  backdropLabel = 'Close dialog',
  ...props
}) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <MotionPresence initial={false}>
      {open ? (
        <>
          <m.button
            type="button"
            aria-label={backdropLabel}
            className={backdropClassName}
            onClick={onClose}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={createBackdropTransition(reducedMotion)}
          />
          <div className="motion-modal-shell">
            <m.div
              className={`motion-modal${className ? ` ${className}` : ''}`}
              initial="hidden"
              animate="visible"
              exit="exit"
              variants={createModalVariants(reducedMotion)}
              {...props}
            >
              {children}
            </m.div>
          </div>
        </>
      ) : null}
    </MotionPresence>
  );
}

export function MotionButton({ children, className = '', accent, style, ...props }) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.button
      className={className}
      style={{ '--motion-button-accent': accent ?? 'var(--accent)', ...style }}
      whileHover={createHoverLift(reducedMotion, { y: -2, scale: 1.008 })}
      whileTap={createTapPress(reducedMotion)}
      whileFocus={createFocusPulse(reducedMotion, accent)}
      {...props}
    >
      {children}
    </m.button>
  );
}

export { m as motion };

// ---------------------------------------------------------------------------
// Skeleton loading primitives
// ---------------------------------------------------------------------------

// Single shimmer block — width/height controlled by CSS vars or inline style.
export function SkeletonBlock({ className = '', style, w, h }) {
  return (
    <span
      className={`skeleton-block${className ? ` ${className}` : ''}`}
      style={{ '--skeleton-w': w, '--skeleton-h': h, ...style }}
      aria-hidden="true"
    />
  );
}

// Stack of text-line skeletons — count controls how many lines render.
export function SkeletonText({ lines = 3, className = '' }) {
  return (
    <span className={className} aria-hidden="true">
      {Array.from({ length: lines }, (_, i) => (
        <span key={i} className="skeleton-text" />
      ))}
    </span>
  );
}

// Heading skeleton — single wider bar.
export function SkeletonHeading({ className = '', w }) {
  return (
    <span
      className={`skeleton-heading${className ? ` ${className}` : ''}`}
      style={w ? { '--skeleton-w': w } : undefined}
      aria-hidden="true"
    />
  );
}

// Circular avatar placeholder.
export function SkeletonAvatar({ size, className = '' }) {
  return (
    <span
      className={`skeleton-avatar${className ? ` ${className}` : ''}`}
      style={size ? { '--skeleton-size': size } : undefined}
      aria-hidden="true"
    />
  );
}

// Rectangular card-shaped placeholder with configurable height.
export function SkeletonCard({ h, delay, className = '' }) {
  return (
    <span
      className={`skeleton-card${className ? ` ${className}` : ''}`}
      style={{ '--skeleton-h': h, '--skeleton-delay': delay }}
      aria-hidden="true"
    />
  );
}

// KPI metric tile placeholder — used while admin/dashboard queries load.
export function SkeletonMetric({ delay, className = '' }) {
  return (
    <span
      className={`skeleton-metric${className ? ` ${className}` : ''}`}
      style={delay ? { '--skeleton-delay': delay } : undefined}
      aria-hidden="true"
    />
  );
}

// Full surface placeholder — used for admin panel sections.
export function SkeletonSurface({ h, delay, className = '' }) {
  return (
    <span
      className={`skeleton-surface${className ? ` ${className}` : ''}`}
      style={{ '--skeleton-h': h, '--skeleton-delay': delay }}
      aria-hidden="true"
    />
  );
}

// Compound: metric grid of N tiles — drop-in loading state for KPI strips.
export function SkeletonMetricGrid({ count = 4, className = '' }) {
  return (
    <div className={`skeleton-metric-grid${className ? ` ${className}` : ''}`} aria-hidden="true">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonMetric key={i} delay={`${i * 80}ms`} />
      ))}
    </div>
  );
}

// Compound: N stacked surface placeholders — use while tab data loads.
export function SkeletonPageShell({ surfaces = 2, className = '' }) {
  return (
    <div className={className} aria-hidden="true" style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
      <SkeletonMetricGrid />
      {Array.from({ length: surfaces }, (_, i) => (
        <SkeletonSurface key={i} delay={`${(i + 4) * 80}ms`} />
      ))}
    </div>
  );
}
