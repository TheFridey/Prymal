import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, EmptyState, InlineNotice, LoadingPanel, PageHeader, PageShell, StatusPill, SurfaceCard } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

const STATUS_COLOR = {
  not_submitted: '#98A2B3',
  pending: '#F59E0B',
  approved: '#00FFD1',
  rejected: '#EF4444',
};

export default function WorkflowCatalogueSubmissions() {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const query = useQuery({ queryKey: ['workflow-catalogue-mine'], queryFn: () => api.get('/workflow-catalogue/mine') });
  const submitMutation = useMutation({
    mutationFn: (itemId) => api.post(`/workflow-catalogue/${itemId}/submit`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflow-catalogue-mine'] });
      notify({ type: 'success', title: 'Submitted', message: 'Your workflow is now in the review queue.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Submit failed', message: getErrorMessage(error) }),
  });

  const items = query.data?.items ?? [];

  return (
    <PageShell>
      <PageHeader
        eyebrow="Workflow Catalogue"
        title="Your workflow submissions"
        description="Track drafts, pending reviews, approved workflows, and rejected submissions."
        accent="#4CC9F0"
        actions={<Link className="pm-btn pm-btn--primary" to="/app/workflows/catalogue/create">Create listing</Link>}
      />
      <SurfaceCard title="Submission queue" subtitle={`${items.length} catalogue listings`} accent="#4CC9F0">
        {query.isLoading ? <LoadingPanel label="Loading submissions..." /> : null}
        {query.isError ? <InlineNotice tone="danger">{getErrorMessage(query.error)}</InlineNotice> : null}
        {!query.isLoading && items.length === 0 ? (
          <EmptyState title="No submissions yet" description="Create a listing from one of your workflows to submit it for review." accent="#4CC9F0" />
        ) : null}
        <div style={{ display: 'grid', gap: 12 }}>
          {items.map((item) => (
            <article key={item.id} className="workspace-workflow-panel__workflow" style={{ padding: 16 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', gap: 12, flexWrap: 'wrap' }}>
                <div>
                  <h3 style={{ margin: 0 }}>{item.title}</h3>
                  <p style={{ color: 'var(--text-muted)' }}>{item.shortDescription}</p>
                </div>
                <StatusPill color={STATUS_COLOR[item.reviewStatus] ?? '#98A2B3'}>{item.reviewStatus}</StatusPill>
              </div>
              {item.rejectionReason ? <InlineNotice tone="danger">{item.rejectionReason}</InlineNotice> : null}
              <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
                {['draft', 'private', 'rejected'].includes(item.visibility) ? (
                  <Button tone="accent" onClick={() => submitMutation.mutate(item.id)} disabled={submitMutation.isPending}>
                    Submit for review
                  </Button>
                ) : null}
                {item.visibility === 'published' ? (
                  <Link className="pm-btn pm-btn--ghost" to={`/app/workflows/catalogue/${item.slug}`}>View published listing</Link>
                ) : null}
              </div>
            </article>
          ))}
        </div>
      </SurfaceCard>
    </PageShell>
  );
}
