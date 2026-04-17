import { screen } from '@testing-library/react';
import ChatPanel from './ChatPanel';
import { renderWithProviders } from '../../../test/renderWithProviders';

const HERALD_AGENT = {
  id: 'herald',
  name: 'HERALD',
  title: 'Email & Outreach Strategist',
  color: '#FF6B35',
  glyph: 'H',
};

test('ChatPanel renders streaming assistant text in the active message list', () => {
  renderWithProviders(
    <ChatPanel
      activeAgent={HERALD_AGENT}
      messages={[
        { id: 'user-1', role: 'user', content: 'Write me a follow-up email.' },
      ]}
      streamingText="Here is a draft reply"
      isStreaming
      streamingTask={{ kind: 'chat', agentId: 'herald', useLore: false, hasAttachments: false }}
      hasConversationContent
      promptCards={[]}
      auditUrl=""
      isAuditing={false}
      wrenEscalated={false}
      messagesViewportRef={{ current: null }}
      bottomRef={{ current: null }}
      onMessagesScroll={() => {}}
      onSetDraft={() => {}}
      onSetAuditUrl={() => {}}
      onOracleAudit={() => {}}
      onRequestReview={() => {}}
    />,
  );

  expect(screen.getByText('Write me a follow-up email.')).toBeInTheDocument();
  expect(screen.getByText('Here is a draft reply')).toBeInTheDocument();
  expect(screen.queryByText(/Start a HERALD conversation/i)).not.toBeInTheDocument();
});
