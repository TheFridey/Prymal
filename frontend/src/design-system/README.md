# Prymal Design System

This folder formalizes the reusable frontend system layer without changing the live product architecture.

- `tokens/`
  Shared color, spacing, typography, radius, shadow, blur, elevation, and motion timing tokens.
- `primitives/`
  Reusable low-level UI helpers for explainability chips, detail cards, meters, and sticky toolbars.
- `surfaces/`
  Reusable glass, notice, chip, and command-surface helpers used across workspace, settings, and admin surfaces.
- `motion/`
  Central motion tokens and transition builders.
- `index.js`
  Barrel export for design-system consumers.
- Legacy compatibility files:
  `tokens.js`, `surfaces.js`, and `motion.js` now re-export the packaged modules so existing imports keep working while the repo migrates incrementally.

The goal is to keep premium visuals and motion consistent while reducing copy-pasted style objects in feature code.
