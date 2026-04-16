import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import { api } from '../lib/api';
import { AGENT_LIBRARY, mergeAgentState } from '../lib/constants';
import { useAppStore } from '../stores/useAppStore';
import { BrandMark, ThemeToggle } from './ui';
import { WorkspaceCommandPalette } from '../features/workspace/command/WorkspaceCommandPalette';
import { MotionDrawer, MotionModal, MotionPresence, motion } from './motion';
import '../styles/app-rebuild.css';

const BASE_RAIL_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', short: 'DB', icon: 'dashboard' },
  { to: '/app/lore', label: 'LORE', short: 'LO', icon: 'knowledge' },
  { to: '/app/workflows', label: 'NEXUS', short: 'NX', icon: 'workflow' },
  { to: '/app/integrations', label: 'Integrations', short: 'IO', icon: 'integrations' },
];

export default function AppLayout({ viewer }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [isMobileView, setIsMobileView] = useState(() =>
    typeof window !== 'undefined' ? window.matchMedia('(max-width: 1024px)').matches : false,
  );
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState([]);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchDebounceRef = useRef(null);
  const navigate = useNavigate();
  const { user } = useUser();
  const { data } = useQuery({
    queryKey: ['agents'],
    queryFn: () => api.get('/agents'),
  });

  const agents = mergeAgentState(data?.agents ?? []);
  const railItems = useMemo(() => {
    const items = [...BASE_RAIL_ITEMS];
    if (viewer?.staff?.isStaff) {
      items.push({ to: '/app/admin', label: 'Admin', short: 'AD', icon: 'admin' });
    }
    return items;
  }, [viewer?.staff?.isStaff]);
  const sharedContext = useMemo(
    () => ({
      viewer,
      agents: agents.length > 0 ? agents : AGENT_LIBRARY,
    }),
    [agents, viewer],
  );

  useEffect(() => {
    if (typeof window === 'undefined') {
      return undefined;
    }

    const mediaQuery = window.matchMedia('(max-width: 1024px)');
    const sync = () => setIsMobileView(mediaQuery.matches);
    sync();
    mediaQuery.addEventListener('change', sync);
    return () => mediaQuery.removeEventListener('change', sync);
  }, []);

  useEffect(() => {
    setDrawerOpen(false);
  }, [isMobileView]);

  useEffect(() => {
    function handleKeyDown(event) {
      const target = event.target;
      const isEditableTarget =
        target instanceof HTMLElement &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (isEditableTarget) {
        return;
      }

      if ((event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k') {
        event.preventDefault();
        setCommandPaletteOpen((current) => !current);
      }
    }

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  function applyParallax(element, event, strength = 8) {
    if (!element) return;
    const rect = element.getBoundingClientRect();
    const offsetX = ((event.clientX - rect.left) / rect.width - 0.5) * strength * 2;
    const offsetY = ((event.clientY - rect.top) / rect.height - 0.5) * strength * 2;
    element.style.setProperty('--parallax-x', `${offsetX.toFixed(2)}px`);
    element.style.setProperty('--parallax-y', `${offsetY.toFixed(2)}px`);
  }

  function resetParallax(element) {
    if (!element) return;
    element.style.setProperty('--parallax-x', '0px');
    element.style.setProperty('--parallax-y', '0px');
  }

  const handleSearchChange = useCallback((value) => {
    setSearchQuery(value);
    clearTimeout(searchDebounceRef.current);

    if (!value.trim() || value.trim().length < 2) {
      setSearchResults([]);
      setSearchOpen(false);
      return;
    }

    searchDebounceRef.current = setTimeout(async () => {
      try {
        const result = await api.get(`/agents/conversations/search?q=${encodeURIComponent(value.trim())}`);
        setSearchResults(result.conversations ?? []);
        setSearchOpen(true);
      } catch {
        setSearchResults([]);
      }
    }, 300);
  }, []);

  function handleSearchSelect(conversation) {
    setSearchQuery('');
    setSearchResults([]);
    setSearchOpen(false);
    setDrawerOpen(false);
    navigate(`/app/agents/${conversation.agentId}?cid=${conversation.id}`);
  }

  return (
    <>
      {isMobileView ? (
        <div className="app-mobile-bar app-mobile-bar--studio">
          <button type="button" className={`burger${drawerOpen ? ' is-open' : ''}`} onClick={() => setDrawerOpen((current) => !current)} aria-label="Toggle workspace navigation">
            <span />
          </button>
          <BrandMark compact />
          <div className="app-mobile-bar__avatar">
            {user?.imageUrl ? <img src={user.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.firstName?.[0] ?? 'A'}
          </div>
        </div>
      ) : null}

      <div className="app-shell app-shell--studio">
        <div className="ambient-background" aria-hidden="true" />
        <div className="app-shell__ambience" aria-hidden="true">
          <span className="app-shell__glow app-shell__glow--one" />
          <span className="app-shell__glow app-shell__glow--two" />
          <span className="app-shell__grid" />
          <span className="app-shell__noise" />
          <span className="app-shell__rings" />
        </div>

        {!isMobileView ? (
          <aside className="app-launcher">
            <Link to="/app/dashboard" className="app-launcher__brand" aria-label="Open Prymal dashboard">
              <BrandMark compact />
            </Link>

            <button
              type="button"
              className={`app-launcher__toggle${drawerOpen ? ' is-open' : ''}`}
              onClick={() => setDrawerOpen((current) => !current)}
              aria-label={drawerOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
              aria-expanded={drawerOpen}
            >
              <ChevronRailIcon />
            </button>

            <nav className="app-launcher__nav" aria-label="Primary workspace navigation">
              {railItems.map((item) => (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `app-launcher__link${isActive ? ' active' : ''}`}
                  title={item.label}
                  aria-label={item.label}
                >
                  <span className="app-launcher__link-indicator" aria-hidden="true" />
                  <span className="app-launcher__link-icon" aria-hidden="true">
                    <RailIcon icon={item.icon} />
                  </span>
                </NavLink>
              ))}
            </nav>

            <div className="app-launcher__footer">
              <NavLink
                to="/app/settings"
                className={({ isActive }) => `app-launcher__link${isActive ? ' active' : ''}`}
                title="Settings"
                aria-label="Settings"
              >
                <span className="app-launcher__link-indicator" aria-hidden="true" />
                <span className="app-launcher__link-icon" aria-hidden="true">
                  <RailIcon icon="settings" />
                </span>
              </NavLink>
            </div>

            <div className="app-launcher__profile">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /> : user?.firstName?.[0] ?? 'A'}
            </div>
          </aside>
        ) : null}

        <main className="app-main app-main--studio">
          <Outlet context={sharedContext} />
        </main>

        <Toasts />
      </div>

      {!isMobileView ? (
        <MotionDrawer
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className={`app-drawer${drawerOpen ? ' is-open' : ''}`}
          backdropClassName="app-drawer-backdrop"
          backdropLabel="Close workspace navigation"
          aria-hidden={!drawerOpen}
        >
        <div className="app-drawer__header">
          <div
            className="app-drawer__header-inner"
            onPointerMove={(event) => applyParallax(event.currentTarget, event, 7)}
            onPointerLeave={(event) => resetParallax(event.currentTarget)}
          >
            <div>
              <div className="app-drawer__label">Workspace</div>
              <div className="app-drawer__title">{viewer?.organisation?.name ?? 'Prymal'}</div>
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
              <button
                type="button"
                onClick={() => setCommandPaletteOpen(true)}
                style={{
                  border: '1px solid var(--line)',
                  borderRadius: '999px',
                  background: 'rgba(255,255,255,0.06)',
                  color: 'var(--text-strong)',
                  padding: '6px 10px',
                  fontSize: '0.72rem',
                  cursor: 'pointer',
                }}
              >
                Jump
              </button>
              <ThemeToggle tiny />
            </div>
          </div>
        </div>

        <div style={{ padding: '0 16px 12px', position: 'relative' }}>
          <input
            type="search"
            placeholder="Search conversations..."
            value={searchQuery}
            onChange={(event) => handleSearchChange(event.target.value)}
            onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
            onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '999px',
              border: '1px solid var(--line)',
              background: 'rgba(255,255,255,0.06)',
              color: 'var(--text-strong)',
              fontSize: '13px',
              outline: 'none',
              boxSizing: 'border-box',
            }}
          />
          {searchOpen && searchResults.length > 0 ? (
            <div
              style={{
                position: 'absolute',
                top: '100%',
                left: '16px',
                right: '16px',
                background: 'var(--surface)',
                border: '1px solid var(--line)',
                borderRadius: '18px',
                overflow: 'hidden',
                zIndex: 100,
                boxShadow: '0 8px 24px rgba(0,0,0,0.18)',
              }}
            >
              {searchResults.map((conv) => (
                <button
                  key={conv.id}
                  type="button"
                  onMouseDown={() => handleSearchSelect(conv)}
                  style={{
                    display: 'block',
                    width: '100%',
                    textAlign: 'left',
                    padding: '10px 14px',
                    background: 'none',
                    border: 'none',
                    borderBottom: '1px solid var(--line)',
                    color: 'var(--text-strong)',
                    cursor: 'pointer',
                    fontSize: '13px',
                  }}
                >
                  <div style={{ fontWeight: 500, marginBottom: '2px', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                    {conv.title || 'Untitled conversation'}
                  </div>
                  <div style={{ color: 'var(--muted)', fontSize: '11px', textTransform: 'uppercase', letterSpacing: '0.1em' }}>
                    {conv.agentId}
                  </div>
                </button>
              ))}
            </div>
          ) : null}
        </div>

        <nav className="app-drawer__nav">
          {railItems.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) => `app-drawer__link${isActive ? ' active' : ''}`}
              onClick={() => setDrawerOpen(false)}
              title={item.label}
            >
              <span
                className="app-drawer__link-icon"
                aria-hidden="true"
                onPointerMove={(event) => applyParallax(event.currentTarget, event, 5)}
                onPointerLeave={(event) => resetParallax(event.currentTarget)}
              >
                <RailIcon icon={item.icon} />
              </span>
              <span className="app-drawer__link-text">
                <span className="app-drawer__link-code">{item.short}</span>
                <span className="app-drawer__link-label">{item.label}</span>
              </span>
            </NavLink>
          ))}
        </nav>

        <div className="app-drawer__footer">
          <NavLink
            to="/app/settings"
            className={({ isActive }) => `app-drawer__link${isActive ? ' active' : ''}`}
            onClick={() => setDrawerOpen(false)}
            title="Workspace settings"
          >
            <span
              className="app-drawer__link-icon"
              aria-hidden="true"
              onPointerMove={(event) => applyParallax(event.currentTarget, event, 5)}
              onPointerLeave={(event) => resetParallax(event.currentTarget)}
            >
              <RailIcon icon="settings" />
            </span>
            <span className="app-drawer__link-text">
              <span className="app-drawer__link-code">ST</span>
              <span className="app-drawer__link-label">Settings</span>
            </span>
          </NavLink>
        </div>
      </MotionDrawer>
      ) : null}

      {drawerOpen && isMobileView ? (
        <MotionModal
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className="mobile-drawer mobile-drawer--studio"
          backdropClassName="mobile-drawer-overlay"
          backdropLabel="Close workspace navigation"
          onClick={(event) => event.stopPropagation()}
        >
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: '12px', marginBottom: '16px' }}>
            <BrandMark compact />
            <ThemeToggle tiny />
          </div>
          <div style={{ display: 'grid', gap: '8px' }}>
            {[...railItems, { to: '/app/settings', label: 'Settings', icon: '::' }].map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setDrawerOpen(false)} className={({ isActive }) => `sidebar-link${isActive ? ' active' : ''}`}>
                <span style={{ minWidth: '28px', color: 'var(--muted-2)' }}>{item.icon}</span>
                <span>{item.label}</span>
              </NavLink>
            ))}
          </div>
        </MotionModal>
      ) : null}

      {commandPaletteOpen ? (
        <WorkspaceCommandPalette
          railItems={railItems}
          agents={sharedContext.agents}
          onNavigate={(to) => {
            setCommandPaletteOpen(false);
            setDrawerOpen(false);
            navigate(to);
          }}
          onClose={() => setCommandPaletteOpen(false)}
        />
      ) : null}
    </>
  );
}

