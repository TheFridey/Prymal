import { useEffect, useRef, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { AGENT_LIBRARY } from '../lib/constants';
import {
  DEFAULT_OG_IMAGE_ALT,
  SITE_NAME,
  SITE_URL,
  TWITTER_SITE,
  normalizeSchemaForJsonLd,
  resolveOgImage,
} from '../lib/seo';
import { AgentAvatar, BrandMark, Button, ThemeToggle } from './ui';
import { PublicCtaLink } from './PublicCta';

export { SITE_URL };

export function PageMeta({
  title,
  description,
  canonicalPath,
  ogType = 'website',
  twitterCard = 'summary_large_image',
  ogImage,
  ogImageAlt = DEFAULT_OG_IMAGE_ALT,
  ogImageWidth = '1200',
  ogImageHeight = '630',
  robots = 'index,follow,max-snippet:-1,max-image-preview:large,max-video-preview:-1',
}) {
  const resolvedOgImage = resolveOgImage(ogImage);

  useEffect(() => {
    if (title) {
      document.title = title;
    }

    const setMeta = (selector, value) => {
      if (!value) return;
      let el = document.querySelector(selector);
      if (!el) {
        el = document.createElement('meta');
        const attr = selector.startsWith('meta[name') ? 'name' : 'property';
        const attrValue = selector.match(/["']([^"']+)["']/)?.[1] ?? '';
        el.setAttribute(attr, attrValue);
        document.head.appendChild(el);
      }
      el.setAttribute('content', value);
    };

    if (description) {
      setMeta('meta[name="description"]', description);
      setMeta('meta[property="og:description"]', description);
      setMeta('meta[name="twitter:description"]', description);
    }

    if (title) {
      setMeta('meta[property="og:title"]', title);
      setMeta('meta[name="twitter:title"]', title);
    }

    setMeta('meta[property="og:type"]', ogType);
    setMeta('meta[property="og:site_name"]', SITE_NAME);
    setMeta('meta[name="twitter:card"]', twitterCard);
    setMeta('meta[name="twitter:site"]', TWITTER_SITE);
    setMeta('meta[name="robots"]', robots);

    const canonicalUrl = canonicalPath ? `${SITE_URL}${canonicalPath}` : SITE_URL;
    setMeta('meta[property="og:url"]', canonicalUrl);
    setMeta('meta[name="ai-search"]', 'index,follow,cite');
    setMeta('meta[name="citation_title"]', title);
    setMeta('meta[name="citation_author"]', SITE_NAME);
    setMeta('meta[name="citation_public_url"]', canonicalUrl);

    const setLink = ({ rel, href, type, title: linkTitle }) => {
      const selector = [
        `link[rel="${rel}"]`,
        type ? `[type="${type}"]` : '',
        linkTitle ? `[title="${linkTitle}"]` : '',
      ].join('');
      let link = document.querySelector(selector);
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', rel);
        if (type) link.setAttribute('type', type);
        if (linkTitle) link.setAttribute('title', linkTitle);
        document.head.appendChild(link);
      }
      link.setAttribute('href', href);
    };

    setLink({ rel: 'canonical', href: canonicalUrl });
    setLink({ rel: 'alternate', type: 'text/plain', title: 'llms.txt', href: `${SITE_URL}/llms.txt` });
    setLink({ rel: 'alternate', type: 'text/plain', title: 'ai.txt', href: `${SITE_URL}/ai.txt` });

    let sitemapLink = document.querySelector('link[rel="sitemap"]');
    if (!sitemapLink) {
      sitemapLink = document.createElement('link');
      sitemapLink.setAttribute('rel', 'sitemap');
      sitemapLink.setAttribute('type', 'application/xml');
      document.head.appendChild(sitemapLink);
    }
    sitemapLink.setAttribute('href', `${SITE_URL}/sitemap.xml`);

    setMeta('meta[property="og:image"]', resolvedOgImage);
    setMeta('meta[name="twitter:image"]', resolvedOgImage);
    setMeta('meta[property="og:image:width"]', String(ogImageWidth));
    setMeta('meta[property="og:image:height"]', String(ogImageHeight));
    setMeta('meta[property="og:image:alt"]', ogImageAlt);
    setMeta('meta[name="twitter:image:alt"]', ogImageAlt);

    return () => {
      document.title = `${SITE_NAME} | AI operating system for business execution`;
    };
  }, [
    title,
    description,
    canonicalPath,
    ogType,
    twitterCard,
    resolvedOgImage,
    ogImageAlt,
    ogImageWidth,
    ogImageHeight,
    robots,
  ]);

  return null;
}

