import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { formatDateTime, getErrorMessage, truncate } from '../../../lib/utils';
import {
  Button,
  EmptyState,
  InlineNotice,
  SectionLabel,
  TextInput,
} from '../../../components/ui';
import { useAppStore } from '../../../stores/useAppStore';
import { MotionList, MotionListItem, MotionPresence, MotionSection } from '../../../components/motion';

const WEBHOOK_EVENT_OPTIONS = [
  'workflow.completed',
  'workflow.failed',
  'workflow.node.completed',
  'workflow.node.failed',
];

const SECRET_REVEAL_MS = 30_000;

function generateWebhookSecret() {
  return crypto.randomUUID().replace(/-/g, '') + crypto.randomUUID().replace(/-/g, '');
}

function validateWebhookForm({ url, secret, events }) {
  if (!url.trim()) {
    return 'Webhook URL is required.';
  }

  if (!url.trim().startsWith('https://')) {
    return 'Webhook URL must start with https://.';
  }

  if (events.length === 0) {
    return 'Select at least one webhook event.';
  }

  if (!secret.trim()) {
    return 'Webhook secret is required.';
  }

  if (secret.trim().length < 16) {
    return 'Webhook secret must be at least 16 characters long.';
  }

  return null;
}

function EventChip({ children }) {
  return (
    <span
      style={{
        padding: '4px 8px',
        borderRadius: '999px',
        background: 'rgba(189, 224, 254, 0.12)',
        border: '1px solid rgba(189, 224, 254, 0.18)',
        color: '#BDE0FE',
        fontSize: '11px',
        lineHeight: 1.2,
      }}
    >
      {children}
    </span>
  );
}

function WebhookRow({ webhook, onToggle, onDelete, pendingToggleId, pendingDeleteId }) {
  return (
    <div
      style={{
        display: 'grid',
        gap: '12px',
        padding: '14px',
        borderRadius: '14px',
        border: '1px solid var(--line)',
        background: 'var(--panel-soft)',
      }}
    >
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <div style={{ minWidth: 0, flex: '1 1 320px' }}>
          <div
            title={webhook.url}
            style={{
              color: 'var(--text-strong)',
              fontFamily: 'var(--ff-mono)',
              fontSize: '12px',
              lineHeight: 1.6,
              marginBottom: '6px',
              wordBreak: 'break-all',
            }}
          >
            {truncate(webhook.url, 60)}
          </div>
          <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
            {webhook.events.map((eventName) => (
              <EventChip key={eventName}>{eventName}</EventChip>
            ))}
          </div>
        </div>

        <div style={{ display: 'grid', gap: '10px', justifyItems: 'end', minWidth: '180px' }}>
          <label
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              color: 'var(--muted)',
              fontSize: '12px',
              cursor: 'pointer',
            }}
          >
            <input
              type="checkbox"
              checked={webhook.enabled}
              onChange={() => onToggle(webhook)}
              disabled={pendingToggleId === webhook.id}
            />
            <span>{webhook.enabled ? 'Enabled' : 'Disabled'}</span>
          </label>

          <div style={{ color: 'var(--muted-2)', fontSize: '12px' }}>
            Created {formatDateTime(webhook.createdAt)}
          </div>

          <Button
            tone="ghost"
            onClick={() => onDelete(webhook)}
            disabled={pendingDeleteId === webhook.id}
          >
            Delete
          </Button>
        </div>
      </div>
    </div>
  );
}

function LoadingSkeletonRows() {
  return (
    <div style={{ display: 'grid', gap: '10px' }}>
      {[0, 1].map((index) => (
        <div
          key={index}
          style={{
            height: '82px',
            borderRadius: '14px',
            border: '1px solid var(--line)',
            background:
              'linear-gradient(90deg, rgba(255,255,255,0.04) 0%, rgba(255,255,255,0.08) 50%, rgba(255,255,255,0.04) 100%)',
          }}
        />
      ))}
    </div>
  );
}

