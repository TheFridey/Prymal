import { BRAND_ICONS } from '../lib/integrationLogoBrands';
import { REACT_MARKS } from '../lib/integrationLogoReactMarks';

/** Light solid chip behind glyphs so Simple Icons/React icons stay legible on dark Prymal shells. */
const BADGE_SURFACE = '#D8DEE9';
const BADGE_OUTLINE = 'rgba(255, 255, 255, 0.2)';

export function getIntegrationLogoPresentation(service, fallbackColor = '#4CC9F0') {
  const fromSi = BRAND_ICONS[service];
  if (fromSi) {
    return {
      badgeBackground: BADGE_SURFACE,
      badgeBorder: BADGE_OUTLINE,
      iconColor: `#${fromSi.hex}`,
    };
  }

  const fromReact = REACT_MARKS[service];
  if (fromReact) {
    return {
      badgeBackground: BADGE_SURFACE,
      badgeBorder: BADGE_OUTLINE,
      iconColor: `#${fromReact.hex}`,
    };
  }

  return {
    badgeBackground: BADGE_SURFACE,
    badgeBorder: BADGE_OUTLINE,
    iconColor: fallbackColor,
  };
}

export default function IntegrationLogo({ service, size = 22, color = 'currentColor', title = '', className = '' }) {
  const si = BRAND_ICONS[service];
  const rk = REACT_MARKS[service];

  if (si) {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="currentColor"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
        style={{ color }}
      >
        {title ? <title>{title}</title> : null}
        <path d={si.path} fill="currentColor" />
      </svg>
    );
  }

  if (rk) {
    const { Icon } = rk;
    return (
      <Icon className={className} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : 'presentation'} size={Math.round(size * 0.95)} color={color} title={title} />
    );
  }

  const Fallback = REACT_MARKS.custom_webhook.Icon;
  return (
    <Fallback className={className} aria-hidden={title ? undefined : 'true'} role={title ? 'img' : 'presentation'} size={Math.round(size * 0.95)} color={color} title={title} />
  );
}
