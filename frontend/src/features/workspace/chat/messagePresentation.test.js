import { buildMessagePresentation, getSpeechPreviewText } from './messagePresentation';

const RAW_AGENT_MESSAGE = `Executive summary: You're asking for today's plan. I don't yet have your actual priorities, but I can turn them into a simple project plan with owners, deadlines, and risks as soon as you share them (even as a short bullet list). Meanwhile, here's a quick "starter template" you can fill in right now.

Today’s plan (fill-in template)
| Task | Owner | Deadline (today) | Definition of done | Risks / blockers |
|---|---|---|---|---|
| 1. | | | | |
| 2. | | | | |
| 3. | | | | |
| 4. | | | | |

To generate your real plan, reply with:
Your priorities for today (3–8 bullets)
Any known due times (e.g., "before 3pm")
Who owns what (names or roles), if known
Any known risks/blockers (optional)

{
  "agent": "cipher",
  "summary": "User asked for today's plan but no priorities were provided.",
  "keyMetrics": {
    "confidenceLabel": "low"
  },
  "anomalies": [
    {
      "description": "No priorities were supplied.",
      "severity": "high"
    }
  ],
  "recommendations": [
    "Provide a short list of priorities."
  ]
}
10,023 tokens

Guide: How to Say "What Are Your Plans for Today" - How To Say Guide
web | fetch | search
Open
Guide: How to Say "What Are Your Plans for Today" - How To Say Guide Skip to content
Why this source won
Guide: How to Say "What Are Your Plans for Today" - How To Say Guide
HowToSayGuide.com: Master Language Nuances & Express Yourself Globally
Alternative Ways To Ask What's The Plan
web | fetch | search
Open
Alternative Ways To Ask What's The Plan
GrammarSir`;

test('buildMessagePresentation extracts markdown tables, structured JSON, and trace clutter cleanly', () => {
  const presentation = buildMessagePresentation({ content: RAW_AGENT_MESSAGE, agentId: 'atlas' });

  expect(presentation.markdown).toContain('Executive summary');
  expect(presentation.markdown).not.toContain('"agent": "cipher"');
  expect(presentation.markdown).not.toContain('web | fetch | search');
  expect(presentation.structuredData).toMatchObject({
    agent: 'cipher',
    summary: expect.stringContaining('no priorities'),
  });
  expect(presentation.traceSources).toHaveLength(2);
  expect(presentation.markdownBlocks).toEqual(
    expect.arrayContaining([
      expect.objectContaining({
        type: 'table',
        headers: ['Task', 'Owner', 'Deadline (today)', 'Definition of done', 'Risks / blockers'],
      }),
    ]),
  );
});

test('getSpeechPreviewText strips structured payloads and source traces from spoken copy', () => {
  const preview = getSpeechPreviewText({ content: RAW_AGENT_MESSAGE, agentId: 'atlas' });

  expect(preview).toContain('Executive summary');
  expect(preview).toContain('Task: 1.');
  expect(preview).not.toContain('web | fetch | search');
  expect(preview).not.toContain('"agent": "cipher"');
});
