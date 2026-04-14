import { useEffect, useMemo, useState } from 'react';
import { Button, InlineNotice, SectionLabel, StatusPill, SurfaceCard, TextInput } from '../../components/ui';
import { AGENT_LIBRARY, BILLING_INTERVALS, PLAN_LIBRARY, getPlanPrice } from '../../lib/constants';
import { formatDate, formatDateTime, getErrorMessage } from '../../lib/utils';
import {
  createGlassPanelStyle,
  createLabeledRowStyle,
  FORM_LABEL_STYLE,
  MUTED_COPY_STYLE,
} from '../../design-system/surfaces';
import { SeatMetric } from './referrals/ReferralsTab';

const chipStyle = {
  padding: '2px 8px',
  borderRadius: '999px',
  border: '1px solid var(--line)',
  color: 'var(--muted)',
  fontSize: '11px',
  background: 'transparent',
};

const PROVENANCE_META = {
  confirmed: { label: 'confirmed', color: '#18c7a0' },
  inferred: { label: 'inferred', color: '#4CC9F0' },
  corrected: { label: 'corrected', color: '#F59E0B' },
  extracted: { label: 'extracted', color: '#8b5cf6' },
};

export const selectStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-strong)',
  outline: 'none',
};

export const stepperBtnStyle = {
  width: '36px',
  height: '36px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-strong)',
  cursor: 'pointer',
  fontSize: '18px',
  display: 'grid',
  placeItems: 'center',
};

const rowStyle = {
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid var(--line)',
  background: 'var(--panel-soft)',
  display: 'flex',
  justifyContent: 'space-between',
  gap: '12px',
  flexWrap: 'wrap',
  alignItems: 'center',
};

const providerGuidance = [
  {
    key: 'anthropic',
    title: 'Anthropic',
    accent: '#7DD3FC',
    role: 'Deep reasoning and contract-heavy specialist work.',
    helper: 'Best when you want deliberate analysis, stronger instruction-following, and premium long-form synthesis.',
  },
  {
    key: 'openai',
    title: 'OpenAI',
    accent: '#7CFFCB',
    role: 'Premium structured, multimodal, realtime, and operator-facing execution.',
    helper: 'Best for polished customer-facing output, voice, images, and strong structured-response lanes.',
  },
  {
    key: 'google',
    title: 'Gemini',
    accent: '#BDB4FE',
    role: 'Fast, lower-cost throughput and experimentation lane.',
    helper: 'Best for budget-sensitive routing, high-volume fast paths, and controlled experimentation.',
  },
];

export function AccountSettingsTab({ user, viewer, signOut }) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Profile" accent="#00FFD1">
        <div style={{ display: 'flex', gap: '16px', alignItems: 'center', flexWrap: 'wrap' }}>
          <div
            style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              overflow: 'hidden',
              border: '1px solid var(--line)',
              background: 'var(--panel-soft)',
              display: 'grid',
              placeItems: 'center',
              color: 'var(--text-strong)',
            }}
          >
            {user?.imageUrl ? (
              <img src={user.imageUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              user?.firstName?.[0] ?? 'A'
            )}
          </div>
          <div>
            <div style={{ fontSize: '20px', marginBottom: '4px' }}>{user?.fullName ?? viewer?.user?.email ?? 'Prymal User'}</div>
            <div style={{ color: 'var(--muted)' }}>{viewer?.user?.email ?? user?.primaryEmailAddress?.emailAddress}</div>
            <div style={{ color: 'var(--muted-2)', marginTop: '4px' }}>Role: {viewer?.user?.role ?? 'member'}</div>
          </div>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Workspace posture" accent="#BDB4FE">
        <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
          Prymal keeps organisation-level context shared across the workspace, while conversations remain user-private by
          default. Team collaboration, seat access, and sensitive actions are now controlled through server-side roles.
        </div>
      </SurfaceCard>

      <SurfaceCard title="Session" accent="#EF4444">
        <div style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: '12px' }}>
          Clerk handles authentication, while Prymal handles org membership, seat entitlements, and runtime permissions.
        </div>
        <Button tone="danger" onClick={() => signOut({ redirectUrl: '/' })}>
          Sign out
        </Button>
      </SurfaceCard>
    </div>
  );
}