export function WebhookSubscriptionsPanel({ workflowId, initialWebhooks = null }) {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const [formOpen, setFormOpen] = useState(false);
  const [url, setUrl] = useState('');
  const [secret, setSecret] = useState('');
  const [selectedEvents, setSelectedEvents] = useState(['workflow.completed']);
  const [formError, setFormError] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [revealedSecret, setRevealedSecret] = useState(null);
  const [secretExpiresAt, setSecretExpiresAt] = useState(null);

  const webhooksQuery = useQuery({
    queryKey: ['workflow-webhooks', workflowId],
    queryFn: () => api.get('/workflows/webhooks'),
    initialData: initialWebhooks ? { webhooks: initialWebhooks } : undefined,
  });

  const allWebhooks = webhooksQuery.data?.webhooks ?? [];
  const workflowWebhooks = useMemo(
    () => allWebhooks.filter((webhook) => webhook.workflowId === workflowId),
    [allWebhooks, workflowId],
  );
  const orgWideWebhooks = useMemo(
    () => allWebhooks.filter((webhook) => webhook.workflowId == null),
    [allWebhooks],
  );
  const hasSubscriptions = workflowWebhooks.length > 0 || orgWideWebhooks.length > 0;

  useEffect(() => {
    if (!secretExpiresAt) {
      return undefined;
    }

    const remainingMs = secretExpiresAt - Date.now();
    if (remainingMs <= 0) {
      setRevealedSecret(null);
      setSecretExpiresAt(null);
      return undefined;
    }

    const timer = window.setTimeout(() => {
      setRevealedSecret(null);
      setSecretExpiresAt(null);
    }, remainingMs);

    return () => window.clearTimeout(timer);
  }, [secretExpiresAt]);

  const createMutation = useMutation({
    mutationFn: () =>
      api.post('/workflows/webhooks', {
        workflowId,
        url: url.trim(),
        secret: secret.trim(),
        events: selectedEvents,
      }),
    onSuccess: async (data) => {
      setUrl('');
      setSecret('');
      setSelectedEvents(['workflow.completed']);
      setFormError('');
      setFormOpen(false);
      setSuccessMessage('Webhook added. The secret was shown once — save it now.');
      setRevealedSecret(data.secret ?? null);
      setSecretExpiresAt((data.secret ?? null) ? Date.now() + SECRET_REVEAL_MS : null);

      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks', workflowId] }),
      ]);
    },
    onError: (error) => {
      setSuccessMessage('');
      setFormError(getErrorMessage(error));
    },
  });

  const toggleMutation = useMutation({
    mutationFn: (webhook) =>
      api.patch(`/workflows/webhooks/${webhook.id}`, {
        enabled: !webhook.enabled,
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks', workflowId] }),
      ]);
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Webhook update failed',
        message: getErrorMessage(error),
      });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (webhookId) => api.delete(`/workflows/webhooks/${webhookId}`),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-webhooks', workflowId] }),
      ]);
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Webhook removal failed',
        message: getErrorMessage(error),
      });
    },
  });

  function toggleEvent(eventName) {
    setSelectedEvents((current) =>
      current.includes(eventName)
        ? current.filter((value) => value !== eventName)
        : [...current, eventName],
    );
  }

  function handleCreate(event) {
    event.preventDefault();
    const nextError = validateWebhookForm({
      url,
      secret,
      events: selectedEvents,
    });

    if (nextError) {
      setFormError(nextError);
      return;
    }

    setFormError('');
    setSuccessMessage('');
    createMutation.mutate();
  }

  async function handleCopySecret() {
    if (!revealedSecret) {
      return;
    }

    try {
      await navigator.clipboard.writeText(revealedSecret);
      notify({
        type: 'success',
        title: 'Secret copied',
        message: 'The webhook secret has been copied to your clipboard.',
      });
    } catch (error) {
      notify({
        type: 'error',
        title: 'Copy failed',
        message: error?.message || 'Clipboard access was not available.',
      });
    }
  }

  function handleDelete(webhook) {
    if (window.confirm('Remove webhook? Deliveries to this URL will stop immediately.')) {
      deleteMutation.mutate(webhook.id);
    }
  }

  return (
    <div style={{ display: 'grid', gap: '14px', marginTop: '14px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
        <div>
          <SectionLabel>Webhook subscriptions</SectionLabel>
          <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7, marginTop: '6px' }}>
            Add outbound callbacks for workflow completions, failures, and node-level events.
          </div>
        </div>
        <Button
          tone={formOpen ? 'ghost' : 'accent'}
          onClick={() => {
            setFormOpen((current) => !current);
            setFormError('');
          }}
        >
          {formOpen ? 'Close form' : '+ Add webhook'}
        </Button>
      </div>

      <MotionPresence initial={false}>
        {successMessage ? (
          <MotionSection key="success-block" reveal={{ y: 10, blur: 4 }}>
            <div style={{ display: 'grid', gap: '10px' }}>
              <InlineNotice tone="success">{successMessage}</InlineNotice>
              <MotionPresence initial={false}>
                {revealedSecret ? (
                  <MotionSection key="secret-reveal" reveal={{ y: 8, blur: 4 }}>
                    <div
                      style={{
                        display: 'grid',
                        gap: '8px',
                        padding: '14px',
                        borderRadius: '14px',
                        border: '1px solid rgba(34, 197, 94, 0.24)',
                        background: 'rgba(34, 197, 94, 0.08)',
                      }}
                    >
                      <div style={{ color: 'var(--success-ink)', fontSize: '12px' }}>
                        Secret visible for 30 seconds only.
                      </div>
                      <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                        <TextInput
                          readOnly
                          value={revealedSecret}
                          style={{
                            flex: '1 1 320px',
                            fontFamily: 'var(--ff-mono)',
                          }}
                        />
                        <Button tone="ghost" onClick={handleCopySecret}>
                          Copy
                        </Button>
                      </div>
                    </div>
                  </MotionSection>
                ) : null}
              </MotionPresence>
            </div>
          </MotionSection>
        ) : null}
      </MotionPresence>

      <MotionPresence initial={false}>
        {formOpen ? (
        <MotionSection key="webhook-form" reveal={{ y: 12, blur: 4 }}>
        <form
          onSubmit={handleCreate}
          style={{
            display: 'grid',
            gap: '12px',
            padding: '16px',
            borderRadius: '16px',
            border: '1px solid var(--line)',
            background: 'var(--panel-soft)',
          }}
        >
          <div style={{ display: 'grid', gap: '6px' }}>
            <SectionLabel>Webhook URL</SectionLabel>
            <TextInput
              value={url}
              onChange={(event) => setUrl(event.target.value)}
              placeholder="https://your-server.com/webhook"
              required
            />
          </div>

          <div style={{ display: 'grid', gap: '8px' }}>
            <SectionLabel>Events</SectionLabel>
            <div style={{ display: 'grid', gap: '8px' }}>
              {WEBHOOK_EVENT_OPTIONS.map((eventName) => (
                <label
                  key={eventName}
                  style={{
                    display: 'flex',
                    gap: '8px',
                    alignItems: 'center',
                    color: 'var(--text)',
                    fontSize: '13px',
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedEvents.includes(eventName)}
                    onChange={() => toggleEvent(eventName)}
                  />
                  <span>{eventName}</span>
                </label>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gap: '6px' }}>
            <SectionLabel>Secret</SectionLabel>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              <TextInput
                type="password"
                value={secret}
                onChange={(event) => setSecret(event.target.value)}
                minLength={16}
                style={{ flex: '1 1 320px' }}
              />
              <Button
                type="button"
                tone="ghost"
                onClick={() => setSecret(generateWebhookSecret())}
              >
                Generate
              </Button>
            </div>
          </div>

          {formError ? <InlineNotice tone="danger">{formError}</InlineNotice> : null}

          <div style={{ display: 'flex', justifyContent: 'flex-end' }}>
            <Button type="submit" tone="accent" disabled={createMutation.isPending}>
              {createMutation.isPending ? 'Adding webhook...' : 'Add webhook'}
            </Button>
          </div>
        </form>
        </MotionSection>
        ) : null}
      </MotionPresence>

      {webhooksQuery.isLoading ? <LoadingSkeletonRows /> : null}
      {webhooksQuery.isError ? <InlineNotice tone="danger">{getErrorMessage(webhooksQuery.error)}</InlineNotice> : null}

      {!webhooksQuery.isLoading && !webhooksQuery.isError && !hasSubscriptions ? (
        <EmptyState
          title="No webhook subscriptions yet"
          description="Add one to receive HTTP callbacks when this workflow runs."
          accent="#BDE0FE"
        />
      ) : null}

      {!webhooksQuery.isLoading && !webhooksQuery.isError && hasSubscriptions ? (
        <div style={{ display: 'grid', gap: '16px' }}>
          <div style={{ display: 'grid', gap: '10px' }}>
            <SectionLabel>Workflow-specific</SectionLabel>
            {workflowWebhooks.length === 0 ? (
              <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>
                No workflow-specific subscriptions yet.
              </div>
            ) : (
              <MotionList>
                {workflowWebhooks.map((webhook) => (
                  <MotionListItem key={webhook.id}>
                    <WebhookRow
                      webhook={webhook}
                      onToggle={toggleMutation.mutate}
                      onDelete={handleDelete}
                      pendingToggleId={toggleMutation.variables?.id}
                      pendingDeleteId={deleteMutation.variables}
                    />
                  </MotionListItem>
                ))}
              </MotionList>
            )}
          </div>

          {orgWideWebhooks.length > 0 ? (
            <div style={{ display: 'grid', gap: '10px' }}>
              <SectionLabel>Org-wide</SectionLabel>
              <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>
                These subscriptions receive workflow events for every workflow in the organisation.
              </div>
              <MotionList>
                {orgWideWebhooks.map((webhook) => (
                  <MotionListItem key={webhook.id}>
                    <WebhookRow
                      webhook={webhook}
                      onToggle={toggleMutation.mutate}
                      onDelete={handleDelete}
                      pendingToggleId={toggleMutation.variables?.id}
                      pendingDeleteId={deleteMutation.variables}
                    />
                  </MotionListItem>
                ))}
              </MotionList>
            </div>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}

export default WebhookSubscriptionsPanel;
