import { fireEvent, screen, waitFor } from '@testing-library/react';
import { vi } from 'vitest';
import { renderWithProviders } from '../../../test/renderWithProviders';

const mockApi = vi.hoisted(() => ({
  get: vi.fn(),
  post: vi.fn(),
}));

vi.mock('../../../lib/api', () => ({
  api: mockApi,
}));

import { StudioMessage } from './renderers';

const HERALD_AGENT = {
  id: 'herald',
  name: 'HERALD',
  title: 'Email & Outreach Strategist',
  color: '#FF6B35',
  glyph: 'H',
};

beforeEach(() => {
  mockApi.get.mockReset();
  mockApi.post.mockReset();
});

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

test('StudioMessage renders only safe evidence metadata for normal users', () => {
  const message = {
    id: 'message-safe-evidence',
    role: 'assistant',
    content: 'Here is the answer.',
    metadata: {
      sources: [
        {
          title: 'ICP notes',
          sourceUrl: 'https://example.com/icp',
          origin: 'workspace_knowledge',
          freshness: 'fresh',
          confidenceLevel: 'high',
          contradictionWarning: 'One source is older than the current positioning memo.',
          provider: 'hidden-provider',
          routeReason: 'hidden-route-reason',
        },
      ],
      evidenceSummary: {
        confidenceLevel: 'high',
        sourceCount: 1,
        sourceFreshness: 'fresh',
        contradictionSeverity: 'low',
        origins: ['workspace_knowledge'],
      },
      provider: 'anthropic',
      model: 'claude-secret',
      policyKey: 'premium_reasoning',
      fallbackProvider: 'openai',
    },
  };

  renderWithProviders(<StudioMessage message={message} agent={HERALD_AGENT} />);

  expect(screen.getByText(/Evidence confidence: high/i)).toBeInTheDocument();
  expect(screen.queryByText(/anthropic/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/claude-secret/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/premium_reasoning/i)).not.toBeInTheDocument();

  fireEvent.click(screen.getByRole('button', { name: /open evidence/i }));

  expect(screen.getAllByText(/ICP notes/i).length).toBeGreaterThan(0);
  expect(screen.getAllByText(/workspace knowledge/i).length).toBeGreaterThan(0);
  expect(screen.getByText(/older than the current positioning memo/i)).toBeInTheDocument();
  expect(screen.queryByText(/hidden-provider/i)).not.toBeInTheDocument();
  expect(screen.queryByText(/hidden-route-reason/i)).not.toBeInTheDocument();
});

test('StudioMessage can request approval to publish an agent reply to a connected social platform', async () => {
  mockApi.get.mockResolvedValue({
    available: [],
    connected: [
      {
        id: 'integration_1',
        service: 'linkedin',
        name: 'LinkedIn',
        supportsPublish: true,
        publishDisabled: false,
        meta: {
          settings: {
            authorUrn: 'urn:li:organization:115856278',
          },
        },
      },
    ],
  });
  mockApi.post.mockResolvedValueOnce({
    success: false,
    awaitingApproval: true,
    approvalId: 'approval_1',
    approvalToken: 'approval_token',
    risk: { level: 'medium' },
  });

  const message = {
    id: 'message-social',
    role: 'assistant',
    content: 'Post copy for LinkedIn from an agent reply.',
  };

  renderWithProviders(<StudioMessage message={message} agent={HERALD_AGENT} />);

  fireEvent.click(screen.getByRole('button', { name: /publish to social/i }));
  expect(await screen.findByText('Publish from this reply')).toBeInTheDocument();
  await waitFor(() => expect(mockApi.get).toHaveBeenCalledWith('/integrations'));

  fireEvent.click(await screen.findByRole('button', { name: /request approval/i }));

  await waitFor(() => {
    expect(mockApi.post).toHaveBeenCalledWith('/actions/execute', {
      type: 'social.publish',
      payload: expect.objectContaining({
        service: 'linkedin',
        text: 'Post copy for LinkedIn from an agent reply.',
        messageId: 'message-social',
        sourceAgent: 'herald',
      }),
    });
  });

  expect(await screen.findByText('Action pending approval')).toBeInTheDocument();
  expect(screen.getByText('Publish social post')).toBeInTheDocument();
});
