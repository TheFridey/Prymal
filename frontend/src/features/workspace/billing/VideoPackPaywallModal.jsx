import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { getErrorMessage } from '../../../lib/utils';
import { useAppStore } from '../../../stores/useAppStore';
import { Button } from '../../../components/ui';

/**
 * Premium lane paywall — video credits exhausted; encourage Video Pack checkout (no silent degradation).
 */
export function VideoPackPaywallModal({ open, onClose }) {
  const notify = useAppStore((s) => s.addNotification);

  const billingQuery = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats'),
    enabled: open,
    staleTime: 15_000,
  });

  const creditPackCheckoutMutation = useMutation({
    mutationFn: (payload) => api.post('/billing/packs/checkout', payload),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Checkout failed', message: getErrorMessage(error) });
    },
  });

  const videoCredits = billingQuery.data?.videoCredits ?? billingQuery.data?.credits?.video ?? null;
  const monetisation = billingQuery.data?.monetisation;
  const packSuggested = monetisation?.upgradeSuggestions?.video?.addOnSuggested;
  const packFallback = { creditType: 'video', packId: 'video_30', label: 'Video Pack — refill AI renders' };

  const packTarget = packSuggested?.packId ? packSuggested : packFallback;

  if (!open) return null;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="video-pack-paywall-title"
      style={{
        position: 'fixed',
        inset: 0,
        background: 'rgba(4, 8, 20, 0.68)',
        display: 'grid',
        placeItems: 'center',
        zIndex: 160,
        padding: '22px',
      }}
    >
      <div
        style={{
          width: 'min(520px, 100%)',
          borderRadius: '24px',
          border: '1px solid var(--line)',
          background: 'var(--panel)',
          padding: '24px',
          boxShadow: '0 24px 88px rgba(0, 0, 0, 0.42)',
        }}
      >
        <div
          id="video-pack-paywall-title"
          style={{ fontSize: '24px', marginBottom: '8px', letterSpacing: '-0.02em' }}
        >
          Video generation requires a Video Pack
        </div>
        <p style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '12px' }}>
          AI video is a premium render lane. Prymal does not downgrade quality silently — add a Video Pack to keep shipping
          cinematic output, or upgrade for a higher monthly video allowance from Settings.
        </p>
        <div
          style={{
            borderRadius: '16px',
            border: '1px solid var(--line)',
            padding: '12px 14px',
            marginBottom: '14px',
            fontSize: '13px',
            color: 'var(--text-strong)',
            background: 'var(--panel-soft)',
          }}
        >
          Remaining AI video credits:{' '}
          <strong>{videoCredits?.available != null ? videoCredits.available : '…'}</strong>
          {' '}
          (reserved {videoCredits?.reserved ?? 0})
        </div>
        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
          <Button
            tone="accent"
            onClick={() => creditPackCheckoutMutation.mutate({ creditType: packTarget.creditType, packId: packTarget.packId })}
            disabled={creditPackCheckoutMutation.isPending}
          >
            {packSuggested?.label ?? 'Buy Video Pack'}
          </Button>
          <Link to="/app/settings?tab=Billing" className="button button--ghost" onClick={onClose}>
            Plans & packs
          </Link>
          <Button tone="ghost" onClick={onClose}>
            Close
          </Button>
        </div>
      </div>
    </div>
  );
}
