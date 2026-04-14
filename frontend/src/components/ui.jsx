import { motion, MotionButton, MotionPanel, MotionSection } from './motion';
import { useTheme } from './theme';

function blend(color, alphaHex = '20') {
  if (!color || !color.startsWith('#')) {
    return color;
  }

  const normalized = color.length === 4
    ? `#${color[1]}${color[1]}${color[2]}${color[2]}${color[3]}${color[3]}`
    : color;

  return `${normalized}${alphaHex}`;
}

export function BrandMark({ compact = false }) {
  return (
    <div className={`brand-mark${compact ? ' compact' : ''}`}>
      <div className="brand-mark__orb" />
      <div>
        <div className="brand-mark__name">PRYMAL</div>
        {!compact ? <div className="brand-mark__tag">Instinctive AI operations</div> : null}
      </div>
    </div>
  );
}

export function AgentAvatar({
  agent,
  size = 48,
  circular = false,
  active = false,
  className = '',
  style,
}) {
  const borderRadius = circular ? '999px' : Math.max(16, Math.round(size * 0.34));
  const avatarSrc = agent?.avatarSrc ?? null;
  const showScene = Boolean(agent?.avatarScene && size >= 96);

  return (
    <div
      className={`agent-avatar${active ? ' is-active' : ''}${className ? ` ${className}` : ''}`}
      style={{
        width: size,
        height: size,
        borderRadius,
        '--avatar-accent': agent?.color ?? 'var(--accent)',
        ...style,
      }}
    >
      {showScene ? <AvatarScene effect={agent.avatarScene} /> : null}
      {avatarSrc ? (
        <img src={avatarSrc} alt={agent?.name ?? 'Agent avatar'} className="agent-avatar__image" />
      ) : (
        <>
          <div className="agent-avatar__glow" />
          <span className="agent-avatar__glyph">{agent?.glyph ?? '?'}</span>
        </>
      )}
    </div>
  );
}

