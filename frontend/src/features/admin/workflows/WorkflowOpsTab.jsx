import { useState } from 'react';
import {
  Button,
  InlineNotice,
  LoadingPanel,
  TextArea,
  TextInput,
} from '../../../components/ui';
import { formatDateTime, formatNumber, truncate } from '../../../lib/utils';
import { humanize } from '../utils';
import {
  AdminDetailDrawer,
  DetailBlock,
  TIMELINE_KIND_ACCENT,
  TIMELINE_KIND_OPTIONS,
  summarizeDetail,
} from '../runtime/shared';
import { MotionList, MotionListItem, MotionStat, MotionTimelineItem } from '../../../components/motion';

export function WorkflowOpsTab({
  failedRunsQuery,
  orgTimelineQuery,
  webhookDeliveryHealthQuery,
  selectedOrg,
  organisations = [],
  workflowDays,
  workflowFailureClass,
  onWorkflowDaysChange,
  onWorkflowFailureClassChange,
  onSelectOrg,
  onSelectRun,
  onOpenTrace,
  onOpenRun,
}) {
  const [timelineKind, setTimelineKind] = useState('all');
  const failedRuns = failedRunsQuery.data?.runs ?? [];
  const rawTimeline = orgTimelineQuery.data?.timeline ?? [];
  const webhookSubscriptions = webhookDeliveryHealthQuery.data?.subscriptions ?? [];
  const timeline = timelineKind === 'all'
    ? rawTimeline
    : rawTimeline.filter((entry) => entry.kind === timelineKind);

  return (
    <div className="staff-admin__ops-grid">
      <div className="staff-admin__runtime-filter-grid">
        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Failure window</span>
          <select
            className="staff-admin__select"
            value={workflowDays}
            onChange={(event) => onWorkflowDaysChange(event.target.value)}
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Failure class</span>
          <TextInput
            value={workflowFailureClass}
            onChange={(event) => onWorkflowFailureClassChange(event.target.value)}
            placeholder="timeout, provider, validation..."
          />
        </label>
        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Timeline workspace</span>
          <select
            className="staff-admin__select"
            value={selectedOrg?.id ?? 'all'}
            onChange={(event) => onSelectOrg(event.target.value)}
          >
            <option value="all">Pick a workspace</option>
            {organisations.map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.name}
              </option>
            ))}
          </select>
        </label>
      </div>

      {failedRunsQuery.error ? (
        <InlineNotice tone="danger">{failedRunsQuery.error.message}</InlineNotice>
      ) : null}

      <div className="staff-admin__stack-grid staff-admin__stack-grid--two">
        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Execution queue</div>
              <h2>Failed workflow runs</h2>
            </div>
            <div className="staff-admin__surface-meta">
              {formatNumber(failedRunsQuery.data?.count ?? 0)} failed runs
            </div>
          </div>

          {failedRunsQuery.isLoading && !failedRunsQuery.data ? (
            <LoadingPanel label="Loading workflow failures..." />
          ) : failedRuns.length === 0 ? (
            <div className="staff-admin__empty">No failed runs matched the current filters.</div>
          ) : (
            <MotionList className="staff-admin__queue-list">
              {failedRuns.map((run) => (
                <MotionListItem key={run.id} className="staff-admin__queue-item" reveal={{ y: 12, blur: 4 }}>
                  <div className="staff-admin__queue-head">
                    <strong>{truncate(run.workflowId, 18)}</strong>
                    <span>{humanize(run.failureClass ?? 'failed')}</span>
                  </div>
                  <p>{truncate(run.orgId, 12)} | {humanize(run.executionMode ?? 'inline')} | attempt {run.attemptCount ?? 1}</p>
                  <small>{run.errorLog ? truncate(run.errorLog, 180) : 'No error log attached to this run.'}</small>
                  <div className="staff-admin__queue-actions">
                    <Button tone="ghost" onClick={() => onSelectOrg(run.orgId)}>
                      Open timeline
                    </Button>
                    <Button tone="accent" onClick={() => onSelectRun(run)}>
                      Inspect run
                    </Button>
                  </div>
                </MotionListItem>
              ))}
            </MotionList>
          )}
        </section>

        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Support timeline</div>
              <h2>{selectedOrg?.name ?? 'Workspace timeline'}</h2>
            </div>
            <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
              {selectedOrg && rawTimeline.length > 0 ? (
                <select
                  className="staff-admin__select"
                  value={timelineKind}
                  onChange={(event) => setTimelineKind(event.target.value)}
                  style={{ fontSize: '0.8rem' }}
                >
                  {TIMELINE_KIND_OPTIONS.map((opt) => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
              ) : null}
              <div className="staff-admin__surface-meta">
                {selectedOrg
                  ? `${formatNumber(timeline.length)} of ${formatNumber(rawTimeline.length)} events`
                  : 'Select a workspace'}
              </div>
            </div>
          </div>

          {!selectedOrg ? (
            <div className="staff-admin__empty">Choose a workspace to inspect its timeline across traces, workflow runs, events, and credit actions.</div>
          ) : orgTimelineQuery.isLoading && !orgTimelineQuery.data ? (
            <LoadingPanel label="Loading workspace timeline..." />
          ) : timeline.length === 0 ? (
            <div className="staff-admin__empty">No timeline entries matched the current filter.</div>
          ) : (
            <div className="staff-admin__timeline-list">
              {timeline.map((entry, index) => {
                const accent = TIMELINE_KIND_ACCENT[entry.kind] ?? 'var(--muted)';
                const linkedTraceId = entry.detail?.traceId ?? (entry.kind === 'trace' || entry.kind === 'failed_trace' ? entry.detail?.id : null);
                const linkedRunId = entry.detail?.runId ?? (entry.kind === 'workflow_run' ? entry.detail?.id : null);
                return (
                  <MotionTimelineItem key={`${entry.kind}-${index}`} className="staff-admin__timeline-entry" accent={accent}>
                    <div className="staff-admin__timeline-dot" style={{ '--dot-color': accent }} />
                    <div className="staff-admin__timeline-copy">
                      <div className="staff-admin__timeline-head">
                        <strong style={{ color: accent }}>{humanize(entry.kind)}</strong>
                        <span>{formatDateTime(entry.createdAt)}</span>
                      </div>
                      <p>{entry.label}</p>
                      <small>{summarizeDetail(entry.detail)}</small>
                      {(linkedTraceId || linkedRunId) ? (
                        <div className="staff-admin__queue-actions" style={{ marginTop: '6px' }}>
                          {linkedTraceId && onOpenTrace ? (
                            <Button tone="ghost" onClick={() => onOpenTrace(linkedTraceId)}>
                              Open trace
                            </Button>
                          ) : null}
                          {linkedRunId && onOpenRun ? (
                            <Button tone="ghost" onClick={() => onOpenRun({ id: linkedRunId, orgId: selectedOrg?.id })}>
                              Open run
                            </Button>
                          ) : null}
                        </div>
                      ) : null}
                    </div>
                  </MotionTimelineItem>
                );
              })}
            </div>
          )}
        </section>
      </div>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Webhook subscriptions</div>
            <h2>Outbound delivery health</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {formatNumber(webhookSubscriptions.length)} recent subscriptions
          </div>
        </div>

        {webhookDeliveryHealthQuery.error ? (
          <InlineNotice tone="danger">{webhookDeliveryHealthQuery.error.message}</InlineNotice>
        ) : null}

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px', marginBottom: '14px' }}>
          <MotionStat className="staff-admin__queue-item" accent="#18C7A0">
            <div className="staff-admin__surface-label">Active subscriptions</div>
            <strong style={{ fontSize: '1.6rem' }}>{formatNumber(webhookDeliveryHealthQuery.data?.totalEnabled ?? 0)}</strong>
          </MotionStat>
          <MotionStat className="staff-admin__queue-item" accent="#EF4444">
            <div className="staff-admin__surface-label">Disabled subscriptions</div>
            <strong style={{ fontSize: '1.6rem' }}>{formatNumber(webhookDeliveryHealthQuery.data?.totalDisabled ?? 0)}</strong>
          </MotionStat>
          <MotionStat className="staff-admin__queue-item" accent="#8B5CF6">
            <div className="staff-admin__surface-label">Orgs using webhooks</div>
            <strong style={{ fontSize: '1.6rem' }}>{formatNumber(webhookDeliveryHealthQuery.data?.orgsWithWebhooks ?? 0)}</strong>
          </MotionStat>
        </div>

        {webhookDeliveryHealthQuery.isLoading && !webhookDeliveryHealthQuery.data ? (
          <LoadingPanel label="Loading webhook subscriptions..." />
        ) : webhookSubscriptions.length === 0 ? (
          <div className="staff-admin__empty">No webhook subscriptions registered yet.</div>
        ) : (
          <div className="staff-admin__table-wrap">
            <table className="staff-admin__table">
              <thead>
                <tr>
                  <th>Org ID</th>
                  <th>URL</th>
                  <th>Events</th>
                  <th>Enabled</th>
                  <th>Created</th>
                </tr>
              </thead>
              <tbody>
                {webhookSubscriptions.map((subscription) => (
                  <tr key={subscription.id}>
                    <td>{truncate(subscription.orgId, 12)}</td>
                    <td title={subscription.url}>{truncate(subscription.url, 40)}</td>
                    <td>{subscription.events.join(', ')}</td>
                    <td>
                      <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px' }}>
                        <span
                          style={{
                            width: '8px',
                            height: '8px',
                            borderRadius: '999px',
                            background: subscription.enabled ? '#18C7A0' : '#EF4444',
                          }}
                        />
                        {subscription.enabled ? 'Enabled' : 'Disabled'}
                      </span>
                    </td>
                    <td>{formatDateTime(subscription.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

export function WorkflowRunDrawer({
  runQuery,
  onClose,
  onOpenTrace,
  onOpenReceipt,
  onReplay,
  isReplaying,
}) {
  const [reasonCode, setReasonCode] = useState('manual_replay');
  const [reason, setReason] = useState('Replay requested from the staff control plane.');
  const run = runQuery.data?.run;
  const workflow = runQuery.data?.workflow;
  const traces = runQuery.data?.traces ?? [];
  const actionReceipts = runQuery.data?.actionReceipts ?? [];

  return (
    <AdminDetailDrawer title="Workflow run detail" eyebrow="Workflow ops" onClose={onClose}>
      {runQuery.isLoading && !runQuery.data ? <LoadingPanel label="Loading workflow run..." /> : null}
      {runQuery.error ? <InlineNotice tone="danger">{runQuery.error.message}</InlineNotice> : null}
      {run ? (
        <div className="staff-admin__drawer-stack">
          <div className="staff-admin__drawer-grid">
            <DetailBlock label="Workflow">{workflow?.name ?? truncate(run.workflowId, 18)}</DetailBlock>
            <DetailBlock label="Status">{humanize(run.status)}</DetailBlock>
            <DetailBlock label="Failure class">{humanize(run.failureClass ?? 'none')}</DetailBlock>
            <DetailBlock label="Execution mode">{humanize(run.executionMode ?? 'inline')}</DetailBlock>
            <DetailBlock label="Started">{formatDateTime(run.startedAt ?? run.createdAt)}</DetailBlock>
            <DetailBlock label="Completed">{run.completedAt ? formatDateTime(run.completedAt) : 'Still open'}</DetailBlock>
          </div>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Replay from control plane</div>
            <div className="staff-admin__runtime-filter-grid">
              <label className="staff-admin__field">
                <span className="staff-admin__field-label">Reason code</span>
                <TextInput value={reasonCode} onChange={(event) => setReasonCode(event.target.value)} />
              </label>
              <label className="staff-admin__field staff-admin__field--wide">
                <span className="staff-admin__field-label">Reason</span>
                <TextArea rows={3} value={reason} onChange={(event) => setReason(event.target.value)} />
              </label>
            </div>
            <div className="staff-admin__queue-actions">
              <Button
                tone="accent"
                disabled={isReplaying || !reasonCode.trim() || reason.trim().length < 4}
                onClick={() => onReplay(run.id, { reasonCode, reason })}
              >
                {isReplaying ? 'Replaying...' : 'Replay workflow run'}
              </Button>
            </div>
          </section>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Trace ladder</div>
            <div className="staff-admin__queue-list">
              {traces.length === 0 ? (
                <div className="staff-admin__empty">No LLM traces are attached to this workflow run.</div>
              ) : (
                traces.map((trace) => (
                  <article key={trace.id} className="staff-admin__queue-item">
                    <div className="staff-admin__queue-head">
                      <strong>{humanize(trace.agentId)}</strong>
                      <span>{humanize(trace.outcomeStatus)}</span>
                    </div>
                    <p>{trace.provider}:{trace.model} | {humanize(trace.policyClass ?? trace.policyKey)}</p>
                    <small>{formatNumber(trace.totalTokens ?? 0)} tokens | {formatNumber(trace.latencyMs ?? 0)} ms</small>
                    <div className="staff-admin__queue-actions">
                      <Button tone="ghost" onClick={() => onOpenTrace(trace.id)}>
                        Open trace
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>

          <section className="staff-admin__drawer-section">
            <div className="staff-admin__surface-label">Immutable action receipts</div>
            <div className="staff-admin__queue-list">
              {actionReceipts.length === 0 ? (
                <div className="staff-admin__empty">No action receipts are attached to this run yet.</div>
              ) : (
                actionReceipts.map((receipt) => (
                  <article key={receipt.id} className="staff-admin__queue-item">
                    <div className="staff-admin__queue-head">
                      <strong>{humanize(receipt.action)}</strong>
                      <span>{humanize(receipt.actorStaffRole)}</span>
                    </div>
                    <p>{receipt.reasonCode} | {formatDateTime(receipt.createdAt)}</p>
                    <small>{receipt.reason ?? 'No reason attached.'}</small>
                    <div className="staff-admin__queue-actions">
                      <Button tone="ghost" onClick={() => onOpenReceipt(receipt.id)}>
                        View receipt
                      </Button>
                    </div>
                  </article>
                ))
              )}
            </div>
          </section>
        </div>
      ) : null}
    </AdminDetailDrawer>
  );
}
