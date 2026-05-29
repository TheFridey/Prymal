import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { getRecommendedAgentsForWorkspaceProfile } from '../lib/constants';
import { FIRST_RUN_OUTCOMES } from '../lib/first-run-outcomes';
import { trackFirstWinSelected, trackOnboardingStarted } from '../lib/analytics';
import { getRecommendedWorkflowTemplateForProfile } from '../lib/workflow-templates';
import { getErrorMessage } from '../lib/utils';
import { BrandMark, InlineNotice, TextInput, ThemeToggle } from '../components/ui';
import { usePrymalReducedMotion } from '../components/motion';
import { useAppStore } from '../stores/useAppStore';
import { MagicalCanvas } from '../features/marketing/MagicalCanvas';
import { SimpleAdvancedModeSection } from '../features/marketing/SimpleAdvancedModeSection';
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

function readStoredStartIntent() {
  if (typeof window === 'undefined') return {};
  try {
    return {
      intent: window.sessionStorage.getItem('prymal_start_intent') || '',
      redirect: window.sessionStorage.getItem('prymal_start_redirect') || '',
    };
  } catch {
    return {};
  }
}

function resolveStartIntent({ searchParams, stored }) {
  const rawIntent = searchParams.get('intent')?.trim() || stored.intent || '';
  const startMode = rawIntent === 'advanced' ? 'advanced' : 'simple';
  const rawRedirect = searchParams.get('redirect_url')?.trim() || stored.redirect || '';
  const fallback = startMode === 'advanced' ? '/app/workflows' : '/app/dashboard?intent=simple';
  const redirect = ['/app/workflows', '/app/dashboard', '/app/dashboard?intent=simple'].includes(rawRedirect)
    ? rawRedirect
    : fallback;

  return { startMode, redirect };
}

export default function Onboarding() {
  const [searchParams] = useSearchParams();
  const inviteToken = searchParams.get('invite')?.trim() || '';
  const urlRef = searchParams.get('ref')?.trim() || '';
  const storedRef = sessionStorage.getItem('prymal_referral') || '';
  const referralCode = urlRef || storedRef;
  const storedStart = readStoredStartIntent();
  const initialStart = resolveStartIntent({ searchParams, stored: storedStart });
  const totalSteps = 2;
  const [step, setStep] = useState(inviteToken ? 2 : 1);
  const [orgName, setOrgName] = useState('');
  const [businessType, setBusinessType] = useState(BUSINESS_TYPE_OPTIONS[0]);
  const [primaryGoal, setPrimaryGoal] = useState(PRIMARY_GOALS[0]);
  const [workspaceFocus, setWorkspaceFocus] = useState('agency');
  const [startMode, setStartMode] = useState(initialStart.startMode);
  const [firstRunOutcomeId, setFirstRunOutcomeId] = useState('create_content');
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
    return getRecommendedWorkflowTemplateForProfile({ primaryGoal, workspaceFocus });
  }, [primaryGoal, workspaceFocus]);

  const recommendedFirstAgentId = recommendedAgents[0]?.id ?? 'cipher';
  const canContinueStepOne = inviteToken || orgName.trim().length >= 2;
  const progressPercent = Math.round((step / totalSteps) * 100);

  useEffect(() => {
    trackOnboardingStarted({ surface: 'onboarding', step: inviteToken ? 2 : 1 });
  }, [inviteToken]);

  const onboardMutation = useMutation({
    mutationFn: (payload) => api.post('/auth/onboard', payload),
    onSuccess: async (result) => {
      sessionStorage.removeItem('prymal_referral');
      sessionStorage.removeItem('prymal_start_intent');
      sessionStorage.removeItem('prymal_start_redirect');
      await queryClient.invalidateQueries({ queryKey: ['viewer'] });
      const selectedOutcome = FIRST_RUN_OUTCOMES.find((outcome) => outcome.id === firstRunOutcomeId) ?? FIRST_RUN_OUTCOMES[0];
      trackFirstWinSelected({
        outcome_id: selectedOutcome.id,
        recommended_agent_id: selectedOutcome.recommendedAgentId,
        surface: 'onboarding_complete',
      });
      notify({
        type: 'success',
        title: inviteToken ? 'Workspace joined' : 'Workspace ready',
        message: inviteToken
          ? 'Your seat has been activated and your first recommended agent is ready.'
          : 'Prymal created your workspace and queued the fastest first-win path.',
      });
      const destination = startMode === initialStart.startMode
        ? initialStart.redirect
        : startMode === 'advanced'
          ? '/app/workflows'
          : '/app/dashboard?intent=simple';
      navigate(destination, {
        replace: true,
        state: {
          onboardingResult: result,
          onboardingWorkspaceProfile: workspaceProfile,
          onboardingStartMode: startMode,
          onboardingStartPaths:
            startMode === 'advanced'
              ? ['workflow-builder', 'lore-setup', 'integrations', 'agent-selection']
              : ['content-builder', 'website-audit', 'lead-generation', 'first-agent-chat'],
          recommendedAgentIds: recommendedAgents.map((agent) => agent.id),
          recommendedFirstAgentId,
          recommendedWorkflowName: recommendedWorkflow?.name ?? 'Weekly Client Report',
          firstRunOutcomeId: selectedOutcome.id,
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
                  <TextInput
                    value={orgName}
                    onChange={(event) => setOrgName(event.target.value)}
                    placeholder="Prymal Labs"
                    maxLength={80}
                    data-testid="onboarding-org-name"
                  />
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
                <button className="pm-btn pm-btn--primary" disabled={!canContinueStepOne} onClick={() => setStep(2)} type="button" data-testid="onboarding-next">
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

              <div className="pm-onboarding__summary">
                <div>
                  <div className="pm-onboarding__summary-title">What do you want to do first?</div>
                  <div className="pm-onboarding__summary-body">
                    Pick the outcome. Prymal will choose the specialist and guided prompt after setup.
                  </div>
                </div>
                <div style={{ display: 'grid', gap: '10px' }}>
                  {FIRST_RUN_OUTCOMES.map((outcome) => (
                    <button
                      key={outcome.id}
                      type="button"
                      onClick={() => {
                        setFirstRunOutcomeId(outcome.id);
                        trackFirstWinSelected({
                          outcome_id: outcome.id,
                          recommended_agent_id: outcome.recommendedAgentId,
                          surface: 'onboarding_picker',
                        });
                      }}
                      className={`pm-onboarding__option${firstRunOutcomeId === outcome.id ? ' pm-onboarding__option--selected' : ''}`}
                    >
                      <div className="pm-onboarding__option-label">{outcome.title}</div>
                      <div className="pm-onboarding__option-desc">
                        {outcome.plainOutcome} Recommended: {outcome.recommendedAgentId.toUpperCase()} | {outcome.creditIntensity} cost | {outcome.timeToResult}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              <InlineNotice tone="default">
                Nothing else blocks this path. Integrations, LORE uploads, and workflow setup can all happen after your first conversation is already underway.
              </InlineNotice>

              <SimpleAdvancedModeSection
                variant="compact"
                surface="onboarding"
                selectedMode={startMode}
                onModeChange={setStartMode}
              />

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
                <div style={{ fontSize: '16px', marginBottom: '6px', color: '#fff', fontWeight: 700 }}>{recommendedWorkflow?.name ?? 'Weekly Client Report'}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', lineHeight: 1.7 }}>{recommendedWorkflow?.description ?? 'A default workflow blueprint will be suggested from your first-win goal.'}</div>
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
                  data-testid="onboarding-submit"
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

