import { formatNumber } from '../../../lib/utils';
import { InlineNotice, LoadingPanel } from '../../../components/ui';
import { formatCurrency, humanize } from '../utils';

const RISK_TONE = {
  healthy: 'mint',
  watch: 'amber',
  high_risk: 'rose',
};

function RiskBadge({ status }) {
  const tone = RISK_TONE[status] ?? 'slate';
  const label = status === 'high_risk' ? 'High risk' : humanize(status ?? 'healthy');
  return <span className={`staff-admin__badge staff-admin__badge--${tone}`}>{label}</span>;
}

function MetricCard({ label, value, helper, accent = 'mint' }) {
  return (
    <div className={`staff-admin__metric staff-admin__metric--${accent}`}>
      <span className="staff-admin__metric-label">{label}</span>
      <strong>{value}</strong>
      {helper ? <small>{helper}</small> : null}
    </div>
  );
}

function Section({ label, title, children, meta = null }) {
  return (
    <section className="staff-admin__surface">
      <div className="staff-admin__surface-head">
        <div>
          <div className="staff-admin__surface-label">{label}</div>
          <h2>{title}</h2>
        </div>
        {meta ? <div className="staff-admin__surface-meta">{meta}</div> : null}
      </div>
      {children}
    </section>
  );
}

function EmptyRow({ children }) {
  return <div className="staff-admin__empty">{children}</div>;
}

