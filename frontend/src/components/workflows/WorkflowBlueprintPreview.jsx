import { AgentAvatar, StatusPill } from '../ui';
import { MotionSection } from '../motion';
import { getAgentMeta } from '../../lib/constants';
import { formatNumber } from '../../lib/utils';

export default function WorkflowBlueprintPreview({
  workflowDefinition,
  title = 'Workflow blueprint',
  category,
  difficulty,
  estimatedExecutionCredits = 0,
  estimatedRuntimeLabel,
  modeTag = 'simple',
  validationWarnings = [],
  compact = false,
}) {
  const nodes = Array.isArray(workflowDefinition?.nodes) ? workflowDefinition.nodes : [];
  const triggerType = workflowDefinition?.triggerType ?? 'manual';
  const isAdvanced = modeTag === 'advanced' || difficulty === 'advanced' || nodes.length > 2;
  const accent = isAdvanced ? '#BDB4FE' : '#00FFD1';
  const displayNodes = compact ? nodes.slice(0, 3) : nodes;
  const hiddenNodeCount = Math.max(0, nodes.length - displayNodes.length);

  return (
    <MotionSection
      className={`workflow-blueprint${compact ? ' workflow-blueprint--compact' : ''}`}
      style={{ '--workflow-blueprint-accent': accent }}
      reveal={{ y: 12, blur: 6 }}
      delay={0.04}
      aria-label={`${title} workflow sequence`}
    >
      <div className="workflow-blueprint__header">
        <div>
          <div className="workflow-blueprint__eyebrow">{category || 'Workflow'} system map</div>
          <h3>{title}</h3>
          {!compact ? <p>See exactly how this workflow runs before you install it.</p> : null}
        </div>
        <div className="workflow-blueprint__badges" aria-label="Workflow metadata">
          <StatusPill color={accent}>{isAdvanced ? 'Advanced' : 'Simple'}</StatusPill>
          <StatusPill color="#4CC9F0">{difficulty || 'beginner'}</StatusPill>
          {!compact ? <StatusPill color="#F59E0B">{formatNumber(estimatedExecutionCredits)} credits est.</StatusPill> : null}
        </div>
      </div>

      <ol className="workflow-blueprint__rail" aria-label="Workflow steps in execution order">
        <BlueprintStep
          label={triggerType === 'manual' ? 'Manual Trigger' : `${triggerType} trigger`}
          meta="User starts the run"
          index={0}
          accent={accent}
        />
        {displayNodes.map((node, index) => (
          <BlueprintStep
            key={node.id ?? `${node.agentId}-${index}`}
            label={node.label || node.outputVar || `Step ${index + 1}`}
            meta={node.agentId ? `${getAgentMeta(node.agentId)?.name ?? node.agentId.toUpperCase()} agent` : 'Workflow step'}
            agentId={node.agentId}
            index={index + 1}
            accent={accent}
          />
        ))}
        {hiddenNodeCount > 0 ? (
          <BlueprintStep
            label={`+${hiddenNodeCount} more step${hiddenNodeCount === 1 ? '' : 's'}`}
            meta="Visible after install"
            index={displayNodes.length + 1}
            accent={accent}
          />
        ) : null}
        <BlueprintStep
          label="Structured Output"
          meta={estimatedRuntimeLabel || 'Ready to use'}
          index={displayNodes.length + hiddenNodeCount + 1}
          accent={accent}
        />
      </ol>

      <div className="workflow-blueprint__fallback">
        Sequence: Manual Trigger, {nodes.map((node) => node.label || node.outputVar || node.agentId).filter(Boolean).join(', ')}, Structured Output.
      </div>

      {!compact ? (
        <div className="workflow-blueprint__footer">
          <span>{isAdvanced ? 'Built for multi-step operating depth.' : 'Beginner friendly and quick to run.'}</span>
          {validationWarnings?.length ? (
            <span className="workflow-blueprint__warning">{validationWarnings.length} review warning{validationWarnings.length === 1 ? '' : 's'}</span>
          ) : (
            <span>Safe install checks passed.</span>
          )}
        </div>
      ) : null}
    </MotionSection>
  );
}

function BlueprintStep({ label, meta, agentId, index, accent }) {
  const agent = agentId ? getAgentMeta(agentId) : null;

  return (
    <li className="workflow-blueprint__step">
      <div className="workflow-blueprint__node" style={{ '--workflow-blueprint-accent': agent?.color ?? accent }}>
        {agent ? (
          <AgentAvatar agent={agent} size={42} active />
        ) : (
          <span className="workflow-blueprint__node-index">{index}</span>
        )}
      </div>
      <div className="workflow-blueprint__node-copy">
        <strong>{label}</strong>
        <span>{meta}</span>
      </div>
    </li>
  );
}
