import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useUser } from '@clerk/clerk-react';
import { useQuery } from '@tanstack/react-query';
import { Link, NavLink, Outlet, useNavigate } from 'react-router-dom';
import {
  TbBook2,
  TbBrain,
  TbChevronRight,
  TbLayoutDashboard,
  TbPlugConnected,
  TbRoute,
  TbSettings,
  TbShieldCog,
  TbX,
} from 'react-icons/tb';
import { api } from '../lib/api';
import { AGENT_LIBRARY, mergeAgentState } from '../lib/constants';
import { isInternalDiagnosticsVisible } from '../lib/diagnostics';
import { useAppStore } from '../stores/useAppStore';
import { BrandMark, ThemeToggle } from './ui';
import { WorkspaceCreditAlerts } from '../features/workspace/billing/WorkspaceCreditAlerts';
import { WorkspaceCommandPalette } from '../features/workspace/command/WorkspaceCommandPalette';
import { MotionModal, MotionPresence, motion } from './motion';

const BASE_RAIL_ITEMS = [
  { to: '/app/dashboard', label: 'Dashboard', short: 'DB', icon: 'dashboard' },
  { to: '/app/memory', label: 'Memory', short: 'ME', icon: 'memory' },
  { to: '/app/lore', label: 'LORE', short: 'LO', icon: 'lore' },
  { to: '/app/workflows', label: 'NEXUS', short: 'NX', icon: 'workflow', badgeKey: 'approvals' },
  { to: '/app/integrations', label: 'Integrations', short: 'IO', icon: 'integrations' },
];

