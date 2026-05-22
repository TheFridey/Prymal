export function canUseHoverTooltips() {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return true;
  }

  return window.matchMedia('(hover: hover) and (pointer: fine)').matches;
}

export function resolveAgentStripIndex(agents, agentId) {
  return agents.findIndex((agent) => agent.id === agentId);
}

export function resolveAgentStripNeighbor(agents, currentIndex, direction) {
  if (!agents.length) {
    return null;
  }

  const offset = direction === 'next' ? 1 : -1;
  const nextIndex = (currentIndex + offset + agents.length) % agents.length;
  return agents[nextIndex] ?? null;
}
