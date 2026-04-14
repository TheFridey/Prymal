import { useState } from 'react';
import { formatDate } from '../../../lib/utils';
import { Button, SurfaceCard } from '../../../components/ui';

const chipStyle = {
  padding: '4px 8px',
  borderRadius: '999px',
  border: '1px solid var(--line)',
  color: 'var(--muted)',
  fontSize: '11px',
};

const rowStyle = {
  padding: '14px',
  borderRadius: '14px',
  border: '1px solid var(--line)',
  background: 'var(--panel-soft)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '10px',
  flexWrap: 'wrap',
  alignItems: 'center',
};

export function ReferralsTab({ query }) {
  const referralUrl = query.data?.referralUrl ?? null;
  const history = query.data?.history ?? [];
  const [copied, setCopied] = useState(false);

  function copyLink() {
    if (!referralUrl) return;
    navigator.clipboard.writeText(referralUrl).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Your referral link" accent="#00FFD1">
        <p style={{ margin: '0 0 16px', color: 'var(--muted)', lineHeight: 1.7 }}>
          Share your unique link. Every workspace that signs up via your link earns both of you bonus credits.
        </p>
        {query.isLoading ? (
          <div style={{ color: 'var(--muted)', padding: '8px 0' }}>Loading referral link...</div>
        ) : referralUrl ? (
          <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap' }}>
            <code
              style={{
                flex: 1,
                padding: '12px 16px',
                borderRadius: '14px',
                border: '1px solid var(--line)',
                background: 'var(--panel-soft)',
                fontSize: '13px',
                color: 'var(--accent)',
                wordBreak: 'break-all',
              }}
            >
              {referralUrl}
            </code>
            <Button tone="accent" onClick={copyLink}>
              {copied ? 'Copied!' : 'Copy link'}
            </Button>
          </div>
        ) : (
          <div style={{ color: 'var(--muted)' }}>No referral link available.</div>
        )}
      </SurfaceCard>

      <SurfaceCard title="Referral history" accent="#00FFD1">
        {query.isLoading ? (
          <div style={{ color: 'var(--muted)', padding: '8px 0' }}>Loading history...</div>
        ) : history.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '8px 0' }}>No referrals yet. Share your link to get started.</div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {history.map((entry) => (
              <div key={entry.id} style={rowStyle}>
                <div>
                  <div style={{ fontWeight: 600, color: 'var(--text-strong)' }}>{entry.refereeEmail}</div>
                  <div style={{ color: 'var(--muted)', fontSize: '0.8rem', marginTop: '2px' }}>
                    Joined {formatDate(entry.createdAt)}
                  </div>
                </div>
                {entry.bonusCreditsAwarded > 0 ? (
                  <span style={{ ...chipStyle, color: 'var(--accent)', borderColor: 'var(--accent)' }}>
                    +{entry.bonusCreditsAwarded} credits
                  </span>
                ) : null}
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

export function SeatMetric({ label, value }) {
  return (
    <div
      style={{
        minWidth: '140px',
        padding: '14px 16px',
        borderRadius: '18px',
        border: '1px solid var(--line)',
        background: 'var(--panel-soft)',
      }}
    >
      <div style={{ color: 'var(--muted-2)', textTransform: 'uppercase', fontSize: '11px', letterSpacing: '0.16em', marginBottom: '6px' }}>
        {label}
      </div>
      <div style={{ fontSize: '22px' }}>{value}</div>
    </div>
  );
}
