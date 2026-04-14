// features/admin/tabs/activity.jsx
import { formatDateTime, formatNumber, truncate } from '../../../lib/utils';
import {
  describeActivity,
  getActivityHighlights,
  getActivityTitle,
  humanize,
  summarizeMeta,
} from '../utils';
import { ACTIVITY_KIND_OPTIONS, RUN_STATUS_OPTIONS } from '../constants';

export function ActivityTab({
  activity,
  runs,
  documents,
  runFilter,
  onRunFilterChange,
  activityFilter,
  onActivityFilterChange,
}) {
  return (
    <div className="staff-admin__activity-grid">
      <section className="staff-admin__surface">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Platform feed</div>
            <h2>Audit and event stream</h2>
          </div>
          <div className="staff-admin__inline-filters">
            <select className="staff-admin__select" value={activityFilter} onChange={(event) => onActivityFilterChange(event.target.value)}>
              {ACTIVITY_KIND_OPTIONS.map((option) => (
                <option key={option} value={option}>
                  {option === 'all' ? 'All signals' : humanize(option)}
                </option>
              ))}
            </select>
          </div>
        </div>

        <div className="staff-admin__feed">
          {activity.length === 0 ? (
            <div className="staff-admin__empty">No activity matched the current query.</div>
          ) : (
            activity.map((entry) => (
              <article key={entry.id} className="staff-admin__feed-item staff-admin__feed-item--detailed">
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
                  <small>{summarizeMeta(entry.meta)}</small>
                </div>
              </article>
            ))
          )}
        </div>
      </section>

      <div className="staff-admin__stack-grid">
        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Execution queue</div>
              <h2>Workflow runs</h2>
            </div>
            <div className="staff-admin__inline-filters">
              <select className="staff-admin__select" value={runFilter} onChange={(event) => onRunFilterChange(event.target.value)}>
                {RUN_STATUS_OPTIONS.map((option) => (
                  <option key={option} value={option}>
                    {option === 'all' ? 'All runs' : humanize(option)}
                  </option>
                ))}
              </select>
            </div>
          </div>
          <div className="staff-admin__queue-list">
            {runs.length === 0 ? (
              <div className="staff-admin__empty">No workflow runs matched the current query.</div>
            ) : (
              runs.map((run) => (
                <article key={run.id} className="staff-admin__queue-item">
                  <div className="staff-admin__queue-head">
                    <strong>{run.workflowName}</strong>
                    <span>{humanize(run.status)}</span>
                  </div>
                  <p>{run.orgName} · {formatNumber(run.creditsUsed ?? 0)} credits · started {formatDateTime(run.startedAt ?? run.createdAt)}</p>
                  <small>{run.errorLog ? truncate(run.errorLog, 160) : 'No error log attached.'}</small>
                </article>
              ))
            )}
          </div>
        </section>

        <section className="staff-admin__surface">
          <div className="staff-admin__surface-head">
            <div>
              <div className="staff-admin__surface-label">Knowledge queue</div>
              <h2>Documents awaiting resolution</h2>
            </div>
          </div>
          <div className="staff-admin__queue-list">
            {documents.length === 0 ? (
              <div className="staff-admin__empty">No queued documents matched the current query.</div>
            ) : (
              documents.map((document) => (
                <article key={document.id} className="staff-admin__queue-item">
                  <div className="staff-admin__queue-head">
                    <strong>{document.title}</strong>
                    <span>{humanize(document.status)}</span>
                  </div>
                  <p>{document.orgName} · {humanize(document.sourceType)}</p>
                  <small>Updated {formatDateTime(document.updatedAt)}</small>
                </article>
              ))
            )}
          </div>
        </section>
      </div>
    </div>
  );
}

