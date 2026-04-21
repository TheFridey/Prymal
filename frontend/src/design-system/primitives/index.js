import { COLOR_TOKENS, RADIUS_TOKENS, SPACING_TOKENS, withAlpha } from '../tokens/index.js';

export function createExplainabilityChipStyle({
  accent = COLOR_TOKENS.muted,
  subtle = false,
} = {}) {
  const tint = String(accent).startsWith('#')
    ? withAlpha(accent, subtle ? '16' : '20')
    : `color-mix(in srgb, ${accent} ${subtle ? '16%' : '20%'}, transparent)`;
  const borderColor = subtle
    ? 'transparent'
    : String(accent).startsWith('#')
      ? withAlpha(accent, '40')
      : `color-mix(in srgb, ${accent} 36%, transparent)`;

  return {
    fontSize: '10px',
    fontWeight: 600,
    padding: '2px 8px',
    borderRadius: RADIUS_TOKENS.pill,
    border: `1px solid ${borderColor}`,
    background: tint,
    color: accent,
  };
}

export function createSignalMeterStyle(accent = COLOR_TOKENS.accent) {
  return {
    track: {
      flex: 1,
      height: '3px',
      borderRadius: '999px',
      background: COLOR_TOKENS.line,
      overflow: 'hidden',
    },
    fill: (valuePct) => ({
      width: `${valuePct}%`,
      height: '100%',
      background: accent,
      borderRadius: '999px',
      transition: 'width 0.4s ease',
    }),
  };
}

export function createExplainabilityCardStyle(accent = COLOR_TOKENS.line) {
  return {
    padding: SPACING_TOKENS.md,
    borderRadius: RADIUS_TOKENS.lg,
    border: `1px solid ${String(accent).startsWith('#') ? withAlpha(accent, '2b') : `color-mix(in srgb, ${accent} 24%, transparent)`}`,
    background: `linear-gradient(180deg, ${
      String(accent).startsWith('#') ? withAlpha(accent, '10') : `color-mix(in srgb, ${accent} 10%, transparent)`
    }, rgba(255,255,255,0.03))`,
  };
}

export function createStickyToolbarStyle() {
  return {
    position: 'sticky',
    top: '12px',
    zIndex: 3,
    padding: `${SPACING_TOKENS.md} ${SPACING_TOKENS.lg}`,
    borderRadius: RADIUS_TOKENS.xl,
    border: `1px solid ${withAlpha('#ffffff', '10')}`,
    backdropFilter: 'blur(18px) saturate(150%)',
    background: 'color-mix(in srgb, var(--surface) 86%, transparent)',
  };
}
