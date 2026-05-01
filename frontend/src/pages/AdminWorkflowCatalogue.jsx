import { useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, EmptyState, InlineNotice, LoadingPanel, PageHeader, PageShell, SectionLabel, StatusPill, SurfaceCard } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

export default function AdminWorkflowCatalogue() {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const [reasonById, setReasonById] = useState({});
  const query = useQuery({
    queryKey: ['admin-workflow-catalogue-submissions'],
    queryFn: () => api.get('/admin/workflow-catalogue/submissions'),
  });

  const approveMutation = useMutation({
    mutationFn: (itemId) => api.post(`/admin/workflow-catalogue/${itemId}/approve`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-workflow-catalogue-submissions'] });
      notify({ type: 'success', title: 'Workflow approved', message: 'The listing is now published.' });
    },
  });

  const rejectMutation = useMutation({
    mutationFn: ({ itemId, reason }) => api.post(`/admin/workflow-catalogue/${itemId}/reject`, { reason }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['admin-workflow-catalogue-submissions'] });
      notify({ type: 'success', title: 'Workflow rejected', message: 'The creator can revise and resubmit.' });
    },
  });

  const items = query.data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Admin"
        title="Workflow Catalogue review"
        description="Approve curated submissions, inspect validation warnings, and keep the catalogue high quality."
        accent="#F72585"
      />
      <SurfaceCard title="Pending submissions" subtitle={`${items.length} awaiting review`} accent="#F72585">
        {query.isLoading ? <LoadingPanel label="Loading review queue..." /> : null}
        {query.isError ? <InlineNotice tone="danger">{getErrorMessage(query.error)}</InlineNotice> : null}
        {!query.isLoading && items.length === 0 ? (
          <EmptyState title="No pending submissions" description="User submissions will appear here after they are sent for review." accent="#F72585" />
        ) : null}
        <div style={{ display: 'grid', gap: 14 }}>
          {items.map((item) => (
            <article key={item.id} className="workspace-workflow-panel__workflow" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{item.shortDescription}</p>
                </div>
                <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
                  <StatusPill color="#4CC9F0">{item.category}</StatusPill>
                  <StatusPill color="#F59E0B">{item.difficulty}</StatusPill>
                  <StatusPill color={item.pricingType === 'premium' ? '#F59E0B' : '#00FFD1'}>{item.pricingType}</StatusPill>
                </div>
              </div>

              <SectionLabel>Validation warnings</SectionLabel>
              {item.validationWarnings?.length ? (
                <ul>{item.validationWarnings.map((warning) => <li key={warning}>{warning}</li>)}</ul>
              ) : <p style={{ color: 'var(--text-muted)' }}>No catalogue validation warnings.</p>}

              <SectionLabel>Workflow preview</SectionLabel>
              <div style={{ display: 'grid', gap: 8 }}>
                {(item.templateWorkflowDefinition?.nodes ?? []).map((node) => (
                  <div key={node.id} style={{ color: 'var(--text-muted)' }}>
                    {node.agentId?.toUpperCase()} · {node.label || node.outputVar}
                  </div>
                ))}
              </div>

              <div style={{ display: 'flex', gap: 8, marginTop: 14, flexWrap: 'wrap' }}>
                <Button tone="accent" onClick={() => approveMutation.mutate(item.id)} disabled={approveMutation.isPending}>
                  Approve and publish
                </Button>
                <input
                  aria-label={`Rejection reason for ${item.title}`}
                  placeholder="Rejection reason"
                  value={reasonById[item.id] ?? ''}
                  onChange={(event) => setReasonById({ ...reasonById, [item.id]: event.target.value })}
                />
                <Button
                  tone="danger"
                  onClick={() => rejectMutation.mutate({ itemId: item.id, reason: reasonById[item.id] ?? '' })}
                  disabled={(reasonById[item.id] ?? '').trim().length < 5 || rejectMutation.isPending}
                >
                  Reject
                </Button>
              </div>
            </article>
          ))}
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
