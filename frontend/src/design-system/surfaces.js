import {
  BLUR_TOKENS,
  COLOR_TOKENS,
  RADIUS_TOKENS,
  SHADOW_TOKENS,
  SPACING_TOKENS,
  TYPOGRAPHY_TOKENS,
  withAlpha,
} from './tokens';

export function createSurfaceAccentVars(accent) {
  return {
    '--card-accent': accent ?? COLOR_TOKENS.lineSoft,
  };
}

export function createStatusPillVars(color = COLOR_TOKENS.accent) {
  return {
    '--status-pill-color': color,
  };
}

export function createInlineNoticePalette(tone = 'default') {
  const toneMap = {
    default: {
      borderColor: COLOR_TOKENS.line,
      color: COLOR_TOKENS.muted,
      background: COLOR_TOKENS.panelSoft,
    },
    success: {
      borderColor: 'rgba(34, 197, 94, 0.24)',
      color: COLOR_TOKENS.success,
      background: COLOR_TOKENS.successSurface,
    },
    warning: {
      borderColor: 'rgba(245, 158, 11, 0.24)',
      color: COLOR_TOKENS.warning,
      background: COLOR_TOKENS.warningSurface,
    },
    danger: {
      borderColor: 'rgba(239, 68, 68, 0.24)',
      color: COLOR_TOKENS.danger,
      background: COLOR_TOKENS.dangerSurface,
    },
  };

  return toneMap[tone] ?? toneMap.default;
}

export function createGlassPanelStyle({
  accent = COLOR_TOKENS.accent,
  padding = SPACING_TOKENS.lg,
  radius = RADIUS_TOKENS.lg,
  elevated = false,
} = {}) {
  return {
    padding,
    borderRadius: radius,
    border: `1px solid color-mix(in srgb, ${accent} 12%, ${COLOR_TOKENS.line})`,
    background: `linear-gradient(180deg, color-mix(in srgb, ${accent} 8%, transparent), rgba(255,255,255,0.03))`,
    boxShadow: elevated ? SHADOW_TOKENS.elevated : undefined,
  };
}

export function createLabeledRowStyle({ accent = COLOR_TOKENS.line } = {}) {
  return {
    display: 'flex',
    justifyContent: 'space-between',
    gap: '12px',
    flexWrap: 'wrap',
    paddingBottom: SPACING_TOKENS.md,
    borderBottom: `1px solid color-mix(in srgb, ${accent} 18%, ${COLOR_TOKENS.line})`,
  };
}

export function createCapsuleStyle({ accent = COLOR_TOKENS.accent, subtle = false } = {}) {
  return {
    padding: '4px 10px',
    borderRadius: RADIUS_TOKENS.pill,
    border: `1px solid color-mix(in srgb, ${accent} 20%, ${COLOR_TOKENS.line})`,
    background: subtle
      ? `color-mix(in srgb, ${accent} 8%, transparent)`
      : `color-mix(in srgb, ${accent} 12%, rgba(255, 255, 255, 0.04))`,
    color: accent,
    fontSize: '11px',
    letterSpacing: '0.08em',
    textTransform: 'uppercase',
  };
}

export function createCommandPaletteBackdropStyle() {
  return {
    position: 'fixed',
    inset: 0,
    zIndex: 9999,
    background: 'rgba(10, 15, 31, 0.58)',
    backdropFilter: `blur(${BLUR_TOKENS.overlay})`,
    padding: '8vh 16px 24px',
    display: 'flex',
    justifyContent: 'center',
    alignItems: 'flex-start',
  };
}

export function createCommandPaletteDialogStyle() {
  return {
    width: 'min(720px, 100%)',
    borderRadius: RADIUS_TOKENS.xxl,
    border: '1px solid color-mix(in srgb, var(--line) 82%, white 8%)',
    background:
      'linear-gradient(180deg, color-mix(in srgb, var(--panel) 96%, white 4%), color-mix(in srgb, var(--surface) 92%, transparent 8%))',
    boxShadow: '0 36px 120px rgba(6, 10, 24, 0.36)',
    overflow: 'hidden',
  };
}

export function createCommandPaletteKindStyle(accent) {
  return {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    minWidth: '52px',
    padding: '5px 10px',
    borderRadius: RADIUS_TOKENS.pill,
    background: accent ? withAlpha(accent, '18') : 'rgba(255,255,255,0.06)',
    color: accent ?? COLOR_TOKENS.muted,
    fontSize: '0.68rem',
    letterSpacing: '0.14em',
    textTransform: 'uppercase',
    fontWeight: 700,
  };
}

export function createCommandPaletteActionStyle(active) {
  return {
    display: 'grid',
    gridTemplateColumns: 'auto 1fr auto',
    alignItems: 'center',
    gap: '12px',
    width: '100%',
    padding: '12px 14px',
    borderRadius: RADIUS_TOKENS.lg,
    border: active
      ? '1px solid color-mix(in srgb, var(--accent) 36%, var(--line))'
      : '1px solid transparent',
    background: active
      ? 'color-mix(in srgb, var(--panel-soft) 84%, var(--accent) 6%)'
      : 'transparent',
    color: COLOR_TOKENS.textStrong,
    cursor: 'pointer',
    textAlign: 'left',
  };
}

export const FORM_LABEL_STYLE = TYPOGRAPHY_TOKENS.monoLabel;
export const MUTED_COPY_STYLE = TYPOGRAPHY_TOKENS.caption;
