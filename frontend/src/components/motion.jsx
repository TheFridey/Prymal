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
} from '../lib/motion';

export function MotionProvider({ children }) {
  return (
    <LazyMotion features={domAnimation}>
      <MotionConfig reducedMotion="user">
        {children}
      </MotionConfig>
    </LazyMotion>
  );
}

export function usePrymalReducedMotion() {
  return useReducedMotion() ?? false;
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

export function MotionList({
  children,
  className = '',
  style,
  staggerChildren,
  delayChildren,
  ...props
}) {
  const reducedMotion = usePrymalReducedMotion();

  return (
    <m.div
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
}

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
