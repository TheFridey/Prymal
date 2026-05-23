import { useEffect, useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { useLocation, useOutletContext } from 'react-router-dom';
import { PageShell } from '../components/ui';
import { MotionSection } from '../components/motion';
import { getRecommendedAgentsForWorkspaceProfile } from '../lib/constants';
import { api } from '../lib/api';
import '../styles/app-rebuild.css';
import {
  FIRST_RUN_OUTCOMES,
  FIRST_WIN_STATES,
  readFirstWinState,
  writeFirstWinState,
} from '../lib/first-run-outcomes';
import DashboardGreeting from '../features/dashboard/DashboardGreeting';
import DashboardQuickActions from '../features/dashboard/DashboardQuickActions';
import DashboardTimeSaved from '../features/dashboard/DashboardTimeSaved';
import DashboardContinueWork from '../features/dashboard/DashboardContinueWork';
import DashboardRecommendedNext from '../features/dashboard/DashboardRecommendedNext';
import DashboardCreditsChip from '../features/dashboard/DashboardCreditsChip';
import DashboardFirstWinStrip from '../features/dashboard/DashboardFirstWinStrip';
import { resolveDashboardRecommendation } from '../features/dashboard/dashboard-recommendations';
import { LearningSignalsSection, isLearningSignalsEmpty } from '../features/dashboard/LearningSignalsSection';

export { LearningSignalsSection, isLearningSignalsEmpty };

export default function Dashboard() {
  const { viewer } = useOutletContext();
  const location = useLocation();

  const workspaceProfile = location.state?.onboardingWorkspaceProfile ?? viewer?.organisation?.metadata ?? {};
  const recommendedFirstAgentId =
    location.state?.recommendedFirstAgentId
    ?? getRecommendedAgentsForWorkspaceProfile(workspaceProfile)[0]?.id
    ?? 'cipher';

  const conversationCount = Number(viewer?.stats?.conversationCount ?? 0);
  const currentPlan = viewer?.organisation?.plan ?? 'free';
  const orgName = viewer?.organisation?.name ?? 'your workspace';
  const userId = viewer?.user?.id ?? 'local';

  const conversationsQuery = useQuery({
    queryKey: ['dashboard-recent-conversations'],
    queryFn: () => api.get('/agents/conversations?limit=6'),
  });

  const workflowsQuery = useQuery({
    queryKey: ['dashboard-workflows'],
    queryFn: () => api.get('/workflows'),
  });

  const timeSavedQuery = useQuery({
    queryKey: ['time-saved-stats'],
    queryFn: () => api.get('/org/time-saved-stats'),
  });

  const learningSignalsQuery = useQuery({
    queryKey: ['dashboard-learning-signals'],
    queryFn: () => api.get('/org/learning-signals'),
  });

  const recentConversations = conversationsQuery.data?.conversations ?? [];
  const workflows = workflowsQuery.data?.workflows ?? [];
  const trainedOnRuns = Number(viewer?.stats?.trainedOnRuns ?? 0);
  const loreDocumentCount = Number(
    timeSavedQuery.data?.periods?.month?.counts?.loreDocuments
    ?? viewer?.stats?.loreDocuments
    ?? 0,
  );

  const hasMeaningfulProgress =
    conversationCount >= 3
    || workflows.some((workflow) => Number(workflow.runCount ?? 0) > 0)
    || trainedOnRuns > 2;

  const [firstWinState, setFirstWinState] = useState(() => readFirstWinState(userId));

  useEffect(() => {
    const outcomeId = location.state?.firstRunOutcomeId;
    if (!outcomeId || firstWinState?.outcomeId === outcomeId) {
      return;
    }
    const selectedOutcome = FIRST_RUN_OUTCOMES.find((outcome) => outcome.id === outcomeId);
    if (!selectedOutcome) {
      return;
    }
    setFirstWinState(writeFirstWinState(userId, {
      state: FIRST_WIN_STATES.OUTCOME_SELECTED,
      outcomeId,
      recommendedAgentId: selectedOutcome.recommendedAgentId,
    }));
  }, [firstWinState?.outcomeId, location.state?.firstRunOutcomeId, userId]);

  const firstWinNudge = {
    [FIRST_WIN_STATES.NO_OUTCOME]: 'Choose your first outcome',
    [FIRST_WIN_STATES.OUTCOME_SELECTED]: 'Finish your first guided prompt',
    [FIRST_WIN_STATES.PROMPT_STARTED]: 'Finish your first guided prompt',
    [FIRST_WIN_STATES.PROMPT_SUBMITTED]: 'Your first result is being prepared',
    [FIRST_WIN_STATES.OUTPUT_COMPLETED]: 'Want to make this repeatable?',
    [FIRST_WIN_STATES.LORE_SOURCE_ADDED]: 'Ask a question from your business knowledge',
    [FIRST_WIN_STATES.WORKFLOW_DRAFT_CREATED]: 'Run or refine your first workflow',
    [FIRST_WIN_STATES.BETA_SUCCESS]: 'First beta success achieved',
  }[firstWinState?.state ?? FIRST_WIN_STATES.NO_OUTCOME];

  const recommendation = useMemo(
    () =>
      resolveDashboardRecommendation({
        hasMeaningfulProgress,
        conversationCount,
        workflows,
        loreDocumentCount,
        firstRunOutcomeId: location.state?.firstRunOutcomeId ?? firstWinState?.outcomeId,
        recommendedFirstAgentId,
        currentPlan,
        recentConversations,
      }),
    [
      conversationCount,
      currentPlan,
      firstWinState?.outcomeId,
      hasMeaningfulProgress,
      location.state?.firstRunOutcomeId,
      loreDocumentCount,
      recentConversations,
      recommendedFirstAgentId,
      workflows,
    ],
  );

  const executionBalance = viewer?.credits?.execution;
  const videoBalance = viewer?.credits?.video;

  return (
    <PageShell width="1260px" flushMobile>
      <div className="pm-dash pm-dash--command">
        <MotionSection delay={0.01} reveal={{ y: 8, blur: 4 }}>
          <DashboardGreeting orgName={orgName} />
          <DashboardCreditsChip executionBalance={executionBalance} videoBalance={videoBalance} />
        </MotionSection>

        <MotionSection delay={0.02} reveal={{ y: 10, blur: 4 }}>
          <DashboardQuickActions />
        </MotionSection>

        <MotionSection delay={0.03} reveal={{ y: 10, blur: 4 }}>
          <DashboardTimeSaved
            timeSavedStats={timeSavedQuery.data}
            isLoading={timeSavedQuery.isLoading}
          />
        </MotionSection>

        {hasMeaningfulProgress ? (
          <MotionSection delay={0.04} reveal={{ y: 10, blur: 4 }}>
            <DashboardContinueWork conversations={recentConversations} workflows={workflows} />
          </MotionSection>
        ) : (
          <MotionSection delay={0.04} reveal={{ y: 10, blur: 4 }}>
            <DashboardFirstWinStrip
              userId={userId}
              firstWinState={firstWinState}
              onStateChange={setFirstWinState}
              firstWinNudge={firstWinNudge}
            />
          </MotionSection>
        )}

        <MotionSection delay={0.05} reveal={{ y: 10, blur: 4 }}>
          <DashboardRecommendedNext recommendation={recommendation} />
        </MotionSection>

        <MotionSection delay={0.06} reveal={{ y: 8, blur: 4 }}>
          <LearningSignalsSection
            signals={learningSignalsQuery.data}
            isLoading={learningSignalsQuery.isLoading}
          />
        </MotionSection>
      </div>
    </PageShell>
  );
}
