import { useMemo } from 'react';
import { Button, InlineNotice, LoadingPanel, TextInput } from '../../../components/ui';
import { formatDateTime, formatNumber, truncate } from '../../../lib/utils';
import { AGENT_ID_OPTIONS } from '../constants';
import { humanize } from '../utils';
import { AdminDetailDrawer, DetailBlock, JsonBlock, formatRate } from '../runtime/shared';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';

export function TraceCenterTab({
  query,
  organisations = [],
  filters,
  onFilterChange,
  onSelectTrace,
  onSelectWorkflowRun,
}) {
  if (query.isLoading && !query.data) {
    return <LoadingPanel label="Loading runtime traces..." />;
  }

  const traces = query.data?.traces ?? [];
  const failureBreakdown = query.data?.failureBreakdown ?? [];
  const policySummary = query.data?.policySummary ?? [];

  return (
    <div className="staff-admin__ops-grid">
      <MotionSection reveal={{ y: 18, blur: 6 }}>
      <section className="staff-admin__surface staff-admin__surface--full">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Runtime observability</div>
            <h2>Trace center</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {formatNumber(query.data?.count ?? 0)} traces in window
          </div>
        </div>

        <div className="staff-admin__runtime-filter-grid">
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Days</span>
            <select
              className="staff-admin__select"
              value={filters.days}
              onChange={(event) => onFilterChange('days', event.target.value)}
            >
              <option value="7">7 days</option>
              <option value="30">30 days</option>
              <option value="90">90 days</option>
            </select>
          </label>
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Outcome</span>
            <select
              className="staff-admin__select"
              value={filters.outcomeStatus}
              onChange={(event) => onFilterChange('outcomeStatus', event.target.value)}
            >
              <option value="all">All outcomes</option>
              <option value="succeeded">Succeeded</option>
              <option value="failed">Failed</option>
              <option value="held">Held</option>
            </select>
          </label>
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Agent</span>
            <select
              className="staff-admin__select"
              value={filters.agentId}
              onChange={(event) => onFilterChange('agentId', event.target.value)}
            >
              <option value="all">All agents</option>
              {AGENT_ID_OPTIONS.map((agentId) => (
                <option key={agentId} value={agentId}>
                  {humanize(agentId)}
                </option>
              ))}
            </select>
          </label>
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Workspace</span>
            <select
              className="staff-admin__select"
              value={filters.orgId}
              onChange={(event) => onFilterChange('orgId', event.target.value)}
            >
              <option value="all">All workspaces</option>
              {organisations.map((organisation) => (
                <option key={organisation.id} value={organisation.id}>
                  {organisation.name}
                </option>
              ))}
            </select>
          </label>
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Failure class</span>
            <TextInput
              value={filters.failureClass}
              onChange={(event) => onFilterChange('failureClass', event.target.value)}
              placeholder="rate_limit, timeout, provider..."
            />
          </label>
        </div>

        {query.error ? (
          <InlineNotice tone="danger">
            {query.error.message ?? 'Trace data could not be loaded.'}
          </InlineNotice>
        ) : null}

        <div className="staff-admin__runtime-summary-grid">
          <article className="staff-admin__runtime-summary-card">
            <div className="staff-admin__surface-label">Failure breakdown</div>
            <div className="staff-admin__runtime-stat-list">
              {failureBreakdown.length === 0 ? (
                <div className="staff-admin__empty">No failures matched this window.</div>
              ) : (
                failureBreakdown.slice(0, 5).map((entry) => (
                  <div key={entry.key} className="staff-admin__runtime-stat-row">
                    <span>{humanize(entry.key)}</span>
                    <strong>{formatNumber(entry.count)}</strong>
                  </div>
                ))
              )}
            </div>
          </article>
          <article className="staff-admin__runtime-summary-card">
            <div className="staff-admin__surface-label">Policy outcomes</div>
            <div className="staff-admin__runtime-stat-list">
              {policySummary.length === 0 ? (
                <div className="staff-admin__empty">No policy data matched this window.</div>
              ) : (
                policySummary.slice(0, 5).map((entry) => (
                  <div key={entry.policyKey} className="staff-admin__runtime-stat-row">
                    <span>{humanize(entry.policyKey)}</span>
                    <strong>{Math.round((entry.successRate ?? 0) * 100)}%</strong>
                  </div>
                ))
              )}
            </div>
          </article>
        </div>

        <div className="staff-admin__table-wrap">
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>When</th>
                <th>Agent</th>
                <th>Policy</th>
                <th>Outcome</th>
                <th>Latency</th>
                <th>Tokens</th>
                <th>Cost</th>
                <th>Run</th>
                <th />
              </tr>
            </thead>
            <tbody>
              {traces.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="staff-admin__empty">No traces matched the current filters.</div>
                  </td>
                </tr>
              ) : (
                traces.map((trace) => (
                  <tr key={trace.id}>
                    <td>{formatDateTime(trace.createdAt)}</td>
                    <td>
                      <div className="staff-admin__table-stack">
                        <strong>{humanize(trace.agentId)}</strong>
                        <span>{trace.provider}:{trace.model}</span>
                      </div>
                    </td>
                    <td>{humanize(trace.policyClass ?? trace.policyKey)}</td>
                    <td>
                      <span className={`staff-admin__badge staff-admin__badge--${trace.outcomeStatus === 'failed' ? 'rose' : trace.outcomeStatus === 'held' ? 'amber' : 'mint'}`}>
                        {humanize(trace.outcomeStatus)}
                      </span>
                    </td>
                    <td>{formatNumber(trace.latencyMs ?? 0)} ms</td>
                    <td>{formatNumber(trace.totalTokens ?? 0)}</td>
                    <td>${Number(trace.estimatedCostUsd ?? 0).toFixed(4)}</td>
                    <td>
                      {trace.workflowRunId ? (
                        <button
                          type="button"
                          className="staff-admin__text-link"
                          onClick={() => onSelectWorkflowRun(trace.workflowRunId)}
                        >
                          Workflow
                        </button>
                      ) : trace.conversationId ? (
                        `Chat ${truncate(trace.conversationId, 10)}`
                      ) : (
                        'Direct'
                      )}
                    </td>
                    <td>
                      <Button tone="ghost" onClick={() => onSelectTrace(trace.id)}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
      </MotionSection>
    </div>
  );
}

export function EvalSummariesTab({ summaryQuery, traceQuery, onSelectTrace }) {
  if (summaryQuery.isLoading && !summaryQuery.data) {
    return <LoadingPanel label="Loading evaluation signals..." />;
  }

  const summary = summaryQuery.data?.summary ?? {};
  const total = summary.total ?? 0;
  const breakdown = traceQuery.data?.failureBreakdown ?? [];
  const traces = traceQuery.data?.traces ?? [];

  const metricCards = [
    { label: 'Grounded responses', value: formatRate(summary.grounded, total) },
    { label: 'Citations present', value: formatRate(summary.citations, total) },
    { label: 'Structured output pass', value: formatRate(summary.structured, total) },
    { label: 'Tool policy pass', value: formatRate(summary.tooling, total) },
    { label: 'Instruction adherence', value: formatRate(summary.instruction, total) },
    { label: 'High hallucination risk', value: formatRate(summary.hallucinationRisk, total) },
  ];

  const riskyTraces = useMemo(
    () =>
      traces.filter(
        (trace) =>
          trace.evaluation?.hallucinationRisk?.level === 'high'
          || trace.evaluation?.grounded?.passed === false
          || trace.evaluation?.structuredOutput?.passed === false,
      ),
    [traces],
  );

  return (
    <div className="staff-admin__ops-grid">
      <section className="staff-admin__metric-grid staff-admin__metric-grid--compact">
        {metricCards.map((card) => (
          <article key={card.label} className="staff-admin__metric staff-admin__metric--blue">
            <span className="staff-admin__metric-label">{card.label}</span>
            <strong>{card.value}</strong>
            <small>{formatNumber(total)} traced runs in window</small>
          </article>
        ))}
      </section>

      <div className="staff-admin__stack-grid staff-admin__stack-grid--two">
        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Failure trend</div>
              <h2>Most common trace failures</h2>
            </div>
          </div>
          <div className="staff-admin__runtime-stat-list">
            {breakdown.length === 0 ? (
              <div className="staff-admin__empty">No failures captured in this window.</div>
            ) : (
              breakdown.slice(0, 8).map((entry) => (
                <div key={entry.key} className="staff-admin__runtime-stat-row">
                  <span>{humanize(entry.key)}</span>
                  <strong>{formatNumber(entry.count)}</strong>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Review queue</div>
              <h2>Risky or failed outputs</h2>
            </div>
          </div>
          <div className="staff-admin__queue-list">
            {riskyTraces.length === 0 ? (
              <div className="staff-admin__empty">No risky traces matched the active trace filters.</div>
            ) : (
              riskyTraces.slice(0, 10).map((trace) => (
                <article key={trace.id} className="staff-admin__queue-item">
                  <div className="staff-admin__queue-head">
                    <strong>{humanize(trace.agentId)}</strong>
                    <span>{humanize(trace.outcomeStatus)}</span>
                  </div>
                  <p>{trace.provider}:{trace.model} | {humanize(trace.policyKey)}</p>
                  <small>
                    Grounded: {trace.evaluation?.grounded?.passed ? 'pass' : 'review'}
                    {' | '}
                    Structured: {trace.evaluation?.structuredOutput?.passed ? 'pass' : 'review'}
                    {' | '}
                    Hallucination: {humanize(trace.evaluation?.hallucinationRisk?.level ?? 'unknown')}
                  </small>
                  <div className="staff-admin__queue-actions">
                    <Button tone="ghost" onClick={() => onSelectTrace(trace.id)}>
                      Open trace
                    </Button>
                  </div>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function TraceDetailDrawer({
  traceQuery,
  onClose,
  onOpenWorkflowRun,
  onOpenReceipt,
}) {
  return (
    <AdminDetailDrawer title="Trace detail" eyebrow="Runtime" onClose={onClose}>
      {traceQuery.isLoading && !traceQuery.data ? <LoadingPanel label="Loading trace detail..." /> : null}
      {traceQuery.error ? <InlineNotice tone="danger">{traceQuery.error.message}</InlineNotice> : null}
      {traceQuery.data?.trace ? (
        <TraceDetailContent
          detail={traceQuery.data}
          onOpenWorkflowRun={onOpenWorkflowRun}
          onOpenReceipt={onOpenReceipt}
        />
      ) : null}
    </AdminDetailDrawer>
  );
}

function TraceDetailContent({ detail, onOpenWorkflowRun, onOpenReceipt }) {
  const { trace, conversation, workflowRun, organisation, user, relatedActionReceipts } = detail;
  const retrievalSources = trace.sources ?? [];
  const routing = trace.routing ?? {};
  const schemaRepair = routing.schemaRepair ?? null;
  const contract = trace.contract ?? null;
  const schemaVerdict = trace.schemaValidation?.verdict ?? 'skipped';
  const sentinelVerdict = trace.sentinelReview?.verdict ?? 'skipped';
  const fallbackDepth = routing.fallbackDepth ?? 0;
  const runtimeSignals = [
    `${formatNumber(retrievalSources.length)} source${retrievalSources.length === 1 ? '' : 's'}`,
    `${formatNumber(trace.toolsUsed.length)} tool${trace.toolsUsed.length === 1 ? '' : 's'}`,
    `${formatNumber(trace.memoryReadIds.length)} memory read${trace.memoryReadIds.length === 1 ? '' : 's'}`,
    `${formatNumber(trace.memoryWriteKeys.length)} memory write${trace.memoryWriteKeys.length === 1 ? '' : 's'}`,
  ];
  const hasRepairLoop = Boolean(
    schemaRepair
    || trace.fallbackUsed
    || trace.fallbackModel
    || trace.failureClass
    || trace.errorMessage
    || trace.sentinelReview?.hold_reason
    || (trace.sentinelReview?.repair_actions ?? []).length > 0,
  );
  const failureReason = trace.errorMessage ?? trace.sentinelReview?.hold_reason ?? trace.routeReason ?? null;
  const linkedContext = [
    workflowRun ? `Workflow ${truncate(workflowRun.id, 12)}` : null,
    conversation ? `Chat ${truncate(conversation.id, 12)}` : null,
    trace.mode ? humanize(trace.mode) : null,
  ].filter(Boolean);

  return (
    <div className="staff-admin__drawer-stack">
      <section className="staff-admin__drawer-section staff-admin__drawer-context">
        <div className="staff-admin__trace-summary-head">
          <div>
            <div className="staff-admin__surface-label">Execution summary</div>
            <h3 style={{ margin: '6px 0 0' }}>
              {humanize(trace.agentId)} via {trace.provider}:{trace.model}
            </h3>
          </div>
          <div className="staff-admin__chip-row">
            <TraceBadge tone={trace.outcomeStatus === 'failed' ? 'danger' : trace.outcomeStatus === 'held' ? 'warning' : 'success'}>
              {humanize(trace.outcomeStatus)}
            </TraceBadge>
            <TraceBadge>{humanize(trace.policyClass ?? trace.policyKey)}</TraceBadge>
            {trace.failureClass ? <TraceBadge tone="danger">{humanize(trace.failureClass)}</TraceBadge> : null}
            {schemaVerdict !== 'skipped' ? (
              <TraceBadge tone={schemaVerdict === 'pass' ? 'success' : schemaVerdict === 'repaired' ? 'warning' : 'danger'}>
                Schema {humanize(schemaVerdict)}
              </TraceBadge>
            ) : null}
            {sentinelVerdict !== 'skipped' ? (
              <TraceBadge tone={sentinelVerdict === 'PASS' ? 'success' : sentinelVerdict === 'REPAIR' ? 'warning' : 'danger'}>
                SENTINEL {sentinelVerdict}
              </TraceBadge>
            ) : null}
            {trace.fallbackUsed ? <TraceBadge tone="warning">Fallback depth {fallbackDepth}</TraceBadge> : null}
          </div>
        </div>
        <p className="staff-admin__drawer-copy" style={{ margin: 0 }}>
          {failureReason ?? 'Primary route completed without a recorded error reason. Routing, trust, and runtime touches are summarised below for faster operator review.'}
        </p>
        <div className="staff-admin__chip-row">
          {runtimeSignals.map((signal) => (
            <span key={signal} className="staff-admin__chip">{signal}</span>
          ))}
          {trace.requestId ? <span className="staff-admin__chip">Request {truncate(trace.requestId, 14)}</span> : null}
          {trace.sourceTypes.map((sourceType) => (
            <span key={sourceType} className="staff-admin__chip">{sourceType}</span>
          ))}
        </div>
      </section>

      <div className="staff-admin__trace-summary-grid">
        <article className="staff-admin__trace-summary-card">
          <div className="staff-admin__surface-label">Core execution</div>
          <div className="staff-admin__runtime-stat-list">
            <TraceSummaryRow label="Latency" value={`${formatNumber(trace.latencyMs ?? 0)} ms`} />
            <TraceSummaryRow label="Tokens" value={formatNumber(trace.totalTokens ?? 0)} />
            <TraceSummaryRow label="Estimated cost" value={`$${Number(trace.estimatedCostUsd ?? 0).toFixed(4)}`} />
            <TraceSummaryRow label="Route" value={trace.route ?? 'n/a'} />
            <TraceSummaryRow label="Fallback model" value={trace.fallbackModel ?? 'Not used'} />
          </div>
        </article>
        <article className="staff-admin__trace-summary-card">
          <div className="staff-admin__surface-label">Safety and repair</div>
          <div className="staff-admin__runtime-stat-list">
            <TraceSummaryRow label="Schema verdict" value={humanize(schemaVerdict)} />
            <TraceSummaryRow label="Repair stage" value={schemaRepair?.stage ? humanize(schemaRepair.stage) : 'Not triggered'} />
            <TraceSummaryRow label="Repair attempts" value={schemaRepair?.attempts != null ? String(schemaRepair.attempts) : '0'} />
            <TraceSummaryRow label="SENTINEL" value={sentinelVerdict === 'skipped' ? 'Not run' : sentinelVerdict} />
            <TraceSummaryRow label="Failure class" value={trace.failureClass ? humanize(trace.failureClass) : 'None'} />
          </div>
        </article>
        <article className="staff-admin__trace-summary-card">
          <div className="staff-admin__surface-label">Trust and memory</div>
          <div className="staff-admin__runtime-stat-list">
            <TraceSummaryRow label="Sources attached" value={String(retrievalSources.length)} />
            <TraceSummaryRow label="Docs touched" value={String(trace.loreDocumentIds.length)} />
            <TraceSummaryRow label="Memory reads" value={String(trace.memoryReadIds.length)} />
            <TraceSummaryRow label="Memory writes" value={String(trace.memoryWriteKeys.length)} />
            <TraceSummaryRow label="Attachments" value={String(trace.attachmentCount ?? 0)} />
          </div>
        </article>
        <article className="staff-admin__trace-summary-card">
          <div className="staff-admin__surface-label">Linked context</div>
          <div className="staff-admin__runtime-stat-list">
            <TraceSummaryRow label="Workspace" value={organisation?.name ?? truncate(trace.orgId, 12)} />
            <TraceSummaryRow label="User" value={user?.email ?? truncate(trace.userId, 12)} />
            <TraceSummaryRow label="Workflow run" value={workflowRun ? truncate(workflowRun.id, 12) : 'n/a'} />
            <TraceSummaryRow label="Conversation" value={conversation ? truncate(conversation.id, 12) : 'n/a'} />
            <TraceSummaryRow label="Mode" value={trace.mode ? humanize(trace.mode) : 'Standard'} />
          </div>
        </article>
      </div>

      <div className="staff-admin__drawer-grid">
        <DetailBlock label="Trace ID">{trace.id}</DetailBlock>
        <DetailBlock label="Workspace">{organisation?.name ?? truncate(trace.orgId, 12)}</DetailBlock>
        <DetailBlock label="User">{user?.email ?? truncate(trace.userId, 12)}</DetailBlock>
        <DetailBlock label="Agent">{humanize(trace.agentId)}</DetailBlock>
        <DetailBlock label="Provider">{trace.provider}</DetailBlock>
        <DetailBlock label="Model">{trace.model}</DetailBlock>
        <DetailBlock label="Policy class">{humanize(trace.policyClass ?? trace.policyKey)}</DetailBlock>
        <DetailBlock label="Route">{trace.route}</DetailBlock>
        <DetailBlock label="Outcome">{humanize(trace.outcomeStatus)}</DetailBlock>
        <DetailBlock label="Latency">{formatNumber(trace.latencyMs ?? 0)} ms</DetailBlock>
        <DetailBlock label="Tokens">{formatNumber(trace.totalTokens ?? 0)}</DetailBlock>
        <DetailBlock label="Estimated cost">${Number(trace.estimatedCostUsd ?? 0).toFixed(4)}</DetailBlock>
      </div>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Routing reason</div>
        <p className="staff-admin__drawer-copy">{trace.routeReason ?? 'No route reason was persisted.'}</p>
        <div className="staff-admin__chip-row">
          {routing.policyOverrideSource ? (
            <span className="staff-admin__chip">Override {humanize(routing.policyOverrideSource)}</span>
          ) : null}
          {routing.orgOverrideApplied ? <span className="staff-admin__chip">Org override applied</span> : null}
          {routing.fallbackProviderUsed ? <span className="staff-admin__chip">Fallback provider {routing.fallbackProviderUsed}</span> : null}
          {routing.reasoningTier ? <span className="staff-admin__chip">Reasoning {humanize(routing.reasoningTier)}</span> : null}
          {routing.fastLane ? <span className="staff-admin__chip">Fast lane {humanize(routing.fastLane)}</span> : null}
        </div>
        {trace.routing ? <JsonBlock value={trace.routing} /> : null}
      </section>

      {hasRepairLoop ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Repair and fallback loop</div>
          <MotionList className="staff-admin__queue-list" staggerChildren={0.04}>
            <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
              <div className="staff-admin__queue-head">
                <strong>Primary route</strong>
                <span>{trace.route}</span>
              </div>
              <p>{trace.provider}:{trace.model}</p>
              <small>{trace.routeReason ?? 'No route reason recorded.'}</small>
            </MotionListItem>
            {trace.fallbackUsed || trace.fallbackModel ? (
              <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>Fallback applied</strong>
                  <span>Depth {fallbackDepth}</span>
                </div>
                <p>{trace.fallbackModel ?? routing.fallbackModelUsed ?? 'Fallback model unavailable'}</p>
                <small>{routing.fallbackProviderUsed ? `Provider ${routing.fallbackProviderUsed}` : 'Fallback provider was not persisted.'}</small>
              </MotionListItem>
            ) : null}
            {schemaRepair ? (
              <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>Schema repair</strong>
                  <span>{humanize(schemaRepair.stage)}</span>
                </div>
                <p>{schemaRepair.attempts} attempt{schemaRepair.attempts === 1 ? '' : 's'} before a valid structure was returned.</p>
                <small>{trace.schemaValidation?.repairNotes ?? 'Schema repair metadata captured without notes.'}</small>
              </MotionListItem>
            ) : null}
            {trace.sentinelReview ? (
              <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>SENTINEL review</strong>
                  <span>{trace.sentinelReview.verdict}</span>
                </div>
                <p>{trace.sentinelReview.summary ?? trace.sentinelReview.hold_reason ?? 'No SENTINEL summary attached.'}</p>
                <small>
                  {(trace.sentinelReview.repair_actions ?? []).length > 0
                    ? trace.sentinelReview.repair_actions.join(' | ')
                    : 'No repair actions attached.'}
                </small>
              </MotionListItem>
            ) : null}
            {trace.failureClass || trace.errorMessage ? (
              <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>Failure detail</strong>
                  <span>{humanize(trace.failureClass ?? 'runtime')}</span>
                </div>
                <p>{trace.errorCode ?? 'No code'} | {trace.errorMessage ?? 'No failure message persisted.'}</p>
                <small>{trace.requestId ? `Request ${trace.requestId}` : 'No request identifier persisted.'}</small>
              </MotionListItem>
            ) : null}
          </MotionList>
        </section>
      ) : (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Fallback chain</div>
          {(trace.fallbackChain ?? []).length === 0 ? (
            <div className="staff-admin__empty">No fallback or repair loop was needed for this trace.</div>
          ) : (
            <div className="staff-admin__queue-list">
              {trace.fallbackChain.map((entry) => (
                <article key={`${entry.provider}-${entry.model}-${entry.route}`} className="staff-admin__queue-item">
                  <div className="staff-admin__queue-head">
                    <strong>{entry.provider}</strong>
                    <span>{entry.route}</span>
                  </div>
                  <p>{entry.model}</p>
                </article>
              ))}
            </div>
          )}
        </section>
      )}

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Evaluation summary</div>
        {trace.evaluation ? (
          <div className="staff-admin__drawer-grid">
            <DetailBlock label="Grounded">{trace.evaluation.grounded?.passed ? 'Pass' : 'Review'}</DetailBlock>
            <DetailBlock label="Citations">{formatNumber(trace.evaluation.grounded?.citationCount ?? 0)}</DetailBlock>
            <DetailBlock label="Structured">{trace.evaluation.structuredOutput?.passed ? 'Pass' : 'Review'}</DetailBlock>
            <DetailBlock label="Tool policy">{trace.evaluation.toolUse?.passed ? 'Pass' : 'Review'}</DetailBlock>
            <DetailBlock label="Instruction adherence">{trace.evaluation.instructionAdherence?.passed ? 'Pass' : 'Review'}</DetailBlock>
            <DetailBlock label="Hallucination risk">{humanize(trace.evaluation.hallucinationRisk?.level ?? 'unknown')}</DetailBlock>
          </div>
        ) : (
          <div className="staff-admin__empty">No eval record was attached to this trace.</div>
        )}
      </section>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Retrieval diagnostics</div>
        {retrievalSources.length === 0 ? (
          <div className="staff-admin__empty">No retrieval sources were attached to this trace.</div>
        ) : (
          <div className="staff-admin__queue-list">
            {retrievalSources.map((source, index) => (
              <article key={`${source.documentId ?? source.sourceUrl ?? 'source'}-${index}`} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>{source.documentTitle ?? source.title ?? 'Source'}</strong>
                  <span>{source.confidenceLabel ?? source.citation?.trustLabel ?? source.sourceType ?? 'source'}</span>
                </div>
                <p>
                  Similarity {formatMetricPct(source.similarity)}
                  {' | '}
                  Rank {formatMetricPct(source.finalScore)}
                  {' | '}
                  Freshness {formatMetricPct(source.freshnessScore)}
                  {' | '}
                  Authority {formatMetricPct(source.authorityScore)}
                </p>
                <div className="staff-admin__chip-row">
                  {source.retrievalMode ? <span className="staff-admin__chip">{humanize(source.retrievalMode)}</span> : null}
                  {source.lexicalScore != null ? <span className="staff-admin__chip">Lexical {formatMetricPct(source.lexicalScore)}</span> : null}
                  {source.versionLineage?.latestVersion ? <span className="staff-admin__chip">Latest v{source.versionLineage.latestVersion}</span> : null}
                  {source.versionLineage?.isSuperseded ? <span className="staff-admin__chip">Superseded</span> : null}
                </div>
                <small>
                  {source.staleWarning ?? 'No stale warning.'}
                  {(source.contradictionSignals ?? []).length > 0
                    ? ` | Contradictions: ${source.contradictionSignals.map((signal) => humanize(signal.type)).join(', ')}`
                    : ''}
                </small>
                {source.summary ? <small>{source.summary}</small> : null}
              </article>
            ))}
          </div>
        )}
      </section>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Runtime contract</div>
        {contract ? (
          <div className="staff-admin__trace-summary-grid">
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Policy and schema</div>
              <div className="staff-admin__runtime-stat-list">
                <TraceSummaryRow label="Preferred policy" value={humanize(contract.preferredPolicyClass ?? 'fast_chat')} />
                <TraceSummaryRow label="Structured lane" value={contract.structuredPolicyClass ? humanize(contract.structuredPolicyClass) : 'n/a'} />
                <TraceSummaryRow label="Output schema" value={contract.outputSchemaId ?? 'n/a'} />
                <TraceSummaryRow label="Strict runtime" value={contract.strictRuntime ? 'Enabled' : 'Standard'} />
              </div>
            </article>
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Allowed tools</div>
              <div className="staff-admin__chip-row">
                {(contract.allowedTools ?? []).length > 0
                  ? contract.allowedTools.map((tool) => <span key={tool} className="staff-admin__chip">{tool}</span>)
                  : <span className="staff-admin__chip">No tool contract</span>}
              </div>
            </article>
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Memory scopes</div>
              <div className="staff-admin__chip-row">
                {(contract.memoryReadScopes ?? []).map((scope) => <span key={`read-${scope}`} className="staff-admin__chip">Read {scope}</span>)}
                {(contract.memoryWriteScopes ?? []).map((scope) => <span key={`write-${scope}`} className="staff-admin__chip">Write {scope}</span>)}
                {(contract.memoryReadScopes ?? []).length === 0 && (contract.memoryWriteScopes ?? []).length === 0 ? (
                  <span className="staff-admin__chip">No memory scopes</span>
                ) : null}
              </div>
            </article>
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Escalation rules</div>
              <div className="staff-admin__chip-row">
                {(contract.escalationRules ?? []).length > 0
                  ? contract.escalationRules.map((rule) => <span key={rule} className="staff-admin__chip">{rule}</span>)
                  : <span className="staff-admin__chip">No escalation rules</span>}
              </div>
            </article>
          </div>
        ) : (
          <div className="staff-admin__empty">No runtime contract summary was persisted for this trace.</div>
        )}
      </section>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Runtime touches</div>
        <div className="staff-admin__chip-row">
          {trace.toolsUsed.length > 0 ? trace.toolsUsed.map((tool) => (
            <span key={tool} className="staff-admin__chip">{tool}</span>
          )) : <span className="staff-admin__chip">No tools</span>}
          {trace.loreDocumentIds.length > 0 ? trace.loreDocumentIds.map((documentId) => (
            <span key={documentId} className="staff-admin__chip">Doc {truncate(documentId, 10)}</span>
          )) : null}
          {trace.memoryReadIds.length > 0 ? trace.memoryReadIds.map((memoryId) => (
            <span key={memoryId} className="staff-admin__chip">Read {truncate(memoryId, 10)}</span>
          )) : null}
          {trace.memoryWriteKeys.length > 0 ? trace.memoryWriteKeys.map((memoryKey) => (
            <span key={memoryKey} className="staff-admin__chip">{truncate(memoryKey, 20)}</span>
          )) : null}
        </div>
      </section>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Linked records</div>
        <div className="staff-admin__queue-actions">
          {workflowRun ? (
            <Button tone="accent" onClick={() => onOpenWorkflowRun(workflowRun.id)}>
              Open workflow run
            </Button>
          ) : null}
          {conversation ? (
            <span className="staff-admin__drawer-footnote">Conversation {truncate(conversation.id, 12)}</span>
          ) : null}
          {linkedContext.length > 0 ? (
            <span className="staff-admin__drawer-footnote">{linkedContext.join(' | ')}</span>
          ) : null}
        </div>
      </section>

      <section className="staff-admin__drawer-section">
        <div className="staff-admin__surface-label">Related action receipts</div>
        <div className="staff-admin__queue-list">
          {relatedActionReceipts.length === 0 ? (
            <div className="staff-admin__empty">No action receipts were linked to this trace context.</div>
          ) : (
            relatedActionReceipts.map((receipt) => (
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
  );
}

function TraceBadge({ children, tone = 'default' }) {
  const palette = tone === 'success'
    ? { background: 'rgba(24,199,160,0.12)', color: '#18c7a0', borderColor: '#18c7a044' }
    : tone === 'warning'
      ? { background: 'rgba(245,158,11,0.12)', color: '#f59e0b', borderColor: '#f59e0b44' }
      : tone === 'danger'
        ? { background: 'rgba(239,68,68,0.12)', color: '#ef4444', borderColor: '#ef444444' }
        : { background: 'rgba(91,107,134,0.16)', color: 'var(--muted)', borderColor: 'rgba(91,107,134,0.26)' };

  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        minHeight: '28px',
        padding: '0 10px',
        borderRadius: '999px',
        border: `1px solid ${palette.borderColor}`,
        background: palette.background,
        color: palette.color,
        fontSize: '0.78rem',
      }}
    >
      {children}
    </span>
  );
}

function TraceSummaryRow({ label, value }) {
  return (
    <div className="staff-admin__runtime-stat-row">
      <span>{label}</span>
      <strong>{value}</strong>
    </div>
  );
}

function formatMetricPct(value) {
  if (value == null) {
    return 'n/a';
  }

  return `${Math.round(Math.max(Math.min(Number(value), 1), 0) * 100)}%`;
}
