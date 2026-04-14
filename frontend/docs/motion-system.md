# Prymal Motion System

The premium interaction layer is organised into four parts:

1. `src/lib/motion.js`
   Central tokens for easing, durations, spring presets, stagger presets, and reusable transition builders.

2. `src/components/motion.jsx`
   Reusable wrappers for product surfaces:
   `MotionPage`, `MotionSection`, `MotionCard`, `MotionPanel`, `MotionList`, `MotionDrawer`, `MotionModal`, `MotionStat`, and `MotionTimelineItem`.

3. `src/styles/motion-system.css`
   Shared motion-oriented utility styling and reduced-motion-safe shell classes.

4. `src/styles/premium-overrides.css`
   Premium visual language overrides layered on top of the existing design system, including cinematic hero styling, elevated glass surfaces, ambient shell treatment, and workspace/admin refinements.

Usage guidance:

- Prefer the wrappers in `src/components/motion.jsx` before hand-rolling `framer-motion` transitions.
- Keep motion purposeful: hierarchy, causality, feedback, or storytelling.
- Respect reduced motion by using the shared wrappers or `usePrymalReducedMotion()`.
- For public storytelling sections, use GSAP only when the sequence needs scroll-linked choreography rather than simple reveal motion.
- For premium 3D visuals, keep React Three Fiber isolated to hero or showcase surfaces and avoid always-on heavy scenes inside the main product workflow.
