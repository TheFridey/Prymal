import { useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/utils';

const INTERVAL_OPTIONS = [
  { value: 'hourly', label: 'Hourly' },
  { value: 'daily', label: 'Daily' },
  { value: 'multiple_times_daily', label: 'Multiple times a day' },
  { value: 'weekly', label: 'Weekly' },
  { value: 'selected_days', label: 'Selected days' },
];

const APPROVAL_OPTIONS = [
  { value: 'auto_publish', label: 'Auto-publish', description: 'Publish immediately after WARDEN check.' },
  { value: 'approval_required', label: 'Approval required', description: 'Send for human review before publishing.' },
  { value: 'draft_only', label: 'Draft only', description: 'Generate content but never publish automatically.' },
];

const DAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, h) => ({
  value: h,
  label: `${String(h).padStart(2, '0')}:00`,
}));

const COMMON_TIMEZONES = [
  'UTC',
  'America/New_York',
  'America/Chicago',
  'America/Denver',
  'America/Los_Angeles',
  'Europe/London',
  'Europe/Paris',
  'Europe/Berlin',
  'Asia/Dubai',
  'Asia/Kolkata',
  'Asia/Singapore',
  'Asia/Tokyo',
  'Australia/Sydney',
];

export default function WorkflowScheduleConfig({ workflow, onClose }) {
  const queryClient = useQueryClient();

  const [intervalType, setIntervalType] = useState(workflow.intervalType ?? 'daily');
  const [timesPerDay, setTimesPerDay] = useState(
    Array.isArray(workflow.timesPerDay) && workflow.timesPerDay.length > 0
      ? workflow.timesPerDay
      : [9],
  );
  const [daysOfWeek, setDaysOfWeek] = useState(
    Array.isArray(workflow.daysOfWeek) && workflow.daysOfWeek.length > 0
      ? workflow.daysOfWeek
      : [1],
  );
  const [timezone, setTimezone] = useState(workflow.timezone ?? 'UTC');
  const [approvalMode, setApprovalMode] = useState(workflow.approvalMode ?? 'auto_publish');
  const [error, setError] = useState(null);

  const saveMutation = useMutation({
    mutationFn: (payload) => api.put(`/workflows/${workflow.id}/schedule`, payload),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] });
      onClose?.();
    },
    onError: (err) => setError(getErrorMessage(err)),
  });

  function toggleHour(hour) {
    setTimesPerDay((prev) =>
      prev.includes(hour) ? prev.filter((h) => h !== hour) : [...prev, hour].sort((a, b) => a - b),
    );
  }

  function toggleDay(day) {
    setDaysOfWeek((prev) =>
      prev.includes(day) ? prev.filter((d) => d !== day) : [...prev, day].sort((a, b) => a - b),
    );
  }

  function handleSave() {
    setError(null);
    saveMutation.mutate({ intervalType, timesPerDay, daysOfWeek, timezone, approvalMode });
  }

  const needsDays = intervalType === 'weekly' || intervalType === 'selected_days';
  const needsHours = intervalType !== 'hourly';

  return (
    <div style={{ padding: '1.5rem', maxWidth: 480, display: 'flex', flexDirection: 'column', gap: '1.25rem' }}>
      <h3 style={{ margin: 0, fontSize: '1rem', fontWeight: 600 }}>Schedule configuration</h3>

      {/* Interval type */}
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Run frequency</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.4rem' }}>
          {INTERVAL_OPTIONS.map((opt) => (
            <label key={opt.value} style={radioLabelStyle}>
              <input
                type="radio"
                name="intervalType"
                value={opt.value}
                checked={intervalType === opt.value}
                onChange={() => setIntervalType(opt.value)}
              />
              {opt.label}
            </label>
          ))}
        </div>
      </fieldset>

      {/* Days of week */}
      {needsDays && (
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Days</legend>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {DAY_LABELS.map((label, i) => (
              <button
                key={i}
                type="button"
                onClick={() => toggleDay(i)}
                style={{
                  ...dayBtnStyle,
                  background: daysOfWeek.includes(i) ? 'var(--color-accent, #7c3aed)' : 'transparent',
                  color: daysOfWeek.includes(i) ? '#fff' : 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Times per day */}
      {needsHours && (
        <fieldset style={fieldsetStyle}>
          <legend style={legendStyle}>Time(s) of day (local)</legend>
          <div style={{ display: 'flex', gap: '0.4rem', flexWrap: 'wrap' }}>
            {HOUR_OPTIONS.map(({ value, label }) => (
              <button
                key={value}
                type="button"
                onClick={() => toggleHour(value)}
                style={{
                  ...hourBtnStyle,
                  background: timesPerDay.includes(value) ? 'var(--color-accent, #7c3aed)' : 'transparent',
                  color: timesPerDay.includes(value) ? '#fff' : 'inherit',
                }}
              >
                {label}
              </button>
            ))}
          </div>
        </fieldset>
      )}

      {/* Timezone */}
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>Timezone</legend>
        <select
          value={timezone}
          onChange={(e) => setTimezone(e.target.value)}
          style={selectStyle}
        >
          {COMMON_TIMEZONES.map((tz) => (
            <option key={tz} value={tz}>{tz}</option>
          ))}
        </select>
      </fieldset>

      {/* Approval mode */}
      <fieldset style={fieldsetStyle}>
        <legend style={legendStyle}>LinkedIn post approval</legend>
        <div style={{ display: 'flex', flexDirection: 'column', gap: '0.5rem' }}>
          {APPROVAL_OPTIONS.map((opt) => (
            <label key={opt.value} style={{ ...radioLabelStyle, alignItems: 'flex-start' }}>
              <input
                type="radio"
                name="approvalMode"
                value={opt.value}
                checked={approvalMode === opt.value}
                onChange={() => setApprovalMode(opt.value)}
                style={{ marginTop: '0.2rem' }}
              />
              <span>
                <span style={{ fontWeight: 500 }}>{opt.label}</span>
                <br />
                <span style={{ fontSize: '0.8rem', opacity: 0.65 }}>{opt.description}</span>
              </span>
            </label>
          ))}
        </div>
      </fieldset>

      {error && (
        <p style={{ color: '#ef4444', fontSize: '0.85rem', margin: 0 }}>{error}</p>
      )}

      <div style={{ display: 'flex', gap: '0.75rem', justifyContent: 'flex-end' }}>
        {onClose && (
          <button type="button" onClick={onClose} style={cancelBtnStyle} disabled={saveMutation.isPending}>
            Cancel
          </button>
        )}
        <button
          type="button"
          onClick={handleSave}
          style={saveBtnStyle}
          disabled={saveMutation.isPending || (needsDays && daysOfWeek.length === 0) || (needsHours && timesPerDay.length === 0)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save schedule'}
        </button>
      </div>
    </div>
  );
}

const fieldsetStyle = {
  border: '1px solid rgba(255,255,255,0.08)',
  borderRadius: '0.5rem',
  padding: '0.75rem',
  margin: 0,
};

const legendStyle = {
  fontSize: '0.75rem',
  fontWeight: 600,
  textTransform: 'uppercase',
  letterSpacing: '0.05em',
  opacity: 0.55,
  padding: '0 0.25rem',
};

const radioLabelStyle = {
  display: 'flex',
  alignItems: 'center',
  gap: '0.5rem',
  cursor: 'pointer',
  fontSize: '0.9rem',
};

const dayBtnStyle = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '0.375rem',
  padding: '0.25rem 0.6rem',
  cursor: 'pointer',
  fontSize: '0.8rem',
  fontWeight: 500,
  transition: 'background 0.15s',
};

const hourBtnStyle = {
  border: '1px solid rgba(255,255,255,0.15)',
  borderRadius: '0.375rem',
  padding: '0.2rem 0.5rem',
  cursor: 'pointer',
  fontSize: '0.75rem',
  fontFamily: 'monospace',
  transition: 'background 0.15s',
};

const selectStyle = {
  width: '100%',
  padding: '0.4rem 0.6rem',
  borderRadius: '0.375rem',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  fontSize: '0.875rem',
};

const cancelBtnStyle = {
  padding: '0.5rem 1rem',
  borderRadius: '0.375rem',
  border: '1px solid rgba(255,255,255,0.15)',
  background: 'transparent',
  cursor: 'pointer',
  fontSize: '0.875rem',
};

const saveBtnStyle = {
  padding: '0.5rem 1.25rem',
  borderRadius: '0.375rem',
  border: 'none',
  background: 'var(--color-accent, #7c3aed)',
  color: '#fff',
  cursor: 'pointer',
  fontSize: '0.875rem',
  fontWeight: 600,
  opacity: 1,
};
