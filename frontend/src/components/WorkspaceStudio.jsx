import { useMemo, useState } from 'react';
import { Button } from './ui';
import { MotionPresence, motion } from './motion';
import WorkspaceChatExperience from '../features/workspace/chat/WorkspaceChatExperience';
import LorePanel from '../features/workspace/lore/LorePanel';
import WorkflowPanel from '../features/workspace/workflows/WorkflowPanel';

const PANEL_META = {
  chat: { label: 'Chat', accent: '#4CC9F0' },
  lore: { label: 'LORE', accent: '#C77DFF' },
  workflows: { label: 'Workflows', accent: '#F72585' },
};

export default function WorkspaceStudio(props) {
  const [activePanel, setActivePanel] = useState('chat');

  const fallbackAccent = useMemo(() => {
    const initialAgent = (props.fallbackAgents ?? []).find((agent) => agent.id === props.initialAgentId);
    return initialAgent?.color ?? PANEL_META.chat.accent;
  }, [props.fallbackAgents, props.initialAgentId]);

  const panelSwitcher = (
    <div className="workspace-studio__panel-switcher" role="tablist" aria-label="Workspace panels">
      {Object.entries(PANEL_META).map(([panelId, panel]) => (
        <Button
          key={panelId}
          tone={activePanel === panelId ? 'accent' : 'ghost'}
          className={`workspace-studio__panel-tab${activePanel === panelId ? ' is-active' : ''}`}
          onClick={() => setActivePanel(panelId)}
        >
          {panel.label}
        </Button>
      ))}
    </div>
  );

  if (activePanel === 'chat') {
    return <WorkspaceChatExperience {...props} panelSwitcher={panelSwitcher} />;
  }

  const activeMeta = PANEL_META[activePanel];

  return (
    <section
      className="workspace-studio workspace-studio--panel"
      style={{ '--studio-accent': activeMeta?.accent ?? fallbackAccent }}
    >
      <div className="workspace-studio__tool-shell">
        {panelSwitcher}
        <div className="workspace-studio__tool-surface">
          <MotionPresence mode="wait" initial={false}>
            <motion.div
              key={activePanel}
              initial={{ opacity: 0, y: 18, scale: 0.99, filter: 'blur(8px)' }}
              animate={{ opacity: 1, y: 0, scale: 1, filter: 'blur(0px)' }}
              exit={{ opacity: 0, y: -14, scale: 0.99, filter: 'blur(6px)' }}
              transition={{ duration: 0.28 }}
            >
              {activePanel === 'lore' ? <LorePanel /> : <WorkflowPanel />}
            </motion.div>
          </MotionPresence>
        </div>
      </div>
    </section>
  );
}
