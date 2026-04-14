import { TextInput } from '../../../components/ui';
import { PLAN_OPTIONS, ROLE_OPTIONS } from '../constants';
import { humanize } from '../utils';

export function AdminCommandBar({
  commandQuery,
  onCommandQueryChange,
  planFilter,
  onPlanFilterChange,
  roleFilter,
  onRoleFilterChange,
  syncLabel,
}) {
  return (
    <section className="staff-admin__command-bar">
      <label className="staff-admin__field staff-admin__field--search">
        <span className="staff-admin__field-label">Global search</span>
        <TextInput
          value={commandQuery}
          onChange={(event) => onCommandQueryChange(event.target.value)}
          placeholder="Search orgs, users, invoices, workflow runs, and events"
        />
      </label>

      <label className="staff-admin__field">
        <span className="staff-admin__field-label">Plan lens</span>
        <select
          className="staff-admin__select"
          value={planFilter}
          onChange={(event) => onPlanFilterChange(event.target.value)}
        >
          {PLAN_OPTIONS.map((plan) => (
            <option key={plan} value={plan}>
              {plan === 'all' ? 'All plans' : humanize(plan)}
            </option>
          ))}
        </select>
      </label>

      <label className="staff-admin__field">
        <span className="staff-admin__field-label">Role lens</span>
        <select
          className="staff-admin__select"
          value={roleFilter}
          onChange={(event) => onRoleFilterChange(event.target.value)}
        >
          {ROLE_OPTIONS.map((role) => (
            <option key={role} value={role}>
              {role === 'all' ? 'All roles' : humanize(role)}
            </option>
          ))}
        </select>
      </label>

      <div className="staff-admin__sync-chip">
        <span className="staff-admin__sync-dot" aria-hidden="true" />
        Synced {syncLabel}
      </div>
    </section>
  );
}
