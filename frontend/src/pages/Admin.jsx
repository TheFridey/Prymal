import { startTransition, useDeferredValue, useEffect, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Navigate, useOutletContext } from 'react-router-dom';
import { api, createIdempotentRequestInit } from '../lib/api';
import { formatDate, formatDateTime, formatNumber, getErrorMessage, truncate } from '../lib/utils';
import {
  Button,
  InlineNotice,
  LoadingPanel,
  PageShell,
} from '../components/ui';
import { useAppStore } from '../stores/useAppStore';
import {
  EMPTY_DASHBOARD,
  PLAN_OPTIONS,
  ROLE_OPTIONS,
  TABS,
} from '../features/admin/constants';
import {
  flattenMeta,
  formatCurrency,
  getOrganisationAttentionScore,
  getPercent,
  getPlanTone,
  getRoleTone,
  humanize,
  matchesSearch,
} from '../features/admin/utils';
import { ModelUsageTab, ModelPolicyTab, ScorecardsTab } from '../features/admin/tabs/control-plane';
import { ErrorBoundary } from '../components/ErrorBoundary';
import { MotionPresence, motion } from '../components/motion';
import { AdminCommandBar } from '../features/admin/dashboard/AdminCommandBar';
import { AdminHero } from '../features/admin/dashboard/AdminHero';
import {
  ActionReceiptDrawer,
  EvalSummariesTab,
  TraceCenterTab,
  TraceDetailDrawer,
  WorkflowOpsTab,
  WorkflowRunDrawer,
} from '../features/admin/tabs/runtime-ops';
import { OverviewTab, OrganisationInspector, UserInspector } from '../features/admin/tabs/overview';
import { BillingTab, RevenueTab, ReferralsTab } from '../features/admin/tabs/billing';
import { ActivityTab, AuditLogsTab, CreditUsageTab, ProductEventsTab } from '../features/admin/tabs/activity';
import { EmailQueueTab, WaitlistTab, PowerUpsTab } from '../features/admin/tabs/support';
import { GrowthTab } from '../features/admin/tabs/growth';
import { AdminCommandPalette } from '../features/admin/AdminCommandPalette';

