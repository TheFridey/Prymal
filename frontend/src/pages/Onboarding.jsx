import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getRecommendedAgentsForWorkspaceProfile, WORKFLOW_TEMPLATES } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';
import { BrandMark, Button, InlineNotice, TextInput, ThemeToggle } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

const WORKSPACE_OPTIONS = [
  {
    id: 'agency',
    label: 'Agency',
    description: 'Client delivery, reporting, proposals, and multi-seat collaboration.',
  },
  {
    id: 'owner_led',
    label: 'Owner-led business',
    description: 'A founder or operator using Prymal as a high-leverage operating layer.',
  },
  {
    id: 'service_business',
    label: 'Service business',
    description: 'Operations, lead flow, support, and delivery systems in one workspace.',
  },
  {
    id: 'other',
    label: 'Other',
    description: 'A custom operating model with mixed workflows.',
  },
];

const BUSINESS_TYPE_OPTIONS = [
  'Marketing agency',
  'Creative studio',
  'Consultancy',
  'Recruitment',
  'Legal / professional services',
  'Operational services',
  'SaaS',
];

const PRIMARY_GOALS = [
  'Win and progress more leads',
  'Ship content faster',
  'Run weekly reporting',
  'Handle support and client comms',
  'Centralise knowledge and SOPs',
  'Build repeatable workflows',
];

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite')?.trim() || '';
  const urlRef = searchParams.get('ref')?.trim() || '';
  const storedRef = sessionStorage.getItem('prymal_referral') || '';
  const referralCode = urlRef || storedRef;
  const totalSteps = 2;
  const [step, setStep] = useState(inviteToken ? 2 : 1);
  const [orgName, setOrgName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_OPTIONS[0]);
  const [primaryGoal, setPrimaryGoal] = useState(PRIMARY_GOALS[0]);
  const [workspaceFocus, setWorkspaceFocus] = useState('agency');
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);

  const workspaceProfile = useMemo(
    () => ({
      workspaceFocus,
      businessType,
      primaryGoal,
    }),
    [businessType, primaryGoal, workspaceFocus],
  );

  const recommendedAgents = useMemo(
    () => getRecommendedAgentsForWorkspaceProfile(workspaceProfile).slice(0, 3),
    [workspaceProfile],
  );

  const recommendedWorkflow = useMemo(() => {
    if (primaryGoal.toLowerCase().includes('support')) {
      return WORKFLOW_TEMPLATES[0];
    }

    if (primaryGoal.toLowerCase().includes('report') || primaryGoal.toLowerCase().includes('data')) {
      return WORKFLOW_TEMPLATES[2];
    }

    return workspaceFocus === 'agency' ? WORKFLOW_TEMPLATES[1] : WORKFLOW_TEMPLATES[0];
  }, [primaryGoal, workspaceFocus]);

  const recommendedFirstAgentId = recommendedAgents[0]?.id ?? 'cipher';
  const canContinueStepOne = inviteToken || orgName.trim().length >= 2;
  const progressPercent = Math.round((step / totalSteps) * 100);

  const onboardMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/onboard', payload),
    onSuccess: async (result) => {
      sessionStorage.removeItem('prymal_referral');
      await queryClient.invalidateQueries({ queryKey: ['viewer'] });
      notify({
        type: 'success',
        title: inviteToken ? 'Workspace joined' : 'Workspace ready',
        message: inviteToken
          ? 'Your seat has been activated and your first recommended agent is ready.'
          : 'Prymal created your workspace and queued the fastest first-win path.',
      });
      navigate('/app/dashboard', {
        replace: true,
        state: {
          onboardingResult: result,
          onboardingWorkspaceProfile: workspaceProfile,
          recommendedAgentIds: recommendedAgents.map((agent) => agent.id),
          recommendedFirstAgentId,
          recommendedWorkflowName: recommendedWorkflow.name,
        },
      });
    },
    onError: (error) => {
      notify({
        type: 'error',
        title: 'Setup failed',
        message: getErrorMessage(error, 'Could not finish workspace onboarding.'),
      });
    },
  });

  return (
    <div className="auth-screen">
      <div className="setup-card" style={{ maxWidth: '920px' }}>
        <div
          style={{
            display: 'flex',
            justifyContent: 'space-between',
            gap: '14px',
            alignItems: 'center',
            marginBottom: '18px',
            flexWrap: 'wrap',
          }}
        >
          <BrandMark />
          <ThemeToggle />
        </div>

        <div className="setup-screen__header">
          <div className="eyebrow" style={{ '--eyebrow-accent': 'var(--accent)' }}>
            {inviteToken ? 'Accept invitation' : 'First-win onboarding'}
          </div>
          <h1 className="setup-screen__title">
            {inviteToken
              ? 'Join the Prymal workspace and start with the right agent.'
              : 'Get from signup to your first useful AI output in minutes.'}
          </h1>
          <p className="setup-screen__copy">
            This flow is intentionally short: define the workspace, pick the business outcome that matters most, and Prymal
            will route you straight to the agent most likely to deliver value first.
          </p>
        </div>

        <div style={{ display: 'grid', gap: '12px', marginBottom: '18px' }}>
          <div
            aria-hidden="true"
            style={{
              position: 'relative',
              width: '100%',
              height: '10px',
              borderRadius: '999px',
              border: '1px solid var(--line)',
              background: 'rgba(255,255,255,0.06)',
              overflow: 'hidden',
            }}
          >
            <span
              style={{
                display: 'block',
                width: `${progressPercent}%`,
                height: '100%',
                borderRadius: 'inherit',
                background: 'linear-gradient(135deg, var(--accent), var(--accent-2), var(--accent-3))',
              }}
            />
          </div>

          <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
            {[
              { id: 1, label: 'Workspace' },
              { id: 2, label: 'First win' },
            ].map((stepEntry) => (
              <div
                key={stepEntry.id}
                style={{
                  padding: '10px 14px',
                  borderRadius: '999px',
                  border: '1px solid var(--line)',
                  background: step >= stepEntry.id ? 'var(--panel-soft)' : 'transparent',
                  color: step >= stepEntry.id ? 'var(--text-strong)' : 'var(--muted)',
                  fontSize: '12px',
                  letterSpacing: '0.16em',
                  textTransform: 'uppercase',
                }}
              >
                Step {stepEntry.id} | {stepEntry.label}
              </div>
            ))}
          </div>
        </div>

        {step === 1 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            {inviteToken ? (
              <InlineNotice tone="success">
                Prymal detected an invitation link. Review the workspace shape below, then move straight into the first-win
                step.
              </InlineNotice>
            ) : null}

            {!inviteToken ? (
              <label style={{ display: 'grid', gap: '8px' }}>
                <span className="section-label" style={{ marginBottom: 0 }}>Organisation name</span>
                <TextInput
                  value={orgName}
                  onChange={(event) => setOrgName(event.target.value)}
                  placeholder="Prymal Labs"
                  maxLength={80}
                />
              </label>
            ) : null}

            <div style={{ display: 'grid', gap: '10px' }}>
              <span className="section-label" style={{ marginBottom: 0 }}>Workspace type</span>
              <div style={{ display: 'grid', gap: '10px' }}>
                {WORKSPACE_OPTIONS.map((option) => (
                  <button
                    key={option.id}
                    type="button"
                    onClick={() => setWorkspaceFocus(option.id)}
                    style={{
                      textAlign: 'left',
                      padding: '14px 16px',
                      borderRadius: '18px',
                      border: '1px solid var(--line)',
                      background: workspaceFocus === option.id ? 'var(--panel-soft)' : 'transparent',
                      color: 'var(--text-strong)',
                      cursor: 'pointer',
                    }}
                  >
                    <div style={{ marginBottom: '4px', fontSize: '15px' }}>{option.label}</div>
                    <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{option.description}</div>
                  </button>
                ))}
              </div>
            </div>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              <Button tone="accent" disabled={!canContinueStepOne} onClick={() => setStep(2)}>
                Continue to first win
              </Button>
            </div>
          </div>
        ) : null}

        {step === 2 ? (
          <div style={{ display: 'grid', gap: '16px' }}>
            <div style={{ display: 'grid', gap: '8px' }}>
              <span className="section-label" style={{ marginBottom: 0 }}>Business type</span>
              <select
                value={businessType}
                onChange={(event) => setBusinessType(event.target.value)}
                style={selectStyle}
              >
                {BUSINESS_TYPE_OPTIONS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <div style={{ display: 'grid', gap: '8px' }}>
              <span className="section-label" style={{ marginBottom: 0 }}>Primary goal</span>
              <select
                value={primaryGoal}
                onChange={(event) => setPrimaryGoal(event.target.value)}
                style={selectStyle}
              >
                {PRIMARY_GOALS.map((option) => (
                  <option key={option} value={option}>{option}</option>
                ))}
              </select>
            </div>

            <InlineNotice tone="default">
              Nothing else blocks this path. Integrations, LORE uploads, and workflow setup can all happen after your first
              conversation is already underway.
            </InlineNotice>

            <SurfaceSummary
              title="Recommended first agents"
              body={`Based on your answers, ${recommendedAgents[0]?.name ?? 'CIPHER'} should get you to a useful output fastest.`}
            >
              <div style={{ display: 'grid', gap: '10px' }}>
                {recommendedAgents.map((agent) => (
                  <div
                    key={agent.id}
                    style={{
                      padding: '12px 14px',
                      borderRadius: '18px',
                      border: '1px solid var(--line)',
                      background: 'var(--panel-soft)',
                    }}
                  >
                    <div style={{ fontSize: '14px', marginBottom: '4px', color: 'var(--text-strong)' }}>{agent.name}</div>
                    <div style={{ color: 'var(--muted)', lineHeight: 1.6 }}>{agent.description}</div>
                  </div>
                ))}
              </div>
            </SurfaceSummary>

            <SurfaceSummary
              title="Suggested workflow after the first chat"
              body="This step is intentionally deferred. Land the first output first, then turn it into a repeatable workflow."
            >
              <div style={{ fontSize: '16px', marginBottom: '6px', color: 'var(--text-strong)' }}>{recommendedWorkflow.name}</div>
              <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{recommendedWorkflow.description}</div>
            </SurfaceSummary>

            <InlineNotice tone="success">
              After setup, Prymal will drop you directly into the dashboard with {recommendedAgents[0]?.name ?? 'CIPHER'}
              highlighted as the recommended first agent.
            </InlineNotice>

            <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
              {!inviteToken ? <Button tone="ghost" onClick={() => setStep(1)}>Back</Button> : null}
              <Button
                tone="accent"
                disabled={onboardMutation.isPending}
                onClick={() =>
                  onboardMutation.mutate({
                    orgName: orgName.trim() || undefined,
                    businessType,
                    primaryGoal,
                    workspaceFocus,
                    inviteToken: inviteToken || undefined,
                    referralCode: referralCode || undefined,
                  })
                }
              >
                {onboardMutation.isPending
                  ? inviteToken
                    ? 'Joining workspace'
                    : 'Creating workspace'
                  : inviteToken
                    ? `Join workspace and open ${recommendedAgents[0]?.name ?? 'Prymal'}`
                    : `Create workspace and open ${recommendedAgents[0]?.name ?? 'Prymal'}`}
              </Button>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}

function SurfaceSummary({ title, body, children }) {
  return (
    <div
      style={{
        padding: '18px',
        borderRadius: '22px',
        border: '1px solid var(--line)',
        background: 'var(--panel-soft)',
        display: 'grid',
        gap: '12px',
      }}
    >
      <div>
        <div className="section-label" style={{ marginBottom: '6px' }}>{title}</div>
        <div style={{ color: 'var(--muted)', lineHeight: 1.7 }}>{body}</div>
      </div>
      {children}
    </div>
  );
}

const selectStyle = {
  width: '100%',
  padding: '14px 16px',
  borderRadius: '18px',
  border: '1px solid var(--line)',
  background: 'rgba(255,255,255,0.72)',
  color: 'var(--text-strong)',
  outline: 'none',
};
