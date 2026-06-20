import { useEffect } from 'react';
import { useLocation } from 'react-router-dom';

function resolvePublicPageName(pathname) {
  if (!pathname || pathname === '/') return 'landing';
  if (pathname.startsWith('/pricing')) return 'pricing';
  if (pathname.startsWith('/blog/')) return 'blog_post';
  if (pathname.startsWith('/blog')) return 'blog';
  if (pathname.startsWith('/signup')) return 'signup';
  if (pathname.startsWith('/login')) return 'login';
  if (pathname.startsWith('/features/')) return 'feature';
  if (pathname.startsWith('/features')) return 'features';
  if (pathname.startsWith('/compare/')) return 'compare_detail';
  if (pathname.startsWith('/compare')) return 'compare';
  if (pathname.startsWith('/for-agencies')) return 'for_agencies';
  if (pathname.startsWith('/for-small-business')) return 'for_small_business';
  if (pathname.startsWith('/changelog')) return 'changelog';
  if (pathname.startsWith('/trust')) return 'trust';
  if (pathname.startsWith('/agents/')) return 'agent_profile';
  if (pathname.startsWith('/privacy')) return 'privacy';
  if (pathname.startsWith('/terms')) return 'terms';
  if (pathname.startsWith('/cookies')) return 'cookies';
  return 'other';
}

function isPublicMarketingRoute(pathname) {
  return (
    pathname === '/'
    || pathname.startsWith('/pricing')
    || pathname.startsWith('/blog')
    || pathname.startsWith('/features')
    || pathname.startsWith('/compare')
    || pathname.startsWith('/for-agencies')
    || pathname.startsWith('/for-small-business')
    || pathname.startsWith('/changelog')
    || pathname.startsWith('/trust')
    || pathname.startsWith('/agents/')
    || pathname.startsWith('/privacy')
    || pathname.startsWith('/terms')
    || pathname.startsWith('/cookies')
    || pathname.startsWith('/signup')
    || pathname.startsWith('/login')
  );
}

function trackPublicPageView(metadata) {
  if (typeof window === 'undefined' || typeof window.prymalTrack !== 'function') {
    return;
  }

  try {
    window.prymalTrack('public_page_view', metadata);
  } catch {
    // Analytics should never block navigation or rendering.
  }
}

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
