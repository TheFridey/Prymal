import { useEffect, useMemo, useState } from 'react';
import { useClerk, useUser } from '@clerk/clerk-react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useOutletContext, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { getWorkspacePlanMeta } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';
import { Button, PageHeader, PageShell, SurfaceCard } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';
import { SETTINGS_TABS } from '../features/settings/constants';
import { ReferralsTab } from '../features/settings/referrals/ReferralsTab';
import {
  AccountSettingsTab,
  ApiKeysSettingsTab,
  BillingSettingsTab,
  MemorySettingsTab,
  OrganisationSettingsTab,
  TeamSettingsTab,
} from '../features/settings/SettingsTabPanels';

export default function Settings() {
  const { viewer } = useOutletContext();
  const { user } = useUser();
  const { signOut } = useClerk();
  const [searchParams] = useSearchParams();
  const [activeTab, setActiveTab] = useState('Account');
  const [billingInterval, setBillingInterval] = useState('monthly');
  const [usageDays, setUsageDays] = useState(30);
  const [seatAddonOpen, setSeatAddonOpen] = useState(false);
  const [seatAddonQty, setSeatAddonQty] = useState(1);
  const [keyName, setKeyName] = useState('');
  const [expiresInDays, setExpiresInDays] = useState('30');
  const [freshToken, setFreshToken] = useState('');
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteRole, setInviteRole] = useState('member');
  const [ownerTargetId, setOwnerTargetId] = useState('');
  const [memoryAgentFilter, setMemoryAgentFilter] = useState('all');
  const [memorySortKey, setMemorySortKey] = useState('recency');
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const billingQuery = useQuery({
    queryKey: ['billing-stats'],
    queryFn: () => api.get('/billing/stats'),
  });

  const apiKeysQuery = useQuery({
    queryKey: ['api-keys'],
    queryFn: () => api.get('/auth/api-keys'),
  });

  const teamQuery = useQuery({
    queryKey: ['team'],
    queryFn: () => api.get('/auth/team'),
  });

  const usageBreakdownQuery = useQuery({
    queryKey: ['usage-breakdown', usageDays],
    queryFn: () => api.get(`/billing/usage-breakdown?days=${usageDays}`),
    enabled: activeTab === 'Billing',
  });

  const memoryQuery = useQuery({
    queryKey: ['agent-memory'],
    queryFn: () => api.get('/agents/memory'),
    enabled: activeTab === 'Memory',
  });

  const referralQuery = useQuery({
    queryKey: ['referral'],
    queryFn: () => api.get('/auth/referral'),
    enabled: activeTab === 'Referrals',
  });

  const deleteMemoryMutation = useMutation({
    mutationFn: (memoryId) => api.delete(`/agents/memory/${memoryId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['agent-memory'] });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error) });
    },
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

  const seatAddonMutation = useMutation({
    mutationFn: (payload) => api.post('/billing/seat-addon', payload),
    onSuccess: (result) => {
      window.location.href = result.checkoutUrl;
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Seat add-on failed', message: getErrorMessage(error) });
    },
  });

  const portalMutation = useMutation({
    mutationFn: () => api.post('/billing/portal'),
    onSuccess: (result) => {
      window.location.href = result.url;
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Portal failed', message: getErrorMessage(error) });
    },
  });

  const createKeyMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/api-keys', payload),
    onSuccess: async (result) => {
      setFreshToken(result.token);
      setKeyName('');
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notify({ type: 'success', title: 'API key created', message: 'Copy the token now. It will not be shown again.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Key creation failed', message: getErrorMessage(error) });
    },
  });

  const revokeKeyMutation = useMutation({
    mutationFn: (keyId) => api.delete(`/auth/api-keys/${keyId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['api-keys'] });
      notify({ type: 'success', title: 'API key revoked', message: 'The key is now inactive.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Revoke failed', message: getErrorMessage(error) });
    },
  });

  const inviteMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/team/invitations', payload),
    onSuccess: async (result) => {
      setInviteEmail('');
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      notify({
        type: 'success',
        title: 'Invitation created',
        message: `Seat reserved. Invite preview ${result.invitation.tokenPreview} is ready.`,
      });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Invite failed', message: getErrorMessage(error) });
    },
  });

  const resendInviteMutation = useMutation({
    mutationFn: (inviteId) => api.post(`/auth/team/invitations/${inviteId}/resend`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      notify({ type: 'success', title: 'Invitation resent', message: 'A fresh invite link has been issued.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Resend failed', message: getErrorMessage(error) });
    },
  });

  const revokeInviteMutation = useMutation({
    mutationFn: (inviteId) => api.delete(`/auth/team/invitations/${inviteId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      notify({ type: 'success', title: 'Invitation revoked', message: 'The reserved seat is available again.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Revoke failed', message: getErrorMessage(error) });
    },
  });

  const updateMemberRoleMutation = useMutation({
    mutationFn: ({ userId, role }) => api.patch(`/auth/team/members/${userId}`, { role }),
    onSuccess: async () => {
      setOwnerTargetId('');
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      await queryClient.invalidateQueries({ queryKey: ['viewer'] });
      notify({ type: 'success', title: 'Role updated', message: 'Member permissions were updated.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Role change failed', message: getErrorMessage(error) });
    },
  });

  const removeMemberMutation = useMutation({
    mutationFn: (userId) => api.delete(`/auth/team/members/${userId}`),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['team'] });
      notify({ type: 'success', title: 'Member removed', message: 'The seat has been released.' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Removal failed', message: getErrorMessage(error) });
    },
  });

  useEffect(() => {
    if (searchParams.get('billing') === 'success') {
      notify({ type: 'success', title: 'Billing updated', message: 'Stripe checkout completed successfully.' });
    }
    if (searchParams.get('billing') === 'cancelled') {
      notify({ type: 'info', title: 'Billing cancelled', message: 'The checkout session was cancelled.' });
    }
  }, [notify, searchParams]);

  const currentPlan = billingQuery.data?.plan ?? viewer?.organisation?.plan ?? 'free';
  const currentPlanMeta = getWorkspacePlanMeta(currentPlan);
  const canCreateApiKey = currentPlan === 'agency';
  const creditPercent = billingQuery.data?.creditLimit
    ? Math.min((billingQuery.data.creditsUsed / billingQuery.data.creditLimit) * 100, 100)
    : 0;
  const canManageTeam = teamQuery.data?.canManage ?? viewer?.team?.canManage ?? false;
  const seatSummary = teamQuery.data?.seats ?? billingQuery.data?.seats ?? viewer?.team?.seats ?? null;
  const ownerCandidates = (teamQuery.data?.members ?? []).filter((member) => member.role !== 'owner');

  const filteredMemory = useMemo(() => {
    const entries = memoryQuery.data?.memory ?? [];
    const filtered = memoryAgentFilter === 'all' ? entries : entries.filter((entry) => entry.agentId === memoryAgentFilter);
    if (memorySortKey === 'confidence') return [...filtered].sort((left, right) => (right.confidence ?? 0) - (left.confidence ?? 0));
    if (memorySortKey === 'usage') return [...filtered].sort((left, right) => (right.usageCount ?? 0) - (left.usageCount ?? 0));
    return [...filtered].sort((left, right) => new Date(right.updatedAt) - new Date(left.updatedAt));
  }, [memoryQuery.data?.memory, memoryAgentFilter, memorySortKey]);

  const memoryAgentOptions = useMemo(() => {
    const ids = [...new Set((memoryQuery.data?.memory ?? []).map((entry) => entry.agentId))].sort();
    return ['all', ...ids];
  }, [memoryQuery.data?.memory]);

  const orgRows = useMemo(
    () => [
      ['Organisation', viewer?.organisation?.name ?? 'Unknown'],
      ['Plan', currentPlanMeta.name],
      ['Workspace focus', viewer?.organisation?.metadata?.workspaceFocus ?? 'Not set'],
      ['Primary goal', viewer?.organisation?.metadata?.primaryGoal ?? 'Not set'],
      ['Seats', seatSummary ? `${seatSummary.members}/${seatSummary.seatLimit} active` : `${currentPlanMeta.seats ?? 1}`],
      ['Credits', `${billingQuery.data?.creditsUsed ?? 0} / ${billingQuery.data?.creditLimit ?? currentPlanMeta.credits}`],
    ],
    [
      billingQuery.data?.creditLimit,
      billingQuery.data?.creditsUsed,
      currentPlanMeta.credits,
      currentPlanMeta.name,
      currentPlanMeta.seats,
      seatSummary,
      viewer?.organisation?.metadata?.primaryGoal,
      viewer?.organisation?.metadata?.workspaceFocus,
      viewer?.organisation?.name,
    ],
  );

  return (
    <PageShell>
      <PageHeader
        eyebrow="Settings"
        title="Workspace, billing, and operating controls"
        description="Prymal now treats billing, team access, API keys, and workspace context as real SaaS surfaces, not placeholder panels."
        accent="#00FFD1"
      />

      <SurfaceCard accent="#00FFD1" style={{ marginBottom: '14px' }}>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {SETTINGS_TABS.map((tab) => (
            <Button key={tab} tone={activeTab === tab ? 'accent' : 'ghost'} onClick={() => setActiveTab(tab)}>
              {tab}
            </Button>
          ))}
        </div>
      </SurfaceCard>

      {activeTab === 'Account' ? <AccountSettingsTab viewer={viewer} user={user} signOut={signOut} /> : null}
      {activeTab === 'Billing' ? (
        <BillingSettingsTab
          billingQuery={billingQuery}
          checkoutMutation={checkoutMutation}
          portalMutation={portalMutation}
          usageBreakdownQuery={usageBreakdownQuery}
          currentPlan={currentPlan}
          currentPlanMeta={currentPlanMeta}
          creditPercent={creditPercent}
          seatSummary={seatSummary}
          billingInterval={billingInterval}
          setBillingInterval={setBillingInterval}
          usageDays={usageDays}
          setUsageDays={setUsageDays}
        />
      ) : null}
      {activeTab === 'Team' ? (
        <TeamSettingsTab
          viewer={viewer}
          teamQuery={teamQuery}
          currentPlan={currentPlan}
          currentPlanMeta={currentPlanMeta}
          seatSummary={seatSummary}
          canManageTeam={canManageTeam}
          ownerCandidates={ownerCandidates}
          inviteEmail={inviteEmail}
          setInviteEmail={setInviteEmail}
          inviteRole={inviteRole}
          setInviteRole={setInviteRole}
          ownerTargetId={ownerTargetId}
          setOwnerTargetId={setOwnerTargetId}
          seatAddonOpen={seatAddonOpen}
          setSeatAddonOpen={setSeatAddonOpen}
          seatAddonQty={seatAddonQty}
          setSeatAddonQty={setSeatAddonQty}
          seatAddonMutation={seatAddonMutation}
          inviteMutation={inviteMutation}
          resendInviteMutation={resendInviteMutation}
          revokeInviteMutation={revokeInviteMutation}
          updateMemberRoleMutation={updateMemberRoleMutation}
          removeMemberMutation={removeMemberMutation}
        />
      ) : null}
      {activeTab === 'API Keys' ? (
        <ApiKeysSettingsTab
          apiKeysQuery={apiKeysQuery}
          createKeyMutation={createKeyMutation}
          revokeKeyMutation={revokeKeyMutation}
          canCreateApiKey={canCreateApiKey}
          keyName={keyName}
          setKeyName={setKeyName}
          expiresInDays={expiresInDays}
          setExpiresInDays={setExpiresInDays}
          freshToken={freshToken}
        />
      ) : null}
      {activeTab === 'Organisation' ? <OrganisationSettingsTab orgRows={orgRows} /> : null}
      {activeTab === 'Referrals' ? <ReferralsTab query={referralQuery} /> : null}
      {activeTab === 'Memory' ? (
        <MemorySettingsTab
          memoryQuery={memoryQuery}
          filteredMemory={filteredMemory}
          memoryAgentFilter={memoryAgentFilter}
          setMemoryAgentFilter={setMemoryAgentFilter}
          memorySortKey={memorySortKey}
          setMemorySortKey={setMemorySortKey}
          memoryAgentOptions={memoryAgentOptions}
          deleteMemoryMutation={deleteMemoryMutation}
        />
      ) : null}
    </PageShell>
  );
}
