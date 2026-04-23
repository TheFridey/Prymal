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
      showFirstRunHint={false}
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
      onDismissFirstRunHint={() => {}}
    />,
  );

  expect(screen.getByText('Write me a follow-up email.')).toBeInTheDocument();
  expect(screen.getByText('Here is a draft reply')).toBeInTheDocument();
  expect(screen.queryByText(/Start a HERALD conversation/i)).not.toBeInTheDocument();
});

test('ChatPanel shows first-run guidance, starter prompts, and the new empty-state copy', () => {
  renderWithProviders(
    <ChatPanel
      activeAgent={HERALD_AGENT}
      messages={[]}
      streamingText=""
      isStreaming={false}
      streamingTask={null}
      hasConversationContent={false}
      promptCards={[
        'Write 5 social posts for my business',
        'Create a marketing plan',
        'Generate a promo video',
      ]}
      showFirstRunHint
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
      onDismissFirstRunHint={() => {}}
    />,
  );

  expect(screen.getByText('Start by asking Prymal to do something for your business')).toBeInTheDocument();
  expect(screen.getByText('Write 5 social posts for my business')).toBeInTheDocument();
  expect(screen.getByText('Create a marketing plan')).toBeInTheDocument();
  expect(screen.getByText('Generate a promo video')).toBeInTheDocument();
  expect(screen.getByText(/Ask me to generate content, automate a task, or analyse something/i)).toBeInTheDocument();
});
