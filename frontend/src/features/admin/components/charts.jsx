import { formatNumber } from '../../../lib/utils';

export function ActivityTrendChart({ series }) {
  const width = 720;
  const height = 260;
  const padding = 26;
  const graphHeight = height - padding * 2;
  const graphWidth = width - padding * 2;
  const maxValue = Math.max(
    1,
    ...series.map((entry) => Math.max(entry.events ?? 0, entry.audits ?? 0)),
  );

  const toPoint = (value, index) => {
    const x = padding + (graphWidth / Math.max(series.length - 1, 1)) * index;
    const y = padding + graphHeight - ((value ?? 0) / maxValue) * graphHeight;
    return [x, y];
  };

  const createLine = (key) => series
    .map((entry, index) => {
      const [x, y] = toPoint(entry[key], index);
      return `${x},${y}`;
    })
    .join(' ');

  const labelStep = Math.max(Math.ceil(series.length / 5), 1);

  return (
    <div className="staff-admin__trend-chart">
      <svg viewBox={`0 0 ${width} ${height}`} className="staff-admin__trend-svg" role="img" aria-label="Platform activity trend chart">
        {[0, 0.25, 0.5, 0.75, 1].map((ratio) => {
          const y = padding + graphHeight - graphHeight * ratio;
          return (
            <line
              key={ratio}
              x1={padding}
              y1={y}
              x2={width - padding}
              y2={y}
              className="staff-admin__trend-grid"
            />
          );
        })}
        <polyline
          points={createLine('audits')}
          className="staff-admin__trend-line staff-admin__trend-line--audits"
        />
        <polyline
          points={createLine('events')}
          className="staff-admin__trend-line staff-admin__trend-line--events"
        />
        {series.map((entry, index) => {
          const [eventX, eventY] = toPoint(entry.events, index);
          const [auditX, auditY] = toPoint(entry.audits, index);
          return (
            <g key={entry.date}>
              <circle cx={auditX} cy={auditY} r="4" className="staff-admin__trend-node staff-admin__trend-node--audits" />
              <circle cx={eventX} cy={eventY} r="4" className="staff-admin__trend-node staff-admin__trend-node--events" />
            </g>
          );
        })}
      </svg>
      <div className="staff-admin__trend-axis">
        {series.map((entry, index) => (
          <span key={entry.date} className={index % labelStep === 0 || index === series.length - 1 ? '' : 'is-muted'}>
            {entry.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ segments, total, label }) {
  const radius = 54;
  const circumference = 2 * Math.PI * radius;
  let offset = 0;

  return (
    <div className="staff-admin__donut">
      <svg viewBox="0 0 160 160" className="staff-admin__donut-svg" role="img" aria-label={label}>
        <circle cx="80" cy="80" r={radius} className="staff-admin__donut-track" />
        {segments.map((segment, index) => {
          const portion = total > 0 ? (segment.value / total) * circumference : 0;
          const strokeDasharray = `${portion} ${circumference - portion}`;
          const strokeDashoffset = -offset;
          offset += portion;

          return (
            <circle
              key={`${segment.color}-${index}`}
              cx="80"
              cy="80"
              r={radius}
              className="staff-admin__donut-segment"
              style={{
                '--segment': segment.color,
                strokeDasharray,
                strokeDashoffset,
              }}
            />
          );
        })}
      </svg>
      <div className="staff-admin__donut-copy">
        <span>{label}</span>
        <strong>{formatNumber(total)}</strong>
      </div>
    </div>
  );
}

export function MetricTile({ label, value, helper }) {
  return (
    <div className="staff-admin__mini-metric">
      <span>{label}</span>
      <strong>{value}</strong>
      <small>{helper}</small>
    </div>
  );
}
