import {
  siBox,
  siDiscord,
  siDropbox,
  siMastodon,
  siNotion,
  siTelegram,
  siX,
} from 'simple-icons';

const SIMPLE_ICON_MAP = {
  dropbox: siDropbox,
  box: siBox,
  notion: siNotion,
  discord: siDiscord,
  telegram: siTelegram,
  x: siX,
  mastodon: siMastodon,
};

export function getIntegrationLogoPresentation(service, fallbackColor = '#4CC9F0') {
  if (service === 'x') {
    return {
      badgeBackground: '#F8FAFC',
      badgeBorder: 'rgba(255,255,255,0.18)',
      iconColor: '#111111',
    };
  }

  if (service === 'notion') {
    return {
      badgeBackground: '#FFFFFF',
      badgeBorder: 'rgba(255,255,255,0.18)',
      iconColor: '#111111',
    };
  }

  if (service === 'linkedin') {
    return {
      badgeBackground: '#0A66C2',
      badgeBorder: '#0A66C2',
      iconColor: '#FFFFFF',
    };
  }

  if (service === 'slack') {
    return {
      badgeBackground: 'rgba(255,255,255,0.08)',
      badgeBorder: 'rgba(255,255,255,0.12)',
      iconColor: null,
    };
  }

  return {
    badgeBackground: `color-mix(in srgb, ${fallbackColor} 12%, transparent)`,
    badgeBorder: `color-mix(in srgb, ${fallbackColor} 26%, transparent)`,
    iconColor: fallbackColor,
  };
}

