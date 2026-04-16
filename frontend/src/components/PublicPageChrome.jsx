import { useEffect, useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { SignedIn, SignedOut } from '@clerk/clerk-react';
import { AGENT_LIBRARY } from '../lib/constants';
import { AgentAvatar, BrandMark, Button, ThemeToggle } from './ui';

const BASE_URL = 'https://prymal.io';

export function PageMeta({ title, description, canonicalPath }) {
  useEffect(() => {
    if (title) {
      document.title = title;
    }

    const setMeta = (selector, value) => {
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

    if (canonicalPath) {
      const canonicalUrl = `${BASE_URL}${canonicalPath}`;
      setMeta('meta[property="og:url"]', canonicalUrl);

      let link = document.querySelector('link[rel="canonical"]');
      if (!link) {
        link = document.createElement('link');
        link.setAttribute('rel', 'canonical');
        document.head.appendChild(link);
      }
      link.setAttribute('href', canonicalUrl);
    }

    return () => {
      // Restore defaults on unmount
      document.title = 'Prymal | AI-Powered Team';
    };
  }, [title, description, canonicalPath]);

  return null;
}

export function JsonLd({ id, schema }) {
  useEffect(() => {
    const script = document.createElement('script');
    script.type = 'application/ld+json';
    script.id = id;
    script.textContent = JSON.stringify(schema);
    document.head.appendChild(script);
    return () => {
      document.getElementById(id)?.remove();
    };
  }, [id, schema]);

  return null;
}

function buildSignupSource(prefix, slot) {
  return prefix ? `${prefix}-${slot}` : slot;
}

export function PublicPageNavbar({ sourcePrefix = '', onSignupClick = () => {} }) {
  const [menuOpen, setMenuOpen] = useState(false);
  const [agentsOpen, setAgentsOpen] = useState(false);
  const { pathname } = useLocation();

  const fireSignup = (slot) => onSignupClick(buildSignupSource(sourcePrefix, slot));
  const closeMenu = () => setMenuOpen(false);

  return (
    <header className="prymal-nav-wrap">
      <div className="prymal-nav-wrap__ambient" aria-hidden="true">
        <span className="prymal-nav-wrap__ambient-orb prymal-nav-wrap__ambient-orb--one" />
        <span className="prymal-nav-wrap__ambient-orb prymal-nav-wrap__ambient-orb--two" />
      </div>
      <div className="marketing-nav prymal-nav">
        <Link to="/" onClick={closeMenu}>
          <BrandMark compact />
        </Link>

        <nav className="marketing-nav__links prymal-nav__links">
          <a className="marketing-link" href="/#platform">Platform</a>
          <Link className={`marketing-link${pathname === '/for-agencies' ? ' is-active' : ''}`} to="/for-agencies">
            For agencies
          </Link>
          <Link className={`marketing-link${pathname === '/for-small-business' ? ' is-active' : ''}`} to="/for-small-business">
            For small business
          </Link>
          <a className="marketing-link" href="/#agents">Agents</a>
          <a className="marketing-link" href="/#stack">Execution</a>
          <a className="marketing-link" href="/#pricing">Pricing</a>
          <div className="dropdown" onMouseEnter={() => setAgentsOpen(true)} onMouseLeave={() => setAgentsOpen(false)}>
            <button type="button" className="marketing-link prymal-nav__trigger">
              Explore agents
            </button>
            {agentsOpen ? (
              <div className="dropdown__panel prymal-dropdown">
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

        <div className="marketing-nav__actions prymal-nav__actions">
          <ThemeToggle />
          <SignedOut>
            <Link className="marketing-link" to="/login">Login</Link>
            <Link to="/signup" onClick={() => fireSignup('nav')}>
              <Button tone="accent">Start free</Button>
            </Link>
          </SignedOut>
          <SignedIn>
            <Link to="/app/dashboard"><Button tone="accent">Open workspace</Button></Link>
          </SignedIn>
          <button
            type="button"
            className={`burger${menuOpen ? ' is-open' : ''}`}
            onClick={() => setMenuOpen((current) => !current)}
            aria-label="Toggle navigation menu"
          >
            <span />
          </button>
        </div>
      </div>

      {menuOpen ? (
        <div className="slide-menu prymal-slide-menu">
          <a className="menu-link" href="/#platform" onClick={closeMenu}>Platform</a>
          <Link className="menu-link" to="/for-agencies" onClick={closeMenu}>For agencies</Link>
          <Link className="menu-link" to="/for-small-business" onClick={closeMenu}>For small business</Link>
          <a className="menu-link" href="/#agents" onClick={closeMenu}>Agents</a>
          <a className="menu-link" href="/#stack" onClick={closeMenu}>Execution</a>
          <a className="menu-link" href="/#pricing" onClick={closeMenu}>Pricing</a>
          <div className="slide-menu__section prymal-slide-menu__agents">
            {AGENT_LIBRARY.slice(0, 5).map((agent) => (
              <Link key={agent.id} className="menu-link" to={`/agents/${agent.id}`} onClick={closeMenu}>
                {agent.name} | {agent.title}
              </Link>
            ))}
          </div>
          <SignedOut>
            <Link className="menu-link" to="/signup" onClick={() => fireSignup('menu')}>Start free</Link>
          </SignedOut>
        </div>
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
          Prymal is the AI operations team for agencies, owner-led businesses, and service teams that need useful work done fast.
        </p>
      </div>
      <div className="prymal-footer__links">
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Use cases</span>
          <Link to="/for-agencies">For agencies</Link>
          <Link to="/for-small-business">For small business</Link>
          <a href="/#pricing">Pricing</a>
        </div>
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Product</span>
          <a href="/#agents">Agents</a>
          <a href="/#stack">Execution</a>
          <Link to="/signup" onClick={() => fireSignup('footer')}>Start free</Link>
        </div>
        <div className="prymal-footer__column">
          <span className="prymal-footer__label">Legal</span>
          <Link to="/privacy">Privacy Policy</Link>
          <Link to="/terms">Terms of Service</Link>
          <Link to="/cookies">Cookie Policy</Link>
          <Link to="/changelog">Changelog</Link>
        </div>
      </div>
    </footer>
  );
}