export function AuditLogsTab({ query }) {
  const logs = query.data?.logs ?? [];

  return (
    <div className="staff-admin__tab-body">
      <section className="staff-admin__section">
        <header className="staff-admin__section-head">
          <h2 className="staff-admin__section-title">Audit log</h2>
          <span className="staff-admin__section-meta">{formatNumber(logs.length)} entries</span>
        </header>
        {query.isLoading ? (
          <div className="staff-admin__empty">Loading audit log…</div>
        ) : logs.length === 0 ? (
          <div className="staff-admin__empty">No audit log entries found.</div>
        ) : (
          <div className="staff-admin__queue-list">
            {logs.map((log) => (
              <article key={log.id} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>{log.action}</strong>
                  <span>{formatDateTime(log.createdAt)}</span>
                </div>
                <p>
                  {log.targetType && log.targetId ? `${log.targetType}: ${truncate(log.targetId, 36)}` : 'No target'}
                  {log.actorUserId ? ` · actor: ${truncate(log.actorUserId, 24)}` : ''}
                  {log.orgId ? ` · org: ${truncate(log.orgId, 24)}` : ''}
                </p>
                {Object.keys(log.metadata ?? {}).length > 0 ? (
                  <small style={{ wordBreak: 'break-all' }}>{JSON.stringify(log.metadata)}</small>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function CreditUsageTab({ query }) {
  const orgs = query.data?.organisations ?? [];
  const totalCreditsUsed = query.data?.totalCreditsUsed ?? 0;

  return (
    <div className="staff-admin__tab-body">
      <section className="staff-admin__section">
        <header className="staff-admin__section-head">
          <h2 className="staff-admin__section-title">Credit usage</h2>
          <span className="staff-admin__section-meta">{formatNumber(totalCreditsUsed)} total credits consumed</span>
        </header>
        {query.isLoading ? (
          <div className="staff-admin__empty">Loading credit usage…</div>
        ) : orgs.length === 0 ? (
          <div className="staff-admin__empty">No organisations found.</div>
        ) : (
          <div className="staff-admin__queue-list">
            {orgs.map((org) => (
              <article key={org.id} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>{org.name}</strong>
                  <span style={{ color: org.usagePercent >= 90 ? '#ef4444' : org.usagePercent >= 70 ? '#f59e0b' : 'var(--muted)' }}>
                    {org.usagePercent}%
                  </span>
                </div>
                <div style={{ margin: '6px 0', height: '4px', borderRadius: '2px', background: 'var(--line)', overflow: 'hidden' }}>
                  <div style={{
                    height: '100%',
                    width: `${Math.min(org.usagePercent, 100)}%`,
                    background: org.usagePercent >= 90 ? '#ef4444' : org.usagePercent >= 70 ? '#f59e0b' : '#18c7a0',
                    borderRadius: '2px',
                  }} />
                </div>
                <p>
                  {formatNumber(org.creditsUsed)} / {formatNumber(org.monthlyCreditLimit)} credits
                  {' · '}
                  <span style={{ textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.1em' }}>{org.plan}</span>
                </p>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function ProductEventsTab({ query }) {
  const events = query.data?.events ?? [];

  return (
    <div className="staff-admin__tab-body">
      <section className="staff-admin__section">
        <header className="staff-admin__section-head">
          <h2 className="staff-admin__section-title">Product events</h2>
          <span className="staff-admin__section-meta">{formatNumber(events.length)} events</span>
        </header>
        {query.isLoading ? (
          <div className="staff-admin__empty">Loading product events…</div>
        ) : events.length === 0 ? (
          <div className="staff-admin__empty">No product events found.</div>
        ) : (
          <div className="staff-admin__queue-list">
            {events.map((event) => (
              <article key={event.id} className="staff-admin__queue-item">
                <div className="staff-admin__queue-head">
                  <strong>{event.eventName}</strong>
                  <span>{formatDateTime(event.createdAt)}</span>
                </div>
                <p>
                  {event.orgId ? `org: ${truncate(event.orgId, 24)}` : 'No org'}
                  {event.userId ? ` · user: ${truncate(event.userId, 24)}` : ''}
                </p>
                {Object.keys(event.metadata ?? {}).length > 0 ? (
                  <small style={{ wordBreak: 'break-all' }}>{JSON.stringify(event.metadata)}</small>
                ) : null}
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
