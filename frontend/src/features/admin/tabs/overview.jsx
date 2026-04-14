// features/admin/tabs/overview.jsx
import { useEffect, useState } from 'react';
import { formatDate, formatDateTime, formatNumber, truncate } from '../../../lib/utils';
import { Button, TextInput } from '../../../components/ui';
import { MetricTile } from '../components/charts';
import { ActivityTrendChart, DonutChart } from '../components/charts';
import { MotionList, MotionListItem, MotionSection } from '../../../components/motion';
import {
  describeActivity,
  formatCurrency,
  getActivityHighlights,
  getActivityTitle,
  getPercent,
  getPlanTone,
  getRoleTone,
  humanize,
  displayName,
} from '../utils';
import { PLAN_CHART_COLORS, PLAN_OPTIONS, ROLE_OPTIONS } from '../constants';

export function OverviewTab({
  summaryCards,
  data,
  attentionQueue,
  topOrganisations,
  seatTotals,
  indexedTotals,
  billingTotals,
}) {
  const planTotal = data.planDistribution.reduce((sum, entry) => sum + (entry.count ?? 0), 0);
  const conversionPercent = getPercent(data.lifecycle.usefulOutputs30d, data.lifecycle.onboardingCompleted30d);
  const activityTotals = data.activitySeries.reduce((accumulator, entry) => {
    accumulator.events += entry.events ?? 0;
    accumulator.audits += entry.audits ?? 0;
    return accumulator;
  }, { events: 0, audits: 0 });
  const planSegments = data.planDistribution.map((entry, index) => ({
    ...entry,
    color: PLAN_CHART_COLORS[index % PLAN_CHART_COLORS.length],
    percent: getPercent(entry.count, planTotal),
  }));

  return (
    <>
      <MotionList className="staff-admin__metric-grid" staggerChildren={0.04}>
        {summaryCards.map((card) => (
          <MotionListItem
            key={card.label}
            className={`staff-admin__metric staff-admin__metric--${card.accent}`}
            reveal={{ y: 14, blur: 4 }}
          >
            <span className="staff-admin__metric-label">{card.label}</span>
            <strong>{card.value}</strong>
            <small>{card.helper}</small>
          </MotionListItem>
        ))}
      </MotionList>

      <section className="staff-admin__overview-grid">
        <article className="staff-admin__surface staff-admin__surface--chart">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Platform motion</div>
              <h2>Platform activity trend</h2>
            </div>
            <div className="staff-admin__surface-meta">
              Last 10 days
            </div>
          </div>

          <div className="staff-admin__trend-shell">
            <ActivityTrendChart series={data.activitySeries} />
            <div className="staff-admin__trend-legend">
              <article className="staff-admin__trend-stat">
                <div className="staff-admin__trend-label">
                  <span className="staff-admin__legend-dot staff-admin__legend-dot--events" />
                  Product events
                </div>
                <strong>{formatNumber(activityTotals.events)}</strong>
                <small>Signals from onboarding, chat, and team events</small>
              </article>
              <article className="staff-admin__trend-stat">
                <div className="staff-admin__trend-label">
                  <span className="staff-admin__legend-dot staff-admin__legend-dot--audits" />
                  Audit logs
                </div>
                <strong>{formatNumber(activityTotals.audits)}</strong>
                <small>Staff and system-level control changes</small>
              </article>
            </div>
          </div>
        </article>

        <div className="staff-admin__stack-grid">
          <MotionSection delay={0.06} reveal={{ y: 14, blur: 4 }}>
          <article className="staff-admin__surface">
            <div className="staff-admin__surface-head">
              <div>
                <div className="staff-admin__surface-label">Commercial mix</div>
                <h2>Plan distribution</h2>
              </div>
              <div className="staff-admin__surface-meta">{formatNumber(planTotal)} total workspaces</div>
            </div>
            <div className="staff-admin__donut-layout">
              <DonutChart
                total={planTotal}
                label="Active plans"
                segments={planSegments.map((entry) => ({
                  value: entry.count,
                  color: entry.color,
                }))}
              />
              <div className="staff-admin__plan-list">
                {planSegments.map((entry) => (
                  <div key={entry.plan} className="staff-admin__plan-row">
                    <span className="staff-admin__plan-key">
                      <i className="staff-admin__plan-swatch" style={{ '--swatch': entry.color }} />
                      {humanize(entry.plan)}
                    </span>
                    <div className="staff-admin__meter staff-admin__meter--compact">
                      <span style={{ width: `${entry.percent}%`, '--meter': entry.color }} />
                    </div>
                    <strong>{formatNumber(entry.count)}</strong>
                  </div>
                ))}
              </div>
            </div>
          </article>
          </MotionSection>

          <article className="staff-admin__surface">
            <div className="staff-admin__surface-head">
              <div>
                <div className="staff-admin__surface-label">Operational health</div>
                <h2>Platform signals</h2>
              </div>
            </div>
            <div className="staff-admin__signal-grid">
              <div className="staff-admin__signal-card staff-admin__signal-card--mint">
                <span>Seat utilization</span>
                <strong>{seatTotals.percent.toFixed(0)}%</strong>
                <small>{formatNumber(seatTotals.members)} of {formatNumber(seatTotals.seats)} provisioned seats active</small>
              </div>
              <div className="staff-admin__signal-card staff-admin__signal-card--blue">
                <span>Indexed knowledge</span>
                <strong>{indexedTotals.percent.toFixed(0)}%</strong>
                <small>{formatNumber(indexedTotals.indexed)} of {formatNumber(indexedTotals.documents)} documents indexed</small>
              </div>
              <div className="staff-admin__signal-card staff-admin__signal-card--violet">
                <span>Useful output conversion</span>
                <strong>{conversionPercent.toFixed(0)}%</strong>
                <small>{formatNumber(data.lifecycle.usefulOutputs30d)} useful outputs from {formatNumber(data.lifecycle.onboardingCompleted30d)} onboarded workspaces</small>
              </div>
              <div className="staff-admin__signal-card staff-admin__signal-card--amber">
                <span>Collections tracked</span>
                <strong>{formatCurrency(billingTotals.amountPaid)}</strong>
                <small>{formatCurrency(billingTotals.amountDue)} still outstanding</small>
              </div>
            </div>
          </article>
        </div>
      </section>

      <section className="staff-admin__overview-lower">
        <article className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Attention queue</div>
              <h2>Workspaces that need staff intervention</h2>
            </div>
          </div>
          <MotionList className="staff-admin__queue-list">
            {attentionQueue.length === 0 ? (
              <div className="staff-admin__empty">No organisation is currently surfacing a meaningful risk signal.</div>
            ) : (
              attentionQueue.map((organisation) => (
                <MotionListItem key={organisation.id} className="staff-admin__queue-item" reveal={{ y: 12, blur: 4 }}>
                  <div className="staff-admin__queue-head">
                    <strong>{organisation.name}</strong>
                    <span>{organisation.severity} flags</span>
                  </div>
                  <p>{organisation.reasons.join('. ')}.</p>
                  <small>
                    {formatNumber(organisation.memberCount)} members / {formatNumber(organisation.workflowCount)} workflows / {formatNumber(organisation.integrationCount)} integrations
                  </small>
                </MotionListItem>
              ))
            )}
          </MotionList>
        </article>

        <article className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Top workspaces</div>
              <h2>Most instrumented organisations</h2>
            </div>
          </div>
          <MotionList className="staff-admin__mini-grid" staggerChildren={0.04}>
            {topOrganisations.map((organisation) => (
              <MotionListItem key={organisation.id} className="staff-admin__mini-card" reveal={{ y: 12, blur: 4 }}>
                <strong>{organisation.name}</strong>
                <span>{humanize(organisation.plan)} plan / {formatNumber(organisation.memberCount)} members</span>
                <small>
                  {formatNumber(organisation.integrationCount)} integrations / {formatNumber(organisation.workflowCount)} workflows / {formatNumber(organisation.indexedDocumentCount)} indexed docs
                </small>
              </MotionListItem>
            ))}
          </MotionList>
        </article>

        <article className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Live feed</div>
              <h2>Recent platform events</h2>
            </div>
          </div>
          <div className="staff-admin__feed">
            {data.recentActivity.slice(0, 8).map((entry) => (
              <article key={entry.id} className="staff-admin__feed-item staff-admin__feed-item--readable">
                <span className={`staff-admin__feed-dot staff-admin__feed-dot--${entry.kind}`} aria-hidden="true" />
                <div className="staff-admin__feed-body">
                  <div className="staff-admin__feed-heading">
                    <div className="staff-admin__feed-title-group">
                      <strong>{getActivityTitle(entry)}</strong>
                      <p className="staff-admin__feed-summary">{describeActivity(entry)}</p>
                    </div>
                    <span>{formatDateTime(entry.createdAt)}</span>
                  </div>
                  <div className="staff-admin__feed-chips">
                    {getActivityHighlights(entry).map((chip) => (
                      <span key={`${entry.id}-${chip}`} className="staff-admin__feed-chip">
                        {chip}
                      </span>
                    ))}
                  </div>
                </div>
              </article>
            ))}
          </div>
        </article>
      </section>
    </>
  );
}