export default function Admin() {
  const { viewer } = useOutletContext();
  const isStaff = Boolean(viewer?.staff?.isStaff);
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState('overview');
  const [commandQuery, setCommandQuery] = useState('');
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [planFilter, setPlanFilter] = useState('all');
  const [roleFilter, setRoleFilter] = useState('all');
  const [runFilter, setRunFilter] = useState('all');
  const [activityFilter, setActivityFilter] = useState('all');
  const [selectedOrgId, setSelectedOrgId] = useState(null);
  const [selectedUserId, setSelectedUserId] = useState(null);
  const [selectedTimelineOrgId, setSelectedTimelineOrgId] = useState(null);
  const [selectedTraceId, setSelectedTraceId] = useState(null);
  const [selectedWorkflowRunId, setSelectedWorkflowRunId] = useState(null);
  const [selectedReceiptId, setSelectedReceiptId] = useState(null);
  const [traceDays, setTraceDays] = useState('30');
  const [traceOutcomeStatus, setTraceOutcomeStatus] = useState('all');
  const [traceAgentFilter, setTraceAgentFilter] = useState('all');
  const [traceOrgFilter, setTraceOrgFilter] = useState('all');
  const [traceFailureFilter, setTraceFailureFilter] = useState('');
  const [workflowDays, setWorkflowDays] = useState('30');
  const [workflowFailureClass, setWorkflowFailureClass] = useState('');
  const [evalDays, setEvalDays] = useState('30');
  const [modelCompDays, setModelCompDays] = useState('30');
  const [modelCompPolicy, setModelCompPolicy] = useState('all');
  const deferredQuery = useDeferredValue(commandQuery);

  const overviewQuery = useQuery({
    queryKey: ['staff-admin-overview'],
    queryFn: () => api.get('/admin/overview'),
    enabled: isStaff,
    refetchInterval: 15_000,
  });

  const [waitlistSearch, setWaitlistSearch] = useState('');
  const deferredWaitlistSearch = useDeferredValue(waitlistSearch);

  const waitlistQuery = useQuery({
    queryKey: ['staff-admin-waitlist'],
    queryFn: () => api.get('/admin/waitlist?limit=1000'),
    enabled: isStaff && activeTab === 'waitlist',
  });

  const revenueQuery = useQuery({
    queryKey: ['staff-admin-revenue'],
    queryFn: () => api.get('/admin/revenue'),
    enabled: isStaff && activeTab === 'revenue',
    refetchInterval: activeTab === 'revenue' ? 60_000 : false,
  });

  const [referralDays, setReferralDays] = useState(30);
  const referralsQuery = useQuery({
    queryKey: ['staff-admin-referrals', referralDays],
    queryFn: () => api.get(`/admin/referrals?days=${referralDays}`),
    enabled: isStaff && activeTab === 'referrals',
  });

  const [emailQueueStatus, setEmailQueueStatus] = useState('pending');
  const emailQueueQuery = useQuery({
    queryKey: ['staff-admin-email-queue', emailQueueStatus],
    queryFn: () => api.get(`/admin/email-queue?status=${emailQueueStatus}&limit=100`),
    enabled: isStaff && activeTab === 'email-queue',
  });

  const powerupsAdminQuery = useQuery({
    queryKey: ['staff-admin-powerups'],
    queryFn: () => api.get('/admin/powerups'),
    enabled: isStaff && activeTab === 'powerups',
  });

  const growthQuery = useQuery({
    queryKey: ['staff-admin-growth'],
    queryFn: () => api.get('/admin/growth'),
    enabled: isStaff && activeTab === 'growth',
    refetchInterval: activeTab === 'growth' ? 60_000 : false,
  });

  const auditLogsQuery = useQuery({
    queryKey: ['staff-admin-audit-logs'],
    queryFn: () => api.get('/admin/audit-logs?limit=200'),
    enabled: isStaff && activeTab === 'audit-logs',
    refetchInterval: activeTab === 'audit-logs' ? 30_000 : false,
  });

  const creditUsageQuery = useQuery({
    queryKey: ['staff-admin-credit-usage'],
    queryFn: () => api.get('/admin/credit-usage'),
    enabled: isStaff && activeTab === 'credit-usage',
    refetchInterval: activeTab === 'credit-usage' ? 30_000 : false,
  });

  const productEventsQuery = useQuery({
    queryKey: ['staff-admin-product-events'],
    queryFn: () => api.get('/admin/product-events?limit=200'),
    enabled: isStaff && activeTab === 'product-events',
    refetchInterval: activeTab === 'product-events' ? 30_000 : false,
  });

  const modelUsageQuery = useQuery({
    queryKey: ['staff-admin-model-usage', modelCompDays, modelCompPolicy],
    queryFn: () => {
      const params = new URLSearchParams({ days: modelCompDays, limit: '1000' });
      if (modelCompPolicy !== 'all') params.set('policyKey', modelCompPolicy);
      return api.get(`/admin/model-usage?${params.toString()}`);
    },
    enabled: isStaff && activeTab === 'model-usage',
    refetchInterval: activeTab === 'model-usage' ? 30_000 : false,
  });

  const scorecardsQuery = useQuery({
    queryKey: ['staff-admin-scorecards'],
    queryFn: () => api.get('/admin/agent-scorecards?days=30&limit=2000'),
    enabled: isStaff && activeTab === 'scorecards',
    refetchInterval: activeTab === 'scorecards' ? 30_000 : false,
  });

  const modelPolicyQuery = useQuery({
    queryKey: ['staff-admin-model-policy'],
    queryFn: () => api.get('/admin/model-policy'),
    enabled: isStaff && activeTab === 'model-policy',
  });

  const tracesQueryString = useMemo(() => {
    const params = new URLSearchParams({
      days: traceDays,
      limit: '120',
    });

    if (traceOutcomeStatus !== 'all') params.set('outcomeStatus', traceOutcomeStatus);
    if (traceAgentFilter !== 'all') params.set('agentId', traceAgentFilter);
    if (traceOrgFilter !== 'all') params.set('orgId', traceOrgFilter);
    if (traceFailureFilter.trim()) params.set('failureClass', traceFailureFilter.trim());

    return params.toString();
  }, [traceAgentFilter, traceDays, traceFailureFilter, traceOrgFilter, traceOutcomeStatus]);

  const tracesQuery = useQuery({
    queryKey: ['staff-admin-traces', tracesQueryString],
    queryFn: () => api.get(`/admin/traces?${tracesQueryString}`),
    enabled: isStaff && (activeTab === 'traces' || activeTab === 'evals'),
    refetchInterval: activeTab === 'traces' ? 30_000 : false,
  });

  const evalSummaryQuery = useQuery({
    queryKey: ['staff-admin-eval-summaries', evalDays, traceAgentFilter, traceOrgFilter],
    queryFn: () => {
      const params = new URLSearchParams({
        days: evalDays,
        limit: '400',
      });
      if (traceAgentFilter !== 'all') params.set('agentId', traceAgentFilter);
      if (traceOrgFilter !== 'all') params.set('orgId', traceOrgFilter);
      return api.get(`/admin/eval-summaries?${params.toString()}`);
    },
    enabled: isStaff && activeTab === 'evals',
    refetchInterval: activeTab === 'evals' ? 30_000 : false,
  });

  const failedWorkflowRunsQuery = useQuery({
    queryKey: ['staff-admin-failed-workflow-runs', workflowDays, workflowFailureClass],
    queryFn: () => {
      const params = new URLSearchParams({
        days: workflowDays,
        limit: '80',
      });
      if (workflowFailureClass.trim()) params.set('failureClass', workflowFailureClass.trim());
      return api.get(`/admin/failed-workflow-runs?${params.toString()}`);
    },
    enabled: isStaff && activeTab === 'workflow-ops',
    refetchInterval: activeTab === 'workflow-ops' ? 30_000 : false,
  });

  const orgTimelineQuery = useQuery({
    queryKey: ['staff-admin-org-timeline', selectedTimelineOrgId, workflowDays],
    queryFn: () => api.get(`/admin/organisations/${selectedTimelineOrgId}/timeline?days=${workflowDays}&limit=40`),
    enabled: isStaff && activeTab === 'workflow-ops' && Boolean(selectedTimelineOrgId),
  });

  const webhookDeliveryHealthQuery = useQuery({
    queryKey: ['staff-admin-webhook-delivery-health'],
    queryFn: () => api.get('/admin/webhook-delivery-health'),
    enabled: isStaff && activeTab === 'workflow-ops',
    refetchInterval: activeTab === 'workflow-ops' ? 30_000 : false,
  });

  const traceDetailQuery = useQuery({
    queryKey: ['staff-admin-trace-detail', selectedTraceId],
    queryFn: () => api.get(`/admin/traces/${selectedTraceId}`),
    enabled: isStaff && Boolean(selectedTraceId),
  });

  const workflowRunDetailQuery = useQuery({
    queryKey: ['staff-admin-workflow-run-detail', selectedWorkflowRunId],
    queryFn: () => api.get(`/admin/workflow-runs/${selectedWorkflowRunId}`),
    enabled: isStaff && Boolean(selectedWorkflowRunId),
  });

  const actionReceiptQuery = useQuery({
    queryKey: ['staff-admin-action-receipt', selectedReceiptId],
    queryFn: () => api.get(`/admin/admin-action-logs/${selectedReceiptId}`),
    enabled: isStaff && Boolean(selectedReceiptId),
  });

  const updateOrganisationMutation = useMutation({
    mutationFn: ({ organisationId, payload }) =>
      api.patch(`/admin/organisations/${organisationId}`, payload, createIdempotentRequestInit('admin-org-update')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-admin-overview'] });
      notify({
        type: 'success',
        title: 'Organisation updated',
        message: 'Platform controls were saved successfully.',
      });
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Organisation update failed',
        message: getErrorMessage(error),
      });
    },
  });

  const updateUserMutation = useMutation({
    mutationFn: ({ userId, payload }) =>
      api.patch(`/admin/users/${userId}`, payload, createIdempotentRequestInit('admin-user-update')),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['viewer'] }),
      ]);
      notify({
        type: 'success',
        title: 'User updated',
        message: 'The user record has been updated.',
      });
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'User update failed',
        message: getErrorMessage(error),
      });
    },
  });

  const processEmailQueueMutation = useMutation({
    mutationFn: () => api.post('/admin/process-email-queue', {}, createIdempotentRequestInit('admin-email-process')),
    onSuccess: async (result) => {
      await emailQueueQuery.refetch();
      notify({ type: 'success', title: 'Email queue processed', message: `${result.sent ?? 0} sent, ${result.failed ?? 0} failed.` });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Queue processing failed', message: getErrorMessage(error) });
    },
  });

  const replayWorkflowMutation = useMutation({
    mutationFn: ({ runId, payload }) =>
      api.post(`/admin/workflow-runs/${runId}/replay`, payload, createIdempotentRequestInit('admin-workflow-replay')),
    onSuccess: async (result) => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['staff-admin-overview'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-admin-failed-workflow-runs'] }),
        queryClient.invalidateQueries({ queryKey: ['staff-admin-org-timeline'] }),
      ]);

      if (result?.runId) {
        setSelectedWorkflowRunId(result.runId);
      }
      if (result?.receipt?.id) {
        setSelectedReceiptId(result.receipt.id);
      }

      notify({
        type: 'success',
        title: 'Workflow replay queued',
        message: `Replay ${truncate(result?.runId ?? '', 12)} was dispatched in ${humanize(result?.executionMode ?? 'inline')}.`,
      });
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Workflow replay failed',
        message: getErrorMessage(error),
      });
    },
  });

  const data = overviewQuery.data ?? EMPTY_DASHBOARD;
  const searchValue = deferredQuery.trim().toLowerCase();

  const summaryCards = useMemo(() => ([
    {
      label: 'Organisations',
      value: formatNumber(data.summary.organisations),
      helper: `${formatNumber(data.summary.openInvites)} open invites in circulation`,
      accent: 'mint',
    },
    {
      label: 'Platform users',
      value: formatNumber(data.summary.users),
      helper: `${formatNumber(data.summary.activeUsers7d)} seen in the last 7 days`,
      accent: 'blue',
    },
    {
      label: 'Workflow load',
      value: formatNumber(data.summary.workflowRuns24h),
      helper: `${formatNumber(data.summary.workflows)} workflow templates live`,
      accent: 'violet',
    },
    {
      label: 'Indexed knowledge',
      value: formatNumber(data.summary.documentsIndexed),
      helper: `${formatNumber(data.pipeline.docsPending)} docs still in the queue`,
      accent: 'amber',
    },
    {
      label: 'Integrations online',
      value: formatNumber(data.summary.activeIntegrations),
      helper: `${formatNumber(data.pipeline.integrationsOffline)} need attention`,
      accent: 'cyan',
    },
    {
      label: 'Credits consumed',
      value: formatNumber(data.summary.totalCreditsUsed),
      helper: 'Across every organisation on the platform',
      accent: 'rose',
    },
  ]), [data]);

  const seatTotals = useMemo(() => {
    const totals = data.organisations.reduce((accumulator, organisation) => {
      accumulator.members += organisation.memberCount ?? 0;
      accumulator.seats += organisation.seatLimit ?? 0;
      return accumulator;
    }, { members: 0, seats: 0 });

    const percent = totals.seats > 0 ? Math.min((totals.members / totals.seats) * 100, 100) : 0;
    return { ...totals, percent };
  }, [data.organisations]);

  const indexedTotals = useMemo(() => {
    const totals = data.organisations.reduce((accumulator, organisation) => {
      accumulator.documents += organisation.documentCount ?? 0;
      accumulator.indexed += organisation.indexedDocumentCount ?? 0;
      return accumulator;
    }, { documents: 0, indexed: 0 });

    const percent = totals.documents > 0 ? Math.min((totals.indexed / totals.documents) * 100, 100) : 0;
    return { ...totals, percent };
  }, [data.organisations]);

  const billingTotals = useMemo(() => {
    const invoices = data.billing.invoices ?? [];
    const subscriptions = data.billing.subscriptions ?? [];
    const amountPaid = invoices.reduce((sum, invoice) => sum + (invoice.amountPaid ?? 0), 0);
    const amountDue = invoices.reduce((sum, invoice) => sum + (invoice.amountDue ?? 0), 0);
    const activeSubscriptions = subscriptions.filter((subscription) => ['active', 'trialing'].includes(subscription.status)).length;
    const cancelingSubscriptions = subscriptions.filter((subscription) => subscription.cancelAtPeriodEnd).length;
    return {
      amountPaid,
      amountDue,
      activeSubscriptions,
      cancelingSubscriptions,
    };
  }, [data.billing]);

  const attentionQueue = useMemo(() => {
    return [...data.organisations]
      .map((organisation) => {
        const usagePercent = getPercent(organisation.creditsUsed, organisation.monthlyCreditLimit);
        const indexingPercent = getPercent(organisation.indexedDocumentCount, organisation.documentCount);
        let severity = 0;
        const reasons = [];

        if ((organisation.integrationCount ?? 0) === 0) {
          severity += 3;
          reasons.push('No active integrations');
        }
        if ((organisation.workflowCount ?? 0) === 0) {
          severity += 2;
          reasons.push('No saved workflows');
        }
        if ((organisation.documentCount ?? 0) > 0 && (organisation.indexedDocumentCount ?? 0) === 0) {
          severity += 3;
          reasons.push('Knowledge not indexed');
        }
        if ((organisation.pendingInvites ?? 0) > 0) {
          severity += 1;
          reasons.push('Pending invites need resolution');
        }
        if (usagePercent >= 90) {
          severity += 2;
          reasons.push('Credit limit nearly exhausted');
        }
        if (indexingPercent > 0 && indexingPercent < 60) {
          severity += 1;
          reasons.push('Indexing coverage is partial');
        }

        return {
          ...organisation,
          usagePercent,
          indexingPercent,
          severity,
          reasons,
        };
      })
      .filter((organisation) => organisation.severity > 0)
      .sort((left, right) => right.severity - left.severity || right.updatedAt.localeCompare(left.updatedAt))
      .slice(0, 6);
  }, [data.organisations]);

  const topOrganisations = useMemo(() => {
    return [...data.organisations]
      .map((organisation) => ({
        ...organisation,
        signalScore:
          (organisation.memberCount ?? 0) * 1.4 +
          (organisation.workflowCount ?? 0) * 1.8 +
          (organisation.integrationCount ?? 0) * 2.4 +
          (organisation.indexedDocumentCount ?? 0),
      }))
      .sort((left, right) => right.signalScore - left.signalScore)
      .slice(0, 5);
  }, [data.organisations]);

  const filteredOrganisations = useMemo(() => {
    return data.organisations
      .filter((organisation) => planFilter === 'all' || organisation.plan === planFilter)
      .filter((organisation) => matchesSearch(searchValue, [
        organisation.name,
        organisation.slug,
        organisation.id,
        organisation.plan,
      ]))
      .sort((left, right) => {
        const leftScore = getOrganisationAttentionScore(left);
        const rightScore = getOrganisationAttentionScore(right);
        if (rightScore !== leftScore) {
          return rightScore - leftScore;
        }
        return (right.memberCount ?? 0) - (left.memberCount ?? 0);
      });
  }, [data.organisations, planFilter, searchValue]);

  const filteredUsers = useMemo(() => {
    return data.users
      .filter((user) => roleFilter === 'all' || user.role === roleFilter)
      .filter((user) => matchesSearch(searchValue, [
        user.firstName,
        user.lastName,
        user.email,
        user.orgName,
        user.id,
      ]))
      .sort((left, right) => {
        const leftSeen = left.lastSeenAt ? new Date(left.lastSeenAt).getTime() : 0;
        const rightSeen = right.lastSeenAt ? new Date(right.lastSeenAt).getTime() : 0;
        return rightSeen - leftSeen;
      });
  }, [data.users, roleFilter, searchValue]);

  const filteredRuns = useMemo(() => {
    return data.recentRuns
      .filter((run) => runFilter === 'all' || run.status === runFilter)
      .filter((run) => matchesSearch(searchValue, [
        run.workflowName,
        run.orgName,
        run.status,
        run.id,
      ]));
  }, [data.recentRuns, runFilter, searchValue]);

  const filteredActivity = useMemo(() => {
    return data.recentActivity
      .filter((entry) => activityFilter === 'all' || entry.kind === activityFilter)
      .filter((entry) => matchesSearch(searchValue, [
        entry.label,
        entry.actorUserId,
        entry.targetType,
        entry.targetId,
        flattenMeta(entry.meta),
      ]));
  }, [activityFilter, data.recentActivity, searchValue]);

  const filteredDocuments = useMemo(() => {
    return data.documentQueue.filter((document) => matchesSearch(searchValue, [
      document.title,
      document.orgName,
      document.status,
      document.sourceType,
      document.id,
    ]));
  }, [data.documentQueue, searchValue]);

  const selectedOrganisation =
    filteredOrganisations.find((organisation) => organisation.id === selectedOrgId) ??
    filteredOrganisations[0] ??
    null;

  const selectedUser =
    filteredUsers.find((user) => user.id === selectedUserId) ??
    filteredUsers[0] ??
    null;

  const syncLabel = formatDateTime(new Date().toISOString());

  useEffect(() => {
    if (selectedTimelineOrgId) {
      return;
    }

    const firstFailedOrgId = failedWorkflowRunsQuery.data?.runs?.[0]?.orgId ?? null;
    if (firstFailedOrgId) {
      setSelectedTimelineOrgId(firstFailedOrgId);
    }
  }, [failedWorkflowRunsQuery.data?.runs, selectedTimelineOrgId]);

  const selectedTimelineOrganisation = useMemo(() => {
    if (!selectedTimelineOrgId) {
      return null;
    }

    return data.organisations.find((organisation) => organisation.id === selectedTimelineOrgId) ?? null;
  }, [data.organisations, selectedTimelineOrgId]);

  useEffect(() => {
    function handleKeyDown(event) {
      if ((event.metaKey || event.ctrlKey) && event.key === 'k') {
        event.preventDefault();
        setPaletteOpen((current) => !current);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  if (!isStaff) {
    return <Navigate to="/app/dashboard" replace />;
  }

  if (overviewQuery.isLoading && !overviewQuery.data) {
    return (
      <PageShell width="1640px" flushMobile>
        <LoadingPanel label="Booting the Prymal staff command center..." />
      </PageShell>
    );
  }

  return (
    <PageShell width="1640px" flushMobile>
      <div className="staff-admin">
        <AdminHero
          data={data}
          seatTotals={seatTotals}
          indexedTotals={indexedTotals}
          billingTotals={billingTotals}
          onRefresh={() => overviewQuery.refetch()}
          onOpenBilling={() => startTransition(() => setActiveTab('billing'))}
          onOpenActivity={() => startTransition(() => setActiveTab('activity'))}
        />

        {overviewQuery.error ? (
          <InlineNotice tone="danger">
            {getErrorMessage(overviewQuery.error, 'The staff dashboard could not refresh from the backend.')}
          </InlineNotice>
        ) : null}

        <AdminCommandBar
          commandQuery={commandQuery}
          onCommandQueryChange={(value) => startTransition(() => setCommandQuery(value))}
          planFilter={planFilter}
          onPlanFilterChange={(value) => startTransition(() => setPlanFilter(value))}
          roleFilter={roleFilter}
          onRoleFilterChange={(value) => startTransition(() => setRoleFilter(value))}
          syncLabel={syncLabel}
        />

        <div className="staff-admin__tabs">
          {TABS.map((tab) => (
            <button
              key={tab.id}
              type="button"
              className={`staff-admin__tab${activeTab === tab.id ? ' is-active' : ''}`}
              onClick={() => startTransition(() => setActiveTab(tab.id))}
            >
              {tab.label}
            </button>
          ))}
        </div>

        <ErrorBoundary key={activeTab} label={`${activeTab} tab`}>
        <MotionPresence mode="wait" initial={false}>
        <motion.div
          key={activeTab}
          initial={{ opacity: 0, y: 18, scale: 0.992, filter: 'blur(8px)' }}
          animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
          exit={{ opacity: 0, y: -12, scale: 0.992, filter: 'blur(6px)' }}
          transition={{ duration: 0.28 }}
        >
        {activeTab === 'overview' ? (
          <OverviewTab
            summaryCards={summaryCards}
            data={data}
            attentionQueue={attentionQueue}
            topOrganisations={topOrganisations}
            seatTotals={seatTotals}
            indexedTotals={indexedTotals}
            billingTotals={billingTotals}
          />
        ) : null}

        {activeTab === 'organisations' ? (
          <div className="staff-admin__workspace-grid">
            <section className="staff-admin__surface staff-admin__surface--list">
              <div className="staff-admin__surface-head">
                <div>
                  <div className="staff-admin__surface-label">Organisation control</div>
                  <h2>Platform workspaces</h2>
                </div>
                <div className="staff-admin__surface-meta">
                  {formatNumber(filteredOrganisations.length)} visible
                </div>
              </div>

              <div className="staff-admin__collection">
                {filteredOrganisations.map((organisation, index) => {
                  const attention = getOrganisationAttentionScore(organisation);
                  const usagePercent = getPercent(organisation.creditsUsed, organisation.monthlyCreditLimit);
                  return (
                    <button
                      key={organisation.id}
                      type="button"
                      className={`staff-admin__entity-card${selectedOrganisation?.id === organisation.id ? ' is-active' : ''}`}
                      onClick={() => setSelectedOrgId(organisation.id)}
                      style={{ animationDelay: `${index * 60}ms` }}
                    >
                      <div className="staff-admin__entity-head">
                        <div>
                          <strong>{organisation.name}</strong>
                          <span>{organisation.slug}</span>
                        </div>
                        <span className={`staff-admin__badge staff-admin__badge--${getPlanTone(organisation.plan)}`}>
                          {humanize(organisation.plan)}
                        </span>
                      </div>
                      <div className="staff-admin__entity-grid">
                        <span>{formatNumber(organisation.memberCount)} members</span>
                        <span>{formatNumber(organisation.workflowCount)} workflows</span>
                        <span>{formatNumber(organisation.integrationCount)} integrations</span>
                        <span>{formatNumber(organisation.indexedDocumentCount)} indexed docs</span>
                      </div>
                      <div className="staff-admin__meter">
                        <span style={{ width: `${usagePercent}%` }} />
                      </div>
                      <div className="staff-admin__entity-foot">
                        <span>{attention > 0 ? `${attention} attention flags` : 'Healthy posture'}</span>
                        <span>Updated {formatDate(organisation.updatedAt)}</span>
                      </div>
                    </button>
                  );
                })}
              </div>
            </section>

            <section className="staff-admin__surface staff-admin__surface--inspector">
              <OrganisationInspector
                organisation={selectedOrganisation}
                onSave={(payload) => updateOrganisationMutation.mutate({
                  organisationId: selectedOrganisation.id,
                  payload,
                })}
                isSaving={updateOrganisationMutation.isPending}
              />
            </section>
          </div>
        ) : null}

        {activeTab === 'users' ? (
          <div className="staff-admin__workspace-grid">
            <section className="staff-admin__surface staff-admin__surface--list">
              <div className="staff-admin__surface-head">
                <div>
                  <div className="staff-admin__surface-label">User command</div>
                  <h2>Platform directory</h2>
                </div>
                <div className="staff-admin__surface-meta">
                  {formatNumber(filteredUsers.length)} visible
                </div>
              </div>

              <div className="staff-admin__collection">
                {filteredUsers.map((user, index) => (
                  <button
                    key={user.id}
                    type="button"
                    className={`staff-admin__entity-card${selectedUser?.id === user.id ? ' is-active' : ''}`}
                    onClick={() => setSelectedUserId(user.id)}
                    style={{ animationDelay: `${index * 40}ms` }}
                  >
                    <div className="staff-admin__entity-head">
                      <div>
                        <strong>{displayName(user)}</strong>
                        <span>{user.email}</span>
                      </div>
                      <span className={`staff-admin__badge staff-admin__badge--${getRoleTone(user.role)}`}>
                        {humanize(user.role)}
                      </span>
                    </div>
                    <div className="staff-admin__entity-grid">
                      <span>{user.orgName ?? 'No organisation'}</span>
                      <span>{user.orgPlan ? humanize(user.orgPlan) : 'Unassigned'}</span>
                      <span>Seen {formatDate(user.lastSeenAt)}</span>
                      <span>Joined {formatDate(user.createdAt)}</span>
                    </div>
                    <div className="staff-admin__entity-foot">
                      <span>{user.id}</span>
                    </div>
                  </button>
                ))}
              </div>
            </section>

            <section className="staff-admin__surface staff-admin__surface--inspector">
              <UserInspector
                user={selectedUser}
                organisations={data.organisations}
                onSave={(payload) => updateUserMutation.mutate({
                  userId: selectedUser.id,
                  payload,
                })}
                isSaving={updateUserMutation.isPending}
              />
            </section>
          </div>
        ) : null}

        {activeTab === 'billing' ? (
          <BillingTab data={data} billingTotals={billingTotals} />
        ) : null}

        {activeTab === 'activity' ? (
          <ActivityTab
            activity={filteredActivity}
            runs={filteredRuns}
            documents={filteredDocuments}
            runFilter={runFilter}
            onRunFilterChange={(value) => startTransition(() => setRunFilter(value))}
            activityFilter={activityFilter}
            onActivityFilterChange={(value) => startTransition(() => setActivityFilter(value))}
          />
        ) : null}

        {activeTab === 'waitlist' ? (
          <WaitlistTab
            query={waitlistQuery}
            searchValue={deferredWaitlistSearch}
            onSearchChange={(value) => startTransition(() => setWaitlistSearch(value))}
          />
        ) : null}

        {activeTab === 'revenue' ? (
          <RevenueTab query={revenueQuery} />
        ) : null}

        {activeTab === 'referrals' ? (
          <ReferralsTab
            query={referralsQuery}
            days={referralDays}
            onDaysChange={setReferralDays}
          />
        ) : null}

        {activeTab === 'model-usage' ? (
          <ModelUsageTab
            query={modelUsageQuery}
            days={modelCompDays}
            policyKey={modelCompPolicy}
            onDaysChange={(value) => setModelCompDays(value)}
            onPolicyKeyChange={(value) => setModelCompPolicy(value)}
          />
        ) : null}

        {activeTab === 'scorecards' ? (
          <ScorecardsTab query={scorecardsQuery} />
        ) : null}

        {activeTab === 'model-policy' ? (
          <ModelPolicyTab query={modelPolicyQuery} />
        ) : null}

        {activeTab === 'traces' ? (
          <TraceCenterTab
            query={tracesQuery}
            organisations={data.organisations}
            filters={{
              days: traceDays,
              outcomeStatus: traceOutcomeStatus,
              agentId: traceAgentFilter,
              orgId: traceOrgFilter,
              failureClass: traceFailureFilter,
            }}
            onFilterChange={(key, value) => {
              const nextValue = value ?? '';
              if (key === 'days') startTransition(() => setTraceDays(nextValue));
              if (key === 'outcomeStatus') startTransition(() => setTraceOutcomeStatus(nextValue));
              if (key === 'agentId') startTransition(() => setTraceAgentFilter(nextValue));
              if (key === 'orgId') startTransition(() => setTraceOrgFilter(nextValue));
              if (key === 'failureClass') startTransition(() => setTraceFailureFilter(nextValue));
            }}
            onSelectTrace={(traceId) => setSelectedTraceId(traceId)}
            onSelectWorkflowRun={(runId) => setSelectedWorkflowRunId(runId)}
          />
        ) : null}

        {activeTab === 'evals' ? (
          <EvalSummariesTab
            summaryQuery={evalSummaryQuery}
            traceQuery={tracesQuery}
            onSelectTrace={(traceId) => setSelectedTraceId(traceId)}
          />
        ) : null}

        {activeTab === 'workflow-ops' ? (
          <WorkflowOpsTab
            failedRunsQuery={failedWorkflowRunsQuery}
            orgTimelineQuery={orgTimelineQuery}
            webhookDeliveryHealthQuery={webhookDeliveryHealthQuery}
            selectedOrg={selectedTimelineOrganisation}
            organisations={data.organisations}
            workflowDays={workflowDays}
            workflowFailureClass={workflowFailureClass}
            onWorkflowDaysChange={(value) => startTransition(() => setWorkflowDays(value))}
            onWorkflowFailureClassChange={(value) => startTransition(() => setWorkflowFailureClass(value))}
            onSelectOrg={(orgId) => startTransition(() => setSelectedTimelineOrgId(orgId === 'all' ? null : orgId))}
            onSelectRun={(run) => {
              setSelectedTimelineOrgId(run.orgId);
              setSelectedWorkflowRunId(run.id);
            }}
            onOpenTrace={(traceId) => setSelectedTraceId(traceId)}
            onOpenRun={(run) => {
              if (run.orgId) setSelectedTimelineOrgId(run.orgId);
              setSelectedWorkflowRunId(run.id);
            }}
          />
        ) : null}

        {activeTab === 'email-queue' ? (
          <EmailQueueTab
            query={emailQueueQuery}
            status={emailQueueStatus}
            onStatusChange={(value) => startTransition(() => setEmailQueueStatus(value))}
            onProcess={() => processEmailQueueMutation.mutate()}
            isProcessing={processEmailQueueMutation.isPending}
          />
        ) : null}
        {activeTab === 'powerups' ? (
          <PowerUpsTab query={powerupsAdminQuery} />
        ) : null}
        {activeTab === 'audit-logs' ? (
          <AuditLogsTab query={auditLogsQuery} />
        ) : null}
        {activeTab === 'credit-usage' ? (
          <CreditUsageTab query={creditUsageQuery} />
        ) : null}
        {activeTab === 'product-events' ? (
          <ProductEventsTab query={productEventsQuery} />
        ) : null}
        {activeTab === 'growth' ? (
          <GrowthTab query={growthQuery} />
        ) : null}
        </motion.div>
        </MotionPresence>
        </ErrorBoundary>
      </div>

      {selectedTraceId ? (
        <TraceDetailDrawer
          key={selectedTraceId}
          traceQuery={traceDetailQuery}
          onClose={() => setSelectedTraceId(null)}
          onOpenWorkflowRun={(runId) => {
            setSelectedTraceId(null);
            setSelectedWorkflowRunId(runId);
          }}
          onOpenReceipt={(receiptId) => setSelectedReceiptId(receiptId)}
        />
      ) : null}

      {selectedWorkflowRunId ? (
        <WorkflowRunDrawer
          key={selectedWorkflowRunId}
          runQuery={workflowRunDetailQuery}
          onClose={() => setSelectedWorkflowRunId(null)}
          onOpenTrace={(traceId) => {
            setSelectedWorkflowRunId(null);
            setSelectedTraceId(traceId);
          }}
          onOpenReceipt={(receiptId) => setSelectedReceiptId(receiptId)}
          onReplay={(runId, payload) => replayWorkflowMutation.mutate({ runId, payload })}
          isReplaying={replayWorkflowMutation.isPending}
        />
      ) : null}

      {selectedReceiptId ? (
        <ActionReceiptDrawer
          key={selectedReceiptId}
          receiptQuery={actionReceiptQuery}
          onClose={() => setSelectedReceiptId(null)}
        />
      ) : null}

      {paletteOpen ? (
        <AdminCommandPalette
          organisations={data.organisations}
          users={data.users}
          onNavigateTab={(tabId) => startTransition(() => setActiveTab(tabId))}
          onSelectOrg={(orgId) => {
            startTransition(() => {
              setActiveTab('organisations');
              setSelectedOrgId(orgId);
            });
          }}
          onSelectUser={(userId) => {
            startTransition(() => {
              setActiveTab('users');
              setSelectedUserId(userId);
            });
          }}
          onSelectTrace={(traceId) => {
            startTransition(() => {
              setActiveTab('traces');
              setSelectedTraceId(traceId);
            });
          }}
          onSelectWorkflowRun={(runId, orgId) => {
            startTransition(() => {
              setActiveTab('workflow-ops');
              if (orgId) {
                setSelectedTimelineOrgId(orgId);
              }
              setSelectedWorkflowRunId(runId);
            });
          }}
          onClose={() => setPaletteOpen(false)}
        />
      ) : null}
    </PageShell>
  );
}