export default function IntegrationLogo({
  service,
  size = 20,
  color = 'currentColor',
  title = '',
  className = '',
}) {
  const icon = SIMPLE_ICON_MAP[service];

  if (icon) {
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
        <path d={icon.path} />
      </svg>
    );
  }

  if (service === 'gmail') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M3.75 6.5 12 12.75 20.25 6.5" stroke="#EA4335" strokeWidth="2.1" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M4 7.2V17.5H7.1V10.05L12 13.72 16.9 10.05V17.5H20V7.2" stroke="#34A853" strokeWidth="2.1" strokeLinejoin="round" />
        <path d="M4 17.5V7.2L7.6 9.95V17.5H4Z" fill="#4285F4" />
        <path d="M20 17.5V7.2L16.4 9.95V17.5H20Z" fill="#FBBC04" />
      </svg>
    );
  }

  if (service === 'google_drive') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M8.55 3.3h6.9l5.6 9.65-3.45 5.98H6.4L2.95 12.95 8.55 3.3Z" fill="#FFFFFF" opacity=".02" />
        <path d="M8.55 3.3 2.95 12.95h4.2l5.6-9.65h-4.2Z" fill="#34A853" />
        <path d="m12.75 3.3 5.6 9.65h4.2l-5.6-9.65h-4.2Z" fill="#FBBC04" />
        <path d="M7.15 12.95 10.6 18.93H17.6l-3.45-5.98H7.15Z" fill="#4285F4" />
      </svg>
    );
  }

  if (service === 'slack') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M9.18 3.4a2.05 2.05 0 1 0-4.1 0v5.14a2.05 2.05 0 0 0 4.1 0V3.4Z" fill="#36C5F0" />
        <path d="M9.18 10.12a2.05 2.05 0 0 0 0-4.1H4.04a2.05 2.05 0 0 0 0 4.1h5.14Z" fill="#36C5F0" />
        <path d="M20.6 9.18a2.05 2.05 0 1 0 0-4.1h-5.14a2.05 2.05 0 1 0 0 4.1h5.14Z" fill="#2EB67D" />
        <path d="M13.88 9.18a2.05 2.05 0 0 0 4.1 0V4.04a2.05 2.05 0 1 0-4.1 0v5.14Z" fill="#2EB67D" />
        <path d="M14.82 20.6a2.05 2.05 0 1 0 4.1 0v-5.14a2.05 2.05 0 0 0-4.1 0v5.14Z" fill="#ECB22E" />
        <path d="M14.82 13.88a2.05 2.05 0 0 0 0 4.1h5.14a2.05 2.05 0 1 0 0-4.1h-5.14Z" fill="#ECB22E" />
        <path d="M3.4 14.82a2.05 2.05 0 1 0 0 4.1h5.14a2.05 2.05 0 0 0 0-4.1H3.4Z" fill="#E01E5A" />
        <path d="M10.12 14.82a2.05 2.05 0 1 0-4.1 0v5.14a2.05 2.05 0 1 0 4.1 0v-5.14Z" fill="#E01E5A" />
      </svg>
    );
  }

  if (service === 'linkedin') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M7.1 9.15H4.8V19h2.3V9.15Zm-1.15-1.3a1.34 1.34 0 1 0 0-2.68 1.34 1.34 0 0 0 0 2.68Zm3.3 1.3V19h2.3v-4.88c0-1.3.25-2.55 1.86-2.55 1.58 0 1.6 1.48 1.6 2.64V19H17.3v-5.28c0-2.6-.56-4.6-3.6-4.6-1.46 0-2.43.8-2.82 1.56h-.03v-1.53h-2.2Z" fill={color} />
      </svg>
    );
  }

  if (service === 'outlook') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M10.1 5.5H19.1A1.9 1.9 0 0 1 21 7.4v9.2a1.9 1.9 0 0 1-1.9 1.9H10.1" stroke="#0078D4" strokeWidth="1.7" strokeLinejoin="round" />
        <path d="m10.1 8.1 4.45 3.08 4.5-3.08" stroke="#1490FF" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round" />
        <path d="M3.2 12c0-2.97 2.08-5.05 4.9-5.05S13 9.03 13 12s-2.07 5.05-4.9 5.05S3.2 14.97 3.2 12Zm4.9 2.8c1.43 0 2.35-1.15 2.35-2.8 0-1.66-.92-2.8-2.35-2.8-1.46 0-2.38 1.14-2.38 2.8 0 1.65.92 2.8 2.38 2.8Z" fill="#005FB8" />
      </svg>
    );
  }

  if (service === 'onedrive') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
      >
        {title ? <title>{title}</title> : null}
        <path d="M10.95 7.15a5.42 5.42 0 0 1 4.86 2.98 4.48 4.48 0 0 1 1.03-.12A4.16 4.16 0 0 1 21 14.16 3.84 3.84 0 0 1 17.16 18H7.34A4.34 4.34 0 0 1 7.1 9.34a5.25 5.25 0 0 1 3.85-2.2Z" fill="#0078D4" />
        <path d="M11.02 8.2a4.35 4.35 0 0 1 3.86 2.47 3.98 3.98 0 0 1 1.65-.35 3.26 3.26 0 0 1 3.22 3.13A3.1 3.1 0 0 1 16.66 16H8.15a3.52 3.52 0 0 1-.15-7.03 4.2 4.2 0 0 1 3.02-.77Z" fill="#1490FF" />
      </svg>
    );
  }

  if (service === 'custom_webhook') {
    return (
      <svg
        viewBox="0 0 24 24"
        width={size}
        height={size}
        fill="none"
        aria-hidden={title ? undefined : 'true'}
        role={title ? 'img' : 'presentation'}
        className={className}
        style={{ color }}
      >
        {title ? <title>{title}</title> : null}
        <path
          d="M7.5 7.5A3.5 3.5 0 1 1 11 11h-2.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path
          d="M16.5 16.5A3.5 3.5 0 1 1 13 13h2.5"
          stroke="currentColor"
          strokeWidth="1.9"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <path d="M10 14 14 10" stroke="currentColor" strokeWidth="1.9" strokeLinecap="round" />
      </svg>
    );
  }

  return (
    <svg
      viewBox="0 0 24 24"
      width={size}
      height={size}
      fill="none"
      aria-hidden={title ? undefined : 'true'}
      role={title ? 'img' : 'presentation'}
      className={className}
      style={{ color }}
    >
      {title ? <title>{title}</title> : null}
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="1.8" />
      <path d="M8 12h8M12 8v8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </svg>
  );
}
