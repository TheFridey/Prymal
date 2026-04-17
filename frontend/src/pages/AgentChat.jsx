import { useOutletContext, useParams, useSearchParams } from 'react-router-dom';
import WorkspaceStudio from '../components/WorkspaceStudio';

export default function AgentChat() {
  const { agentId } = useParams();
  const [searchParams] = useSearchParams();
  const { viewer, agents } = useOutletContext();
  const initialDraft = searchParams.get('draft')?.trim() || '';
  const forceNewChat = searchParams.get('new') === '1';
  const initialPowerupSlug = searchParams.get('powerup')?.trim() || '';
  const initialConversationId = searchParams.get('cid')?.trim()
    || searchParams.get('conversation')?.trim()
    || '';

  return (
    <WorkspaceStudio
      viewer={viewer}
      fallbackAgents={agents}
      initialAgentId={agentId}
      initialDraft={initialDraft}
      forceNewChat={forceNewChat}
      initialPowerupSlug={initialPowerupSlug}
      initialConversationId={initialConversationId}
      routeMode
    />
  );
}