function AvatarScene({ effect }) {
  if (effect === 'cipher-data') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__shard agent-avatar__shard--cipher-left" />
          <span className="agent-avatar__shard agent-avatar__shard--cipher-right" />
          <span className="agent-avatar__bar agent-avatar__bar--cipher" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__shard agent-avatar__shard--cipher-front" />
          <span className="agent-avatar__dot agent-avatar__dot--cipher" />
        </div>
      </>
    );
  }

  if (effect === 'herald-feathers') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__feather agent-avatar__feather--back-left" />
          <span className="agent-avatar__feather agent-avatar__feather--back-right" />
          <span className="agent-avatar__feather agent-avatar__feather--back-top" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__feather agent-avatar__feather--front-left" />
          <span className="agent-avatar__feather agent-avatar__feather--front-right" />
        </div>
      </>
    );
  }

  if (effect === 'lore-pages') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__page agent-avatar__page--lore-left" />
          <span className="agent-avatar__page agent-avatar__page--lore-right" />
          <span className="agent-avatar__sigil agent-avatar__sigil--lore" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__page agent-avatar__page--lore-front" />
        </div>
      </>
    );
  }

  if (effect === 'forge-sparks') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__spark agent-avatar__spark--forge-left" />
          <span className="agent-avatar__spark agent-avatar__spark--forge-top" />
          <span className="agent-avatar__spark agent-avatar__spark--forge-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__ember agent-avatar__ember--forge-left" />
          <span className="agent-avatar__ember agent-avatar__ember--forge-right" />
        </div>
      </>
    );
  }

  if (effect === 'atlas-orbits') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__ring agent-avatar__ring--atlas" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__orbiter agent-avatar__orbiter--atlas-top" />
          <span className="agent-avatar__orbiter agent-avatar__orbiter--atlas-right" />
          <span className="agent-avatar__orbiter agent-avatar__orbiter--atlas-bottom" />
        </div>
      </>
    );
  }

  if (effect === 'echo-waves') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__wave agent-avatar__wave--echo-left" />
          <span className="agent-avatar__wave agent-avatar__wave--echo-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__dot agent-avatar__dot--echo" />
        </div>
      </>
    );
  }

  if (effect === 'oracle-comets') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__comet agent-avatar__comet--oracle-left" />
          <span className="agent-avatar__comet agent-avatar__comet--oracle-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__dot agent-avatar__dot--oracle" />
        </div>
      </>
    );
  }

  if (effect === 'vance-arrows') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__arrow agent-avatar__arrow--vance-left" />
          <span className="agent-avatar__arrow agent-avatar__arrow--vance-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__target agent-avatar__target--vance" />
        </div>
      </>
    );
  }

  if (effect === 'wren-bubbles') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__bubble agent-avatar__bubble--wren-left" />
          <span className="agent-avatar__bubble agent-avatar__bubble--wren-top" />
          <span className="agent-avatar__bubble agent-avatar__bubble--wren-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__bubble agent-avatar__bubble--wren-front" />
        </div>
      </>
    );
  }

  if (effect === 'ledger-bars') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__chart-bar agent-avatar__chart-bar--ledger-left" />
          <span className="agent-avatar__chart-bar agent-avatar__chart-bar--ledger-mid" />
          <span className="agent-avatar__chart-bar agent-avatar__chart-bar--ledger-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__chart-line agent-avatar__chart-line--ledger" />
        </div>
      </>
    );
  }

  if (effect === 'nexus-nodes') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__link agent-avatar__link--nexus-a" />
          <span className="agent-avatar__link agent-avatar__link--nexus-b" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__node agent-avatar__node--nexus-left" />
          <span className="agent-avatar__node agent-avatar__node--nexus-top" />
          <span className="agent-avatar__node agent-avatar__node--nexus-right" />
        </div>
      </>
    );
  }

  if (effect === 'pixel-prism') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__beam agent-avatar__beam--pixel-left" />
          <span className="agent-avatar__beam agent-avatar__beam--pixel-right" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__prism agent-avatar__prism--pixel" />
        </div>
      </>
    );
  }

  if (effect === 'scout-compass') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__ring agent-avatar__ring--scout" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__needle agent-avatar__needle--scout" />
          <span className="agent-avatar__dot agent-avatar__dot--scout-a" />
          <span className="agent-avatar__dot agent-avatar__dot--scout-b" />
        </div>
      </>
    );
  }

  if (effect === 'sentinel-guard') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__shield agent-avatar__shield--sentinel" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__reticle agent-avatar__reticle--sentinel" />
        </div>
      </>
    );
  }

  if (effect === 'sage-halo') {
    return (
      <>
        <div className="agent-avatar__scene agent-avatar__scene--back">
          <span className="agent-avatar__halo agent-avatar__halo--sage" />
        </div>
        <div className="agent-avatar__scene agent-avatar__scene--front">
          <span className="agent-avatar__dust agent-avatar__dust--sage-left" />
          <span className="agent-avatar__dust agent-avatar__dust--sage-right" />
        </div>
      </>
    );
  }

  return null;
}