export function OrganisationInspector({ organisation, onSave, isSaving }) {
  const [plan, setPlan] = useState('pro');
  const [monthlyCreditLimit, setMonthlyCreditLimit] = useState('0');
  const [seatLimit, setSeatLimit] = useState('1');

  useEffect(() => {
    if (!organisation) return;
    setPlan(organisation.plan ?? 'pro');
    setMonthlyCreditLimit(String(organisation.monthlyCreditLimit ?? 0));
    setSeatLimit(String(organisation.seatLimit ?? 1));
  }, [organisation]);

  if (!organisation) {
    return <div className="staff-admin__empty">No organisation matched the current filters.</div>;
  }

  const usagePercent = getPercent(organisation.creditsUsed, organisation.monthlyCreditLimit);
  const indexingPercent = getPercent(organisation.indexedDocumentCount, organisation.documentCount);

  return (
    <div className="staff-admin__inspector">
      <div className="staff-admin__inspector-head">
        <div>
          <div className="staff-admin__surface-label">Workspace inspector</div>
          <h2>{organisation.name}</h2>
        </div>
        <span className={`staff-admin__badge staff-admin__badge--${getPlanTone(organisation.plan)}`}>
          {humanize(organisation.plan)}
        </span>
      </div>

      <p className="staff-admin__inspector-copy">
        Control the commercial and capacity settings for this workspace without leaving the staff console.
      </p>

      <div className="staff-admin__inspector-grid">
        <MetricTile label="Members" value={formatNumber(organisation.memberCount)} helper={`${formatNumber(organisation.pendingInvites)} pending invites`} />
        <MetricTile label="Credits" value={`${usagePercent.toFixed(0)}%`} helper={`${formatNumber(organisation.creditsUsed)} used`} />
        <MetricTile label="Knowledge" value={`${indexingPercent.toFixed(0)}%`} helper={`${formatNumber(organisation.indexedDocumentCount)} indexed docs`} />
        <MetricTile label="Automation" value={formatNumber(organisation.runCount)} helper={`${formatNumber(organisation.workflowCount)} workflows`} />
      </div>

      <div className="staff-admin__form-grid">
        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Plan</span>
          <select className="staff-admin__select" value={plan} onChange={(event) => setPlan(event.target.value)}>
            {PLAN_OPTIONS.filter((option) => option !== 'all').map((option) => (
              <option key={option} value={option}>{humanize(option)}</option>
            ))}
          </select>
        </label>

        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Monthly credit limit</span>
          <TextInput value={monthlyCreditLimit} onChange={(event) => setMonthlyCreditLimit(event.target.value)} />
        </label>

        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Seat limit</span>
          <TextInput value={seatLimit} onChange={(event) => setSeatLimit(event.target.value)} />
        </label>
      </div>

      <div className="staff-admin__inspector-actions">
        <Button
          tone="accent"
          disabled={isSaving}
          onClick={() => onSave({
            plan,
            monthlyCreditLimit: Number(monthlyCreditLimit),
            seatLimit: Number(seatLimit),
          })}
        >
          {isSaving ? 'Saving...' : 'Save workspace controls'}
        </Button>
      </div>

      <div className="staff-admin__detail-list">
        <div><span>Slug</span><strong>{organisation.slug}</strong></div>
        <div><span>Organisation ID</span><strong>{organisation.id}</strong></div>
        <div><span>Created</span><strong>{formatDateTime(organisation.createdAt)}</strong></div>
        <div><span>Updated</span><strong>{formatDateTime(organisation.updatedAt)}</strong></div>
      </div>
    </div>
  );
}

