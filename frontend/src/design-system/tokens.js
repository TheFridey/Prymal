export const COLOR_TOKENS = {
  text: 'var(--text)',
  textStrong: 'var(--text-strong)',
  muted: 'var(--muted)',
  mutedStrong: 'var(--muted-2)',
  line: 'var(--line)',
  lineSoft: 'var(--line-soft)',
  panel: 'var(--panel)',
  panelSoft: 'var(--panel-soft)',
  surface: 'var(--surface)',
  surface2: 'var(--surface-2)',
  accent: 'var(--accent)',
  accent2: 'var(--accent-2)',
  accent3: 'var(--accent-3)',
  success: 'var(--success-ink)',
  successSurface: 'var(--success-surface)',
  warning: 'var(--warning-ink)',
  warningSurface: 'var(--warning-surface)',
  danger: 'var(--danger-ink)',
  dangerSurface: 'var(--danger-surface)',
};

export const SPACING_TOKENS = {
  xs: '6px',
  sm: '10px',
  md: '14px',
  lg: '18px',
  xl: '24px',
  xxl: '32px',
};

export const TYPOGRAPHY_TOKENS = {
  monoLabel: {
    fontSize: '11px',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    color: COLOR_TOKENS.mutedStrong,
  },
  caption: {
    fontSize: '12px',
    color: COLOR_TOKENS.muted,
    lineHeight: 1.6,
  },
  code: {
    fontFamily: 'monospace',
    fontSize: '11px',
    color: COLOR_TOKENS.textStrong,
  },
};

export const RADIUS_TOKENS = {
  sm: '12px',
  md: '16px',
  lg: '18px',
  xl: '20px',
  xxl: '28px',
  pill: '999px',
};

export const SHADOW_TOKENS = {
  surface: 'var(--shadow)',
  elevated: 'var(--shadow-strong)',
  float: 'var(--shadow-float, var(--shadow))',
};

export const BLUR_TOKENS = {
  glass: '18px',
  modal: '22px',
  overlay: '28px',
};

export const ELEVATION_TOKENS = {
  surface: COLOR_TOKENS.surface,
  panel: COLOR_TOKENS.panel,
  panelSoft: COLOR_TOKENS.panelSoft,
};

export const MOTION_TIMING_TOKENS = {
  instant: 0.01,
  micro: 0.14,
  fast: 0.2,
  base: 0.32,
  slow: 0.48,
  hero: 0.72,
  cinematic: 1.05,
};

export function withAlpha(color, alphaHex = '20') {
  if (!color || !color.startsWith('#')) {
    return color;
  }

  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;

  return `${normalized}${alphaHex}`;
}

