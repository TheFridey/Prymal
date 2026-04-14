# Prymal Design System

This folder formalizes the reusable frontend system layer without changing the live product architecture.

- `tokens.js`
  Shared color, spacing, typography, radius, shadow, blur, elevation, and motion timing tokens for inline-style consumers.
- `surfaces.js`
  Reusable glass, notice, chip, and command-surface helpers used across workspace, settings, and admin surfaces.
- `motion.js`
  Central motion tokens and transition builders. `frontend/src/lib/motion.js` re-exports this module for backward compatibility.

The goal is to keep premium visuals and motion consistent while reducing copy-pasted style objects in feature code.
