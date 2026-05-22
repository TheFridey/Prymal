import { fireEvent, screen, within } from '@testing-library/react';
import { vi } from 'vitest';
import AgentSidebar from './AgentSidebar';
import { AGENT_LIBRARY } from '../../../lib/constants';
import { renderWithProviders } from '../../../test/renderWithProviders';

const SCOUT = AGENT_LIBRARY.find((agent) => agent.id === 'scout');
const CIPHER = AGENT_LIBRARY.find((agent) => agent.id === 'cipher');

function mockFinePointerHover(enabled = true) {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = (query) => ({
    matches: enabled && query.includes('hover: hover'),
    media: query,
    addEventListener: () => {},
    removeEventListener: () => {},
  });
  return () => {
    window.matchMedia = originalMatchMedia;
  };
}

function renderSidebar(overrides = {}) {
  return renderWithProviders(
    <AgentSidebar
      activeAgent={SCOUT}
      unlockedAgents={[SCOUT, CIPHER]}
      recentAgentIds={new Set(['cipher'])}
      routeMode={false}
      powerCards={[]}
      conversations={[]}
      groupedConversations={[]}
      currentConversationId=""
      isDraftingNewChat
      pinnedByAgent={{}}
      editingConversationId=""
      editTitle=""
      renameConversationMutation={{ mutate: () => {}, isPending: false }}
      deleteConversationMutation={{ mutate: () => {}, isPending: false }}
      agentStripRef={{ current: null }}
      agentStripDragRef={{ current: { suppressClick: false } }}
      onSelectAgent={() => {}}
      onStartNewChat={() => {}}
      onSetDraft={() => {}}
      onAgentStripPointerDown={() => {}}
      onAgentStripPointerMove={() => {}}
      onAgentStripPointerEnd={() => {}}
      onAgentStripWheel={() => {}}
      onSelectConversation={() => {}}
      onTogglePinned={() => {}}
      onOpenRename={() => {}}
      onSetEditTitle={() => {}}
      onOpenSettings={() => {}}
      {...overrides}
    />,
  );
}

test('AgentSidebar shows descriptive agent-strip tooltip content and avoids delayed native titles', () => {
  const restoreMatchMedia = mockFinePointerHover(true);
  renderSidebar();

  const scoutButton = screen.getByRole('tab', { name: new RegExp(`^${SCOUT.name}:`, 'i') });
  fireEvent.mouseEnter(scoutButton);

  const scoutTooltip = screen.getByRole('tooltip');
  expect(within(scoutTooltip).getByText(SCOUT.description)).toBeInTheDocument();
  expect(scoutButton).toHaveAttribute('aria-describedby', 'agent-strip-tooltip');
  expect(scoutButton).not.toHaveAttribute('title');
  restoreMatchMedia();
});

test('AgentSidebar shifts edge tooltips back inside the sidebar strip', () => {
  const originalGetBoundingClientRect = Element.prototype.getBoundingClientRect;
  Element.prototype.getBoundingClientRect = function mockGetBoundingClientRect() {
    if (this.classList?.contains('workspace-studio__agent-strip-shell')) {
      return { left: 0, right: 220, top: 0, bottom: 120, width: 220, height: 120, x: 0, y: 0, toJSON: () => ({}) };
    }

    if (this.getAttribute?.('aria-label')?.startsWith(`${CIPHER.name}:`)) {
      return { left: 182, right: 240, top: 80, bottom: 138, width: 58, height: 58, x: 182, y: 80, toJSON: () => ({}) };
    }

    if (this.id === 'agent-strip-tooltip') {
      return { left: 0, right: 208, top: 0, bottom: 80, width: 208, height: 80, x: 0, y: 0, toJSON: () => ({}) };
    }

    return originalGetBoundingClientRect.call(this);
  };

  try {
    const restoreMatchMedia = mockFinePointerHover(true);
    renderSidebar();

    const cipherButton = screen.getByRole('tab', { name: new RegExp(`^${CIPHER.name}:`, 'i') });
    fireEvent.mouseEnter(cipherButton);

    const cipherTooltip = screen.getByRole('tooltip');
    expect(cipherTooltip.style.getPropertyValue('--agent-tooltip-shift')).toBe('-109px');
    restoreMatchMedia();
  } finally {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  }
});

test('AgentSidebar skips hover tooltips on touch-first devices but keeps keyboard focus tooltips', () => {
  const originalMatchMedia = window.matchMedia;
  window.matchMedia = () => ({
    matches: false,
    media: '',
    addEventListener: () => {},
    removeEventListener: () => {},
  });

  try {
    renderSidebar();
    const scoutButton = screen.getByRole('tab', { name: new RegExp(`^${SCOUT.name}:`, 'i') });

    fireEvent.mouseEnter(scoutButton);
    expect(screen.queryByRole('tooltip')).not.toBeInTheDocument();

    fireEvent.focus(scoutButton);
    expect(screen.getByRole('tooltip')).toBeInTheDocument();
  } finally {
    window.matchMedia = originalMatchMedia;
  }
});

test('AgentSidebar supports arrow-key navigation across the agent strip', () => {
  const onSelectAgent = vi.fn();
  renderSidebar({ onSelectAgent });

  const tablist = screen.getByRole('tablist', { name: 'Available agents' });
  fireEvent.keyDown(tablist, { key: 'ArrowRight' });

  expect(onSelectAgent).toHaveBeenCalledWith(CIPHER.id, expect.any(Object));
});