export function JsonLd({ id, schema }) {
  useEffect(() => {
    const normalizedSchema = normalizeSchemaForJsonLd(schema);
    document.getElementById(id)?.remove();
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(normalizedSchema);
    document.head.appendChild(script);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [id, schema]);

  return null;
}

export const SchemaJsonLd = JsonLd;

function buildSignupSource(prefix, slot) {
  return prefix ? `${prefix}-${slot}` : slot;
}

export function PublicPageNavbar({ sourcePrefix = '', onSignupClick = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const [mobileAgentsOpen, setMobileAgentsOpen] = useState(false);
  const { pathname } = useLocation();
  const menuButtonRef = useRef(null);
  const drawerRef = useRef(null);
  const desktopAgentsPanelId = 'public-nav-agents-panel';
  const mobileAgentsPanelId = 'public-nav-mobile-agents-panel';

  const fireSignup = (slot) => onSignupClick(buildSignupSource(sourcePrefix, slot));
  const closeMenu = () => {
    setMenuOpen(false);
    setMobileAgentsOpen(false);
  };

  useEffect(() => {
    setMenuOpen(false);
    setMobileAgentsOpen(false);
  }, [pathname]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = prev;
    };
  }, [menuOpen]);

  useEffect(() => {
    if (!menuOpen) {
      return undefined;
    }

    const focusableSelector = [
      'a[href]',
      'button:not([disabled])',
      'input:not([disabled])',
      'select:not([disabled])',
      'textarea:not([disabled])',
      '[tabindex]:not([tabindex="-1"])',
    ].join(',');
    const drawer = drawerRef.current;
    const focusable = drawer ? [...drawer.querySelectorAll(focusableSelector)] : [];
    focusable[0]?.focus();

    const handleKeyDown = (event) => {
      if (event.key === 'Escape') {
        closeMenu();
        menuButtonRef.current?.focus();
        return;
      }

      if (event.key !== 'Tab' || focusable.length === 0) {
        return;
      }

      const first = focusable[0];
      const last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [menuOpen]);

  return (
    <header className={`prymal-nav-wrap${menuOpen ? ' prymal-nav-wrap--drawer-open' : ''}`}>
      <div className="prymal-nav-wrap__ambient" aria-hidden="true">
        <span className="prymal-nav-wrap__ambient-orb prymal-nav-wrap__ambient-orb--one" />
        <span className="prymal-nav-wrap__ambient-orb prymal-nav-wrap__ambient-orb--two" />
      </div>
      <div className="marketing-nav prymal-nav">
        <Link to="/" onClick={closeMenu} className="prymal-nav__brand-link">
          <BrandMark compact />
        </Link>

        <nav className="marketing-nav__links prymal-nav__links marketing-nav__desktop-only" aria-label="Primary">
          <Link className={`marketing-link${pathname.startsWith('/features') ? ' is-active' : ''}`} to="/features" aria-current={pathname.startsWith('/features') ? 'page' : undefined}>
            Features
          </Link>
          <Link className={`marketing-link${pathname.startsWith('/blog') ? ' is-active' : ''}`} to="/blog" aria-current={pathname.startsWith('/blog') ? 'page' : undefined}>
            Blog
          </Link>
          <Link className={`marketing-link${pathname.startsWith('/compare') ? ' is-active' : ''}`} to="/compare" aria-current={pathname.startsWith('/compare') ? 'page' : undefined}>
            Compare
          </Link>
          <Link className={`marketing-link${pathname === '/pricing' ? ' is-active' : ''}`} to="/pricing" aria-current={pathname === '/pricing' ? 'page' : undefined}>
            Pricing
          </Link>
          <Link className={`marketing-link${pathname === '/trust' ? ' is-active' : ''}`} to="/trust" aria-current={pathname === '/trust' ? 'page' : undefined}>
            Trust Centre
          </Link>
          <Link className={`marketing-link${pathname === '/changelog' ? ' is-active' : ''}`} to="/changelog" aria-current={pathname === '/changelog' ? 'page' : undefined}>
            Changelog
          </Link>
          <div
            className="dropdown"
            onMouseEnter={() => setAgentsOpen(true)}
            onMouseLeave={() => setAgentsOpen(false)}
            onFocus={() => setAgentsOpen(true)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setAgentsOpen(false);
              }
            }}
          >
            <button
              type="button"
              className="marketing-link prymal-nav__trigger"
              aria-expanded={agentsOpen}
              aria-controls={desktopAgentsPanelId}
              aria-haspopup="true"
              onClick={() => setAgentsOpen((current) => !current)}
            >
              Explore agents
            </button>
            {agentsOpen ? (
              <div id={desktopAgentsPanelId} className="dropdown__panel prymal-dropdown" aria-label="Featured agents">
                {AGENT_LIBRARY.slice(0, 6).map((agent) => (
                  <Link key={agent.id} to={`/agents/${agent.id}`} className="dropdown__item prymal-dropdown__item">
                    <AgentAvatar agent={agent} size={42} className="dropdown__glyph" />
                    <div>
                      <div className="dropdown__title">{agent.name}</div>
                      <div className="dropdown__description">{agent.title}</div>
                    </div>
                  </Link>
                ))}
              </div>
            ) : null}
          </div>
        </nav>

        <div className="marketing-nav__actions prymal-nav__actions marketing-nav__desktop-only">
          <ThemeToggle />
          <SignedOut>
            <Link className="marketing-link" to="/login">Login</Link>
            <PublicCtaLink
              to="/signup"
              cta="signup"
              surface={buildSignupSource(sourcePrefix, 'nav')}
              intent="convert"
              onClick={() => fireSignup('nav')}
            >
              <Button tone="accent">Start free</Button>
            </PublicCtaLink>
          </SignedOut>
          <SignedIn>
            <PublicCtaLink
              to="/app/dashboard"
              cta="open-workspace"
              surface={buildSignupSource(sourcePrefix, 'nav')}
              intent="retain"
            >
              <Button tone="accent">Open workspace</Button>
            </PublicCtaLink>
          </SignedIn>
        </div>

        <button
          ref={menuButtonRef}
          type="button"
          className={`burger marketing-nav__burger${menuOpen ? ' is-open' : ''}`}
          onClick={() => setMenuOpen((current) => !current)}
          aria-expanded={menuOpen}
          aria-controls="marketing-nav-drawer"
          aria-label={menuOpen ? 'Close navigation menu' : 'Open navigation menu'}
        >
          <span />
        </button>
      </div>

      {menuOpen ? (
        <>
          <button
            type="button"
            className="marketing-nav__backdrop"
            aria-label="Close menu"
            onClick={closeMenu}
          />
          <div
            id="marketing-nav-drawer"
            ref={drawerRef}
            className="marketing-nav__drawer"
            role="dialog"
            aria-modal="true"
            aria-label="Site navigation"
          >
            <div className="marketing-nav__drawer-top">
              <Link to="/" onClick={closeMenu} className="marketing-nav__drawer-brand">
                <BrandMark compact />
              </Link>
              <button
                type="button"
                className="marketing-nav__drawer-close"
                onClick={closeMenu}
                aria-label="Close menu"
              >
                <span aria-hidden="true">×</span>
              </button>
            </div>

            <div className="marketing-nav__drawer-scroll">
              <Link className={`marketing-nav__drawer-link${pathname.startsWith('/features') ? ' is-active' : ''}`} to="/features" onClick={closeMenu} aria-current={pathname.startsWith('/features') ? 'page' : undefined}>
                Features
              </Link>
              <Link className={`marketing-nav__drawer-link${pathname.startsWith('/blog') ? ' is-active' : ''}`} to="/blog" onClick={closeMenu} aria-current={pathname.startsWith('/blog') ? 'page' : undefined}>
                Blog
              </Link>
              <Link className={`marketing-nav__drawer-link${pathname.startsWith('/compare') ? ' is-active' : ''}`} to="/compare" onClick={closeMenu} aria-current={pathname.startsWith('/compare') ? 'page' : undefined}>
                Compare
              </Link>
              <Link
                className={`marketing-nav__drawer-link${pathname === '/pricing' ? ' is-active' : ''}`}
                to="/pricing"
                onClick={closeMenu}
                aria-current={pathname === '/pricing' ? 'page' : undefined}
              >
                Pricing
              </Link>
              <Link
                className={`marketing-nav__drawer-link${pathname === '/trust' ? ' is-active' : ''}`}
                to="/trust"
                onClick={closeMenu}
                aria-current={pathname === '/trust' ? 'page' : undefined}
              >
                Trust Centre
              </Link>
              <Link
                className={`marketing-nav__drawer-link${pathname === '/changelog' ? ' is-active' : ''}`}
                to="/changelog"
                onClick={closeMenu}
                aria-current={pathname === '/changelog' ? 'page' : undefined}
              >
                Changelog
              </Link>

              <div className="marketing-nav__drawer-section">
                <button
                  type="button"
                  className="marketing-nav__drawer-disclosure"
                  aria-expanded={mobileAgentsOpen}
                  aria-controls={mobileAgentsPanelId}
                  onClick={() => setMobileAgentsOpen((v) => !v)}
                >
                  <span>Explore agents</span>
                  <span className="marketing-nav__drawer-chevron" aria-hidden="true">
                    {mobileAgentsOpen ? '▾' : '▸'}
                  </span>
                </button>
                {mobileAgentsOpen ? (
                  <div id={mobileAgentsPanelId} className="marketing-nav__drawer-agents">
                    {AGENT_LIBRARY.slice(0, 8).map((agent) => (
                      <Link
                        key={agent.id}
                        to={`/agents/${agent.id}`}
                        className="marketing-nav__drawer-agent"
                        onClick={closeMenu}
                      >
                        <AgentAvatar agent={agent} size={36} className="dropdown__glyph" />
                        <span>
                          <strong>{agent.name}</strong>
                          <small>{agent.title}</small>
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : null}
              </div>
            </div>

            <div className="marketing-nav__drawer-footer">
              <div className="marketing-nav__drawer-theme">
                <span className="marketing-nav__drawer-theme-label">Theme</span>
                <ThemeToggle />
              </div>
              <SignedOut>
                <Link className="marketing-nav__drawer-secondary" to="/login" onClick={closeMenu}>
                  Log in
                </Link>
                <PublicCtaLink
                  to="/signup"
                  cta="signup"
                  surface={buildSignupSource(sourcePrefix, 'menu')}
                  intent="convert"
                  onClick={() => {
                    fireSignup('menu');
                    closeMenu();
                  }}
                  className="marketing-nav__drawer-cta"
                >
                  <Button tone="accent">Get early access</Button>
                </PublicCtaLink>
              </SignedOut>
              <SignedIn>
                <PublicCtaLink
                  to="/app/dashboard"
                  cta="open-workspace"
                  surface={buildSignupSource(sourcePrefix, 'menu')}
                  intent="retain"
                  onClick={closeMenu}
                  className="marketing-nav__drawer-cta"
                >
                  <Button tone="accent">Open workspace</Button>
                </PublicCtaLink>
              </SignedIn>
            </div>
          </div>
        </>
      ) : null}
    </header>
  );
}

export function PublicPageFooter({ sourcePrefix = '', onSignupClick = () => {} }) {
  const fireSignup = (slot) => onSignupClick(buildSignupSource(sourcePrefix, slot));

  return (
    <footer className="prymal-footer">
      <div className="prymal-footer__ambient" aria-hidden="true" />
      <div className="prymal-footer__brand">
        <BrandMark />
        <p className="prymal-footer__copy">
          Prymal is an AI operating system for business execution, built around specialist agents, shared business memory, workflow automation, and safety controls.
        </p>
      </div>
      <div className="prymal-footer__links">
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Explore</span>
          <Link to="/features">Features</Link>
          <Link to="/ai-operating-system-for-business">AI operating system</Link>
          <Link to="/what-is">What Is hub</Link>
          <Link to="/ai-agent-orchestration">Agent orchestration</Link>
          <Link to="/use-cases">Use cases</Link>
          <Link to="/content/entities">Entity graph</Link>
          <Link to="/content/industries">Industries</Link>
          <Link to="/content/blog">Content blog</Link>
          <Link to="/blog">Blog</Link>
          <Link to="/compare">Compare</Link>
        </div>
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Product</span>
          <Link to="/trust">Trust Centre</Link>
          <Link to="/architecture">Architecture</Link>
          <Link to="/glossary">Glossary</Link>
          <Link to="/pricing">Pricing</Link>
          <Link to="/changelog">Changelog</Link>
          <PublicCtaLink
            to="/signup"
            cta="signup"
            surface={buildSignupSource(sourcePrefix, 'footer')}
            intent="convert"
            onClick={() => fireSignup('footer')}
          >
            Get early access
          </PublicCtaLink>
        </div>
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Legal</span>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/cookies">Cookie Policy</Link>
          <Link to="/for-agencies">For agencies</Link>
          <Link to="/for-small-business">For small business</Link>
        </div>
      </div>
    </footer>
  );
}
