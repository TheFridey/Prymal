// features/admin/tabs/billing.jsx
import { useMemo, useState } from 'react';
import { formatDate, formatNumber, formatUserHandle } from '../../../lib/utils';
import { InlineNotice, LoadingPanel } from '../../../components/ui';
import { formatCurrency, humanize } from '../utils';
import { MotionList, MotionListItem } from '../../../components/motion';

export function BillingTab({ data, billingTotals, videoJobsQuery }) {
  const invoices = data.billing.invoices ?? [];
  const subscriptions = data.billing.subscriptions ?? [];
  const videoJobs = videoJobsQuery?.data?.jobs ?? [];
  const foundingAccess = data.billing.foundingAccess ?? null;

  return (
    <div className="staff-admin__billing-grid">
      <section className="staff-admin__surface staff-admin__surface--billing-hero">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Revenue visibility</div>
            <h2>Billing and subscriptions</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {data.billing.configured ? 'Stripe connected' : 'Stripe not configured'}
          </div>
        </div>

        {!data.billing.configured ? (
          <InlineNotice tone="warning">
            Stripe is not configured on this environment, so invoice and subscription telemetry is unavailable.
          </InlineNotice>
        ) : data.billing.error ? (
          <InlineNotice tone="warning">
            Stripe is configured, but Prymal could not load billing data right now: {data.billing.error}
          </InlineNotice>
        ) : null}

        <MotionList className="staff-admin__metric-grid staff-admin__metric-grid--billing" staggerChildren={0.04}>
          <MotionListItem className="staff-admin__metric staff-admin__metric--mint" reveal={{ y: 14, blur: 4 }}>
            <span className="staff-admin__metric-label">Paid invoices</span>
            <strong>{formatCurrency(billingTotals.amountPaid)}</strong>
            <small>{formatNumber(invoices.filter((invoice) => invoice.status === 'paid').length)} paid records</small>
          </MotionListItem>
          <MotionListItem className="staff-admin__metric staff-admin__metric--amber" reveal={{ y: 14, blur: 4 }}>
            <span className="staff-admin__metric-label">Outstanding</span>
            <strong>{formatCurrency(billingTotals.amountDue)}</strong>
            <small>{formatNumber(invoices.filter((invoice) => invoice.amountDue > 0).length)} invoices with remaining balance</small>
          </MotionListItem>
          <MotionListItem className="staff-admin__metric staff-admin__metric--violet" reveal={{ y: 14, blur: 4 }}>
            <span className="staff-admin__metric-label">Active subscriptions</span>
            <strong>{formatNumber(billingTotals.activeSubscriptions)}</strong>
            <small>{formatNumber(billingTotals.cancelingSubscriptions)} set to cancel at period end</small>
          </MotionListItem>
          <MotionListItem className="staff-admin__metric staff-admin__metric--mint" reveal={{ y: 14, blur: 4 }}>
            <span className="staff-admin__metric-label">Founding Access</span>
            <strong>{foundingAccess?.active ? 'Open' : 'Closed'}</strong>
            <small>{formatNumber(foundingAccess?.paidClaimsCount ?? 0)} paid claims | {formatNumber(foundingAccess?.leadCount ?? 0)} leads</small>
          </MotionListItem>
        </MotionList>
      </section>

      {foundingAccess ? (
        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Offer visibility</div>
              <h2>Founding Access</h2>
            </div>
            <div className="staff-admin__surface-meta">
              {foundingAccess.active ? 'Active' : 'Inactive'}
            </div>
          </div>
          <MotionList className="staff-admin__ledger">
            {(foundingAccess.recentClaims ?? []).length === 0 ? (
              <div className="staff-admin__empty">No Founding Access claims have been recorded yet.</div>
            ) : (
              foundingAccess.recentClaims.map((claim) => (
                <MotionListItem key={claim.id} className="staff-admin__ledger-row" reveal={{ y: 10, blur: 3 }}>
                  <div>
                    <strong>{claim.planId}</strong>
                    <span>{claim.organisationId ?? claim.orgId ?? 'No organisation'}</span>
                  </div>
                  <div>
                    <strong>{humanize(claim.status)}</strong>
                    <span>{claim.stripeSubscriptionId ?? 'Subscription pending'}</span>
                  </div>
                  <div>
                    <strong>{formatDate(claim.claimedAt)}</strong>
                    <span>{claim.firstMonthCreditBoostAppliedAt ? 'Credit boost applied' : 'Credit boost pending'}</span>
                  </div>
                </MotionListItem>
              ))
            )}
          </MotionList>
        </section>
      ) : null}

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Invoice ledger</div>
            <h2>Recent invoices</h2>
          </div>
        </div>
        <MotionList className="staff-admin__ledger">
          {invoices.length === 0 ? (
            <div className="staff-admin__empty">No invoice records are available for this environment.</div>
          ) : (
            invoices.map((invoice) => (
              <MotionListItem key={invoice.id} className="staff-admin__ledger-row" reveal={{ y: 10, blur: 3 }}>
                <div>
                  <strong>{invoice.orgName ?? 'Unknown organisation'}</strong>
                  <span>{invoice.number ?? invoice.id}</span>
                </div>
                <div>
                  <strong>{formatCurrency(invoice.amountPaid, invoice.currency)}</strong>
                  <span>{invoice.status ?? 'unknown'}</span>
                </div>
                <div>
                  <strong>{formatDate(invoice.createdAt)}</strong>
                  <span>{invoice.amountDue > 0 ? `${formatCurrency(invoice.amountDue, invoice.currency)} due` : 'Settled'}</span>
                </div>
                <div className="staff-admin__ledger-actions">
                  {invoice.hostedInvoiceUrl ? (
                    <a className="staff-admin__ghost-link" href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer">
                      Open
                    </a>
                  ) : null}
                  {invoice.invoicePdf ? (
                    <a className="staff-admin__ghost-link" href={invoice.invoicePdf} target="_blank" rel="noreferrer">
                      PDF
                    </a>
                  ) : null}
                </div>
              </MotionListItem>
            ))
          )}
        </MotionList>
      </section>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Subscription pulse</div>
            <h2>Recent subscriptions</h2>
          </div>
        </div>
        <MotionList className="staff-admin__ledger">
          {subscriptions.length === 0 ? (
            <div className="staff-admin__empty">No subscriptions are currently returned from Stripe.</div>
          ) : (
            subscriptions.map((subscription) => (
              <MotionListItem key={subscription.id} className="staff-admin__ledger-row" reveal={{ y: 10, blur: 3 }}>
                <div>
                  <strong>{subscription.orgName ?? 'Unknown organisation'}</strong>
                  <span>{subscription.id}</span>
                </div>
                <div>
                  <strong>{humanize(subscription.status)}</strong>
                  <span>{subscription.cancelAtPeriodEnd ? 'Cancels at period end' : 'Retained'}</span>
                </div>
                <div>
                  <strong>{formatDate(subscription.currentPeriodEnd)}</strong>
                  <span>Current period end</span>
                </div>
              </MotionListItem>
            ))
          )}
        </MotionList>
      </section>

      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Video queue visibility</div>
            <h2>Recent video jobs</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {formatNumber(videoJobs.length)} visible
          </div>
        </div>

        {videoJobsQuery?.isLoading ? (
          <LoadingPanel label="Loading recent video jobs..." />
        ) : videoJobs.length === 0 ? (
          <div className="staff-admin__empty">No video jobs have been recorded in this environment yet.</div>
        ) : (
          <MotionList className="staff-admin__ledger">
            {videoJobs.map((job) => (
              <MotionListItem key={job.id} className="staff-admin__ledger-row" reveal={{ y: 10, blur: 3 }}>
                <div>
                  <strong>{job.orgName ?? 'Unknown organisation'}</strong>
                  <span>{job.userEmail ? formatUserHandle(job.userEmail, job.userId) : job.userId ?? 'No user attached'}</span>
                </div>
                <div>
                  <strong>{humanize(job.status)}</strong>
                  <span>{job.providerLabel ?? job.mode}</span>
                </div>
                <div>
                  <strong>{`${job.durationSeconds}s | ${job.resolution} | ${job.aspectRatio}`}</strong>
                  <span>
                    {job.referenceImageCount > 0 ? `${job.referenceImageCount} refs` : 'No refs'}
                    {' | '}
                    {job.creditsRequested} reserved
                    {' | '}
                    {job.creditsCommitted} committed
                  </span>
                </div>
                <div className="staff-admin__ledger-actions" style={{ alignItems: 'flex-end' }}>
                  <span style={{ color: 'var(--muted)', fontSize: '12px' }}>
                    {job.storageProvider ?? 'storage n/a'}
                    {job.providerErrorCategory ? ` | ${job.providerErrorCategory}` : ''}
                  </span>
                  {job.deliveryUrl ? (
                    <a className="staff-admin__ghost-link" href={job.deliveryUrl} target="_blank" rel="noreferrer">
                      Open asset
                    </a>
                  ) : null}
                </div>
              </MotionListItem>
            ))}
          </MotionList>
        )}

        {!videoJobsQuery?.isLoading && videoJobs.length > 0 ? (
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            {videoJobs.slice(0, 6).map((job) => (
              <div
                key={`${job.id}-detail`}
                style={{
                  padding: '12px 14px',
                  borderRadius: '14px',
                  border: '1px solid var(--line)',
                  background: 'rgba(255,255,255,0.02)',
                  color: 'var(--muted)',
                  fontSize: '12px',
                  lineHeight: 1.6,
                }}
              >
                <div style={{ color: 'var(--text-strong)', fontWeight: 600, marginBottom: '4px' }}>
                  {job.id}
                </div>
                <div>
                  {job.failureCode ? `Failure: ${job.failureCode}` : 'Failure: none'}
                  {job.failureMessage ? ` | ${job.failureMessage}` : ''}
                </div>
                <div>
                  {job.providerJobId ? `Provider job: ${job.providerJobId}` : 'Provider job: pending'}
                  {job.cloudinaryPublicId ? ` | Cloudinary: ${job.cloudinaryPublicId}` : ''}
                </div>
                <div>
                  Created {formatDate(job.createdAt)}
                  {job.completedAt ? ` | Completed ${formatDate(job.completedAt)}` : ''}
                  {job.retryCount > 0 ? ` | Retries ${job.retryCount}/${job.maxRetries}` : ''}
                </div>
              </div>
            ))}
          </div>
        ) : null}
      </section>
    </div>
  );
}

