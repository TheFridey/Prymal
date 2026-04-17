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
  let terminalReceived = false;

  function dispatchEvent(event) {
    if (event.type === 'chunk') {
      handlers.onChunk?.(event.text ?? '');
      return;
    }
    if (event.type === 'started') {
      handlers.onStarted?.(event);
      return;
    }
    if (event.type === 'done') {
      terminalReceived = true;
      handlers.onDone?.(event);
      return;
    }
    if (event.type === 'hold') {
      terminalReceived = true;
      handlers.onHold?.(event);
      return;
    }
    if (event.type === 'error') {
      terminalReceived = true;
      const error = new Error(event.message || 'Streaming failed.');
      error.code = event.code;
      error.upgrade = event.upgrade;
      error.conversationId = event.conversationId ?? null;
      throw error;
    }
  }

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

      dispatchEvent(JSON.parse(dataLine.slice(6)));
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (dataLine) {
      dispatchEvent(JSON.parse(dataLine.slice(6)));
    }
  }

  if (!terminalReceived) {
    const error = new Error(
      'The agent response ended unexpectedly. Please try again.',
    );
    error.code = 'STREAM_INCOMPLETE';
    throw error;
  }
}
