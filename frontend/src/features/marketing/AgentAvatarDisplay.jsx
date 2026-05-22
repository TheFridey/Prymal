const AVATAR_DIMENSIONS_BY_CLASS = [
  ['pm-execution__step-img', 48],
  ['pm-uc-hero__agent-avatar', 72],
  ['pm-bento__card-character', 100],
  ['pm-showcase-card__avatar', 144],
  ['pm-agent-float__character', 160],
  ['pm-how__img', 200],
];

function getAvatarDimension(className) {
  const match = AVATAR_DIMENSIONS_BY_CLASS.find(([token]) => className.includes(token));
  return match?.[1] ?? 160;
}

export function AgentAvatarDisplay({
  agent,
  className = '',
  loading = 'lazy',
  fetchPriority = 'auto',
}) {
  if (agent.avatarSrc) {
    const dimension = getAvatarDimension(className);

    return (
      <img
        src={agent.avatarSrc}
        alt={agent.name}
        className={className || 'pm-agent-float__character'}
        width={dimension}
        height={dimension}
        loading={loading}
        decoding="async"
        fetchPriority={fetchPriority}
      />
    );
  }

  return (
    <div
      className="pm-agent-float__glyph-fallback"
      style={{ '--glyph-color': agent.color }}
    >
      {agent.glyph}
    </div>
  );
}
