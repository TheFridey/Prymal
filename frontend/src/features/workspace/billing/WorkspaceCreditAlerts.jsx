import { useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../../../lib/api';
import { getNextPlanId, PLAN_LIBRARY } from '../../../lib/constants';
import { getErrorMessage } from '../../../lib/utils';
import { useAppStore } from '../../../stores/useAppStore';
import { Button } from '../../../components/ui';

/**
 * Workspace usage pressure: 70% soft notice, 85% upsell-forward, 95% modal forcing pack/upgrade.
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
  const monetisation = billingQuery.data?.monetisation ?? null;
  const suggestion = monetisation?.upgradeSuggestions?.balanced ?? null;
  const packHint = suggestion?.addOnSuggested;
  const directedPlan = suggestion?.planUpgradeSuggested ?? getNextPlanId(currentPlan);
  const directedPlanLabel = directedPlan ? PLAN_LIBRARY.find((p) => p.id === directedPlan)?.name ?? directedPlan : null;

  const surfaces = [executionCredits?.threshold?.surface, videoCredits?.threshold?.surface];

  const bannerSoft = surfaces.some((s) => s === 'soft_banner');
  const bannerStrong = surfaces.some((s) => s === 'strong_banner');
  const legacyBanner = surfaces.some((s) => s === 'banner');

  const criticalTarget = useMemo(() => {
    if (executionCredits?.threshold?.surface === 'modal' && videoCredits?.threshold?.surface === 'modal') {
      return 'both';
    }
    if (executionCredits?.threshold?.surface === 'modal') return 'execution';
    if (videoCredits?.threshold?.surface === 'modal') return 'video';
    return null;
  }, [executionCredits?.threshold?.surface, videoCredits?.threshold?.surface]);

  const packTopUp =
    packHint?.packId && packHint?.creditType
      ? { creditType: packHint.creditType, packId: packHint.packId }
      : criticalTarget === 'video' || (criticalTarget === 'both' && videoPercent >= executionPercent)
        ? { creditType: 'video', packId: 'video_pack_small' }
        : { creditType: 'execution', packId: 'exec_boost_1000' };

  const thresholdCycleKey = `${billingQuery.data?.resetsAt ?? 'pending'}:${criticalTarget ?? 'none'}:${monetisation?.pressureLevel ?? 'none'}`;
  const [dismissedKey, setDismissedKey] = useState('');

  useEffect(() => {
    if (!criticalTarget) {
      setDismissedKey('');
    }
  }, [criticalTarget]);

  const showModal = Boolean(criticalTarget) && dismissedKey !== thresholdCycleKey;

  const showTipBand = (bannerSoft || legacyBanner) && !bannerStrong && !criticalTarget;
  const showUpgradeBand = bannerStrong && !criticalTarget;

  const modalTitle =
    monetisation?.heavyUserMessaging?.headline && monetisation?.heavyUser
      ? 'High-throughput workspace detected'
      : criticalTarget === 'both'
        ? 'You’re nearing exhausting limits across execution and AI video.'
        : criticalTarget === 'video'
          ? 'AI video renders need more capacity.'
          : 'Execution capacity runs tight';

  const modalBody =
    criticalTarget === 'both'
      ? 'Pick the next plan up for included monthly capacity, or add a pack for a short burst before your reset.'
      : criticalTarget === 'video'
        ? 'Video generation is a premium lane — add a Video Pack or move to a plan with more included AI video credits.'
        : 'Unlock more execution capacity with the next plan tier or bolt on a pack for immediate relief.';

  if (!viewer?.organisation?.id || billingQuery.isLoading) {
    return null;
  }

  return (
    <>
      {showTipBand ? (
        <div
          className="workspace-credit-banner"
          style={{
            margin: '0 0 0',
            padding: '10px 16px',
            background: 'rgba(59, 130, 246, 0.08)',
            borderBottom: '1px solid rgba(59, 130, 246, 0.25)',
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
            {monetisation?.heavyUserMessaging?.headline
              ? `${monetisation.heavyUserMessaging.headline} `
              : 'You’re nearing your plan limits. '}
            {canManage ? 'Keep shipping by watching usage and lining up the next step before you hit the wall.' : 'Ask an admin to review usage and add capacity.'}
          </span>
          <Link to="/app/settings?tab=Billing" className="button button--ghost">
            Usage details
          </Link>
        </div>
      ) : null}

      {showUpgradeBand ? (
        <div
          className="workspace-credit-banner"
          style={{
            margin: '0 0 0',
            padding: '10px 16px',
            background: 'rgba(245, 158, 11, 0.15)',
            borderBottom: '1px solid rgba(245, 158, 11, 0.4)',
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
            <strong>Unlock more execution capacity:</strong>{' '}
            {suggestion?.headline
              ?? 'Upgrade tiers include higher concurrency plus workflow scale — packs cover spikes without changing plans indefinitely.'}{' '}
            {canManage ? 'Buy a usage pack instantly or step up plans when growth sticks.' : null}
          </span>
          {canManage ? (
            <span style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {directedPlan ? (
                <Button
                  tone="accent"
                  onClick={() => checkoutMutation.mutate({ plan: directedPlan, interval: 'monthly' })}
                  disabled={checkoutMutation.isPending}
                >
                  {directedPlanLabel ? `Upgrade to ${directedPlanLabel}` : `Upgrade plan`}
                </Button>
              ) : null}
              {packHint ? (
                <Button
                  tone="ghost"
                  onClick={() => creditPackCheckoutMutation.mutate({ creditType: packHint.creditType, packId: packHint.packId })}
                  disabled={creditPackCheckoutMutation.isPending}
                >
                  {packHint.label ?? 'Add credits'}
                </Button>
              ) : (
                <Button
                  tone="ghost"
                  onClick={() => creditPackCheckoutMutation.mutate(packTopUp)}
                  disabled={creditPackCheckoutMutation.isPending}
                >
                  Add pack
                </Button>
              )}
              <Link to="/app/settings?tab=Billing" className="button button--ghost">
                Billing
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
            <div style={{ color: 'var(--muted)', lineHeight: 1.7, marginBottom: '12px' }}>{modalBody}</div>
            {monetisation?.heavyUserMessaging?.subline ? (
              <div style={{ color: 'var(--text-strong)', fontSize: '13px', marginBottom: '12px' }}>
                {monetisation.heavyUserMessaging.subline}
              </div>
            ) : null}
            <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '16px' }}>
              Execution {executionPercent.toFixed(0)}% · Video {videoPercent.toFixed(0)}%
            </div>
            <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', flexWrap: 'wrap' }}>
              {directedPlan && canManage ? (
                <Button
                  tone="accent"
                  onClick={() => {
                    checkoutMutation.mutate({ plan: directedPlan, interval: 'monthly' });
                    setDismissedKey(thresholdCycleKey);
                  }}
                  disabled={creditPackCheckoutMutation.isPending || checkoutMutation.isPending}
                >
                  {directedPlanLabel ? `Upgrade to ${directedPlanLabel}` : 'Upgrade plan'}
                </Button>
              ) : null}
              {canManage ? (
                <Button
                  tone={directedPlan ? 'ghost' : 'accent'}
                  onClick={() => {
                    creditPackCheckoutMutation.mutate(packTopUp);
                    setDismissedKey(thresholdCycleKey);
                  }}
                  disabled={creditPackCheckoutMutation.isPending || checkoutMutation.isPending}
                >
                  {packHint?.label ?? 'Buy usage pack'}
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
