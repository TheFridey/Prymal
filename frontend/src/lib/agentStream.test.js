import { consumeAgentStream } from './agentStream';

function streamResponse(events) {
  const body = new ReadableStream({
    start(controller) {
      for (const event of events) {
        controller.enqueue(new TextEncoder().encode(event));
      }
      controller.close();
    },
  });

  return new Response(body, { status: 200 });
}

test('consumeAgentStream handles a complete held response as terminal', async () => {
  const holdEvents = [];

  await consumeAgentStream(
    streamResponse([
      'data: {"type":"started","conversationId":"c1"}\n\n',
      'data: {"type":"hold","message":"Held","conversationId":"c1"}\n\n',
    ]),
    {
      onHold: (event) => holdEvents.push(event),
    },
  );

  expect(holdEvents).toHaveLength(1);
  expect(holdEvents[0]).toMatchObject({ type: 'hold', conversationId: 'c1' });
});

test('consumeAgentStream throws a user-safe error for malformed stream data', async () => {
  await expect(
    consumeAgentStream(
      streamResponse(['data: {"type":"chunk","text":\n\n']),
      {},
    ),
  ).rejects.toMatchObject({ code: 'STREAM_PARSE_FAILED' });
});

test('consumeAgentStream fails clearly when no terminal event arrives', async () => {
  await expect(
    consumeAgentStream(
      streamResponse(['data: {"type":"chunk","text":"partial"}\n\n']),
      {},
    ),
  ).rejects.toMatchObject({ code: 'STREAM_INCOMPLETE' });
});
