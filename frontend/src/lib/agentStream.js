export async function consumeAgentStream(response, handlers) {
  if (!response.ok) {
    let message = `Streaming request failed with status ${response.status}.`;

    try {
      const data = await response.json();
      message = data?.error || data?.message || message;
    } catch {}

    const error = new Error(message);
    error.status = response.status;
    throw error;
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = '';

  while (true) {
    const { done, value } = await reader.read();
    if (done) {
      break;
    }

    buffer += decoder.decode(value, { stream: true });
    const segments = buffer.split('\n\n');
    buffer = segments.pop() ?? '';

    for (const segment of segments) {
      const dataLine = segment
        .split('\n')
        .find((line) => line.startsWith('data: '));

      if (!dataLine) {
        continue;
      }

      const event = JSON.parse(dataLine.slice(6));
      if (event.type === 'chunk') {
        handlers.onChunk?.(event.text ?? '');
      }
      if (event.type === 'started') {
        handlers.onStarted?.(event);
      }
      if (event.type === 'done') {
        handlers.onDone?.(event);
      }
      if (event.type === 'hold') {
        handlers.onHold?.(event);
      }
      if (event.type === 'error') {
        const error = new Error(event.message || 'Streaming failed.');
        error.code = event.code;
        error.upgrade = event.upgrade;
        error.conversationId = event.conversationId ?? null;
        throw error;
      }
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (dataLine) {
      const event = JSON.parse(dataLine.slice(6));
      if (event.type === 'done') {
        handlers.onDone?.(event);
      }
      if (event.type === 'started') {
        handlers.onStarted?.(event);
      }
      if (event.type === 'hold') {
        handlers.onHold?.(event);
      }
      if (event.type === 'error') {
        const error = new Error(event.message || 'Streaming failed.');
        error.code = event.code;
        error.upgrade = event.upgrade;
        error.conversationId = event.conversationId ?? null;
        throw error;
      }
    }
  }
}
