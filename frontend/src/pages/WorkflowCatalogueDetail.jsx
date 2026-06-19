import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from 'react-router-dom';
import WorkflowBlueprintPreview from '../components/workflows/WorkflowBlueprintPreview';
import { api } from '../lib/api';
import { formatNumber, getErrorMessage } from '../lib/utils';
import { Button, InlineNotice, LoadingPanel, PageShell, StatusPill } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

export default function WorkflowCatalogueDetail() {
  const { slug } = useParams();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);

  const query = useQuery({
    queryKey: ['workflow-catalogue-item', slug],
    queryFn: () => api.get(`/workflow-catalogue/${slug}`),
    enabled: Boolean(slug),
  });

  const item = query.data?.item;
  const modeTag = resolveModeTag(item);
  const installMutation = useMutation({
    mutationFn: () => api.post(`/workflow-catalogue/${item.id}/install`),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workflow-catalogue'] }),
      ]);
      notify({ type: 'success', title: 'Workflow installed', message: 'The workflow is now available in your NEXUS workspace.' });
      navigate(result.route ?? '/app/workflows');
    },
    onError: (error) => notify({ type: 'error', title: 'Install failed', message: getErrorMessage(error) }),
  });

  return (
    <PageShell>
      {query.isLoading ? <LoadingPanel label="Loading workflow..." /> : null}
      {query.isError ? <InlineNotice tone="danger">{getErrorMessage(query.error)}</InlineNotice> : null}
      {item ? (
        <div className="workflow-catalogue-detail">
          <section className="workflow-catalogue-detail__hero" aria-labelledby="catalogue-detail-title">
            <div className="workflow-catalogue-detail__hero-card">
              <div className="workflow-catalogue-detail__badge-row">
                <StatusPill color="#4CC9F0">{item.category}</StatusPill>
                <StatusPill color={modeTag === 'advanced' ? '#BDB4FE' : '#00FFD1'}>{modeTag === 'advanced' ? 'Advanced' : 'Simple'}</StatusPill>
                <StatusPill color={item.publisherType === 'prymal_official' ? '#00FFD1' : '#BDE0FE'}>
                  {item.publisherType === 'prymal_official' ? 'Official Prymal' : 'Community'}
                </StatusPill>
              </div>

              <h1 id="catalogue-detail-title">{item.title}</h1>
              <p>{item.longDescription || item.shortDescription}</p>

              <div className="workflow-catalogue-detail__meta-row" aria-label="Workflow popularity">
                <StatusPill color="#98A2B3">{formatNumber(item.installCount ?? 0)} installs</StatusPill>
                <StatusPill color="#F59E0B">{item.ratingAverage ? `${item.ratingAverage.toFixed(1)} rating` : 'No rating yet'}</StatusPill>
                <StatusPill color="#98A2B3">{item.requiredPlan ? `${item.requiredPlan}+ required` : 'All plans'}</StatusPill>
              </div>

              <div className="workflow-catalogue-detail__actions">
                <Button tone="accent" onClick={() => installMutation.mutate()} disabled={installMutation.isPending || item.pricingType === 'premium'}>
                  {item.pricingType === 'premium' ? 'Purchase coming soon' : 'Install workflow'}
                </Button>
                <Button tone="ghost" onClick={() => installMutation.mutate()} disabled={installMutation.isPending || item.pricingType === 'premium'}>
                  Duplicate & customise
                </Button>
                <Link className="pm-btn pm-btn--ghost" to="/app/workflows/catalogue">Back to catalogue</Link>
              </div>
            </div>

            <aside className="workflow-catalogue-detail__install-panel" aria-label="Install and usage summary">
              <h2>Install details</h2>
              <p style={{ margin: 0, color: 'var(--muted)', lineHeight: 1.7 }}>
                Installing is free. Running this workflow uses your normal Prymal credits.
              </p>
              <div className="workflow-catalogue-detail__stat-grid">
                <Stat label="Execution credits" value={formatNumber(item.estimatedExecutionCredits ?? 0)} />
                <Stat label="Video credits" value={formatNumber(item.estimatedVideoCredits ?? 0)} />
                <Stat label="Runtime" value={item.expectedRuntimeLabel || 'Varies'} />
              </div>
            </aside>
          </section>

          {installMutation.isError ? <InlineNotice tone="danger">{getErrorMessage(installMutation.error)}</InlineNotice> : null}

          <WorkflowBlueprintPreview
            title="Workflow blueprint"
            category={item.category}
            difficulty={item.difficulty}
            workflowDefinition={item.templateWorkflowDefinition}
            estimatedExecutionCredits={item.estimatedExecutionCredits}
            estimatedRuntimeLabel={item.expectedRuntimeLabel}
            modeTag={modeTag}
            validationWarnings={item.validationWarnings}
          />

          <section className="workflow-catalogue-detail__terminal" aria-labelledby="showcase-heading">
            <div className="workflow-catalogue-detail__terminal-head">
              <div>
                <h2 id="showcase-heading">Showcase in action</h2>
                <p style={{ margin: '8px 0 0', color: 'var(--muted)', lineHeight: 1.7 }}>
                  Start with a few inputs. Prymal turns them into structured, usable output.
                </p>
              </div>
              <StatusPill color="#00FFD1">Structured output</StatusPill>
            </div>
            <div className="workflow-catalogue-detail__console">
              <span className="workflow-catalogue-detail__console-label">Input</span>
              <div className="workflow-catalogue-detail__console-input">"{buildShowcaseInput(item)}"</div>
              <span className="workflow-catalogue-detail__console-label">Output</span>
              <ul className="workflow-catalogue-detail__console-output">
                {(item.expectedOutput ?? []).slice(0, 5).map((entry) => <li key={entry}>{entry}</li>)}
              </ul>
            </div>
          </section>

          <section aria-labelledby="outputs-heading">
            <h2 id="outputs-heading" className="workflow-catalogue-detail__section-title">What you'll get</h2>
            <div className="workflow-catalogue-detail__card-grid" style={{ marginTop: 14 }}>
              {(item.expectedOutput ?? []).map((entry) => (
                <article key={entry} className="workflow-catalogue-detail__mini-card">
                  <strong>{entry}</strong>
                  <span>Generated as part of the completed workflow output.</span>
                </article>
              ))}
            </div>
          </section>

          <section aria-labelledby="inputs-heading">
            <h2 id="inputs-heading" className="workflow-catalogue-detail__section-title">What you'll need</h2>
            <div className="workflow-catalogue-detail__chips" style={{ marginTop: 14 }}>
              {(item.requiredInputs ?? []).map((entry) => <StatusPill key={entry} color="#4CC9F0">{entry}</StatusPill>)}
            </div>
          </section>

          <section aria-labelledby="safety-heading">
            <h2 id="safety-heading" className="workflow-catalogue-detail__section-title">Safety and validation</h2>
            <div className="workflow-catalogue-detail__card-grid" style={{ marginTop: 14 }}>
              {item.validationWarnings?.length ? (
                item.validationWarnings.map((warning) => (
                  <article key={warning} className="workflow-catalogue-detail__mini-card">
                    <strong>Review warning</strong>
                    <p>{warning}</p>
                  </article>
                ))
              ) : (
                <article className="workflow-catalogue-detail__mini-card">
                  <strong>Checked for safe install</strong>
                  <p>No hidden secrets, unsafe webhooks or premium-only nodes detected.</p>
                </article>
              )}
            </div>
          </section>
        </div>
      ) : null}
    </PageShell>
  );
}

function Stat({ label, value }) {
  return (
    <div className="workflow-catalogue-detail__stat">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function resolveModeTag(item) {
  if (item?.tags?.includes('advanced')) return 'advanced';
  return 'simple';
}

function buildShowcaseInput(item) {
  const inputs = item.requiredInputs ?? [];
  if (item.slug === '30-day-content-engine') return 'Business goal: launch Prymal on LinkedIn';
  if (item.slug === 'website-audit-sprint') return 'Website URL, audience, and conversion goal';
  if (inputs.length) return inputs.slice(0, 3).join(', ');
  return item.shortDescription || item.title;
}
