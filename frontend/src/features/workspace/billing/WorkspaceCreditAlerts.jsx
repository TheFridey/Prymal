import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { getNextPlanId, PLAN_LIBRARY } from '../../../lib/constants';
import { getErrorMessage } from '../../../lib/utils';
import { useAppStore } from '../../../stores/useAppStore';
import { Button } from '../../../components/ui';

/**
 * Workspace-wide credit warnings (80% banner) and low-credit modal (90%) with upgrade-first CTAs.
 */
export function WorkspaceCreditAlerts({ viewer }) {
  const notify = useAppStore((s) => s.addNotification);
  const billingQuery = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats'),
    enabled: Boolean(viewer?.organisation?.id),
    staleTime: 20_000,
  });

  const checkoutMutation = useMutation({
    mutationFn: (payload) => api.post('/billing/checkout', payload),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Checkout failed', message: getErrorMessage(error) });
    },
  });

  const creditPackCheckoutMutation = useMutation({
    mutationFn: (payload) => api.post('/billing/packs/checkout', payload),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Top-up failed', message: getErrorMessage(error) });
    },
  });

  const currentPlan = billingQuery.data?.plan ?? viewer?.organisation?.plan ?? 'free';
  const canManage = Boolean(billingQuery.data?.canManageBilling);
  const executionCredits = billingQuery.data?.executionCredits ?? billingQuery.data?.credits?.execution ?? null;
  const videoCredits = billingQuery.data?.videoCredits ?? billingQuery.data?.credits?.video ?? null;
  const executionPercent = executionCredits?.percentUsed ?? 0;
  const videoPercent = videoCredits?.percentUsed ?? 0;

  const showBanner =
    executionCredits?.threshold?.surface === 'banner' || videoCredits?.threshold?.surface === 'banner';

  const criticalTarget = useMemo(() => {
    if (executionCredits?.threshold?.surface === 'modal' && videoCredits?.threshold?.surface === 'modal') {
      return 'both';
    }
    if (executionCredits?.threshold?.surface === 'modal') return 'execution';
    if (videoCredits?.threshold?.surface === 'modal') return 'video';
    return null;
  }, [executionCredits?.threshold?.surface, videoCredits?.threshold?.surface]);

  const nextPlanId = getNextPlanId(currentPlan);
  const nextPlanName = nextPlanId ? PLAN_LIBRARY.find((p) => p.id === nextPlanId)?.name ?? nextPlanId : null;
  const canUpgradePlan = Boolean(nextPlanId && canManage);

  const packTopUp =
    criticalTarget === 'video' || (criticalTarget === 'both' && videoPercent >= executionPercent)
      ? { creditType: 'video', packId: 'video_30' }
      : { creditType: 'execution', packId: 'exec_300' };

  const thresholdCycleKey = `${billingQuery.data?.resetsAt ?? 'pending'}:${criticalTarget ?? 'none'}:global`;
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    if (!criticalTarget) {
      setDismissedKey('');
    }
  }, [criticalTarget]);

  const showModal = Boolean(criticalTarget) && dismissedKey !== thresholdCycleKey;

  const modalTitle =
    criticalTarget === 'both'
      ? 'You are running low on credits'
      : criticalTarget === 'video'
        ? 'AI video credits are running low'
        : 'Execution credits are running low';

  const modalBody =
    criticalTarget === 'both'
      ? 'Upgrade for more included credits each month, or add a one-off pack if you only need a short boost.'
      : criticalTarget === 'video'
        ? 'Upgrade for a higher monthly AI video allowance, or add a video pack as a backup.'
        : 'Upgrade for more monthly execution credits, or add a pack if you need capacity before your cycle resets.';

  if (!viewer?.organisation?.id || billingQuery.isLoading) {
    return null;
  }

  return (
    <>
      {showBanner ? (
        <div
          className="workspace-credit-banner"
          style={{
            margin: '0 0 0',
            padding: '10px 16px',
            background: 'rgba(245, 158, 11, 0.12)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.35)',
            color: 'var(--text-strong)',
            fontSize: '13px',
            lineHeight: 1.5,
            display: 'flex',
            flexWrap: 'wrap',
            gap: '10px',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}
        >
          <span>
            You are approaching your included credit limit.{' '}
            {canManage ? 'Upgrade for more headroom, or add a pack if you only need a small top-up.' : 'Ask a workspace admin to adjust the plan or add credits.'}
          </span>
          {canManage ? (
            <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {nextPlanId ? (
                <Button
                  tone="accent"
                  onClick={() => checkoutMutation.mutate({ plan: nextPlanId, interval: 'monthly' })}
                  disabled={checkoutMutation.isPending}
                >
                  {`Upgrade to ${nextPlanName}`}
                </Button>
              ) : null}
              <Link to="/app/settings?tab=Billing" className="button button--ghost">
                Usage details
              </Link>
            </span>
          ) : (
            <Link to="/app/settings?tab=Billing" className="button button--ghost">
              View usage
            </Link>
          )}
        </div>
      ) : null}

      {showModal ? (
        <div
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(4, 8, 20, 0.62)',
            display: 'grid',
            placeItems: 'center',
            zIndex: 100,
            padding: '20px',
          }}
        >
          <div
            style={{
              width: 'min(520px, 100%)',
              borderRadius: '24px',
              border: '1px solid var(--line)',
              background: 'var(--panel)',
              padding: '22px',
              boxShadow: '0 24px 80px rgba(0, 0, 0, 0.35)',
            }}
          >
            <div style={{ fontSize: '22px', marginBottom: '8px' }}>{modalTitle}</div>
            <div style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '16px' }}>{modalBody}</div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {canUpgradePlan && nextPlanId ? (
                <Button
                  tone="accent"
                  onClick={() => {
                    checkoutMutation.mutate({ plan: nextPlanId, interval: 'monthly' });
                    setDismissedKey(thresholdCycleKey);
                  }}
                  disabled={creditPackCheckoutMutation.isPending || checkoutMutation.isPending}
                >
                  {`Upgrade to ${nextPlanName}`}
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  tone={canUpgradePlan && nextPlanId ? 'ghost' : 'accent'}
                  onClick={() => {
                    creditPackCheckoutMutation.mutate(packTopUp);
                    setDismissedKey(thresholdCycleKey);
                  }}
                  disabled={creditPackCheckoutMutation.isPending || checkoutMutation.isPending}
                >
                  Buy credits
                </Button>
              ) : null}
              <Button tone="ghost" onClick={() => setDismissedKey(thresholdCycleKey)}>
                Dismiss
              </Button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}
