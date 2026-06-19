const AVATAR_DIMENSIONS_BY_CLASS = [
  ['pm-execution__step-img', 48],
  ['pm-uc-hero__agent-avatar', 72],
  ['pm-bento__card-character', 100],
  ['pm-showcase-card__avatar', 144],
  ['pm-agent-float__character', 160],
  ['pm-how__img', 200],
];

const AVATAR_SIZES_BY_CLASS = [
  ['pm-execution__step-img', '48px'],
  ['pm-uc-hero__agent-avatar', '72px'],
  ['pm-bento__card-character', '100px'],
  ['pm-showcase-card__avatar', '(max-width: 720px) 120px, 144px'],
  ['pm-agent-float__character', '(max-width: 720px) 120px, 160px'],
  ['pm-how__img', '(max-width: 720px) 160px, 200px'],
];

function getAvatarDimension(className) {
  const match = AVATAR_DIMENSIONS_BY_CLASS.find(([token]) => className.includes(token));
  return match?.[1] ?? 160;
}

function getAvatarSizes(className) {
  const match = AVATAR_SIZES_BY_CLASS.find(([token]) => className.includes(token));
  return match?.[1] ?? '160px';
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
        srcSet={agent.avatarSrcSet}
        sizes={agent.avatarSrcSet ? getAvatarSizes(className) : undefined}
        alt={agent.name}
        className={className || 'pm-agent-float__character'}
        width={dimension}
        height={dimension}
        loading={loading}
        decoding="async"
        fetchpriority={fetchPriority}
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
