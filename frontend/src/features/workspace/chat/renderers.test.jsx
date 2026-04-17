import { screen } from '@testing-library/react';
import { StudioMessage } from './renderers';
import { renderWithProviders } from '../../../test/renderWithProviders';

const HERALD_AGENT = {
  id: 'herald',
  name: 'HERALD',
  title: 'Email & Outreach Strategist',
  color: '#FF6B35',
  glyph: 'H',
};

test('StudioMessage renders herald structured output as a sequence card instead of raw JSON', () => {
  const message = {
    id: 'message-1',
    role: 'assistant',
    content: JSON.stringify({
      agent: 'herald',
      sequenceName: 'Lead revival sequence',
      targetAudience: 'Warm SaaS leads',
      totalEmails: 1,
      emails: [
        {
          emailNumber: 1,
          sendDay: 0,
          subject: 'Quick question about your stalled trial',
          preview: 'A short note with a low-friction next step.',
          body: 'Hi {{first_name}},\n\nI noticed the trial went quiet.\n\nIf helpful, I can send a short setup checklist.',
          cta: 'Reply "CHECKLIST" and I will send it.',
          tone: 'Direct, consultative',
          abVariants: [
            { variant: 'A', subject: 'Setup checklist for {{company}}' },
            { variant: 'B', subject: 'Want a faster way to get value from the trial?' },
          ],
        },
      ],
      notes: 'Needs stronger social proof before expanding to five emails.',
    }, null, 2),
  };

  renderWithProviders(<StudioMessage message={message} agent={HERALD_AGENT} />);

  expect(screen.getByText('Lead revival sequence')).toBeInTheDocument();
  expect(screen.getByText('Call To Action')).toBeInTheDocument();
  expect(screen.getByText('Reply "CHECKLIST" and I will send it.')).toBeInTheDocument();
  expect(screen.queryByText(/"sequenceName"/)).not.toBeInTheDocument();
});

test('StudioMessage shows a polished structured placeholder while structured content is still streaming', () => {
  const message = {
    id: 'streaming',
    role: 'assistant',
    content: '{\n  "agent": "herald",\n  "sequenceName": "Lead revival sequence"',
  };

  renderWithProviders(<StudioMessage message={message} agent={HERALD_AGENT} streaming />);

  expect(screen.getByText('Lead revival sequence')).toBeInTheDocument();
  expect(screen.getByText(/Preparing subject lines, body copy, and CTA/i)).toBeInTheDocument();
  expect(screen.queryByText(/"sequenceName"/)).not.toBeInTheDocument();
  expect(screen.queryByText('Structured output')).not.toBeInTheDocument();
});

test('StudioMessage shows a task-aware thinking walkthrough while the reply is being prepared', () => {
  const message = {
    id: 'thinking',
    role: 'assistant',
    content: '',
  };

  renderWithProviders(
    <StudioMessage
      message={message}
      agent={HERALD_AGENT}
      streaming
      streamingTask={{ kind: 'chat', agentId: 'herald', useLore: true, hasAttachments: false }}
    />,
  );

  expect(screen.getByText('HERALD is drafting the sequence')).toBeInTheDocument();
  expect(screen.getByText(/Shaping the outreach angle, drafting the copy, and polishing the final message/i)).toBeInTheDocument();
  expect(screen.getByText('Reviewing the audience and objective')).toBeInTheDocument();
  expect(screen.getByText('Cross-checking prior conversations and lore')).toBeInTheDocument();
});
