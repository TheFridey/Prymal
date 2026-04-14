import { Component } from 'react';

/**
 * Reusable React error boundary. Catches render-phase errors from any child
 * subtree and renders a fallback instead of crashing the whole app.
 *
 * Usage:
 *   <ErrorBoundary>
 *     <SomePage />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary fallback={<div>Custom fallback</div>}>
 *     <SomeWidget />
 *   </ErrorBoundary>
 *
 *   <ErrorBoundary label="Admin console" onError={reportToSentry}>
 *     <AdminPanel />
 *   </ErrorBoundary>
 */
export class ErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false, error: null };
    this.handleReset = this.handleReset.bind(this);
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error };
  }

  componentDidCatch(error, info) {
    const { onError } = this.props;
    if (typeof onError === 'function') {
      try {
        onError(error, info);
      } catch {
        // Never let the error reporter itself crash.
      }
    }
    // Log to console in development so stack traces remain accessible.
    if (import.meta.env.DEV) {
      console.error('[ErrorBoundary]', error, info.componentStack);
    }
  }

  handleReset() {
    this.setState({ hasError: false, error: null });
  }

  render() {
    const { hasError, error } = this.state;
    const { children, fallback, label } = this.props;

    if (!hasError) return children;

    if (fallback !== undefined) return fallback;

    const areaLabel = label ?? 'This section';
    const message = error?.message ?? 'An unexpected error occurred.';

    return (
      <div
        style={{
          padding: '24px',
          borderRadius: '16px',
          border: '1px solid var(--line)',
          background: 'var(--panel-soft)',
          display: 'grid',
          gap: '12px',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="#EF4444" strokeWidth="2" style={{ flexShrink: 0 }}>
            <circle cx="12" cy="12" r="10" />
            <line x1="12" y1="8" x2="12" y2="12" />
            <line x1="12" y1="16" x2="12.01" y2="16" />
          </svg>
          <strong style={{ color: 'var(--text-strong)', fontSize: '15px' }}>
            {areaLabel} encountered an error
          </strong>
        </div>
        <p style={{ color: 'var(--muted)', fontSize: '13px', margin: 0 }}>{message}</p>
        <button
          type="button"
          onClick={this.handleReset}
          style={{
            alignSelf: 'flex-start',
            padding: '6px 14px',
            borderRadius: '8px',
            border: '1px solid var(--line)',
            background: 'var(--panel)',
            color: 'var(--text-strong)',
            cursor: 'pointer',
            fontSize: '13px',
          }}
        >
          Try again
        </button>
      </div>
    );
  }
}
