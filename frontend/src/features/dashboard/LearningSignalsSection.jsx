import { Link } from 'react-router-dom';

function timeAgo(dateString) {
  if (!dateString) return 'No recent activity';
  const seconds = Math.floor((Date.now() - new Date(dateString).getTime()) / 1000);
  if (seconds < 60) return 'just now';
  const minutes = Math.floor(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  return `${weeks}w ago`;
}

const EMPTY_LEARNING_SIGNALS = {
  patternsLearned: {
    value: 0,
    label: 'Business patterns learned',
    trend: 'flat',
    explanation: 'Prymal will learn patterns as you generate, publish, and give feedback.',
  },
  workflowsReusedThisWeek: {
    value: 0,
    label: 'Workflows reused this week',
    trend: 'flat',
    explanation: 'Reusable workflow signals appear once you run again, replay, clone, or import workflow templates.',
  },
  topPerformingContentFormat: {
    value: null,
    label: 'Top performing format',
    confidence: 'low',
    explanation: 'No winning format yet. Publish outputs or record feedback to build this signal.',
  },
  brandVoiceConfidence: {
    value: 0,
    previousValue: null,
    trend: 'flat',
    explanation: 'Confidence increases as you add brand context, generate content, publish outputs, and give feedback.',
  },
  recentSignals: [],
};

function normaliseLearningSignals(signals) {
  return {
    patternsLearned: { ...EMPTY_LEARNING_SIGNALS.patternsLearned, ...(signals?.patternsLearned ?? {}) },
    workflowsReusedThisWeek: { ...EMPTY_LEARNING_SIGNALS.workflowsReusedThisWeek, ...(signals?.workflowsReusedThisWeek ?? {}) },
    topPerformingContentFormat: { ...EMPTY_LEARNING_SIGNALS.topPerformingContentFormat, ...(signals?.topPerformingContentFormat ?? {}) },
    brandVoiceConfidence: { ...EMPTY_LEARNING_SIGNALS.brandVoiceConfidence, ...(signals?.brandVoiceConfidence ?? {}) },
    recentSignals: Array.isArray(signals?.recentSignals) ? signals.recentSignals : [],
  };
}

export function isLearningSignalsEmpty(signals) {
  const safe = normaliseLearningSignals(signals);
  return Number(safe.patternsLearned.value ?? 0) === 0
    && Number(safe.workflowsReusedThisWeek.value ?? 0) === 0
    && !safe.topPerformingContentFormat.value
    && Number(safe.brandVoiceConfidence.value ?? 0) === 0
    && safe.recentSignals.length === 0;
}

function TrendPill({ trend, confidence }) {
  const safeTrend = ['up', 'flat', 'down'].includes(trend) ? trend : 'flat';
  const label = confidence
    ? `${confidence} confidence`
    : safeTrend === 'up'
      ? 'Growing'
      : safeTrend === 'down'
        ? 'Cooling'
        : 'Stable';
  return <span className={`pm-learning__pill pm-learning__pill--${safeTrend}`}>{label}</span>;
}

function LearningMetricCard({ metric, value, suffix = '', isFormat = false }) {
  const displayValue = isFormat && !value ? 'Not enough data' : `${value ?? 0}${suffix}`;
  return (
    <article className="pm-learning__metric">
      <div className="pm-learning__metric-top">
        <span>{metric.label}</span>
        <TrendPill trend={metric.trend} confidence={metric.confidence} />
      </div>
      <strong className={isFormat && !value ? 'is-muted' : undefined}>{displayValue}</strong>
      <p>{metric.explanation}</p>
    </article>
  );
}

function signalTypeLabel(type) {
  if (type === 'brand_voice') return 'Brand voice';
  if (type === 'workflow') return 'Workflow';
  if (type === 'feedback') return 'Feedback';
  if (type === 'delivery') return 'Delivery';
  return 'Content';
}

export function LearningSignalsSection({ signals, isLoading = false }) {
  const safe = normaliseLearningSignals(signals);
  const empty = !isLoading && isLearningSignalsEmpty(safe);
  const recentSignals = safe.recentSignals.slice(0, 5);

  return (
    <section className="pm-learning pm-learning--compact" aria-labelledby="learning-signals-title">
      <details className="pm-learning__details">
        <summary className="pm-learning__summary">
          <span className="pm-dash__section-label">Learning signals</span>
          <span className="pm-learning__summary-hint">Optional detail</span>
        </summary>
        <div className="pm-learning__body">
          {empty ? (
            <p className="pm-learning__compact-empty">
              Run workflows or give feedback to help Prymal learn what works for your business.
            </p>
          ) : (
            <>
              <div className="pm-learning__grid" aria-busy={isLoading ? 'true' : 'false'}>
                <LearningMetricCard metric={safe.patternsLearned} value={safe.patternsLearned.value} />
                <LearningMetricCard metric={safe.workflowsReusedThisWeek} value={safe.workflowsReusedThisWeek.value} />
                <LearningMetricCard
                  metric={safe.topPerformingContentFormat}
                  value={safe.topPerformingContentFormat.value}
                  isFormat
                />
                <LearningMetricCard
                  metric={safe.brandVoiceConfidence}
                  value={safe.brandVoiceConfidence.value}
                  suffix="%"
                />
              </div>
              {recentSignals.length > 0 ? (
                <ul className="pm-learning__compact-list">
                  {recentSignals.map((signal) => (
                    <li key={signal.id}>
                      <strong>{signal.title}</strong>
                      <span>{timeAgo(signal.createdAt)}</span>
                    </li>
                  ))}
                </ul>
              ) : null}
            </>
          )}
          <Link to="/app/workflows" className="pm-learning__action">Start a workflow</Link>
        </div>
      </details>
    </section>
  );
}