export function OperatorTab({ query, days, onDaysChange }) {
  const data = query?.data ?? null;

  if (query?.isLoading && !data) {
    return <LoadingPanel label="Loading operator dashboard..." />;
  }

  if (query?.error) {
    return <InlineNotice tone="danger">The operator dashboard could not load. {query.error?.message ?? 'Try again in a moment.'}</InlineNotice>;
  }

  if (!data) {
    return <InlineNotice tone="default">No operator metrics available yet for this window.</InlineNotice>;
  }

  const { revenue, usage, video, costMargin, reliability, beta } = data;

  return (
    <div style={{ display: 'grid', gap: '18px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: '12px' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: '22px' }}>Founder / operator dashboard</h1>
          <small style={{ color: 'var(--muted)' }}>
            Bounded {data.windowDays}-day window. Generated {new Date(data.generatedAt).toLocaleString()}.
          </small>
        </div>
        <label style={{ display: 'flex', alignItems: 'center', gap: '8px', fontSize: '13px' }}>
          <span style={{ color: 'var(--muted)' }}>Window</span>
          <select
            className="field"
            value={String(days ?? 30)}
            onChange={(event) => onDaysChange?.(Number(event.target.value))}
            style={{ minWidth: '90px' }}
          >
            <option value="7">7 days</option>
            <option value="30">30 days</option>
            <option value="90">90 days</option>
          </select>
        </label>
      </div>

      <Section label="Commercial" title="Revenue and plan distribution">
        <div className="staff-admin__metric-grid staff-admin__metric-grid--billing">
          <MetricCard
            label="Estimated MRR"
            value={formatCurrency(revenue.estimatedMrrGbp)}
            helper={`${formatNumber(revenue.paidOrgs)} paid orgs / ${formatNumber(revenue.totalOrgs)} total`}
            accent="mint"
          />
          <MetricCard
            label="Credit pack revenue"
            value={formatCurrency(revenue.creditPackPurchases.totalRevenueGbp)}
            helper={`${formatNumber(revenue.creditPackPurchases.count)} purchases in window`}
            accent="violet"
          />
          <MetricCard
            label="Video credit burn"
            value={formatNumber(usage.videoCreditsUsed)}
            helper={`${formatNumber(usage.averageVideoCreditsPerPaidOrg)} avg per paid org`}
            accent="amber"
          />
          <MetricCard
            label="Execution credit burn"
            value={formatNumber(usage.executionCreditsUsed)}
            helper={`${formatNumber(usage.averageExecutionCreditsPerOrg)} avg per org`}
            accent="blue"
          />
        </div>

        <div style={{ marginTop: '16px' }}>
          <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Plan distribution</div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(150px, 1fr))', gap: '10px' }}>
            {revenue.planDistribution.map((plan) => (
              <div key={plan.plan} style={{ padding: '12px 14px', borderRadius: '14px', border: '1px solid rgba(255,255,255,0.08)', background: 'rgba(255,255,255,0.03)' }}>
                <div style={{ fontSize: '11px', letterSpacing: '0.08em', textTransform: 'uppercase', color: 'var(--muted)' }}>{plan.label}</div>
                <div style={{ fontSize: '20px', fontWeight: 700 }}>{formatNumber(plan.count)}</div>
                <div style={{ fontSize: '12px', color: 'var(--muted)' }}>
                  {plan.priceGbp > 0 ? `${formatCurrency(plan.estimatedMrrGbp)} MRR` : 'Free tier'}
                </div>
              </div>
            ))}
          </div>
        </div>
      </Section>

      <Section label="Usage" title={`Top ${usage.topOrgs.length} orgs by total credit burn`}>
        {usage.topOrgs.length === 0 ? (
          <EmptyRow>No credit usage recorded in this window yet.</EmptyRow>
        ) : (
          <MotionListLikeTable>
            <div style={TABLE_HEAD_STYLE}>
              <span>Organisation</span>
              <span>Plan</span>
              <span>Execution</span>
              <span>Video</span>
              <span>Revenue</span>
              <span>Cost USD</span>
            </div>
            {usage.topOrgs.map((org) => (
              <div key={org.id} style={TABLE_ROW_STYLE}>
                <span>
                  <strong>{org.name}</strong>
                  <small style={{ display: 'block', color: 'var(--muted)' }}>{org.slug}</small>
                </span>
                <span>{humanize(org.plan)}</span>
                <span>{formatNumber(org.executionCredits)}</span>
                <span>{formatNumber(org.videoCredits)}</span>
                <span>{formatCurrency(org.revenueContributionGbp)}</span>
                <span>{org.estimatedCostUsd?.toFixed?.(2) ?? '0.00'}</span>
              </div>
            ))}
          </MotionListLikeTable>
        )}
      </Section>

      <Section label="Video" title="Video job health">
        <div className="staff-admin__metric-grid staff-admin__metric-grid--billing">
          <MetricCard label="Queued" value={formatNumber(video.queued)} accent="blue" />
          <MetricCard label="Processing" value={formatNumber(video.processing)} accent="amber" />
          <MetricCard label="Completed" value={formatNumber(video.completed)} accent="mint" />
          <MetricCard label="Failed" value={formatNumber(video.failed)} helper={`${Math.round((video.failureRate ?? 0) * 100)}% failure rate`} accent="rose" />
          <MetricCard label="Avg processing time" value={video.averageProcessingSeconds > 0 ? `${video.averageProcessingSeconds.toFixed(1)}s` : '-'} accent="violet" />
          <MetricCard label="Lite / Standard" value={`${formatNumber(video.byMode.lite)} / ${formatNumber(video.byMode.standard)}`} helper="Render mode split" accent="cyan" />
        </div>
      </Section>

      <Section label="Margin" title="Cost and revenue signals">
        <div className="staff-admin__metric-grid staff-admin__metric-grid--billing">
          <MetricCard
            label="Provider cost (USD)"
            value={formatCurrency(costMargin.estimatedProviderCostUsd, 'usd')}
            helper={`${formatCurrency(costMargin.estimatedProviderCostGbp)} approx.`}
            accent="rose"
          />
          <MetricCard
            label="Revenue contribution"
            value={formatCurrency(costMargin.estimatedRevenueContributionGbp)}
            helper="Cumulative on subscriptions"
            accent="mint"
          />
          <MetricCard
            label="Cost guard triggers"
            value={formatNumber(costMargin.costGuardTriggeredCount)}
            helper={`${formatNumber(costMargin.heavyUsageFlags.execution + costMargin.heavyUsageFlags.video)} heavy usage flags`}
            accent="amber"
          />
          <MetricCard
            label="High-risk orgs"
            value={formatNumber(costMargin.highCostOrgs.length)}
            helper="Cost ≥ 50% of revenue"
            accent="violet"
          />
        </div>

        {costMargin.highCostOrgs.length > 0 ? (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Orgs needing attention</div>
            <MotionListLikeTable>
              <div style={TABLE_HEAD_STYLE}>
                <span>Organisation</span>
                <span>Plan</span>
                <span>Cost (GBP)</span>
                <span>Revenue (GBP)</span>
                <span>Ratio</span>
                <span>Status</span>
              </div>
              {costMargin.highCostOrgs.map((org) => (
                <div key={org.id} style={TABLE_ROW_STYLE}>
                  <span><strong>{org.name}</strong></span>
                  <span>{humanize(org.plan)}</span>
                  <span>{formatCurrency(org.costGbp)}</span>
                  <span>{formatCurrency(org.revenueGbp)}</span>
                  <span>{org.ratio != null ? `${Math.round(org.ratio * 100)}%` : '—'}</span>
                  <span><RiskBadge status={org.status} /></span>
                </div>
              ))}
            </MotionListLikeTable>
          </div>
        ) : null}
      </Section>

      <Section label="Reliability" title="Failed LLM runs and recent failures">
        <div className="staff-admin__metric-grid staff-admin__metric-grid--billing">
          <MetricCard label="Failed LLM runs" value={formatNumber(reliability.failedLlmRuns)} accent="rose" />
          <MetricCard label="Failed video jobs" value={formatNumber(reliability.failedVideoJobs)} accent="amber" />
        </div>

        {reliability.topFailureCodes.length > 0 ? (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Top failure codes</div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '8px' }}>
              {reliability.topFailureCodes.map((entry) => (
                <span
                  key={entry.code}
                  style={{
                    padding: '6px 10px',
                    borderRadius: '999px',
                    background: 'rgba(255,255,255,0.04)',
                    border: '1px solid rgba(255,255,255,0.08)',
                    fontSize: '12px',
                  }}
                >
                  <strong>{entry.code}</strong> · {formatNumber(entry.count)}
                </span>
              ))}
            </div>
          </div>
        ) : null}

        {reliability.recentFailureEvents.length > 0 ? (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Recent failure events</div>
            <MotionListLikeTable>
              <div style={TABLE_HEAD_STYLE}>
                <span>Event</span>
                <span>Code</span>
                <span>Organisation</span>
                <span>When</span>
              </div>
              {reliability.recentFailureEvents.map((event) => (
                <div key={event.id} style={TABLE_ROW_STYLE}>
                  <span>{event.eventName}</span>
                  <span>{event.failureCode ?? '—'}</span>
                  <span>{event.orgName ?? event.orgId ?? '—'}</span>
                  <span>{new Date(event.createdAt).toLocaleString()}</span>
                </div>
              ))}
            </MotionListLikeTable>
          </div>
        ) : null}
      </Section>

      <Section label="Beta support" title="Activation and early cohort signals">
        <div className="staff-admin__metric-grid staff-admin__metric-grid--billing">
          <MetricCard
            label="First chat activations"
            value={formatNumber(beta.firstChatCount)}
            helper="Orgs with any useful output in window"
            accent="mint"
          />
          <MetricCard
            label="First video activations"
            value={formatNumber(beta.firstVideoCount)}
            helper="Orgs with a completed render in window"
            accent="violet"
          />
          <MetricCard
            label="Early-user failures"
            value={formatNumber(beta.earlyUserFailures)}
            helper="EARLY_USER_IDS cohort failures"
            accent="rose"
          />
          <MetricCard
            label="Newly activated orgs"
            value={formatNumber(beta.recentlyActivatedOrgs.length)}
            helper="Orgs created in window"
            accent="blue"
          />
        </div>

        {beta.recentlyActivatedOrgs.length > 0 ? (
          <div style={{ marginTop: '16px' }}>
            <div style={{ fontSize: '13px', color: 'var(--muted)', marginBottom: '8px' }}>Recently activated orgs</div>
            <MotionListLikeTable>
              <div style={TABLE_HEAD_STYLE}>
                <span>Organisation</span>
                <span>Plan</span>
                <span>Created</span>
              </div>
              {beta.recentlyActivatedOrgs.map((org) => (
                <div key={org.id} style={TABLE_ROW_STYLE}>
                  <span>
                    <strong>{org.name}</strong>
                    <small style={{ display: 'block', color: 'var(--muted)' }}>{org.slug}</small>
                  </span>
                  <span>{humanize(org.plan)}</span>
                  <span>{new Date(org.createdAt).toLocaleDateString()}</span>
                </div>
              ))}
            </MotionListLikeTable>
          </div>
        ) : null}
      </Section>
    </div>
  );
}

const TABLE_ROW_STYLE = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
  gap: '12px',
  padding: '10px 14px',
  borderRadius: '12px',
  background: 'rgba(255,255,255,0.025)',
  border: '1px solid rgba(255,255,255,0.06)',
  fontSize: '13px',
  alignItems: 'center',
};

const TABLE_HEAD_STYLE = {
  ...TABLE_ROW_STYLE,
  background: 'rgba(255,255,255,0.05)',
  fontSize: '11px',
  textTransform: 'uppercase',
  letterSpacing: '0.06em',
  color: 'var(--muted)',
};

function MotionListLikeTable({ children }) {
  return (
    <div style={{ display: 'grid', gap: '6px' }}>
      {children}
    </div>
  );
}
