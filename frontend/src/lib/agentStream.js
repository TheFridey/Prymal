export async function consumeAgentStream(response, handlers) {
  if (!response.ok) {
    let message = `Streaming request failed with status ${response.status}.`;
    let payload = null;

    try {
      payload = await response.json();
      message = payload?.error || payload?.message || message;
    } catch {
      // Non-JSON error responses still surface via the HTTP status message.
    }

    const error = new Error(message);
    error.status = response.status;
    error.code = payload?.code ?? null;
    error.upgrade = Boolean(payload?.upgrade);
    error.retryAfter = Number(payload?.retryAfter ?? response.headers.get('retry-after') ?? 0) || null;
    error.requestId = payload?.requestId ?? response.headers.get('x-request-id') ?? null;
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
    if (event.type === 'grounding_sources') {
      handlers.onGroundingSources?.(event);
      return;
    }
    if (event.type === 'error') {
      terminalReceived = true;
      const error = new Error(event.message || 'Streaming failed.');
      error.code = event.code;
      error.upgrade = event.upgrade;
      error.retryAfter = Number(event.retryAfter ?? 0) || null;
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

      dispatchRawEvent(dataLine.slice(6));
    }
  }

  if (buffer.trim()) {
    const dataLine = buffer
      .split('\n')
      .find((line) => line.startsWith('data: '));

    if (dataLine) {
      dispatchRawEvent(dataLine.slice(6));
    }
  }

  if (!terminalReceived) {
    const error = new Error(
      'The agent response ended unexpectedly. Please try again.',
    );
    error.code = 'STREAM_INCOMPLETE';
    throw error;
  }

  function dispatchRawEvent(raw) {
    let event;

    try {
      event = JSON.parse(raw);
    } catch (parseError) {
      terminalReceived = true;
      const error = new Error('The agent stream returned malformed data. Please retry your message.');
      error.code = 'STREAM_PARSE_FAILED';
      error.cause = parseError;
      throw error;
    }

    dispatchEvent(event);
  }
}
