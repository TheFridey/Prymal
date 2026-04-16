import { useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getRecommendedAgentsForWorkspaceProfile, WORKFLOW_TEMPLATES } from '../lib/constants';
import { getErrorMessage } from '../lib/utils';
import { BrandMark, Button, InlineNotice, TextInput, ThemeToggle } from '../components/ui';
import { usePrymalReducedMotion } from '../components/motion';
import { useAppStore } from '../stores/useAppStore';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import '../styles/landing-rebuild.css';

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

  const reducedMotion = usePrymalReducedMotion();

  return (
    <div className="pm-page">
      <MagicalCanvas reducedMotion={reducedMotion} />
      <div className="pm-onboarding">
        <div className="pm-onboarding__card">
          <div style={{ display: 'flex', justifyContent: 'space-between', gap: '14px', alignItems: 'center', marginBottom: '18px', flexWrap: 'wrap' }}>
            <BrandMark />
            <ThemeToggle />
          </div>

          <div className="pm-onboarding__header">
            <div className="pm-page-header__eyebrow" style={{ display: 'inline-flex' }}>
              <span className="pm-hero__badge-dot" />
              {inviteToken ? 'Accept invitation' : 'First-win onboarding'}
            </div>
            <h1 className="pm-onboarding__title">
              {inviteToken
                ? 'Join the Prymal workspace and start with the right agent.'
                : 'Get from signup to your first useful AI output in minutes.'}
            </h1>
            <p className="pm-onboarding__sub">
              This flow is intentionally short: define the workspace, pick the business outcome that matters most, and Prymal
              will route you straight to the agent most likely to deliver value first.
            </p>
          </div>

          <div className="pm-onboarding__progress" aria-hidden="true">
            <span className="pm-onboarding__progress-bar" style={{ width: `${progressPercent}%` }} />
          </div>

          <div className="pm-onboarding__steps">
            {[
              { id: 1, label: 'Workspace' },
              { id: 2, label: 'First win' },
            ].map((stepEntry) => (
              <div
                key={stepEntry.id}
                className={`pm-onboarding__step-pill${step >= stepEntry.id ? ' pm-onboarding__step-pill--active' : ''}`}
              >
                Step {stepEntry.id} | {stepEntry.label}
              </div>
            ))}
          </div>

          {step === 1 ? (
            <div style={{ display: 'grid', gap: '16px' }}>
              {inviteToken ? (
                <InlineNotice tone="success">
                  Prymal detected an invitation link. Review the workspace shape below, then move straight into the first-win step.
                </InlineNotice>
              ) : null}

              {!inviteToken ? (
                <label style={{ display: 'grid', gap: '8px' }}>
                  <span className="pm-onboarding__summary-title">Organisation name</span>
                  <TextInput value={orgName} onChange={(event) => setOrgName(event.target.value)} placeholder="Prymal Labs" maxLength={80} />
                </label>
              ) : null}

              <div style={{ display: 'grid', gap: '10px' }}>
                <span className="pm-onboarding__summary-title">Workspace type</span>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {WORKSPACE_OPTIONS.map((option) => (
                    <button
                      key={option.id}
                      type="button"
                      onClick={() => setWorkspaceFocus(option.id)}
                      className={`pm-onboarding__option${workspaceFocus === option.id ? ' pm-onboarding__option--selected' : ''}`}
                    >
                      <div className="pm-onboarding__option-label">{option.label}</div>
                      <div className="pm-onboarding__option-desc">{option.description}</div>
                    </button>
                  ))}
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                <button className="pm-btn pm-btn--primary" disabled={!canContinueStepOne} onClick={() => setStep(2)} type="button">
                  Continue to first win →
                </button>
              </div>
            </div>
          ) : null}

          {step === 2 ? (
            <div style={{ display: 'grid', gap: '16px' }}>
              <div style={{ display: 'grid', gap: '8px' }}>
                <span className="pm-onboarding__summary-title">Business type</span>
                <select value={businessType} onChange={(event) => setBusinessType(event.target.value)} className="pm-onboarding__select">
                  {BUSINESS_TYPE_OPTIONS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <div style={{ display: 'grid', gap: '8px' }}>
                <span className="pm-onboarding__summary-title">Primary goal</span>
                <select value={primaryGoal} onChange={(event) => setPrimaryGoal(event.target.value)} className="pm-onboarding__select">
                  {PRIMARY_GOALS.map((option) => (
                    <option key={option} value={option}>{option}</option>
                  ))}
                </select>
              </div>

              <InlineNotice tone="default">
                Nothing else blocks this path. Integrations, LORE uploads, and workflow setup can all happen after your first conversation is already underway.
              </InlineNotice>

              <div className="pm-onboarding__summary">
                <div>
                  <div className="pm-onboarding__summary-title">Recommended first agents</div>
                  <div className="pm-onboarding__summary-body">
                    Based on your answers, {recommendedAgents[0]?.name ?? 'CIPHER'} should get you to a useful output fastest.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {recommendedAgents.map((agent) => (
                    <div key={agent.id} className="pm-card" style={{ padding: '14px 16px' }}>
                      <div style={{ fontSize: '14px', marginBottom: '4px', color: '#fff', fontWeight: 600 }}>{agent.name}</div>
                      <div style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.6, fontSize: '13px' }}>{agent.description}</div>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pm-onboarding__summary">
                <div>
                  <div className="pm-onboarding__summary-title">Suggested workflow after the first chat</div>
                  <div className="pm-onboarding__summary-body">This step is intentionally deferred. Land the first output first, then turn it into a repeatable workflow.</div>
                </div>
                <div style={{ fontSize: '16px', marginBottom: '6px', color: '#fff', fontWeight: 700 }}>{recommendedWorkflow.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{recommendedWorkflow.description}</div>
              </div>

              <InlineNotice tone="success">
                After setup, Prymal will drop you directly into the dashboard with {recommendedAgents[0]?.name ?? 'CIPHER'} highlighted as the recommended first agent.
              </InlineNotice>

              <div style={{ display: 'flex', gap: '10px', flexWrap: 'wrap' }}>
                {!inviteToken ? <button className="pm-btn pm-btn--ghost" onClick={() => setStep(1)} type="button">Back</button> : null}
                <button
                  className="pm-btn pm-btn--primary"
                  disabled={onboardMutation.isPending}
                  type="button"
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
                    ? inviteToken ? 'Joining workspace' : 'Creating workspace'
                    : inviteToken
                      ? `Join workspace and open ${recommendedAgents[0]?.name ?? 'Prymal'}`
                      : `Create workspace and open ${recommendedAgents[0]?.name ?? 'Prymal'}`}
                </button>
              </div>
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}