export function BillingSettingsTab({
  billingQuery,
  checkoutMutation,
  portalMutation,
  usageBreakdownQuery,
  currentPlan,
  currentPlanMeta,
  creditPercent,
  seatSummary,
  billingInterval,
  setBillingInterval,
  usageDays,
  setUsageDays,
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Current usage" accent="#00FFD1">
        <div style={{ display: 'flex', justifyContent: 'space-between', gap: '12px', flexWrap: 'wrap', marginBottom: '10px' }}>
          <div>
            <div style={{ fontSize: '24px', marginBottom: '4px' }}>{currentPlanMeta.name}</div>
            <div style={{ color: 'var(--muted)' }}>{currentPlanMeta.description}</div>
          </div>
          {currentPlan !== 'free' ? (
            <Button tone="ghost" onClick={() => portalMutation.mutate()} disabled={portalMutation.isPending || !billingQuery.data?.canManageBilling}>
              Open billing portal
            </Button>
          ) : null}
        </div>
        <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '6px' }}>
          {billingQuery.data?.creditsUsed ?? 0} / {billingQuery.data?.creditLimit ?? currentPlanMeta.credits} credits used
        </div>
        <div style={{ height: '10px', borderRadius: '999px', background: '#131C2B', overflow: 'hidden', marginBottom: '10px' }}>
          <div style={{ width: `${creditPercent}%`, height: '100%', background: '#00FFD1' }} />
        </div>
        <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap', color: 'var(--muted)' }}>
          <span>{seatSummary ? `${seatSummary.members} active seats` : `${currentPlanMeta.seats ?? 1} seat`}</span>
          <span>{seatSummary ? `${seatSummary.pendingInvites} pending invites` : 'No pending invites data'}</span>
          <span>{billingQuery.data?.workflowRuns ?? 0} workflow runs</span>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Usage by agent" accent="#00FFD1">
        <div style={{ display: 'flex', gap: '8px', marginBottom: '14px' }}>
          {[7, 30, 90].map((days) => (
            <Button key={days} tone={usageDays === days ? 'accent' : 'ghost'} onClick={() => setUsageDays(days)}>
              {days === 7 ? 'Last 7 days' : days === 30 ? 'Last 30 days' : 'Last 90 days'}
            </Button>
          ))}
        </div>
        {usageBreakdownQuery.isLoading ? (
          <div style={{ display: 'grid', gap: '8px' }}>
            {[0, 1, 2].map((index) => (
              <div key={index} style={{ height: '36px', borderRadius: '8px', background: 'var(--panel-soft)', animation: 'pulse 1.5s ease-in-out infinite' }} />
            ))}
          </div>
        ) : (usageBreakdownQuery.data?.breakdown ?? []).length === 0 ? (
          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>No agent activity in this period.</div>
        ) : (
          <>
            <div style={{ display: 'grid', gap: '8px' }}>
              {(usageBreakdownQuery.data.breakdown ?? []).map((row) => {
                const agentMeta = AGENT_LIBRARY.find((agent) => agent.id === row.agentId);
                const color = agentMeta?.color ?? '#00FFD1';
                return (
                  <div key={row.agentId} style={{ display: 'grid', gridTemplateColumns: '16px 1fr auto auto', gap: '10px', alignItems: 'center' }}>
                    <span style={{ width: '10px', height: '10px', borderRadius: '50%', background: color, display: 'block' }} />
                    <div>
                      <div style={{ fontSize: '13px', marginBottom: '4px', color: 'var(--text-strong)' }}>
                        {agentMeta?.name ?? row.agentId}{' '}
                        <span style={{ color: 'var(--muted-2)', fontSize: '11px' }}>
                          {row.runs} run{row.runs !== 1 ? 's' : ''}
                        </span>
                      </div>
                      <div style={{ height: '6px', borderRadius: '999px', background: 'var(--panel-soft)', overflow: 'hidden' }}>
                        <div style={{ width: `${(row.shareOfTotal * 100).toFixed(1)}%`, height: '100%', background: color, opacity: 0.45 }} />
                      </div>
                    </div>
                    <div style={{ fontSize: '13px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>${Number(row.estimatedCostUsd).toFixed(2)}</div>
                  </div>
                );
              })}
            </div>
            <div style={{ marginTop: '12px', paddingTop: '10px', borderTop: '1px solid var(--line)', color: 'var(--muted)', fontSize: '13px' }}>
              Total: {usageBreakdownQuery.data.totalRuns} run{usageBreakdownQuery.data.totalRuns !== 1 ? 's' : ''} | ${Number(usageBreakdownQuery.data.totalCostUsd).toFixed(2)}
            </div>
          </>
        )}
      </SurfaceCard>

      <SurfaceCard accent="#BDB4FE">
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          {BILLING_INTERVALS.map((interval) => (
            <Button
              key={interval.id}
              tone={billingInterval === interval.id ? 'accent' : 'ghost'}
              onClick={() => setBillingInterval(interval.id)}
            >
              {interval.label}
            </Button>
          ))}
        </div>
        <div style={{ marginTop: '12px', color: 'var(--muted)', lineHeight: 1.7 }}>
          Paid plans are framed around operating leverage, shared context, and execution capacity. Quarterly and yearly
          commitments keep the premium positioning while improving long-term value.
        </div>
      </SurfaceCard>

      <div style={{ display: 'grid', gap: '10px' }}>
        {PLAN_LIBRARY.map((plan) => (
          <SurfaceCard key={plan.id} accent={plan.recommended ? '#00FFD1' : 'var(--line)'}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: '16px', flexWrap: 'wrap' }}>
              <div>
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center', flexWrap: 'wrap', marginBottom: '6px' }}>
                  <div style={{ fontSize: '18px' }}>{plan.name}</div>
                  {plan.id === currentPlan ? <StatusPill color="#00FFD1">Current</StatusPill> : null}
                  {plan.recommended ? <StatusPill color="#BDB4FE">Recommended</StatusPill> : null}
                </div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.8, marginBottom: '8px' }}>{plan.description}</div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', marginBottom: '8px' }}>
                  <span style={chipStyle}>{plan.seats} seat{plan.seats > 1 ? 's' : ''}</span>
                  <span style={chipStyle}>{plan.credits.toLocaleString()} monthly credits</span>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
                  {plan.features.map((feature) => (
                    <span key={feature} style={chipStyle}>
                      {feature}
                    </span>
                  ))}
                </div>
              </div>
              <div style={{ minWidth: '150px', textAlign: 'right' }}>
                <div style={{ fontSize: '28px', marginBottom: '6px' }}>{getPlanPrice(plan, billingInterval).display}</div>
                <div style={{ color: 'var(--muted)', fontSize: '12px', marginBottom: '8px' }}>
                  {getPlanPrice(plan, billingInterval).suffix}
                  {getPlanPrice(plan, billingInterval).discountLabel ? ` | ${getPlanPrice(plan, billingInterval).discountLabel}` : ''}
                </div>
                <div style={{ color: 'var(--muted-2)', fontSize: '11px', marginBottom: '10px' }}>
                  {getPlanPrice(plan, billingInterval).monthlyEquivalent}
                </div>
                {plan.id !== currentPlan ? (
                  <Button
                    tone="accent"
                    onClick={() => checkoutMutation.mutate({ plan: plan.id, interval: billingInterval })}
                    disabled={checkoutMutation.isPending || !billingQuery.data?.canManageBilling}
                  >
                    Upgrade
                  </Button>
                ) : null}
              </div>
            </div>
          </SurfaceCard>
        ))}
      </div>
    </div>
  );
}