function RailIcon({ icon }) {
  if (icon === 'dashboard') return <DashboardIcon />;
  if (icon === 'knowledge') return <KnowledgeIcon />;
  if (icon === 'workflow') return <WorkflowIcon />;
  if (icon === 'integrations') return <IntegrationsIcon />;
  if (icon === 'admin') return <AdminIcon />;
  return <SettingsIcon />;
}

function ChevronRailIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 6 6 6-6 6" />
    </svg>
  );
}

function DashboardIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 13h6V4H4zM14 20h6v-9h-6zM14 10h6V4h-6zM4 20h6v-3H4z" />
    </svg>
  );
}

function KnowledgeIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" />
      <path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" />
    </svg>
  );
}

function WorkflowIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M4 6h6v6H4zM14 12h6v6h-6zM14 4h6v4h-6zM10 9h4M12 9v3M7 12v2h7" />
    </svg>
  );
}

function IntegrationsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 7h3a2 2 0 0 1 2 2v3" />
      <path d="M9 17H6a2 2 0 0 1-2-2v-3" />
      <path d="m8 12 4-4 4 4" />
      <path d="m8 12 4 4 4-4" />
    </svg>
  );
}

function SettingsIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="3.2" />
      <path d="M19.4 15a1 1 0 0 0 .2 1.1l.1.1a1.8 1.8 0 0 1 0 2.5l-.2.2a1.8 1.8 0 0 1-2.5 0l-.1-.1a1 1 0 0 0-1.1-.2 1 1 0 0 0-.6.9V20a1.8 1.8 0 0 1-1.8 1.8h-.8A1.8 1.8 0 0 1 10.8 20v-.2a1 1 0 0 0-.6-.9 1 1 0 0 0-1.1.2l-.1.1a1.8 1.8 0 0 1-2.5 0l-.2-.2a1.8 1.8 0 0 1 0-2.5l.1-.1a1 1 0 0 0 .2-1.1 1 1 0 0 0-.9-.6H4.8A1.8 1.8 0 0 1 3 12.6v-.8A1.8 1.8 0 0 1 4.8 10h.2a1 1 0 0 0 .9-.6 1 1 0 0 0-.2-1.1l-.1-.1a1.8 1.8 0 0 1 0-2.5l.2-.2a1.8 1.8 0 0 1 2.5 0l.1.1a1 1 0 0 0 1.1.2 1 1 0 0 0 .6-.9V4.8A1.8 1.8 0 0 1 12.6 3h.8a1.8 1.8 0 0 1 1.8 1.8v.2a1 1 0 0 0 .6.9 1 1 0 0 0 1.1-.2l.1-.1a1.8 1.8 0 0 1 2.5 0l.2.2a1.8 1.8 0 0 1 0 2.5l-.1.1a1 1 0 0 0-.2 1.1 1 1 0 0 0 .9.6h.2A1.8 1.8 0 0 1 21 11.8v.8a1.8 1.8 0 0 1-1.8 1.8H19a1 1 0 0 0-.9.6z" />
    </svg>
  );
}

function AdminIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M12 3 4 7v6c0 4.4 3.1 6.9 8 8 4.9-1.1 8-3.6 8-8V7z" />
      <path d="M9.5 12.5 11 14l3.5-4" />
    </svg>
  );
}

function Toasts() {
  const notifications = useAppStore((state) => state.notifications);
  const removeNotification = useAppStore((state) => state.removeNotification);

  if (notifications.length === 0) {
    return null;
  }

  return (
    <div className="toast-stack">
      <MotionPresence initial={false}>
        {notifications.map((notification) => {
          const tone =
            notification.type === 'error'
              ? '#ef4444'
              : notification.type === 'success'
                ? 'var(--accent)'
                : notification.type === 'warning'
                  ? '#f59e0b'
                  : '#7f8cff';
          return (
            <motion.div
              key={notification.id}
              className="toast"
              initial={{ opacity: 0, y: 18, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -12, scale: 0.98 }}
              transition={{ duration: 0.24 }}
            >
              {notification.title ? <div className="toast__title" style={{ color: tone }}>{notification.title}</div> : null}
              <div style={{ lineHeight: 1.6, fontSize: '0.84rem' }}>{notification.message}</div>
              {notification.action?.href && notification.action?.label ? (
                <div style={{ marginTop: '10px', display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
                  <a
                    href={notification.action.href}
                    onClick={() => removeNotification(notification.id)}
                    style={{
                      color: tone,
                      fontFamily: 'var(--ff-mono)',
                      fontSize: '0.72rem',
                      letterSpacing: '0.12em',
                      textTransform: 'uppercase',
                      textDecoration: 'none',
                    }}
                  >
                    {notification.action.label}
                  </a>
                  <button
                    type="button"
                    onClick={() => removeNotification(notification.id)}
                    style={{
                      border: 'none',
                      background: 'transparent',
                      color: 'var(--muted)',
                      cursor: 'pointer',
                      fontSize: '0.76rem',
                    }}
                  >
                    Dismiss
                  </button>
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => removeNotification(notification.id)}
                  style={{
                    marginTop: '10px',
                    border: 'none',
                    background: 'transparent',
                    color: 'var(--muted)',
                    cursor: 'pointer',
                    fontSize: '0.76rem',
                    padding: 0,
                  }}
                >
                  Dismiss
                </button>
              )}
            </motion.div>
          );
        })}
      </MotionPresence>
    </div>
  );
}
