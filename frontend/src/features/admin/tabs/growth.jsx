// features/admin/tabs/growth.jsx
// Growth + commercial analytics surface for operator and investor readiness.
// Receives the TanStack Query object from Admin.jsx via props.

import { formatNumber } from '../../../lib/utils';
import {
  MotionList,
  MotionListItem,
  MotionSection,
  SkeletonMetricGrid,
  SkeletonSurface,
} from '../../../components/motion';

// ---------------------------------------------------------------------------
// Funnel step bar
// ---------------------------------------------------------------------------
function FunnelBar({ label, value, total, color = 'var(--accent)' }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div className="growth-funnel__step">
      <div className="growth-funnel__step-head">
        <span className="growth-funnel__step-label">{label}</span>
        <span className="growth-funnel__step-count">
          <strong>{formatNumber(value)}</strong>
          <span className="growth-funnel__step-pct">{pct}%</span>
        </span>
      </div>
      <div className="growth-funnel__bar-track">
        <div
          className="growth-funnel__bar-fill"
          style={{ width: `${pct}%`, background: color }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Agent usage row
// ---------------------------------------------------------------------------
function AgentUsageRow({ agentId, displayName, runs, successRate, avgLatencyMs, color }) {
  return (
    <div className="growth-agent-row">
      <div
        className="growth-agent-row__swatch"
        style={{ background: color ?? 'var(--accent)' }}
      />
      <div className="growth-agent-row__name">
        <strong>{displayName}</strong>
        <span className="growth-agent-row__id">{agentId}</span>
      </div>
      <div className="growth-agent-row__stats">
        <span>{formatNumber(runs)} runs</span>
        <span className={successRate >= 0.9 ? 'growth-stat--success' : successRate >= 0.7 ? 'growth-stat--warning' : 'growth-stat--danger'}>
          {Math.round(successRate * 100)}% success
        </span>
        <span className="growth-agent-row__latency">{avgLatencyMs ? `${formatNumber(avgLatencyMs)}ms` : '—'}</span>
      </div>
      <div className="growth-agent-row__meter-track">
        <div
          className="growth-agent-row__meter-fill"
          style={{ width: `${Math.min(successRate * 100, 100)}%`, background: color ?? 'var(--accent)' }}
        />
      </div>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Churn risk signal card
// ---------------------------------------------------------------------------
function ChurnSignalCard({ orgName, plan, riskLevel, signals }) {
  const toneMap = { high: 'rose', medium: 'amber', low: 'mint' };
  const tone = toneMap[riskLevel] ?? 'slate';
  return (
    <div className={`growth-churn-card growth-churn-card--${tone}`}>
      <div className="growth-churn-card__head">
        <strong>{orgName}</strong>
        <span className={`staff-admin__badge staff-admin__badge--${tone}`}>{riskLevel} risk</span>
      </div>
      <span className="growth-churn-card__plan">{plan}</span>
      {signals?.length > 0 && (
        <ul className="growth-churn-card__signals">
          {signals.slice(0, 3).map((signal) => (
            <li key={signal}>{signal}</li>
          ))}
        </ul>
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Main component
// ---------------------------------------------------------------------------
export function GrowthTab({ query }) {
  const data = query?.data ?? {};

  // Show skeleton while the first fetch is in flight
  if (query?.isLoading && !data?.growth) {
    return (
      <>
        <SkeletonMetricGrid count={4} />
        <div className="staff-admin__overview-grid">
          <SkeletonSurface h="320px" delay="320ms" />
          <SkeletonSurface h="320px" delay="400ms" />
        </div>
        <SkeletonSurface h="220px" delay="480ms" />
        <div className="staff-admin__overview-grid">
          <SkeletonSurface h="180px" delay="560ms" />
          <SkeletonSurface h="180px" delay="640ms" />
        </div>
        <SkeletonSurface h="260px" delay="720ms" />
      </>
    );
  }

  // Safely destructure with defaults so the tab renders in zero-data states
  const {
    activationFunnel = {},
    agentUsage = [],
    onboardingMetrics = {},
    workflowConversion = {},
    loreUsage = {},
    seatExpansion = [],
    churnSignals = [],
    powerUserOrgs = [],
    inactivityAlerts = [],
    cohortRetention = [],
  } = data?.growth ?? {};

  const {
    signups = 0,
    onboardingStarted = 0,
    onboardingCompleted = 0,
    firstAgentRun = 0,
    repeatEngagement = 0,
    paidConversion = 0,
  } = activationFunnel;

  const {
    avgCompletionPct = 0,
    medianTimeToFirstRunMs = null,
    completedThisWeek = 0,
  } = onboardingMetrics;

  const {
    workflowsCreated = 0,
    workflowsActivated = 0,
    workflowRunsLast30d = 0,
    avgSuccessRate = 0,
  } = workflowConversion;
  const {
    documentsUploaded30d = 0,
    indexedDocuments30d = 0,
    conflictedDocuments = 0,
    staleDocuments = 0,
    topSourceTypes = [],
  } = loreUsage;

  const totalAgentRuns = agentUsage.reduce((sum, a) => sum + (a.runs ?? 0), 0);

  return (
    <>
      {/* ── KPI strip ─────────────────────────────────────────────────── */}
      <MotionList className="staff-admin__metric-grid" staggerChildren={0.04}>
        <MotionListItem className="staff-admin__metric staff-admin__metric--mint" reveal={{ y: 14, blur: 4 }}>
          <span className="staff-admin__metric-label">Paid conversions (30d)</span>
          <strong>{formatNumber(paidConversion)}</strong>
          <small>
            {signups > 0 ? `${Math.round((paidConversion / signups) * 100)}% of signups` : '—'}
          </small>
        </MotionListItem>
        <MotionListItem className="staff-admin__metric staff-admin__metric--blue" reveal={{ y: 14, blur: 4 }}>
          <span className="staff-admin__metric-label">Onboarding completion</span>
          <strong>{Math.round(avgCompletionPct)}%</strong>
          <small>{formatNumber(completedThisWeek)} finished this week</small>
        </MotionListItem>
        <MotionListItem className="staff-admin__metric staff-admin__metric--violet" reveal={{ y: 14, blur: 4 }}>
          <span className="staff-admin__metric-label">Agent runs (30d)</span>
          <strong>{formatNumber(totalAgentRuns)}</strong>
          <small>{agentUsage.length} active agents</small>
        </MotionListItem>
        <MotionListItem className="staff-admin__metric staff-admin__metric--amber" reveal={{ y: 14, blur: 4 }}>
          <span className="staff-admin__metric-label">Workflow activation</span>
          <strong>
            {workflowsCreated > 0
              ? `${Math.round((workflowsActivated / workflowsCreated) * 100)}%`
              : '—'}
          </strong>
          <small>{formatNumber(workflowsActivated)} of {formatNumber(workflowsCreated)} workflows live</small>
        </MotionListItem>
      </MotionList>

      <div className="staff-admin__overview-grid">
        {/* ── Activation funnel ───────────────────────────────────────── */}
        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Activation funnel</div>
              <h2>User journey</h2>
              <p className="staff-admin__surface-meta">Cohort: last 30 days</p>
            </div>
          </div>

          <div className="growth-funnel">
            <FunnelBar label="Signups" value={signups} total={signups} color="#68f5d0" />
            <FunnelBar label="Onboarding started" value={onboardingStarted} total={signups} color="#5de0f5" />
            <FunnelBar label="Onboarding completed" value={onboardingCompleted} total={signups} color="#69bcff" />
            <FunnelBar label="First agent run" value={firstAgentRun} total={signups} color="#7f8cff" />
            <FunnelBar label="Repeat engagement" value={repeatEngagement} total={signups} color="#b293ff" />
            <FunnelBar label="Paid conversion" value={paidConversion} total={signups} color="#ff8cab" />
          </div>

          {medianTimeToFirstRunMs != null && (
            <div className="growth-funnel__footer">
              <span className="staff-admin__surface-meta">
                Median time to first run:{' '}
                <strong>{Math.round(medianTimeToFirstRunMs / 60_000)} min</strong>
              </span>
            </div>
          )}
        </MotionSection>

        {/* ── Cohort retention ────────────────────────────────────────── */}
        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Cohort retention</div>
              <h2>Week-over-week</h2>
            </div>
          </div>

          {cohortRetention.length === 0 ? (
            <div className="staff-admin__empty">No retention data yet. Requires 2+ weeks of signups.</div>
          ) : (
            <div className="growth-retention">
              {cohortRetention.slice(0, 8).map((cohort) => (
                <div key={cohort.week} className="growth-retention__row">
                  <span className="growth-retention__week">{cohort.week}</span>
                  {cohort.retentionByWeek?.map((rate, weekIdx) => (
                    <div
                      key={weekIdx}
                      className="growth-retention__cell"
                      style={{
                        opacity: 0.15 + rate * 0.85,
                        background: `color-mix(in srgb, #68f5d0 ${Math.round(rate * 100)}%, transparent)`,
                      }}
                      title={`W${weekIdx + 1}: ${Math.round(rate * 100)}%`}
                    >
                      {Math.round(rate * 100)}%
                    </div>
                  ))}
                </div>
              ))}
            </div>
          )}
        </MotionSection>
      </div>

      <div className="staff-admin__overview-grid">
        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">LORE analytics</div>
              <h2>Knowledge-base adoption</h2>
            </div>
          </div>

          <div className="staff-admin__runtime-summary-grid">
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Uploaded (30d)</div>
              <strong>{formatNumber(documentsUploaded30d)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Indexed (30d)</div>
              <strong>{formatNumber(indexedDocuments30d)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Conflicted docs</div>
              <strong>{formatNumber(conflictedDocuments)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Stale docs</div>
              <strong>{formatNumber(staleDocuments)}</strong>
            </div>
          </div>

          {topSourceTypes.length > 0 ? (
            <div className="staff-admin__feed" style={{ marginTop: '14px' }}>
              {topSourceTypes.map((source) => (
                <div key={source.sourceType} className="staff-admin__feed-item">
                  <div className="staff-admin__feed-dot staff-admin__feed-dot--event" />
                  <div className="staff-admin__feed-body">
                    <div className="staff-admin__feed-title-group">
                      <strong>{source.sourceType}</strong>
                      <span className="staff-admin__surface-meta">{formatNumber(source.count)} docs</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="staff-admin__empty">No document ingestion patterns captured yet.</div>
          )}
        </MotionSection>

        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Power users</div>
              <h2>High-leverage workspaces</h2>
            </div>
          </div>

          {powerUserOrgs.length === 0 ? (
            <div className="staff-admin__empty">No power-user orgs detected yet.</div>
          ) : (
            <div className="staff-admin__feed">
              {powerUserOrgs.map((org) => (
                <div key={org.orgId} className="staff-admin__feed-item">
                  <div className="staff-admin__feed-dot staff-admin__feed-dot--event" />
                  <div className="staff-admin__feed-body">
                    <div className="staff-admin__feed-title-group">
                      <strong>{org.orgName}</strong>
                      <span className="staff-admin__surface-meta">{org.plan}</span>
                    </div>
                    <p className="staff-admin__feed-summary">
                      Score {formatNumber(org.score)} · {formatNumber(org.traceCount)} traces · {formatNumber(org.workflowCount)} workflow runs · {formatNumber(org.docCount)} docs · {formatNumber(org.activeSeats)} seats
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MotionSection>
      </div>

      {/* ── Agent usage analytics ───────────────────────────────────────── */}
      <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Agent analytics</div>
            <h2>Usage and success rates</h2>
            <p className="staff-admin__surface-meta">Last 30 days · {formatNumber(totalAgentRuns)} total runs</p>
          </div>
        </div>

        {agentUsage.length === 0 ? (
          <div className="staff-admin__empty">No agent run data yet.</div>
        ) : (
          <div className="growth-agent-list">
            {agentUsage
              .slice()
              .sort((a, b) => (b.runs ?? 0) - (a.runs ?? 0))
              .map((agent) => (
                <AgentUsageRow key={agent.agentId} {...agent} />
              ))}
          </div>
        )}
      </MotionSection>

      <div className="staff-admin__overview-grid">
        {/* ── Workflow conversion ─────────────────────────────────────── */}
        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Workflow conversion</div>
              <h2>Builder → live</h2>
            </div>
          </div>

          <div className="staff-admin__runtime-summary-grid">
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Created</div>
              <strong className="staff-admin__signal-card--mint">{formatNumber(workflowsCreated)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Activated</div>
              <strong className="staff-admin__signal-card--blue">{formatNumber(workflowsActivated)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Runs (30d)</div>
              <strong>{formatNumber(workflowRunsLast30d)}</strong>
            </div>
            <div className="staff-admin__runtime-summary-card">
              <div className="staff-admin__surface-label">Avg success</div>
              <strong className={avgSuccessRate >= 0.9 ? 'growth-stat--success' : 'growth-stat--warning'}>
                {Math.round(avgSuccessRate * 100)}%
              </strong>
            </div>
          </div>
        </MotionSection>

        {/* ── Seat expansion ──────────────────────────────────────────── */}
        <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Expansion signals</div>
              <h2>Seat opportunities</h2>
            </div>
          </div>

          {seatExpansion.length === 0 ? (
            <div className="staff-admin__empty">No expansion signals detected.</div>
          ) : (
            <div className="staff-admin__feed">
              {seatExpansion.slice(0, 6).map((org) => (
                <div key={org.orgId} className="staff-admin__feed-item">
                  <div className="staff-admin__feed-dot staff-admin__feed-dot--event" />
                  <div className="staff-admin__feed-body">
                    <div className="staff-admin__feed-title-group">
                      <strong>{org.orgName}</strong>
                      <span className="staff-admin__surface-meta">{org.currentPlan}</span>
                    </div>
                    <p className="staff-admin__feed-summary">
                      {org.usedSeats}/{org.totalSeats} seats used ·{' '}
                      {org.runRate30d} runs/30d ·{' '}
                      {org.expansionSignal}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </MotionSection>
      </div>

      {/* ── Churn risk signals ──────────────────────────────────────────── */}
      <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Retention watchlist</div>
            <h2>Churn risk signals</h2>
            <p className="staff-admin__surface-meta">Organisations with reduced engagement or cancellation indicators</p>
          </div>
        </div>

        {churnSignals.length === 0 ? (
          <div className="staff-admin__empty">No churn risk signals detected. 🎉</div>
        ) : (
          <MotionList className="growth-churn-grid" staggerChildren={0.05}>
            {churnSignals.slice(0, 9).map((org) => (
              <MotionListItem key={org.orgId} reveal={{ y: 10 }}>
                <ChurnSignalCard {...org} />
              </MotionListItem>
            ))}
          </MotionList>
        )}
      </MotionSection>

      <MotionSection className="staff-admin__surface" reveal={{ y: 18 }}>
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Inactivity alerts</div>
            <h2>Reactivation candidates</h2>
            <p className="staff-admin__surface-meta">Paid workspaces that have gone quiet recently</p>
          </div>
        </div>

        {inactivityAlerts.length === 0 ? (
          <div className="staff-admin__empty">No inactivity alerts right now.</div>
        ) : (
          <div className="staff-admin__feed">
            {inactivityAlerts.map((org) => (
              <div key={org.orgId} className="staff-admin__feed-item">
                <div className="staff-admin__feed-dot staff-admin__feed-dot--audit" />
                <div className="staff-admin__feed-body">
                  <div className="staff-admin__feed-title-group">
                    <strong>{org.orgName}</strong>
                    <span className="staff-admin__surface-meta">{org.plan}</span>
                  </div>
                  <p className="staff-admin__feed-summary">
                    {org.daysInactive} days inactive · last activity {org.lastActiveAt ? new Date(org.lastActiveAt).toLocaleDateString() : 'unknown'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </MotionSection>
    </>
  );
}
