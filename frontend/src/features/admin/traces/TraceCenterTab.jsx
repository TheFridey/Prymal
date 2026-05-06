import { useMemo } from 'react';
import { Button, InlineNotice, LoadingPanel, TextInput } from '../../../components/ui';
import { formatDateTime, formatNumber, truncate } from '../../../lib/utils';
import { AGENT_ID_OPTIONS } from '../constants';
import { displayEmail, humanize } from '../utils';
import { AdminDetailDrawer, AdminPaginationControls, DetailBlock, formatRate } from '../runtime/shared';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';

export function TraceCenterTab({
  query,
  organisations = [],
  filters,
  searchValue = '',
  onSearchChange,
  pagination,
  onPageChange,
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
  const filteredTraces = useMemo(() => {
    const needle = searchValue.trim().toLowerCase();
    if (!needle) {
      return traces;
    }

    return traces.filter((trace) => [
      trace.id,
      trace.agentId,
      trace.provider,
      trace.model,
      trace.policyClass,
      trace.policyKey,
      trace.failureClass,
      trace.route,
      trace.routeReason,
      trace.requestId,
      trace.outcomeStatus,
    ]
      .filter(Boolean)
      .some((value) => String(value).toLowerCase().includes(needle)));
  }, [searchValue, traces]);

  return (
    <div className="staff-admin__ops-grid">
      <MotionSection reveal={{ y: 18, blur: 6 }}>
      <section className="staff-admin__surface staff-admin__surface--full">
        <div className="staff-admin__surface-head staff-admin__surface-head--sticky">
          <div>
            <div className="staff-admin__surface-label">Runtime observability</div>
            <h2>Trace center</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {formatNumber(query.data?.count ?? 0)} traces in window | Shift+T to return here
          </div>
        </div>

        <div className="staff-admin__runtime-filter-grid staff-admin__runtime-filter-grid--sticky">
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
          <label className="staff-admin__field">
            <span className="staff-admin__field-label">Search</span>
            <TextInput
              value={searchValue}
              onChange={(event) => onSearchChange?.(event.target.value)}
              placeholder="trace id, provider, model, request..."
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
              {filteredTraces.length === 0 ? (
                <tr>
                  <td colSpan={9}>
                    <div className="staff-admin__empty">No traces matched the current filters or search.</div>
                  </td>
                </tr>
              ) : (
                filteredTraces.map((trace) => (
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
                      <Button tone="ghost" onClick={() => onSelectTrace(trace.id)} data-testid={`trace-inspect-${trace.id}`}>
                        Inspect
                      </Button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <AdminPaginationControls
          page={pagination?.page}
          pageSize={pagination?.pageSize}
          itemCount={filteredTraces.length}
          hasNextPage={pagination?.hasNextPage}
          onPrevious={() => onPageChange?.('previous')}
          onNext={() => onPageChange?.('next')}
          label="trace rows"
        />
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
  const enforcement = trace.enforcementSummary ?? null;
  const semanticBlocks = trace.schemaValidation?.semantic?.blocks ?? enforcement?.semanticBlocks ?? [];
  const semanticWarnings = trace.schemaValidation?.semantic?.warnings ?? enforcement?.semanticWarnings ?? [];
  const retrievalDecision = enforcement?.retrieval ?? routing.retrievalDecision ?? null;
  const memorySummary = enforcement?.memory ?? routing.memorySummary ?? null;
  const geminiGrounding = trace.geminiGrounding ?? null;
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
    || (trace.sentinelReview?.repair_actions ?? []).length > 0
    || semanticBlocks.length > 0
    || semanticWarnings.length > 0,
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
            <TraceSummaryRow label="User" value={user ? displayEmail(user) : truncate(trace.userId, 12)} />
            <TraceSummaryRow label="Workflow run" value={workflowRun ? truncate(workflowRun.id, 12) : 'n/a'} />
            <TraceSummaryRow label="Conversation" value={conversation ? truncate(conversation.id, 12) : 'n/a'} />
            <TraceSummaryRow label="Mode" value={trace.mode ? humanize(trace.mode) : 'Standard'} />
          </div>
        </article>
      </div>

      <div className="staff-admin__drawer-grid">
        <DetailBlock label="Trace ID">{trace.id}</DetailBlock>
        <DetailBlock label="Workspace">{organisation?.name ?? truncate(trace.orgId, 12)}</DetailBlock>
        <DetailBlock label="User">{user ? displayEmail(user) : truncate(trace.userId, 12)}</DetailBlock>
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
      </section>

      {(routing.weight != null || routing.confidence || routing.escalated) ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Routing intelligence</div>
          {routing.weight != null ? (
            <div style={{ marginBottom: 12 }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 12, color: 'var(--text-muted)', marginBottom: 5 }}>
                <span>Agent weight</span>
                <span style={{ fontVariantNumeric: 'tabular-nums', fontWeight: 600 }}>{Math.round(routing.weight * 100)}%</span>
              </div>
              <div style={{ height: 6, borderRadius: 999, background: 'rgba(255,255,255,0.06)', overflow: 'hidden' }}>
                <div
                  style={{
                    height: '100%',
                    width: `${Math.round(routing.weight * 100)}%`,
                    borderRadius: 999,
                    background: routing.weight >= 0.7 ? '#18c7a0' : routing.weight >= 0.5 ? '#f59e0b' : '#ef4444',
                    transition: 'width 0.4s ease',
                  }}
                />
              </div>
            </div>
          ) : null}
          <div className="staff-admin__chip-row">
            {routing.confidence ? (
              <span
                className="staff-admin__chip"
                style={{
                  color: routing.confidence === 'high' ? '#18c7a0' : routing.confidence === 'medium' ? '#f59e0b' : undefined,
                }}
              >
                {humanize(routing.confidence)} confidence
              </span>
            ) : null}
            {routing.escalated ? (
              <span style={{ padding: '3px 9px', borderRadius: 999, background: 'rgba(247,37,133,0.12)', color: '#F72585', border: '1px solid rgba(247,37,133,0.25)', fontSize: 12, fontWeight: 600 }}>
                Escalated{routing.escalatedFrom ? ` from ${humanize(routing.escalatedFrom)}` : ''}
              </span>
            ) : null}
            {routing.sampleSize != null ? (
              <span className="staff-admin__chip">Based on {formatNumber(routing.sampleSize)} run{routing.sampleSize !== 1 ? 's' : ''}</span>
            ) : null}
          </div>
        </section>
      ) : null}

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
            {semanticBlocks.length > 0 || semanticWarnings.length > 0 ? (
              <MotionListItem reveal={{ y: 10, blur: 4 }} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>Semantic checks</strong>
                  <span>{semanticBlocks.length} block{semanticBlocks.length === 1 ? '' : 's'} | {semanticWarnings.length} warning{semanticWarnings.length === 1 ? '' : 's'}</span>
                </div>
                {semanticBlocks.length > 0 ? (
                  <p style={{ color: '#ef4444' }}>
                    {semanticBlocks.slice(0, 3).join(' | ')}
                  </p>
                ) : null}
                {semanticWarnings.length > 0 ? (
                  <small style={{ color: '#f59e0b' }}>
                    {semanticWarnings.slice(0, 3).join(' | ')}
                  </small>
                ) : (
                  <small>{semanticBlocks.length > 0 ? 'No softer warnings recorded.' : 'No semantic warnings attached.'}</small>
                )}
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

      {enforcement ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Trust enforcement</div>
          <div className="staff-admin__chip-row">
            {enforcement.strictRuntime ? <span className="staff-admin__chip">Strict runtime</span> : null}
            {enforcement.schemaEnforced ? <span className="staff-admin__chip">Schema enforced</span> : null}
            {enforcement.citationRequired ? <span className="staff-admin__chip">Citations required</span> : null}
            {enforcement.toolViolationCount > 0 ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                {enforcement.toolViolationCount} tool violation{enforcement.toolViolationCount === 1 ? '' : 's'}
              </span>
            ) : null}
            {enforcement.hallucinationOverThreshold ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                Hallucination risk over threshold
              </span>
            ) : null}
            {enforcement.contradictionCount > 0 ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                {enforcement.contradictionCount} contradiction{enforcement.contradictionCount === 1 ? '' : 's'}
              </span>
            ) : null}
            {(enforcement.disallowedToolsUsed ?? []).map((tool) => (
              <span key={`disallowed-${tool}`} className="staff-admin__chip" style={{ background: 'rgba(239,68,68,0.12)', color: '#ef4444' }}>
                Disallowed: {tool}
              </span>
            ))}
            {(enforcement.toolViolationTypes ?? []).map((violationType) => (
              <span key={`vtype-${violationType}`} className="staff-admin__chip">
                {humanize(violationType)}
              </span>
            ))}
          </div>
          <div className="staff-admin__drawer-grid">
            <DetailBlock label="Hallucination risk">{humanize(enforcement.hallucinationRiskLevel ?? 'unknown')}</DetailBlock>
            <DetailBlock label="Citation rate">{enforcement.citationRate != null ? formatRate(enforcement.citationRate) : 'n/a'}</DetailBlock>
            <DetailBlock label="Citation count">{formatNumber(enforcement.citationCount ?? 0)}</DetailBlock>
            <DetailBlock label="Groundedness">{humanize(enforcement.groundedness ?? 'unknown')}</DetailBlock>
            <DetailBlock label="SENTINEL risk score">{enforcement.sentinelRiskScore != null ? Number(enforcement.sentinelRiskScore).toFixed(2) : 'n/a'}</DetailBlock>
            <DetailBlock label="Tool violation action">{enforcement.toolViolationAction ? humanize(enforcement.toolViolationAction) : 'none'}</DetailBlock>
          </div>
          {enforcement.agentFields ? (
            <>
              <div className="staff-admin__surface-label" style={{ marginTop: '12px' }}>Agent-specific trace fields</div>
              <div className="staff-admin__chip-row">
                {Object.entries(enforcement.agentFields).map(([key, value]) => (
                  <span key={key} className="staff-admin__chip">{humanize(key)}: {String(value)}</span>
                ))}
              </div>
            </>
          ) : null}
        </section>
      ) : null}

      {retrievalDecision ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Retrieval budget</div>
          <div className="staff-admin__chip-row">
            {retrievalDecision.expanded ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(91,107,134,0.16)' }}>Adaptive expansion</span>
            ) : (
              <span className="staff-admin__chip">Standard budget</span>
            )}
            {retrievalDecision.confidenceFloor != null ? (
              <span className="staff-admin__chip">Confidence floor {formatMetricPct(retrievalDecision.confidenceFloor)}</span>
            ) : null}
            {retrievalDecision.policyClass ? <span className="staff-admin__chip">{humanize(retrievalDecision.policyClass)}</span> : null}
          </div>
          <div className="staff-admin__trace-summary-grid">
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Budget</div>
              <div className="staff-admin__runtime-stat-list">
                <TraceSummaryRow label="Base limit" value={String(retrievalDecision.baseLimit ?? 'n/a')} />
                <TraceSummaryRow label="Hard cap" value={String(retrievalDecision.hardCap ?? 'n/a')} />
                <TraceSummaryRow label="Oversample factor" value={retrievalDecision.oversampleFactor ?? 'n/a'} />
              </div>
            </article>
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Selection</div>
              <div className="staff-admin__runtime-stat-list">
                <TraceSummaryRow label="Fetched" value={String(retrievalDecision.fetched ?? 'n/a')} />
                <TraceSummaryRow label="Selected" value={String(retrievalDecision.selected ?? 'n/a')} />
                <TraceSummaryRow label="Confident" value={String(retrievalDecision.confident ?? 'n/a')} />
                <TraceSummaryRow label="Trimmed" value={String(retrievalDecision.trimmed ?? 0)} />
              </div>
            </article>
          </div>
          {retrievalDecision.reason ? (
            <small>{retrievalDecision.reason}</small>
          ) : null}
        </section>
      ) : null}

      {memorySummary ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Memory provenance</div>
          <div className="staff-admin__chip-row">
            <span className="staff-admin__chip">{memorySummary.totalReads ?? 0} read{memorySummary.totalReads === 1 ? '' : 's'}</span>
            {(memorySummary.scopes ?? []).map((scope) => (
              <span key={`scope-${scope}`} className="staff-admin__chip">{humanize(scope)}</span>
            ))}
            {memorySummary.restrictedReadCount > 0 ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                {memorySummary.restrictedReadCount} restricted
              </span>
            ) : null}
            {memorySummary.staleReadCount > 0 ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>
                {memorySummary.staleReadCount} stale
              </span>
            ) : null}
          </div>
          <div className="staff-admin__trace-summary-grid">
            {memorySummary.statusBreakdown ? (
              <article className="staff-admin__trace-summary-card">
                <div className="staff-admin__surface-label">Status</div>
                <div className="staff-admin__runtime-stat-list">
                  {Object.entries(memorySummary.statusBreakdown).map(([status, count]) => (
                    <TraceSummaryRow key={status} label={humanize(status)} value={String(count)} />
                  ))}
                </div>
              </article>
            ) : null}
            {memorySummary.provenanceBreakdown ? (
              <article className="staff-admin__trace-summary-card">
                <div className="staff-admin__surface-label">Provenance</div>
                <div className="staff-admin__runtime-stat-list">
                  {Object.entries(memorySummary.provenanceBreakdown).map(([provenance, count]) => (
                    <TraceSummaryRow key={provenance} label={humanize(provenance)} value={String(count)} />
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

      {geminiGrounding ? (
        <section className="staff-admin__drawer-section">
          <div className="staff-admin__surface-label">Live grounding</div>
          <div className="staff-admin__chip-row">
            <span className="staff-admin__chip">{geminiGrounding.provider ?? 'google'}</span>
            {geminiGrounding.tool ? <span className="staff-admin__chip">{geminiGrounding.tool}</span> : null}
            {geminiGrounding.fallback ? (
              <span className="staff-admin__chip" style={{ background: 'rgba(245,158,11,0.12)', color: '#f59e0b' }}>Fallback path</span>
            ) : null}
          </div>
          <div className="staff-admin__trace-summary-grid">
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Coverage</div>
              <div className="staff-admin__runtime-stat-list">
                <TraceSummaryRow label="Chunks" value={String(geminiGrounding.chunkCount ?? (geminiGrounding.chunks?.length ?? 0))} />
                <TraceSummaryRow label="Citations" value={String(geminiGrounding.supportCount ?? (geminiGrounding.supports?.length ?? 0))} />
                <TraceSummaryRow label="Queries issued" value={String(geminiGrounding.queryCount ?? (geminiGrounding.queries?.length ?? 0))} />
              </div>
            </article>
            {(geminiGrounding.queries ?? []).length > 0 ? (
              <article className="staff-admin__trace-summary-card">
                <div className="staff-admin__surface-label">Queries</div>
                <div className="staff-admin__chip-row">
                  {geminiGrounding.queries.slice(0, 6).map((query, queryIndex) => (
                    <span key={`gq-${queryIndex}`} className="staff-admin__chip">{truncate(query, 32)}</span>
                  ))}
                </div>
              </article>
            ) : null}
          </div>
        </section>
      ) : null}

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
                <div className="staff-admin__chip-row">
                  {source.confidenceLabel ? <span className="staff-admin__chip">Confidence {source.confidenceLabel}</span> : null}
                  {source.retrievalMode ? <span className="staff-admin__chip">{humanize(source.retrievalMode)}</span> : null}
                  {source.sourceType ? <span className="staff-admin__chip">{humanize(source.sourceType)}</span> : null}
                  {source.lexicalScore != null ? <span className="staff-admin__chip">Lexical {formatMetricPct(source.lexicalScore)}</span> : null}
                  {source.versionLineage?.latestVersion ? <span className="staff-admin__chip">Latest v{source.versionLineage.latestVersion}</span> : null}
                  {source.versionLineage?.isSuperseded ? <span className="staff-admin__chip">Superseded</span> : null}
                  {source.omittedChunkCount ? <span className="staff-admin__chip">{source.omittedChunkCount} omitted chunk{source.omittedChunkCount === 1 ? '' : 's'}</span> : null}
                </div>
                <div className="staff-admin__trace-summary-grid">
                  <article className="staff-admin__trace-summary-card">
                    <div className="staff-admin__surface-label">Ranking reasons</div>
                    <div className="staff-admin__runtime-stat-list">
                      <TraceSummaryRow label="Semantic match" value={formatMetricPct(source.similarity)} />
                      <TraceSummaryRow label="Final rank" value={formatMetricPct(source.finalScore)} />
                      <TraceSummaryRow label="Freshness contribution" value={formatMetricPct(source.freshnessScore)} />
                      <TraceSummaryRow label="Authority contribution" value={formatMetricPct(source.authorityScore)} />
                      <TraceSummaryRow label="Contradiction score" value={String((source.contradictionSignals ?? []).length)} />
                    </div>
                  </article>
                  <article className="staff-admin__trace-summary-card">
                    <div className="staff-admin__surface-label">Lineage and freshness</div>
                    <div className="staff-admin__runtime-stat-list">
                      <TraceSummaryRow label="Freshness posture" value={source.staleWarning ? 'Aging / stale' : 'Current'} />
                      <TraceSummaryRow label="Version chain" value={source.versionLineage?.versionChainId ? String(source.versionLineage.versionChainId).slice(0, 12) : 'n/a'} />
                      <TraceSummaryRow label="Latest version" value={source.versionLineage?.latestVersion ? `v${source.versionLineage.latestVersion}` : 'n/a'} />
                      <TraceSummaryRow label="Superseded" value={source.versionLineage?.isSuperseded ? 'Yes' : 'No'} />
                    </div>
                  </article>
                </div>
                <small>{source.staleWarning ?? 'No stale warning.'}</small>
                {(source.contradictionSignals ?? []).length > 0 ? (
                  <div className="staff-admin__runtime-stat-list">
                    {(source.contradictionSignals ?? []).slice(0, 3).map((signal, signalIndex) => (
                      <div key={`${signal.type ?? 'contradiction'}-${signalIndex}`} className="staff-admin__runtime-stat-row">
                        <span>{humanize(signal.type ?? 'conflict')}</span>
                        <strong>{truncate(signal.excerpt ?? signal.existingDocumentTitle ?? 'Signal attached.', 72)}</strong>
                      </div>
                    ))}
                  </div>
                ) : null}
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
        <div className="staff-admin__surface-label">Memory operations</div>
        {trace.memoryReadIds.length === 0 && trace.memoryWriteKeys.length === 0 ? (
          <div className="staff-admin__empty">No memory reads or writes were recorded for this trace.</div>
        ) : (
          <div className="staff-admin__trace-summary-grid">
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Reads</div>
              <div className="staff-admin__chip-row">
                {trace.memoryReadIds.length > 0
                  ? trace.memoryReadIds.map((memoryId) => <span key={memoryId} className="staff-admin__chip">Read {truncate(memoryId, 14)}</span>)
                  : <span className="staff-admin__chip">No reads</span>}
              </div>
            </article>
            <article className="staff-admin__trace-summary-card">
              <div className="staff-admin__surface-label">Writes</div>
              <div className="staff-admin__chip-row">
                {trace.memoryWriteKeys.length > 0
                  ? trace.memoryWriteKeys.map((memoryKey) => <span key={memoryKey} className="staff-admin__chip">{truncate(memoryKey, 20)}</span>)
                  : <span className="staff-admin__chip">No writes</span>}
              </div>
            </article>
          </div>
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
          {trace.attachmentCount > 0 ? <span className="staff-admin__chip">{trace.attachmentCount} attachment{trace.attachmentCount === 1 ? '' : 's'}</span> : null}
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
