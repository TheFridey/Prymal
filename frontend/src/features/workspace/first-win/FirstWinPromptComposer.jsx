import { useEffect, useMemo, useState } from 'react';
import { Button, InlineNotice, TextArea, TextInput } from '../../../components/ui';
import {
  FIRST_WIN_STATES,
  buildFirstWinPrompt,
  getFirstRunOutcome,
  writeFirstWinState,
} from '../../../lib/first-run-outcomes';
import { trackProductEvent } from '../../../lib/product-events';

export default function FirstWinPromptComposer({
  outcomeId,
  activeAgent,
  userId = 'local',
  onConfirm,
  onClose,
}) {
  const outcome = getFirstRunOutcome(outcomeId);
  const defaults = outcome?.defaultValues ?? {};
  const [values, setValues] = useState(() => ({
    goal: defaults.goal ?? '',
    audience: defaults.audience ?? '',
    tone: defaults.tone ?? '',
    context: defaults.context ?? '',
    output: defaults.output ?? '',
  }));
  const [previewOpen, setPreviewOpen] = useState(false);

  useEffect(() => {
    if (!outcome) return;
    writeFirstWinState(userId, {
      state: FIRST_WIN_STATES.PROMPT_STARTED,
      outcomeId: outcome.id,
      recommendedAgentId: outcome.recommendedAgentId,
    });
    void trackProductEvent('first_win_prompt_started', {
      outcome_id: outcome.id,
      recommended_agent_id: outcome.recommendedAgentId,
    });
    void trackProductEvent('credit_estimate_shown', {
      surface: 'first_win_prompt_composer',
      outcome_id: outcome.id,
      credit_intensity: outcome.creditIntensity,
    });
  }, [outcome, userId]);

  const prompt = useMemo(
    () => buildFirstWinPrompt(outcome?.id, values),
    [outcome?.id, values],
  );

  if (!outcome) {
    return null;
  }

  function updateField(field, value) {
    setValues((current) => ({ ...current, [field]: value }));
  }

  async function handleConfirm() {
    writeFirstWinState(userId, {
      state: FIRST_WIN_STATES.PROMPT_SUBMITTED,
      outcomeId: outcome.id,
      recommendedAgentId: outcome.recommendedAgentId,
    });
    await trackProductEvent('first_win_prompt_submitted', {
      outcome_id: outcome.id,
      recommended_agent_id: outcome.recommendedAgentId,
      agent_id: activeAgent?.id ?? outcome.recommendedAgentId,
    });
    onConfirm?.(prompt);
  }

  return (
    <div
      style={{
        marginBottom: '14px',
        padding: '16px',
        borderRadius: '18px',
        border: `1px solid ${activeAgent?.color ?? '#68f5d0'}55`,
        background: 'linear-gradient(180deg, rgba(255,255,255,0.075), rgba(255,255,255,0.035))',
        display: 'grid',
        gap: '14px',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', alignItems: 'start', flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: '11px', letterSpacing: '0.14em', textTransform: 'uppercase', color: 'var(--muted)', marginBottom: '6px' }}>
            Guided first prompt
          </div>
          <strong style={{ color: 'var(--text-strong)', fontSize: '18px' }}>
            {outcome.title} with {activeAgent?.name ?? outcome.recommendedAgentId.toUpperCase()}
          </strong>
          <p style={{ margin: '6px 0 0', color: 'var(--muted)', lineHeight: 1.6 }}>
            {outcome.recommendationReason} Credit intensity: {outcome.creditIntensity}. Estimate only; final billing is enforced server-side.
          </p>
        </div>
        <Button tone="ghost" onClick={onClose}>Use blank chat</Button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '10px' }}>
        <label className="workspace-modal__field">
          <span>Goal</span>
          <TextInput value={values.goal} onChange={(event) => updateField('goal', event.target.value)} />
        </label>
        <label className="workspace-modal__field">
          <span>Audience / customer / context</span>
          <TextInput value={values.audience} onChange={(event) => updateField('audience', event.target.value)} />
        </label>
        <label className="workspace-modal__field">
          <span>Tone / format</span>
          <TextInput value={values.tone} onChange={(event) => updateField('tone', event.target.value)} />
        </label>
        <label className="workspace-modal__field">
          <span>Output length / detail</span>
          <TextInput value={values.output} onChange={(event) => updateField('output', event.target.value)} />
        </label>
      </div>

      <label className="workspace-modal__field">
        <span>Optional source/context</span>
        <TextArea
          rows={4}
          value={values.context}
          onChange={(event) => updateField('context', event.target.value)}
          placeholder="Paste notes, CSV text, offer details, brand context, or constraints."
        />
      </label>

      {outcome.id === 'media_asset' ? (
        <InlineNotice tone="warning">
          PIXEL can help create image and video briefs. Video generation is high cost, one-shot renders are 4, 6, or 8 seconds, and reference images are currently Standard mode at 8 seconds only.
        </InlineNotice>
      ) : null}

      {previewOpen ? (
        <div style={{ display: 'grid', gap: '10px' }}>
          <div style={{ fontSize: '12px', color: 'var(--muted)', letterSpacing: '0.08em', textTransform: 'uppercase' }}>
            Prompt preview
          </div>
          <pre style={{ whiteSpace: 'pre-wrap', margin: 0, color: 'var(--text)', background: 'rgba(0,0,0,0.18)', border: '1px solid var(--line)', borderRadius: '14px', padding: '12px', lineHeight: 1.6 }}>
            {prompt}
          </pre>
        </div>
      ) : null}

      <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', justifyContent: 'space-between', alignItems: 'center' }}>
        <button
          type="button"
          className="pm-dash__nexus-linkish"
          onClick={() => setPreviewOpen((current) => !current)}
        >
          {previewOpen ? 'Hide prompt preview' : 'Preview prompt before sending'}
        </button>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
          <Button tone="ghost" onClick={onClose}>Cancel</Button>
          <Button tone="accent" onClick={handleConfirm} disabled={!values.goal.trim()}>
            Confirm and send
          </Button>
        </div>
      </div>
    </div>
  );
}
