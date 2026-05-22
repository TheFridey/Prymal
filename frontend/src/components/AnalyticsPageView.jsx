import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';
import { isPublicMarketingRoute, resolvePublicPageName, trackPublicPageView } from '../lib/analytics';

export function AnalyticsPageView() {
  const location = useLocation();

  useEffect(() => {
    if (!isPublicMarketingRoute(location.pathname)) {
      return;
    }

    trackPublicPageView({
      page: resolvePublicPageName(location.pathname),
      route: location.pathname,
    });
  }, [location.pathname]);

  return null;
}