export function RevenueTab({ query }) {
  const d = query.data;
  const [planSort, setPlanSort] = useState({ key: 'planKey', asc: true });
  const [userCostSort, setUserCostSort] = useState({ key: 'estimatedBurnGbp', asc: false });

  const planDistribution = d?.planDistribution ?? [];
  const monthlyRevenueSeries = d?.monthlyRevenueSeries ?? [];
  const recentInvoices = d?.recentInvoices ?? [];
  const currency = d?.currency ?? 'GBP';
  const stripeMrr = d?.stripeMrrGbp ?? d?.stripeMrr ?? 0;
  const estimatedMrrTotal = d?.estimatedMrrTotalGbp ?? d?.estimatedMrrTotal ?? 0;
  const paidCustomers = d?.paidCustomers ?? 0;
  const totalOrgs = d?.totalOrgs ?? 0;
  const stripeConfigured = d?.stripeConfigured ?? false;
  const ec = d?.economicsDashboard ?? null;

  const displayMrr = stripeConfigured && stripeMrr > 0 ? stripeMrr : estimatedMrrTotal;
  const mrrLabel = stripeConfigured && stripeMrr > 0 ? 'Live MRR (Stripe)' : 'Estimated MRR';

  const sortedPlanEconomics = useMemo(() => {
    const rows = [...(ec?.perPlan ?? [])];
    const { key, asc } = planSort;
    rows.sort((a, b) => {
      const va = a[key] ?? 0;
      const vb = b[key] ?? 0;
      if (typeof va === 'string' && typeof vb === 'string') {
        return asc ? va.localeCompare(vb) : vb.localeCompare(va);
      }
      return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return rows;
  }, [ec?.perPlan, planSort]);

  const sortedTopUsers = useMemo(() => {
    const rows = [...(ec?.topUsers ?? [])];
    const { key, asc } = userCostSort;
    rows.sort((a, b) => {
      const va = a[key] ?? '';
      const vb = b[key] ?? '';
      if (key === 'email' || key === 'userId') {
        return asc ? String(va).localeCompare(String(vb)) : String(vb).localeCompare(String(va));
      }
      return asc ? Number(va) - Number(vb) : Number(vb) - Number(va);
    });
    return rows;
  }, [ec?.topUsers, userCostSort]);

  if (query.isLoading) {
    return <LoadingPanel />;
  }

  const togglePlanSort = (key) => {
    setPlanSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: key === 'planKey' }));
  };

  const toggleUserSort = (key) => {
    setUserCostSort((prev) => (prev.key === key ? { key, asc: !prev.asc } : { key, asc: key !== 'estimatedBurnGbp' }));
  };

  const planRowTone = (row) => {
    const p90 = row.pctUsersOver90PctCap ?? 0;
    const p70 = row.pctUsersOver70PctCap ?? 0;
    if (p90 > 0) return 'var(--danger, #f87171)';
    if (p70 > 0) return 'var(--amber, #f59e0b)';
    return undefined;
  };

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      {ec?.alerts?.length ? (
        <InlineNotice tone={ec.alerts.some((a) => a.level === 'critical') ? 'danger' : 'warning'}>
          <strong>Economics alerts</strong>
          <div style={{ marginTop: '8px', display: 'grid', gap: '6px', fontSize: '0.92rem' }}>
            {ec.alerts.slice(0, 12).map((a) => (
              <div key={`${a.code}-${a.message?.slice?.(0, 24)}`}>{a.message}</div>
            ))}
          </div>
        </InlineNotice>
      ) : null}

      <section className="staff-admin__metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: mrrLabel, value: `${currency === 'GBP' ? '£' : '$'}${formatNumber(displayMrr)}` },
          { label: 'Paid customers', value: formatNumber(paidCustomers) },
          { label: 'Total orgs', value: formatNumber(totalOrgs) },
          { label: 'Conversion rate', value: totalOrgs > 0 ? `${Math.round((paidCustomers / totalOrgs) * 100)}%` : '0%' },
          ...(ec?.global
            ? [
                { label: 'Est. total burn (cycle)', value: `£${formatNumber(Math.round(ec.global.totalEstimatedBurnGbp ?? 0))}` },
                { label: 'Gross contribution (est.)', value: `£${formatNumber(Math.round(ec.global.estimatedGrossContributionGbp ?? 0))}` },
                {
                  label: 'Burn / MRR',
                  value:
                    ec.global.burnToMrrRatio != null ? `${ec.global.burnToMrrRatio.toFixed(2)}×` : '—',
                },
              ]
            : []),
          ...(ec?.ledger
            ? [
                { label: 'Cycle execution burn', value: `£${formatNumber(Math.round(ec.ledger.executionCostGbp ?? 0))}` },
                { label: 'Cycle video burn', value: `£${formatNumber(Math.round(ec.ledger.videoCostGbp ?? 0))}` },
                { label: 'All-time ledger burn', value: `£${formatNumber(Math.round(ec.ledger.allTime?.totalLedgerGbp ?? 0))}` },
              ]
            : []),
          ...(ec?.revenueMix
            ? [
                { label: 'Add-on revenue', value: `£${formatNumber(Math.round(ec.revenueMix.addOnRevenueGbp ?? 0))}` },
              ]
            : []),
        ].map((card) => (
          <div key={card.label} className="staff-admin__metric-card">
            <div className="staff-admin__metric-label">{card.label}</div>
            <div className="staff-admin__metric-value">{card.value}</div>
          </div>
        ))}
      </section>

      {ec?.perPlan?.length ? (
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Per-plan economics (server)</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => togglePlanSort('planKey')}>
                    Plan {planSort.key === 'planKey' ? (planSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>Users</th>
                <th>MRR (est.)</th>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => togglePlanSort('totalBurnGbp')}>
                    Burn £ {planSort.key === 'totalBurnGbp' ? (planSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => togglePlanSort('avgBurnPerUser')}>
                    Avg burn / user {planSort.key === 'avgBurnPerUser' ? (planSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => togglePlanSort('avgHeadroomToCapGbp')}>
                    Avg headroom £ {planSort.key === 'avgHeadroomToCapGbp' ? (planSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>% WS &gt;70% cap</th>
                <th>% WS &gt;90% cap</th>
                <th>Avg % of cap</th>
              </tr>
            </thead>
            <tbody>
              {sortedPlanEconomics.map((row) => (
                <tr key={row.planKey} style={{ borderLeft: planRowTone(row) ? `3px solid ${planRowTone(row)}` : undefined }}>
                  <td><span className="staff-admin__plan-pill">{row.planKey}</span></td>
                  <td>{formatNumber(row.totalUsers ?? 0)}</td>
                  <td>{row.mrrGbp ? `£${formatNumber(Math.round(row.mrrGbp))}` : '—'}</td>
                  <td>£{formatNumber(Math.round(row.totalBurnGbp ?? 0))}</td>
                  <td>{row.avgBurnPerUser != null ? `£${row.avgBurnPerUser.toFixed(2)}` : '—'}</td>
                  <td>{row.avgHeadroomToCapGbp != null ? `£${row.avgHeadroomToCapGbp.toFixed(2)}` : '—'}</td>
                  <td>{row.pctUsersOver70PctCap != null ? `${Math.round(row.pctUsersOver70PctCap)}%` : '—'}</td>
                  <td>{row.pctUsersOver90PctCap != null ? `${Math.round(row.pctUsersOver90PctCap)}%` : '—'}</td>
                  <td>{row.avgPctOfCap != null ? `${row.avgPctOfCap.toFixed(0)}%` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {ec?.topUsers?.length ? (
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Top 10 users by cycle burn</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => toggleUserSort('email')}>
                    User {userCostSort.key === 'email' ? (userCostSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
                <th>
                  <button type="button" className="staff-admin__ghost-link" onClick={() => toggleUserSort('estimatedBurnGbp')}>
                    Est. burn £ {userCostSort.key === 'estimatedBurnGbp' ? (userCostSort.asc ? '↑' : '↓') : ''}
                  </button>
                </th>
              </tr>
            </thead>
            <tbody>
              {sortedTopUsers.map((u) => (
                <tr key={u.userId}>
                  <td>{u.email ?? u.userId}</td>
                  <td>£{formatNumber(Math.round(u.estimatedBurnGbp ?? 0))}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      {ec?.topWorkspaces?.length ? (
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Top 10 workspaces by cycle burn</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Workspace</th>
                <th>Cycle burn £</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {ec.topWorkspaces.map((w) => (
                <tr key={w.organisationId}>
                  <td>{w.name}</td>
                  <td>£{formatNumber(Math.round(w.estimatedBurnGbp ?? 0))}</td>
                  <td>{w.burnCapStatus ?? 'normal'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}

      <section style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Plan distribution & estimated MRR</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Plan</th>
                <th>Orgs</th>
                <th>Price/mo</th>
                <th>Est. MRR</th>
              </tr>
            </thead>
            <tbody>
              {planDistribution.map((row) => (
                <tr key={row.plan}>
                  <td><span className="staff-admin__plan-pill">{row.plan}</span></td>
                  <td>{formatNumber(row.count)}</td>
                  <td>{row.priceGbp > 0 ? `£${formatNumber(row.priceGbp)}` : '—'}</td>
                  <td>{row.estimatedMrrGbp > 0 ? `£${formatNumber(row.estimatedMrrGbp)}` : '—'}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {monthlyRevenueSeries.length > 0 ? (
          <div className="staff-admin__panel">
            <div className="staff-admin__panel-header">Monthly revenue (last 6 months)</div>
            <table className="staff-admin__table">
              <thead>
                <tr>
                  <th>Month</th>
                  <th>Revenue</th>
                  <th>Invoices</th>
                </tr>
              </thead>
              <tbody>
                {monthlyRevenueSeries.map((entry) => (
                  <tr key={entry.month}>
                    <td>{entry.month}</td>
                    <td>{currency === 'GBP' ? '£' : '$'}{formatNumber(Math.round(entry.revenue))}</td>
                    <td>{entry.count}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="staff-admin__panel">
            <div className="staff-admin__panel-header">Monthly revenue</div>
            <div className="staff-admin__empty">{stripeConfigured ? 'No paid invoices found.' : 'Stripe not configured — revenue trend unavailable.'}</div>
          </div>
        )}
      </section>

      {recentInvoices.length > 0 ? (
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Recent paid invoices</div>
          <table className="staff-admin__table">
            <thead>
              <tr>
                <th>Invoice</th>
                <th>Amount</th>
                <th>Date</th>
                <th>Link</th>
              </tr>
            </thead>
            <tbody>
              {recentInvoices.map((invoice) => (
                <tr key={invoice.id}>
                  <td>{invoice.number ?? invoice.id.slice(0, 12)}</td>
                  <td>{invoice.currency} {formatNumber(invoice.amountPaid.toFixed(2))}</td>
                  <td>{invoice.createdAt ? formatDate(invoice.createdAt) : '—'}</td>
                  <td>
                    {invoice.hostedInvoiceUrl ? (
                      <a href={invoice.hostedInvoiceUrl} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)', textDecoration: 'none' }}>
                        View
                      </a>
                    ) : '—'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : null}
    </div>
  );
}

export function ReferralsTab({ query, days, onDaysChange }) {
  const d = query.data;

  if (query.isLoading) return <LoadingPanel />;

  const stats = d?.stats ?? {};
  const topReferrers = d?.topReferrers ?? [];
  const recentActivity = d?.recentActivity ?? [];

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap' }}>
        <h2 style={{ margin: 0, fontSize: '1.1rem' }}>Referral programme</h2>
        <select
          className="field"
          value={days}
          onChange={(event) => onDaysChange(Number(event.target.value))}
          style={{ padding: '6px 10px', fontSize: '0.85rem' }}
        >
          {[7, 14, 30, 60, 90].map((d) => (
            <option key={d} value={d}>Last {d} days</option>
          ))}
        </select>
      </div>

      <section className="staff-admin__metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))' }}>
        {[
          { label: `Referrals (${days}d)`, value: formatNumber(stats.windowReferrals ?? 0) },
          { label: 'Total referrals', value: formatNumber(stats.totalReferrals ?? 0) },
          { label: 'Converted', value: formatNumber(stats.converted ?? 0) },
          { label: 'Conversion rate', value: `${stats.conversionRate ?? 0}%` },
          { label: 'Referral codes', value: formatNumber(stats.totalCodes ?? 0) },
          { label: 'Credits awarded', value: formatNumber(stats.totalCreditsAwarded ?? 0) },
        ].map((card) => (
          <div key={card.label} className="staff-admin__metric-card">
            <div className="staff-admin__metric-label">{card.label}</div>
            <div className="staff-admin__metric-value">{card.value}</div>
          </div>
        ))}
      </section>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Top referrers</div>
          {topReferrers.length === 0 ? (
            <div className="staff-admin__empty" style={{ fontSize: '13px', padding: '20px 0' }}>No referrals recorded yet.</div>
          ) : (
            <table className="staff-admin__table">
              <thead>
                <tr>
                  <th>Organisation</th>
                  <th>Plan</th>
                  <th>Referred</th>
                  <th>Converted</th>
                  <th>Credits</th>
                </tr>
              </thead>
              <tbody>
                {topReferrers.map((row) => (
                  <tr key={row.orgId}>
                    <td>{row.orgName}</td>
                    <td>
                      <span style={{ padding: '2px 7px', borderRadius: '999px', fontSize: '11px', background: `rgba(var(--plan-color, 100,100,100), 0.1)`, color: 'var(--muted)', border: '1px solid var(--line)' }}>
                        {row.orgPlan}
                      </span>
                    </td>
                    <td>{formatNumber(row.referralCount)}</td>
                    <td>{formatNumber(row.convertedCount)}</td>
                    <td>{formatNumber(row.creditsAwarded)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>

        <div className="staff-admin__panel">
          <div className="staff-admin__panel-header">Recent activity</div>
          {recentActivity.length === 0 ? (
            <div className="staff-admin__empty" style={{ fontSize: '13px', padding: '20px 0' }}>No recent referrals.</div>
          ) : (
            <table className="staff-admin__table">
              <thead>
                <tr>
                  <th>Referrer</th>
                  <th>Referee email</th>
                  <th>Status</th>
                  <th>Date</th>
                </tr>
              </thead>
              <tbody>
                {recentActivity.map((row) => (
                  <tr key={row.id}>
                    <td>{row.referrerOrgName}</td>
                    <td>{row.refereeEmail}</td>
                    <td>
                      {row.converted
                        ? <span style={{ color: '#18c7a0', fontSize: '12px' }}>Converted</span>
                        : <span style={{ color: 'var(--muted)', fontSize: '12px' }}>Pending</span>
                      }
                    </td>
                    <td>{formatDate(row.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
