import { fireEvent, screen, within } from '@testing-library/react';
import AgentSidebar from './AgentSidebar';
import { AGENT_LIBRARY } from '../../../lib/constants';
import { renderWithProviders } from '../../../test/renderWithProviders';

const SCOUT = AGENT_LIBRARY.find((agent) => agent.id === 'scout');
const CIPHER = AGENT_LIBRARY.find((agent) => agent.id === 'cipher');

test('AgentSidebar shows descriptive agent-strip tooltip content and avoids delayed native titles', () => {
  renderWithProviders(
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
    />,
  );

  const scoutButton = screen.getByRole('button', { name: new RegExp(`^${SCOUT.name}:`, 'i') });
  fireEvent.mouseEnter(scoutButton);

  const scoutTooltip = screen.getByRole('tooltip');
  expect(within(scoutTooltip).getByText(SCOUT.description)).toBeInTheDocument();
  expect(scoutButton).toHaveAttribute('aria-describedby', 'agent-strip-tooltip');
  expect(scoutButton).not.toHaveAttribute('title');
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
    renderWithProviders(
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
      />,
    );

    const cipherButton = screen.getByRole('button', { name: new RegExp(`^${CIPHER.name}:`, 'i') });
    fireEvent.mouseEnter(cipherButton);

    const cipherTooltip = screen.getByRole('tooltip');
    expect(cipherTooltip.style.getPropertyValue('--agent-tooltip-shift')).toBe('-109px');
  } finally {
    Element.prototype.getBoundingClientRect = originalGetBoundingClientRect;
  }
});
