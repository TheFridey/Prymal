export function AgentAvatarDisplay({ agent, className = '' }) {
  if (agent.avatarSrc) {
    return (
      <img
        src={agent.avatarSrc}
        alt={agent.name}
        className={className || 'pm-agent-float__character'}
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
