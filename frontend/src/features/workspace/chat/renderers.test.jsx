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