export function TeamSettingsTab({
  viewer,
  teamQuery,
  currentPlan,
  currentPlanMeta,
  seatSummary,
  canManageTeam,
  ownerCandidates,
  inviteEmail,
  setInviteEmail,
  inviteRole,
  setInviteRole,
  ownerTargetId,
  setOwnerTargetId,
  seatAddonOpen,
  setSeatAddonOpen,
  seatAddonQty,
  setSeatAddonQty,
  seatAddonMutation,
  inviteMutation,
  resendInviteMutation,
  revokeInviteMutation,
  updateMemberRoleMutation,
  removeMemberMutation,
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Seat usage" accent="#00FFD1">
        <div style={{ display: 'flex', gap: '12px', flexWrap: 'wrap' }}>
          <SeatMetric label="Seats included" value={seatSummary?.seatLimit ?? currentPlanMeta.seats ?? 1} />
          <SeatMetric label="Active members" value={seatSummary?.members ?? 0} />
          <SeatMetric label="Pending invites" value={seatSummary?.pendingInvites ?? 0} />
          <SeatMetric label="Available" value={seatSummary?.availableSeats ?? 0} />
        </div>
        {currentPlan === 'teams' ? (
          <div style={{ marginTop: '14px' }}>
            {!seatAddonOpen ? (
              <Button
                tone={(seatSummary?.availableSeats ?? 1) <= 0 ? 'accent' : 'ghost'}
                onClick={() => {
                  setSeatAddonOpen(true);
                  setSeatAddonQty(1);
                }}
              >
                {(seatSummary?.availableSeats ?? 1) <= 0 ? 'Add seats' : 'Need more seats?'}
              </Button>
            ) : (
              <div style={{ display: 'grid', gap: '12px', padding: '16px', borderRadius: '14px', border: '1px solid var(--line)', background: 'var(--panel-soft)' }}>
                <div style={{ fontWeight: 600 }}>Add seats to your plan</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: '12px' }}>
                  <button
                    type="button"
                    style={stepperBtnStyle}
                    onClick={() => setSeatAddonQty((value) => Math.max(1, value - 1))}
                    disabled={seatAddonQty <= 1}
                    aria-label="Decrease"
                  >
                    -
                  </button>
                  <span style={{ minWidth: '32px', textAlign: 'center', fontSize: '18px', fontWeight: 600 }}>{seatAddonQty}</span>
                  <button
                    type="button"
                    style={stepperBtnStyle}
                    onClick={() => setSeatAddonQty((value) => Math.min(20, value + 1))}
                    disabled={seatAddonQty >= 20}
                    aria-label="Increase"
                  >
                    +
                  </button>
                  <span style={{ color: 'var(--muted)', fontSize: '14px' }}>
                    Adds {seatAddonQty} seat{seatAddonQty > 1 ? 's' : ''} to your plan
                  </span>
                </div>
                {seatAddonMutation.isError ? (
                  <InlineNotice tone="danger">{getErrorMessage(seatAddonMutation.error)}</InlineNotice>
                ) : null}
                <div style={{ display: 'flex', gap: '10px', alignItems: 'center' }}>
                  <Button
                    tone="accent"
                    onClick={() => seatAddonMutation.mutate({ additionalSeats: seatAddonQty })}
                    disabled={seatAddonMutation.isPending}
                  >
                    {seatAddonMutation.isPending ? 'Redirecting...' : 'Proceed to checkout'}
                  </Button>
                  <button
                    type="button"
                    style={{ background: 'none', border: 'none', color: 'var(--muted)', cursor: 'pointer', fontSize: '14px' }}
                    onClick={() => setSeatAddonOpen(false)}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard title="Invite teammates" accent="#BDB4FE">
        <InlineNotice tone={canManageTeam ? 'default' : 'warning'}>
          {canManageTeam
            ? 'Owners and admins can invite users by email, reserve seats, and assign roles.'
            : 'Only owners and admins can send invites or manage seats.'}
        </InlineNotice>
        <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
          <TextInput value={inviteEmail} onChange={(event) => setInviteEmail(event.target.value)} placeholder="teammate@company.com" />
          <select value={inviteRole} onChange={(event) => setInviteRole(event.target.value)} style={selectStyle}>
            <option value="member">Member</option>
            <option value="admin">Admin</option>
          </select>
          <Button
            tone="accent"
            disabled={!canManageTeam || !inviteEmail.trim() || inviteMutation.isPending}
            onClick={() => inviteMutation.mutate({ email: inviteEmail.trim(), role: inviteRole })}
          >
            Send invite
          </Button>
        </div>
      </SurfaceCard>

      <SurfaceCard title="Members" accent="#00FFD1">
        <div style={{ display: 'grid', gap: '10px' }}>
          {(teamQuery.data?.members ?? []).map((member) => (
            <div key={member.id} style={rowStyle}>
              <div>
                <div style={{ fontSize: '15px', marginBottom: '4px' }}>
                  {member.firstName || member.lastName
                    ? `${member.firstName ?? ''} ${member.lastName ?? ''}`.trim()
                    : member.email}
                </div>
                <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                  {member.email} | last seen {formatDateTime(member.lastSeenAt)}
                </div>
              </div>
              <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                <StatusPill color={member.role === 'owner' ? '#ffb703' : member.role === 'admin' ? '#4CC9F0' : '#00FFD1'}>
                  {member.role}
                </StatusPill>
                {canManageTeam && !member.isCurrentUser ? (
                  <>
                    <select
                      value={member.role}
                      onChange={(event) =>
                        updateMemberRoleMutation.mutate({ userId: member.id, role: event.target.value })
                      }
                      style={{ ...selectStyle, width: '120px', padding: '10px 12px' }}
                    >
                      <option value="member">Member</option>
                      <option value="admin">Admin</option>
                      <option value="owner">Owner</option>
                    </select>
                    <Button tone="danger" onClick={() => removeMemberMutation.mutate(member.id)}>
                      Remove
                    </Button>
                  </>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      {viewer?.user?.role === 'owner' ? (
        <SurfaceCard title="Owner transfer" accent="#ffb703">
          <InlineNotice tone="warning">
            Ownership transfer promotes the selected teammate to owner and downgrades your account to admin. Use this when moving account control to another operator.
          </InlineNotice>
          <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
            <select value={ownerTargetId} onChange={(event) => setOwnerTargetId(event.target.value)} style={selectStyle}>
              <option value="">Choose new owner</option>
              {ownerCandidates.map((member) => (
                <option key={member.id} value={member.id}>
                  {member.email} ({member.role})
                </option>
              ))}
            </select>
            <Button
              tone="accent"
              disabled={!ownerTargetId}
              onClick={() => updateMemberRoleMutation.mutate({ userId: ownerTargetId, role: 'owner' })}
            >
              Transfer ownership
            </Button>
          </div>
        </SurfaceCard>
      ) : null}

      <SurfaceCard title="Invitations" accent="#4CC9F0">
        {(teamQuery.data?.invitations ?? []).length === 0 ? (
          <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>No outstanding or historical invitations yet.</div>
        ) : (
          <div style={{ display: 'grid', gap: '10px' }}>
            {teamQuery.data.invitations.map((invite) => (
              <div key={invite.id} style={rowStyle}>
                <div>
                  <div style={{ fontSize: '15px', marginBottom: '4px' }}>{invite.email}</div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>
                    {invite.role} | expires {formatDate(invite.expiresAt)} | token preview {invite.tokenPreview}
                  </div>
                </div>
                <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap', alignItems: 'center' }}>
                  <StatusPill color={invite.status === 'pending' ? '#ffb703' : invite.status === 'accepted' ? '#00FFD1' : '#98A2B3'}>
                    {invite.status}
                  </StatusPill>
                  {canManageTeam && invite.status === 'pending' ? (
                    <>
                      <Button tone="ghost" onClick={() => resendInviteMutation.mutate(invite.id)}>
                        Resend
                      </Button>
                      <Button tone="danger" onClick={() => revokeInviteMutation.mutate(invite.id)}>
                        Revoke
                      </Button>
                    </>
                  ) : null}
                </div>
              </div>
            ))}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}

export function ApiKeysSettingsTab({
  apiKeysQuery,
  createKeyMutation,
  revokeKeyMutation,
  canCreateApiKey,
  keyName,
  setKeyName,
  expiresInDays,
  setExpiresInDays,
  freshToken,
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="API access" accent="#BDB4FE">
        <InlineNotice tone={canCreateApiKey ? 'success' : 'warning'}>
          {canCreateApiKey
            ? 'Agency access confirmed. Keys created here can authenticate against Prymal routes that use API-key middleware.'
            : 'API-key issuance is intentionally gated to Agency because Prymal treats it as a real premium capability, not a placeholder.'}
        </InlineNotice>
        <div style={{ display: 'grid', gap: '10px', marginTop: '14px' }}>
          <TextInput value={keyName} onChange={(event) => setKeyName(event.target.value)} placeholder="Key name" />
          <TextInput value={expiresInDays} onChange={(event) => setExpiresInDays(event.target.value)} placeholder="Expiry in days" />
          <Button
            tone="accent"
            disabled={!canCreateApiKey || !keyName.trim() || createKeyMutation.isPending}
            onClick={() =>
              createKeyMutation.mutate({
                name: keyName.trim(),
                expiresInDays: expiresInDays ? Number.parseInt(expiresInDays, 10) : undefined,
                scopes: ['read', 'write'],
              })
            }
          >
            Create API key
          </Button>
        </div>
        {freshToken ? (
          <div style={{ marginTop: '14px' }}>
            <SectionLabel>Copy now</SectionLabel>
            <div
              style={{
                padding: '14px',
                borderRadius: '14px',
                border: '1px solid var(--line)',
                background: 'var(--panel-soft)',
                color: 'var(--text-strong)',
                overflowX: 'auto',
              }}
            >
              {freshToken}
            </div>
          </div>
        ) : null}
      </SurfaceCard>

      <SurfaceCard title="Issued keys" accent="#4CC9F0">
        <div style={{ display: 'grid', gap: '10px' }}>
          {(apiKeysQuery.data?.apiKeys ?? []).length === 0 ? (
            <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>No API keys issued for this organisation yet.</div>
          ) : (
            apiKeysQuery.data.apiKeys.map((entry) => (
              <div key={entry.id} style={rowStyle}>
                <div>
                  <div style={{ fontSize: '15px', marginBottom: '4px' }}>{entry.name}</div>
                  <div style={{ color: 'var(--muted)', lineHeight: 1.8 }}>
                    {entry.keyPrefix} | last used {formatDateTime(entry.lastUsedAt)} | expires {formatDate(entry.expiresAt)}
                  </div>
                </div>
                <div>
                  {entry.isActive ? (
                    <Button tone="danger" onClick={() => revokeKeyMutation.mutate(entry.id)}>
                      Revoke
                    </Button>
                  ) : (
                    <StatusPill color="#98A2B3">Revoked</StatusPill>
                  )}
                </div>
              </div>
            ))
          )}
        </div>
      </SurfaceCard>
    </div>
  );
}

export function OrganisationSettingsTab({ orgRows, viewer, controlsQuery, updateMutation }) {
  const canManageControls = controlsQuery.data?.canManage ?? ['owner', 'admin'].includes(viewer?.user?.role);
  const defaultControls = useMemo(() => ({
    providerPreference: 'auto',
    reasoningTier: 'auto',
    fastLane: 'auto',
    budgetCap: {
      maxCostUsdPerRun: '',
      maxOutputTokensPerRun: '',
    },
    spendThresholds: {
      warnUsdMonthly: '',
      hardCapUsdMonthly: '',
    },
    failoverOrder: ['', '', ''],
    experimentationEnabled: false,
  }), []);
  const [formState, setFormState] = useState(defaultControls);

  useEffect(() => {
    const controls = controlsQuery.data?.controls;
    if (!controls) {
      return;
    }

    setFormState({
      providerPreference: controls.providerPreference ?? 'auto',
      reasoningTier: controls.reasoningTier ?? 'auto',
      fastLane: controls.fastLane ?? 'auto',
      budgetCap: {
        maxCostUsdPerRun: controls.budgetCap?.maxCostUsdPerRun ?? '',
        maxOutputTokensPerRun: controls.budgetCap?.maxOutputTokensPerRun ?? '',
      },
      spendThresholds: {
        warnUsdMonthly: controls.spendThresholds?.warnUsdMonthly ?? '',
        hardCapUsdMonthly: controls.spendThresholds?.hardCapUsdMonthly ?? '',
      },
      failoverOrder: [
        controls.failoverOrder?.[0] ?? '',
        controls.failoverOrder?.[1] ?? '',
        controls.failoverOrder?.[2] ?? '',
      ],
      experimentationEnabled: Boolean(controls.experimentationEnabled),
    });
  }, [controlsQuery.data?.controls, defaultControls]);

  function updateFailover(index, value) {
    setFormState((current) => {
      const next = [...current.failoverOrder];
      next[index] = value;
      return { ...current, failoverOrder: next };
    });
  }

  function saveControls() {
    updateMutation.mutate({
      providerPreference: formState.providerPreference,
      reasoningTier: formState.reasoningTier,
      fastLane: formState.fastLane,
      budgetCap: {
        maxCostUsdPerRun: parseNullableNumber(formState.budgetCap.maxCostUsdPerRun),
        maxOutputTokensPerRun: parseNullableInteger(formState.budgetCap.maxOutputTokensPerRun),
      },
      spendThresholds: {
        warnUsdMonthly: parseNullableNumber(formState.spendThresholds.warnUsdMonthly),
        hardCapUsdMonthly: parseNullableNumber(formState.spendThresholds.hardCapUsdMonthly),
      },
      failoverOrder: formState.failoverOrder.filter(Boolean),
      experimentationEnabled: formState.experimentationEnabled,
    });
  }

  const effectiveSummary = useMemo(() => {
    const selectedProvider = formState.providerPreference === 'auto'
      ? 'Auto-select the best provider per policy lane'
      : formState.providerPreference === 'anthropic'
        ? 'Prefer Anthropic for deliberate reasoning-heavy work'
        : formState.providerPreference === 'openai'
          ? 'Prefer OpenAI for premium multimodal and structured lanes'
          : 'Prefer Gemini for fast or budget-sensitive execution';
    const reasoningSummary = formState.reasoningTier === 'auto'
      ? 'Let policy routing choose the right reasoning depth'
      : formState.reasoningTier === 'high'
        ? 'Bias toward deeper reasoning and higher quality passes'
        : formState.reasoningTier === 'cost_saver'
          ? 'Bias toward lower-cost execution where possible'
          : 'Keep a balanced quality and latency posture';
    const fastLaneSummary = formState.fastLane === 'auto'
      ? 'No explicit fast-lane pinning'
      : formState.fastLane === 'anthropic_fast'
        ? 'Route fast chat toward Anthropic fast models'
        : formState.fastLane === 'openai_router'
          ? 'Route fast chat toward the OpenAI router lane'
          : 'Route fast chat toward Gemini Flash';
    const budgetSummary = formState.budgetCap.maxCostUsdPerRun || formState.budgetCap.maxOutputTokensPerRun
      ? `Cap runs at ${formState.budgetCap.maxCostUsdPerRun || 'no $ cap'} USD and ${formState.budgetCap.maxOutputTokensPerRun || 'no token cap'} tokens.`
      : formState.spendThresholds.warnUsdMonthly || formState.spendThresholds.hardCapUsdMonthly
        ? `Track monthly warning at ${formState.spendThresholds.warnUsdMonthly || 'n/a'} USD and hard cap at ${formState.spendThresholds.hardCapUsdMonthly || 'n/a'} USD.`
        : 'No budget caps or spend thresholds configured.';

    return [
      { label: 'Provider strategy', value: selectedProvider, accent: '#7CFFCB' },
      { label: 'Reasoning posture', value: reasoningSummary, accent: '#BDB4FE' },
      { label: 'Fast lane', value: fastLaneSummary, accent: '#7DD3FC' },
      { label: 'Budget guardrails', value: budgetSummary, accent: '#F9A8D4' },
    ];
  }, [formState]);

  const hasDraftOverrides = useMemo(
    () => formState.providerPreference !== 'auto'
      || formState.reasoningTier !== 'auto'
      || formState.fastLane !== 'auto'
      || formState.experimentationEnabled
      || formState.failoverOrder.some(Boolean)
      || formState.budgetCap.maxCostUsdPerRun !== ''
      || formState.budgetCap.maxOutputTokensPerRun !== ''
      || formState.spendThresholds.warnUsdMonthly !== ''
      || formState.spendThresholds.hardCapUsdMonthly !== '',
    [formState],
  );

  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Organisation detail" accent="#00FFD1">
        <div style={{ display: 'grid', gap: '12px' }}>
          {orgRows.map(([label, value]) => (
            <div
              key={label}
              style={createLabeledRowStyle()}
            >
              <div style={FORM_LABEL_STYLE}>
                {label}
              </div>
              <div>{value}</div>
            </div>
          ))}
        </div>
      </SurfaceCard>

      <SurfaceCard title="AI routing controls" accent="#BDB4FE">
        <InlineNotice tone={canManageControls ? 'default' : 'warning'}>
          {canManageControls
            ? 'These controls tune how Prymal prefers providers, fast lanes, budgets, and failover order for this workspace.'
            : 'Only owners and admins can change organisation-level AI routing controls.'}
        </InlineNotice>

        {controlsQuery.error ? (
          <InlineNotice tone="danger">{getErrorMessage(controlsQuery.error)}</InlineNotice>
        ) : null}

        <div style={{ display: 'grid', gap: '14px', marginTop: '14px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            {effectiveSummary.map((item) => (
              <div
                key={item.label}
                style={createGlassPanelStyle({
                  accent: item.accent,
                  gap: '8px',
                  minHeight: '132px',
                })}
              >
                <div style={FORM_LABEL_STYLE}>{item.label}</div>
                <div style={{ color: 'var(--text-strong)', fontWeight: 600, lineHeight: 1.5 }}>{item.value}</div>
              </div>
            ))}
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <SectionLabel>Provider roles</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
              {providerGuidance.map((provider) => (
                <div
                  key={provider.key}
                  style={createGlassPanelStyle({
                    accent: provider.accent,
                    gap: '8px',
                    minHeight: '164px',
                  })}
                >
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: '10px' }}>
                    <div style={{ color: 'var(--text-strong)', fontWeight: 700 }}>{provider.title}</div>
                    <StatusPill color={provider.accent}>
                      {formState.providerPreference === provider.key ? 'Preferred' : 'Available'}
                    </StatusPill>
                  </div>
                  <div style={{ color: 'var(--text-strong)', lineHeight: 1.55 }}>{provider.role}</div>
                  <div style={MUTED_COPY_STYLE}>{provider.helper}</div>
                </div>
              ))}
            </div>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={FORM_LABEL_STYLE}>Provider preference</span>
              <select
                value={formState.providerPreference}
                onChange={(event) => setFormState((current) => ({ ...current, providerPreference: event.target.value }))}
                style={selectStyle}
                disabled={!canManageControls || controlsQuery.isLoading}
              >
                <option value="auto">Auto</option>
                <option value="anthropic">Anthropic first</option>
                <option value="openai">OpenAI first</option>
                <option value="google">Gemini first</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={FORM_LABEL_STYLE}>Reasoning tier</span>
              <select
                value={formState.reasoningTier}
                onChange={(event) => setFormState((current) => ({ ...current, reasoningTier: event.target.value }))}
                style={selectStyle}
                disabled={!canManageControls || controlsQuery.isLoading}
              >
                <option value="auto">Auto</option>
                <option value="balanced">Balanced</option>
                <option value="high">High reasoning</option>
                <option value="cost_saver">Cost saver</option>
              </select>
            </label>

            <label style={{ display: 'grid', gap: '6px' }}>
              <span style={FORM_LABEL_STYLE}>Fast lane</span>
              <select
                value={formState.fastLane}
                onChange={(event) => setFormState((current) => ({ ...current, fastLane: event.target.value }))}
                style={selectStyle}
                disabled={!canManageControls || controlsQuery.isLoading}
              >
                <option value="auto">Auto</option>
                <option value="anthropic_fast">Anthropic fast</option>
                <option value="openai_router">OpenAI router</option>
                <option value="gemini_flash">Gemini flash</option>
              </select>
            </label>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: '12px' }}>
            <TextInput
              value={String(formState.budgetCap.maxCostUsdPerRun)}
              onChange={(event) => setFormState((current) => ({
                ...current,
                budgetCap: { ...current.budgetCap, maxCostUsdPerRun: event.target.value },
              }))}
              placeholder="Max cost per run (USD)"
              disabled={!canManageControls || controlsQuery.isLoading}
            />
            <TextInput
              value={String(formState.budgetCap.maxOutputTokensPerRun)}
              onChange={(event) => setFormState((current) => ({
                ...current,
                budgetCap: { ...current.budgetCap, maxOutputTokensPerRun: event.target.value },
              }))}
              placeholder="Max output tokens per run"
              disabled={!canManageControls || controlsQuery.isLoading}
            />
            <TextInput
              value={String(formState.spendThresholds.warnUsdMonthly)}
              onChange={(event) => setFormState((current) => ({
                ...current,
                spendThresholds: { ...current.spendThresholds, warnUsdMonthly: event.target.value },
              }))}
              placeholder="Monthly warning threshold (USD)"
              disabled={!canManageControls || controlsQuery.isLoading}
            />
            <TextInput
              value={String(formState.spendThresholds.hardCapUsdMonthly)}
              onChange={(event) => setFormState((current) => ({
                ...current,
                spendThresholds: { ...current.spendThresholds, hardCapUsdMonthly: event.target.value },
              }))}
              placeholder="Monthly hard cap (USD)"
              disabled={!canManageControls || controlsQuery.isLoading}
            />
          </div>

          <div style={{ display: 'grid', gap: '10px' }}>
            <SectionLabel>Failover order</SectionLabel>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(180px, 1fr))', gap: '12px' }}>
              {[0, 1, 2].map((index) => (
                <label key={index} style={{ display: 'grid', gap: '6px' }}>
                  <span style={MUTED_COPY_STYLE}>Fallback {index + 1}</span>
                  <select
                    value={formState.failoverOrder[index]}
                    onChange={(event) => updateFailover(index, event.target.value)}
                    style={selectStyle}
                    disabled={!canManageControls || controlsQuery.isLoading}
                  >
                    <option value="">None</option>
                    <option value="anthropic">Anthropic</option>
                    <option value="openai">OpenAI</option>
                    <option value="google">Gemini</option>
                  </select>
                </label>
              ))}
            </div>
          </div>

          <label style={{ display: 'flex', gap: '10px', alignItems: 'center', color: 'var(--muted)', lineHeight: 1.5 }}>
            <input
              type="checkbox"
              checked={formState.experimentationEnabled}
              onChange={(event) => setFormState((current) => ({ ...current, experimentationEnabled: event.target.checked }))}
              disabled={!canManageControls || controlsQuery.isLoading}
            />
            Enable experimentation tracking for routing comparisons
          </label>

          <InlineNotice tone={hasDraftOverrides ? 'success' : 'default'}>
            {hasDraftOverrides
              ? 'This draft will change default routing posture for the whole organisation. Policy abstractions still stay in control, but the preferred provider, fast lane, failover order, and budget guardrails will bias execution.'
              : 'No explicit routing overrides are active in the current draft. Prymal will continue selecting providers automatically from policy and runtime context.'}
          </InlineNotice>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            <Button
              tone="accent"
              onClick={saveControls}
              disabled={!canManageControls || controlsQuery.isLoading || updateMutation.isPending}
            >
              {updateMutation.isPending ? 'Saving...' : 'Save AI controls'}
            </Button>
            <Button
              tone="ghost"
              onClick={() => setFormState(defaultControls)}
              disabled={!canManageControls || controlsQuery.isLoading || updateMutation.isPending}
            >
              Reset draft
            </Button>
          </div>
        </div>
      </SurfaceCard>
    </div>
  );
}

function parseNullableNumber(value) {
  if (value === '' || value == null) {
    return null;
  }

  const number = Number(value);
  return Number.isFinite(number) && number > 0 ? number : null;
}

function parseNullableInteger(value) {
  if (value === '' || value == null) {
    return null;
  }

  const number = Number(value);
  return Number.isInteger(number) && number > 0 ? number : null;
}

export function MemorySettingsTab({
  memoryQuery,
  filteredMemory,
  memoryAgentFilter,
  setMemoryAgentFilter,
  memorySortKey,
  setMemorySortKey,
  memoryAgentOptions,
  deleteMemoryMutation,
}) {
  return (
    <div style={{ display: 'grid', gap: '14px' }}>
      <SurfaceCard title="Agent memory" accent="#C77DFF">
        <p style={{ margin: '0 0 16px', color: 'var(--muted)', lineHeight: 1.7 }}>
          Prymal agents remember facts and preferences extracted from your conversations. You can delete any entry to remove it from future sessions.
        </p>

        <div style={{ display: 'flex', gap: '8px', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap' }}>
          <select
            value={memoryAgentFilter}
            onChange={(event) => setMemoryAgentFilter(event.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none' }}
          >
            {memoryAgentOptions.map((id) => (
              <option key={id} value={id}>
                {id === 'all' ? 'All agents' : id}
              </option>
            ))}
          </select>
          <select
            value={memorySortKey}
            onChange={(event) => setMemorySortKey(event.target.value)}
            style={{ padding: '6px 10px', borderRadius: '8px', border: '1px solid var(--line)', background: 'var(--panel)', color: 'var(--text-strong)', fontSize: '13px', outline: 'none' }}
          >
            <option value="recency">Sort: recent</option>
            <option value="confidence">Sort: confidence</option>
            <option value="usage">Sort: usage</option>
          </select>
          <span style={{ fontSize: '12px', color: 'var(--muted)', marginLeft: 'auto' }}>
            {filteredMemory.length} entr{filteredMemory.length === 1 ? 'y' : 'ies'}
          </span>
        </div>

        {memoryQuery.isLoading ? (
          <div style={{ color: 'var(--muted)', padding: '16px 0' }}>Loading memory entries...</div>
        ) : filteredMemory.length === 0 ? (
          <div style={{ color: 'var(--muted)', padding: '16px 0' }}>
            {(memoryQuery.data?.memory ?? []).length === 0
              ? 'No memory entries yet. Agents learn from your conversations over time.'
              : 'No entries match the current filter.'}
          </div>
        ) : (
          <div style={{ display: 'grid', gap: '8px' }}>
            {filteredMemory.map((entry) => {
              const confidencePct = Math.round(Math.max(Math.min(Number(entry.confidence ?? 0.5), 1), 0) * 100);
              const confColor = confidencePct >= 85 ? '#18c7a0' : confidencePct >= 60 ? '#F59E0B' : '#EF4444';
              const provMeta = PROVENANCE_META[entry.provenanceKind] ?? PROVENANCE_META.inferred;
              const hasConflict = Boolean(entry.metadata?.conflict);
              const previousValue = entry.metadata?.previousValue;
              const lastSeen = entry.lastUsedAt ?? entry.updatedAt;
              const ageDays = lastSeen
                ? Math.max((Date.now() - new Date(lastSeen).getTime()) / (1000 * 60 * 60 * 24), 0)
                : null;
              const ageLabel = ageDays == null
                ? null
                : ageDays < 1
                  ? 'Used today'
                  : ageDays < 7
                    ? `Used ${Math.round(ageDays)}d ago`
                    : ageDays < 30
                      ? `Used ${Math.round(ageDays / 7)}w ago`
                      : `Used ${Math.round(ageDays / 30)}mo ago`;

              return (
                <div
                  key={entry.id}
                  style={{
                    padding: '12px 16px',
                    borderRadius: '14px',
                    border: `1px solid ${hasConflict ? '#F59E0B44' : 'var(--line)'}`,
                    background: hasConflict ? 'rgba(245,158,11,0.04)' : 'var(--panel-soft)',
                  }}
                >
                  <div style={{ display: 'flex', gap: '12px', alignItems: 'flex-start' }}>
                    <div style={{ flex: 1, minWidth: 0 }}>
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center', marginBottom: '6px', flexWrap: 'wrap' }}>
                        <SectionLabel>{entry.agentId}</SectionLabel>
                        <span style={chipStyle}>{entry.scope}</span>
                        <span style={chipStyle}>{entry.memoryType}</span>
                        <span
                          style={{
                            ...chipStyle,
                            background: `${provMeta.color}18`,
                            color: provMeta.color,
                            borderColor: `${provMeta.color}40`,
                          }}
                        >
                          {provMeta.label}
                        </span>
                        {(entry.version ?? 1) > 1 ? <span style={chipStyle}>v{entry.version}</span> : null}
                        {(entry.usageCount ?? 0) > 0 ? (
                          <span style={{ ...chipStyle, color: 'var(--muted)' }}>
                            {entry.usageCount}x used
                          </span>
                        ) : null}
                        {hasConflict ? (
                          <span style={{ ...chipStyle, background: '#F59E0B18', color: '#F59E0B', borderColor: '#F59E0B40' }}>
                            conflict
                          </span>
                        ) : null}
                      </div>

                      <div style={{ fontWeight: 600, color: 'var(--text-strong)', marginBottom: '2px' }}>{entry.key}</div>
                      <div style={{ color: 'var(--muted)', fontSize: '0.875rem', marginBottom: '8px' }}>{entry.value}</div>

                      {hasConflict && previousValue ? (
                        <div style={{ fontSize: '12px', color: '#F59E0B', marginBottom: '8px', fontStyle: 'italic' }}>
                          Previously: {previousValue}
                        </div>
                      ) : null}

                      <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span style={{ fontSize: '10px', color: 'var(--muted)', whiteSpace: 'nowrap' }}>
                          Confidence {confidencePct}%
                        </span>
                        <div style={{ flex: 1, height: '3px', borderRadius: '2px', background: 'var(--line)', overflow: 'hidden', maxWidth: '120px' }}>
                          <div style={{ width: `${confidencePct}%`, height: '100%', background: confColor, borderRadius: '2px' }} />
                        </div>
                        {ageLabel ? (
                          <span style={{ fontSize: '11px', color: 'var(--muted)', marginLeft: '8px' }}>{ageLabel}</span>
                        ) : null}
                      </div>
                    </div>

                    <Button
                      tone="ghost"
                      onClick={() => deleteMemoryMutation.mutate(entry.id)}
                      disabled={deleteMemoryMutation.isPending}
                    >
                      Delete
                    </Button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </SurfaceCard>
    </div>
  );
}
