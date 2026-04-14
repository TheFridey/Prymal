import { useEffect } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useSearchParams } from 'react-router-dom';
import { API_BASE_URL, api } from '../lib/api';
import { INTEGRATION_LIBRARY } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, PageHeader, PageShell, StatGrid, StatusPill, SurfaceCard } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

export default function Integrations() {
  const [searchParams] = useSearchParams();
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const integrationsQuery = useQuery({
    queryKey: ['integrations'],
    queryFn: () => api.get('/integrations'),
  });

  const disconnectMutation = useMutation({
    mutationFn: (service) => api.delete(`/integrations/${service}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['integrations'] });
      notify({ type: 'success', title: 'Integration disconnected', message: 'The connection was marked inactive for this organisation.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Disconnect failed', message: getErrorMessage(error) });
    },
  });

  useEffect(() => {
    const connected = searchParams.get('connected');
    const error = searchParams.get('error');
    if (connected) {
      notify({ type: 'success', title: 'Integration connected', message: `${connected} is now available to the current organisation.` });
    }
    if (error) {
      notify({ type: 'error', title: 'OAuth failed', message: error.replace(/_/g, ' ') });
    }
  }, [notify, searchParams]);

  const connected = integrationsQuery.data?.connected ?? [];
  const available = integrationsQuery.data?.available ?? [];
  const availableMap = Object.fromEntries(available.map((entry) => [entry.id, entry]));
  const stats = [
    { label: 'Connected', value: connected.length, helper: 'Active org-scoped integrations', accent: '#00FFD1' },
    { label: 'Configured', value: available.filter((entry) => entry.configured).length, helper: 'OAuth providers enabled on the server', accent: '#4CC9F0' },
  ];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Integrations"
        title="Org-scoped connections that match backend reality"
        description="The integration layer now exposes only the providers that the server actually implements: Gmail, Google Drive, Notion, and Slack. Upsert logic is scoped per organisation and service."
        accent="#00FFD1"
      />

      <StatGrid items={stats} />

      <InlineNotice tone="default">
        Token storage is encrypted server-side and each connection is unique per organisation and service. If a provider is not configured on the server, the UI now says so instead of pretending it works.
      </InlineNotice>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: '14px', marginTop: '14px' }}>
        {Object.entries(INTEGRATION_LIBRARY).map(([serviceId, meta]) => {
          const configuration = availableMap[serviceId];
          const connection = connected.find((entry) => entry.service === serviceId);
          const configured = Boolean(configuration?.configured);

          return (
            <SurfaceCard key={serviceId} accent={meta.color}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', marginBottom: '12px' }}>
                <div>
                  <div style={{ color: meta.color, fontSize: '11px', letterSpacing: '0.18em', textTransform: 'uppercase', marginBottom: '6px' }}>{meta.category}</div>
                  <div style={{ fontSize: '18px', marginBottom: '6px' }}>{meta.name}</div>
                </div>
                <div style={{ width: '40px', height: '40px', borderRadius: '14px', background: `${meta.color}12`, border: `1px solid ${meta.color}33`, display: 'grid', placeItems: 'center', color: meta.color, fontWeight: 700 }}>
                  {meta.icon}
                </div>
              </div>

              <div style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: '12px' }}>{meta.description}</div>

              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '14px' }}>
                {connection ? <StatusPill color="#00FFD1">Connected</StatusPill> : null}
                <StatusPill color={configured ? '#4CC9F0' : '#98A2B3'}>{configured ? 'Configured' : 'Server config needed'}</StatusPill>
              </div>

              {connection?.accountEmail ? <div style={{ color: 'var(--text-strong)', fontSize: '13px', marginBottom: '12px' }}>{connection.accountEmail}</div> : null}

              {connection ? (
                <Button tone="danger" onClick={() => disconnectMutation.mutate(serviceId)} disabled={disconnectMutation.isPending}>
                  Disconnect
                </Button>
              ) : (
                <a
                  href={configured ? `${API_BASE_URL}/integrations/${serviceId}/connect` : undefined}
                  style={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    padding: '11px 16px',
                    borderRadius: '12px',
                    border: '1px solid var(--line)',
                    color: 'var(--text)',
                    fontFamily: 'var(--ff-mono)',
                    fontSize: '11px',
                    fontWeight: 700,
                    letterSpacing: '0.12em',
                    textTransform: 'uppercase',
                    textDecoration: 'none',
                    opacity: configured ? 1 : 0.55,
                    pointerEvents: configured ? 'auto' : 'none',
                  }}
                >
                  Connect
                </a>
              )}
            </SurfaceCard>
          );
        })}
      </div>

      <SurfaceCard title="Webhook realism" accent="#BDB4FE" style={{ marginTop: '14px' }}>
        <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
          Webhook-triggered workflows use the backend route `/api/workflows/webhook/:workflowId/:secret`, and outbound workflow subscriptions are managed from the Workflows panel. Prymal keeps both surfaces tied to real backend routes instead of presenting a generic integration shell that is not wired up.
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
