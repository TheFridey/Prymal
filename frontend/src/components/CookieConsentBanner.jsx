import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const CONSENT_KEY = 'cookie_consent';

export function useCookieConsent() {
  const [consented, setConsented] = useState(() => {
    try {
      return localStorage.getItem(CONSENT_KEY) === 'true';
    } catch {
      return false;
    }
  });

  const accept = () => {
    try {
      localStorage.setItem(CONSENT_KEY, 'true');
    } catch {
      // Storage unavailable — treat as accepted for this session
    }
    setConsented(true);
  };

  return { consented, accept };
}

export default function CookieConsentBanner() {
  const { consented, accept } = useCookieConsent();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (!consented) {
      // Small delay so the banner doesn't flash on first paint
      const timer = setTimeout(() => setVisible(true), 800);
      return () => clearTimeout(timer);
    }
    return undefined;
  }, [consented]);

  if (consented || !visible) {
    return null;
  }

  return (
    <div className="cookie-banner" role="region" aria-label="Cookie consent">
      <p className="cookie-banner__text">
        We use essential cookies for authentication.{' '}
        <Link to="/cookies" className="cookie-banner__link">Cookie Policy</Link>
      </p>
      <button
        type="button"
        className="cookie-banner__accept"
        onClick={accept}
        aria-label="Accept essential cookies"
      >
        Accept
      </button>
    </div>
  );
}
