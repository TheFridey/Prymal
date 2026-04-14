// features/admin/tabs/billing.jsx
import { useState } from 'react';
import { formatDate, formatNumber } from '../../../lib/utils';
import { InlineNotice, LoadingPanel } from '../../../components/ui';
import { formatCurrency, humanize, getPlanTone } from '../utils';
import { MotionList, MotionListItem } from '../../../components/motion';

export function BillingTab({ data, billingTotals }) {
  const invoices = data.billing.invoices ?? [];
  const subscriptions = data.billing.subscriptions ?? [];

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
        </MotionList>
      </section>

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
    </div>
  );
}

export function RevenueTab({ query }) {
  const d = query.data;

  if (query.isLoading) {
    return <LoadingPanel />;
  }

  const planDistribution = d?.planDistribution ?? [];
  const monthlyRevenueSeries = d?.monthlyRevenueSeries ?? [];
  const recentInvoices = d?.recentInvoices ?? [];
  const stripeMrr = d?.stripeMrr ?? 0;
  const estimatedMrrTotal = d?.estimatedMrrTotal ?? 0;
  const paidCustomers = d?.paidCustomers ?? 0;
  const totalOrgs = d?.totalOrgs ?? 0;
  const stripeConfigured = d?.stripeConfigured ?? false;

  const displayMrr = stripeConfigured && stripeMrr > 0 ? stripeMrr : estimatedMrrTotal;
  const mrrLabel = stripeConfigured && stripeMrr > 0 ? 'Live MRR (Stripe)' : 'Estimated MRR';

  return (
    <div style={{ display: 'grid', gap: '20px' }}>
      <section className="staff-admin__metric-grid" style={{ gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))' }}>
        {[
          { label: mrrLabel, value: `$${formatNumber(displayMrr)}` },
          { label: 'Paid customers', value: formatNumber(paidCustomers) },
          { label: 'Total orgs', value: formatNumber(totalOrgs) },
          { label: 'Conversion rate', value: totalOrgs > 0 ? `${Math.round((paidCustomers / totalOrgs) * 100)}%` : '0%' },
        ].map((card) => (
          <div key={card.label} className="staff-admin__metric-card">
            <div className="staff-admin__metric-label">{card.label}</div>
            <div className="staff-admin__metric-value">{card.value}</div>
          </div>
        ))}
      </section>

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
                  <td>{row.priceUsd > 0 ? `$${row.priceUsd}` : '—'}</td>
                  <td>{row.estimatedMrr > 0 ? `$${formatNumber(row.estimatedMrr)}` : '—'}</td>
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
                    <td>${formatNumber(Math.round(entry.revenue))}</td>
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
