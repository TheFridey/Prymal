import { useCallback, useState } from 'react';
import { api } from '../../../lib/api';

const EVENTS = [
  { id: 'output.feedback_useful', label: 'Useful' },
  { id: 'output.feedback_not_useful', label: 'Not useful' },
  { id: 'output.feedback_rerun', label: 'Run again' },
];

export default function AgentMessageFeedback({ agentId, conversationId, messageId, onInsertDraft }) {
  const [picked, setPicked] = useState(null);

  const send = useCallback(
    async (eventName, extra = {}) => {
      try {
        await api.post('/org/product-events', {
          eventName,
          metadata: {
            agentId,
            conversationId,
            messageId,
            ...extra,
          },
        });
        setPicked(eventName);
      } catch {
        // Non-blocking; telemetry is best-effort in the client.
      }
    },
    [agentId, conversationId, messageId],
  );

  if (!messageId || picked) {
    return picked ? (
      <div className="workspace-studio__feedback-thanks" aria-live="polite">
        Feedback recorded — we use this to sharpen value.
      </div>
    ) : null;
  }

  return (
    <div className="workspace-studio__feedback-row" role="group" aria-label="Was this output useful?">
      {EVENTS.map((e) => (
        <button key={e.id} type="button" className="workspace-studio__feedback-pill" onClick={() => send(e.id)}>
          {e.label}
        </button>
      ))}
      {onInsertDraft ? (
        <button
          type="button"
          className="workspace-studio__feedback-pill workspace-studio__feedback-pill--ghost"
          onClick={() => {
            onInsertDraft('Improve this answer: make it clearer, shorter, and more actionable.');
            void send('output.feedback_improve', { intent: 'improve_from_ui' });
          }}
        >
          Improve answer
        </button>
      ) : (
        <button type="button" className="workspace-studio__feedback-pill workspace-studio__feedback-pill--ghost" onClick={() => send('output.feedback_improve')}>
          Improve answer
        </button>
      )}
    </div>
  );
}