export function UserInspector({ user, organisations, onSave, isSaving }) {
  const [role, setRole] = useState('member');
  const [orgId, setOrgId] = useState('');

  useEffect(() => {
    if (!user) return;
    setRole(user.role ?? 'member');
    setOrgId(user.orgId ?? '');
  }, [user]);

  if (!user) {
    return <div className="staff-admin__empty">No user matched the current filters.</div>;
  }

  return (
    <div className="staff-admin__inspector">
      <div className="staff-admin__inspector-head">
        <div>
          <div className="staff-admin__surface-label">User inspector</div>
          <h2>{displayName(user)}</h2>
        </div>
        <span className={`staff-admin__badge staff-admin__badge--${getRoleTone(user.role)}`}>
          {humanize(user.role)}
        </span>
      </div>

      <p className="staff-admin__inspector-copy">
        Adjust role placement and workspace assignment directly from the Prymal staff plane.
      </p>

      <div className="staff-admin__inspector-grid">
        <MetricTile label="Organisation" value={truncate(user.orgName ?? 'Unassigned', 18)} helper={user.orgPlan ? humanize(user.orgPlan) : 'No workspace'} />
        <MetricTile label="Last seen" value={formatDate(user.lastSeenAt)} helper="Activity heartbeat" />
        <MetricTile label="Joined" value={formatDate(user.createdAt)} helper="Account created" />
        <MetricTile label="Role" value={humanize(user.role)} helper="Current access level" />
      </div>

      <div className="staff-admin__form-grid">
        <label className="staff-admin__field">
          <span className="staff-admin__field-label">Role</span>
          <select className="staff-admin__select" value={role} onChange={(event) => setRole(event.target.value)}>
            {ROLE_OPTIONS.filter((option) => option !== 'all').map((option) => (
              <option key={option} value={option}>{humanize(option)}</option>
            ))}
          </select>
        </label>

        <label className="staff-admin__field staff-admin__field--wide">
          <span className="staff-admin__field-label">Organisation</span>
          <select className="staff-admin__select" value={orgId} onChange={(event) => setOrgId(event.target.value)}>
            <option value="">No organisation</option>
            {organisations.map((organisation) => (
              <option key={organisation.id} value={organisation.id}>
                {organisation.name} / {humanize(organisation.plan)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <div className="staff-admin__inspector-actions">
        <Button
          tone="accent"
          disabled={isSaving}
          onClick={() => onSave({
            role,
            orgId: orgId || null,
          })}
        >
          {isSaving ? 'Saving...' : 'Save user controls'}
        </Button>
      </div>

      <div className="staff-admin__detail-list">
        <div><span>Email</span><strong>{user.email}</strong></div>
        <div><span>User ID</span><strong>{user.id}</strong></div>
        <div><span>Updated</span><strong>{formatDateTime(user.updatedAt)}</strong></div>
      </div>
    </div>
  );
}