export default function AppLayout({ viewer }) {
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [railExpanded, setRailExpanded] = useState(false);
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

  const { data: approvalsData } = useQuery({
    queryKey: ['pending-approvals'],
    queryFn: () => api.get('/actions/approvals'),
    refetchInterval: 60_000,
    staleTime: 30_000,
  });
  const pendingApprovalsCount = approvalsData?.approvals?.length ?? 0;

  const agents = mergeAgentState(data?.agents ?? []);
  const railItems = useMemo(() => {
    const items = [...BASE_RAIL_ITEMS];
    if (isInternalDiagnosticsVisible(viewer)) {
      items.push({ to: '/app/admin', label: 'Admin', short: 'AD', icon: 'admin' });
    }
    return items;
  }, [viewer]);
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
    setRailExpanded(false);
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

  function handleRailBlur(event) {
    if (!event.currentTarget.contains(event.relatedTarget)) {
      setRailExpanded(false);
    }
  }

  return (
    <>
      {isMobileView ? (
        <div className="app-mobile-bar app-mobile-bar--studio">
          <button
            type="button"
            className={`burger app-mobile-bar__menu${drawerOpen ? ' is-open' : ''}`}
            onClick={() => setDrawerOpen((current) => !current)}
            aria-label={drawerOpen ? 'Close workspace navigation' : 'Open workspace navigation'}
            aria-expanded={drawerOpen}
          >
            <span />
          </button>
          <Link to="/app/dashboard" className="app-mobile-bar__brand" aria-label="Open Prymal dashboard">
            <BrandMark compact />
          </Link>
          <div className="app-mobile-bar__avatar" aria-label="Current user">
            {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : user?.firstName?.[0] ?? 'A'}
          </div>
        </div>
      ) : null}

      <div className={`app-shell app-shell--studio${railExpanded && !isMobileView ? ' app-shell--rail-expanded' : ''}`}>
        <div className="ambient-background" aria-hidden="true" />
        <div className="app-shell__ambience" aria-hidden="true">
          <span className="app-shell__glow app-shell__glow--one" />
          <span className="app-shell__glow app-shell__glow--two" />
          <span className="app-shell__grid" />
          <span className="app-shell__noise" />
          <span className="app-shell__rings" />
        </div>

        {!isMobileView ? (
          <aside
            className="app-launcher"
            onPointerEnter={() => setRailExpanded(true)}
            onPointerLeave={() => setRailExpanded(false)}
            onFocusCapture={() => setRailExpanded(true)}
            onBlurCapture={handleRailBlur}
          >
            <Link to="/app/dashboard" className="app-launcher__brand" aria-label="Open Prymal dashboard">
              <BrandMark compact />
            </Link>

            <div className="app-launcher__tools" aria-label="Workspace tools">
              <button type="button" className="app-launcher__jump" onClick={() => setCommandPaletteOpen(true)}>
                Jump
              </button>
              <ThemeToggle tiny />
            </div>

            <div className="app-launcher__search">
              <input
                type="search"
                placeholder="Search conversations..."
                value={searchQuery}
                onChange={(event) => handleSearchChange(event.target.value)}
                onFocus={() => searchResults.length > 0 && setSearchOpen(true)}
                onBlur={() => setTimeout(() => setSearchOpen(false), 150)}
                aria-label="Search conversations"
              />
              {searchOpen && searchResults.length > 0 ? (
                <div className="app-launcher__search-results">
                  {searchResults.map((conv) => (
                    <button key={conv.id} type="button" onMouseDown={() => handleSearchSelect(conv)}>
                      <span>{conv.title || 'Untitled conversation'}</span>
                      <small>{conv.agentId}</small>
                    </button>
                  ))}
                </div>
              ) : null}
            </div>

            <nav className="app-launcher__nav" aria-label="Primary workspace navigation">
              {railItems.map((item) => {
                const badgeCount = item.badgeKey === 'approvals' ? pendingApprovalsCount : 0;
                return (
                <NavLink
                  key={item.to}
                  to={item.to}
                  className={({ isActive }) => `app-launcher__link${isActive ? ' active' : ''}`}
                  title={item.label}
                  aria-label={badgeCount > 0 ? `${item.label} — ${badgeCount} pending approval${badgeCount !== 1 ? 's' : ''}` : item.label}
                >
                  <span className="app-launcher__link-indicator" aria-hidden="true" />
                  <span className="app-launcher__link-icon" aria-hidden="true" style={{ position: 'relative' }}>
                    <RailIcon icon={item.icon} />
                    {badgeCount > 0 ? (
                      <span
                        aria-hidden="true"
                        style={{
                          position: 'absolute',
                          top: -4,
                          right: -4,
                          minWidth: 16,
                          height: 16,
                          borderRadius: 999,
                          background: '#7f8cff',
                          color: '#fff',
                          fontSize: 10,
                          fontWeight: 700,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          padding: '0 3px',
                          lineHeight: 1,
                        }}
                      >
                        {badgeCount > 99 ? '99+' : badgeCount}
                      </span>
                    ) : null}
                  </span>
                  <span className="app-launcher__link-label">{item.label}</span>
                </NavLink>
                );
              })}
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
                <span className="app-launcher__link-label">Settings</span>
              </NavLink>
              <div className="app-launcher__legal">
                <Link to="/privacy" className="app-launcher__legal-link">Privacy</Link>
                <span className="app-launcher__legal-sep" aria-hidden="true">·</span>
                <Link to="/terms" className="app-launcher__legal-link">Terms</Link>
              </div>
            </div>

            <div className="app-launcher__profile">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : user?.firstName?.[0] ?? 'A'}
            </div>
          </aside>
        ) : null}

        <div className="app-main app-main--studio">
          <WorkspaceCreditAlerts viewer={viewer} />
          <Outlet context={sharedContext} />
        </div>

        <Toasts />
      </div>

      {drawerOpen && isMobileView ? (
        <MotionModal
          open={drawerOpen}
          onClose={() => setDrawerOpen(false)}
          className="mobile-drawer mobile-drawer--studio"
          backdropClassName="mobile-drawer-overlay"
          backdropLabel="Close workspace navigation"
          onClick={(event) => event.stopPropagation()}
        >
          <div className="mobile-drawer__header">
            <Link to="/app/dashboard" onClick={() => setDrawerOpen(false)} className="mobile-drawer__brand">
              <BrandMark compact />
            </Link>
            <button
              type="button"
              className="mobile-drawer__close"
              onClick={() => setDrawerOpen(false)}
              aria-label="Close workspace navigation"
            >
              <TbX />
            </button>
          </div>
          <div className="mobile-drawer__profile">
            <div className="mobile-drawer__avatar">
              {user?.imageUrl ? <img src={user.imageUrl} alt="" /> : user?.firstName?.[0] ?? 'A'}
            </div>
            <div>
              <div className="mobile-drawer__user">{user?.fullName ?? user?.firstName ?? 'Workspace'}</div>
              <div className="mobile-drawer__org">{viewer?.organisation?.name ?? 'Prymal'}</div>
            </div>
          </div>
          <nav className="mobile-drawer__nav" aria-label="Workspace navigation">
            {[...railItems, { to: '/app/settings', label: 'Settings', icon: 'settings' }].map((item) => (
              <NavLink key={item.to} to={item.to} onClick={() => setDrawerOpen(false)} className={({ isActive }) => `mobile-drawer__link${isActive ? ' active' : ''}`}>
                <span className="mobile-drawer__link-icon" aria-hidden="true">
                  <RailIcon icon={item.icon} />
                </span>
                <span>{item.label}</span>
                <TbChevronRight aria-hidden="true" />
              </NavLink>
            ))}
          </nav>
          <div className="mobile-drawer__footer">
            <button type="button" className="pm-btn pm-btn--ghost" onClick={() => { setCommandPaletteOpen(true); setDrawerOpen(false); }}>
              Open command palette
            </button>
            <ThemeToggle tiny />
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
  if (icon === 'dashboard') return <TbLayoutDashboard />;
  if (icon === 'memory') return <TbBrain />;
  if (icon === 'lore') return <TbBook2 />;
  if (icon === 'workflow') return <TbRoute />;
  if (icon === 'integrations') return <TbPlugConnected />;
  if (icon === 'admin') return <TbShieldCog />;
  return <TbSettings />;
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