export function ThemeToggle({ compact = false, tiny = false }) {
  const { theme, toggleTheme } = useTheme();
  const label = tiny
    ? theme === 'dark' ? 'Dark' : 'Light'
    : theme === 'dark' ? 'Dark mode' : 'Light mode';

  return (
    <button
      type="button"
      className={`theme-toggle${compact ? ' compact' : ''}${tiny ? ' tiny' : ''}`}
      onClick={toggleTheme}
      aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} theme`}
    >
      <span className="theme-toggle__track">
        <span className="theme-toggle__thumb" />
      </span>
      <span>{label}</span>
    </button>
  );
}

export function Reveal({ children, className = '', delay = 0, once = true }) {
  return (
    <MotionSection
      className={`reveal reveal-visible${className ? ` ${className}` : ''}`}
      delay={delay / 1000}
      once={once}
      reveal={{ y: 24, blur: 10 }}
    >
      {children}
    </MotionSection>
  );
}

export function PageShell({ children, width = '1180px', flushMobile = false }) {
  return (
    <div className={`page-shell${flushMobile ? ' flush-mobile' : ''}`}>
      <div className="page-shell__inner" style={{ maxWidth: width }}>
        {children}
      </div>
    </div>
  );
}

export function PageHeader({ eyebrow, title, description, accent = 'var(--accent)', actions }) {
  return (
    <div className="page-header">
      <div className="page-header__copy">
        {eyebrow ? (
          <div className="eyebrow" style={{ '--eyebrow-accent': accent }}>
            {eyebrow}
          </div>
        ) : null}
        <h1 className="page-title">{title}</h1>
        {description ? <p className="page-description">{description}</p> : null}
      </div>
      {actions ? <div className="page-header__actions">{actions}</div> : null}
    </div>
  );
}

export function SurfaceCard({ children, title, subtitle, accent, style, className = '' }) {
  return (
    <MotionPanel
      className={`surface-card${className ? ` ${className}` : ''}`}
      accent={accent}
      style={{
        '--card-accent': accent || 'var(--line-soft)',
        ...style,
      }}
    >
      {title ? (
        <div className="surface-card__header">
          <div>
            <h2 className="surface-card__title">{title}</h2>
          </div>
          {subtitle ? <span className="surface-card__subtitle">{subtitle}</span> : null}
        </div>
      ) : null}
      {children}
    </MotionPanel>
  );
}

export function StatGrid({ items }) {
  return (
    <div className="stat-grid">
      {items.map((item) => (
        <SurfaceCard key={item.label} accent={item.accent} className="stat-card">
          <div className="stat-card__value" style={{ color: item.accent || 'var(--text)' }}>
            {item.value}
          </div>
          <div className="stat-card__label">{item.label}</div>
          {item.helper ? <div className="stat-card__helper">{item.helper}</div> : null}
        </SurfaceCard>
      ))}
    </div>
  );
}

export function StatusPill({ children, color = 'var(--accent)' }) {
  return (
    <motion.span
      className="status-pill"
      style={{
        '--status-pill-color': color,
      }}
      initial={{ opacity: 0, y: 4 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
    >
      {children}
    </motion.span>
  );
}

export function SectionLabel({ children }) {
  return <div className="section-label">{children}</div>;
}

export function EmptyState({ title, description, action, accent = 'var(--accent)' }) {
  return (
    <motion.div
      className="empty-state"
      initial={{ opacity: 0, y: 12, scale: 0.985 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      transition={{ duration: 0.32 }}
    >
      <div
        className="empty-state__glyph"
        style={{
          borderColor: blend(accent, '30'),
          background: `linear-gradient(135deg, ${blend(accent, '26')}, transparent)`,
        }}
      />
      <h3 className="empty-state__title" style={{ color: accent }}>
        {title}
      </h3>
      <p className="empty-state__description">{description}</p>
      {action ? <div className="empty-state__action">{action}</div> : null}
    </motion.div>
  );
}

export function InlineNotice({ children, tone = 'default' }) {
  const toneMap = {
    default: {
      borderColor: 'var(--line)',
      color: 'var(--muted)',
      background: 'var(--panel-soft)',
    },
    success: {
      borderColor: 'rgba(34, 197, 94, 0.24)',
      color: 'var(--success-ink)',
      background: 'var(--success-surface)',
    },
    warning: {
      borderColor: 'rgba(245, 158, 11, 0.24)',
      color: 'var(--warning-ink)',
      background: 'var(--warning-surface)',
    },
    danger: {
      borderColor: 'rgba(239, 68, 68, 0.24)',
      color: 'var(--danger-ink)',
      background: 'var(--danger-surface)',
    },
  };
  const palette = toneMap[tone] ?? toneMap.default;

  return (
    <motion.div
      className="inline-notice"
      style={palette}
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.24 }}
    >
      {children}
    </motion.div>
  );
}

export function Button({ children, tone = 'ghost', block = false, style, className = '', ...props }) {
  return (
    <MotionButton
      {...props}
      className={`button button--${tone}${block ? ' button--block' : ''}${className ? ` ${className}` : ''}`}
      style={style}
    >
      {children}
    </MotionButton>
  );
}

export function TextInput({ className = '', style, ...props }) {
  return <input {...props} className={`field${className ? ` ${className}` : ''}`} style={style} />;
}

export function TextArea({ className = '', style, ...props }) {
  return <textarea {...props} className={`field field--textarea${className ? ` ${className}` : ''}`} style={style} />;
}

export function LoadingPanel({ label = 'Loading Prymal...' }) {
  return (
    <motion.div
      className="loading-panel"
      initial={{ opacity: 0, scale: 0.985 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ duration: 0.36 }}
    >
      <motion.div
        className="loading-panel__core"
        initial={{ y: 10, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 0.36, delay: 0.06 }}
      >
        <motion.div
          className="loading-panel__orb"
          animate={{ scale: [1, 1.08, 1], opacity: [0.85, 1, 0.85] }}
          transition={{ duration: 2.8, repeat: Number.POSITIVE_INFINITY, ease: 'easeInOut' }}
        />
        <div className="loading-panel__label">{label}</div>
      </motion.div>
    </motion.div>
  );
}
