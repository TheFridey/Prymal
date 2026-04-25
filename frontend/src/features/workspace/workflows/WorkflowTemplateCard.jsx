import { Button } from '../../../components/ui';
import { getAgentMeta } from '../../../lib/constants';

function bezierPath(from, to) {
  const delta = Math.max((to.x - from.x) * 0.42, 42);
  return `M ${from.x} ${from.y} C ${from.x + delta} ${from.y}, ${to.x - delta} ${to.y}, ${to.x} ${to.y}`;
}

function truncateLabel(value, maxLength = 22) {
  if (!value || value.length <= maxLength) {
    return value;
  }

  return `${value.slice(0, maxLength - 1)}...`;
}

export function WorkflowTemplateDiagram({ template, compact = false }) {
  const width = Math.max(template?.diagramSize?.width ?? 760, 420);
  const height = Math.max(template?.diagramSize?.height ?? 220, 180);
  const cardWidth = compact ? 128 : 156;
  const cardHeight = compact ? 62 : 76;

  if (!template?.nodes?.length) {
    return null;
  }

  const nodeById = new Map(template.nodes.map((node) => [node.id, node]));

  return (
    <div
      className={`workflow-template-diagram${compact ? ' is-compact' : ''}`}
      style={{ '--diagram-width': `${width}px`, '--diagram-height': `${height}px` }}
      aria-label={`${template.name} workflow diagram`}
    >
      <div
        className="workflow-template-diagram__stage"
        style={{ width: `${width}px`, height: `${height}px` }}
      >
        <svg
          className="workflow-template-diagram__svg"
          viewBox={`0 0 ${width} ${height}`}
          preserveAspectRatio="none"
          role="img"
          aria-hidden="true"
        >
          <defs>
            <marker
              id={`workflow-template-arrow-${template.slug}`}
              markerWidth="12"
              markerHeight="12"
              refX="10"
              refY="6"
              orient="auto-start-reverse"
            >
              <path d="M 0 0 L 12 6 L 0 12 z" fill="rgba(183, 197, 221, 0.88)" />
            </marker>
          </defs>

          {template.edges.map((edge) => {
            const source = nodeById.get(edge.from);
            const target = nodeById.get(edge.to);

            if (!source || !target) {
              return null;
            }

            const sourcePoint = {
              x: (source.position?.x ?? 0) + cardWidth,
              y: (source.position?.y ?? 0) + (cardHeight / 2),
            };
            const targetPoint = {
              x: target.position?.x ?? 0,
              y: (target.position?.y ?? 0) + (cardHeight / 2),
            };
            const path = bezierPath(sourcePoint, targetPoint);
            const labelX = (sourcePoint.x + targetPoint.x) / 2;
            const labelY = Math.min(sourcePoint.y, targetPoint.y) - 10;

            return (
              <g key={`${edge.from}-${edge.to}`}>
                <path
                  d={path}
                  fill="none"
                  stroke="rgba(183, 197, 221, 0.7)"
                  strokeWidth={compact ? '2' : '2.4'}
                  markerEnd={`url(#workflow-template-arrow-${template.slug})`}
                />
                {edge.condition ? (
                  <text
                    x={labelX}
                    y={labelY}
                    textAnchor="middle"
                    className="workflow-template-diagram__edge-label"
                  >
                    {truncateLabel(edge.condition, compact ? 18 : 26)}
                  </text>
                ) : null}
              </g>
            );
          })}
        </svg>

        {template.nodes.map((node) => {
          const agent = getAgentMeta(node.agentId);

          return (
            <div
              key={node.id}
              className="workflow-template-diagram__node"
              style={{
                left: `${node.position?.x ?? 0}px`,
                top: `${node.position?.y ?? 0}px`,
                width: `${cardWidth}px`,
                minHeight: `${cardHeight}px`,
                '--workflow-agent-accent': agent?.color ?? '#7FE0FF',
              }}
            >
              <div className="workflow-template-diagram__node-agent">{agent?.name ?? node.agentId}</div>
              <div className="workflow-template-diagram__node-label">{truncateLabel(node.label || 'Untitled step', compact ? 20 : 28)}</div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default function WorkflowTemplateCard({
  template,
  compact = false,
  primaryActionLabel = 'Open in builder',
  secondaryActionLabel = 'Create instantly',
  onPrimaryAction,
  onSecondaryAction,
  footer,
  className = '',
}) {
  if (!template) {
    return null;
  }

  return (
    <div className={`workflow-template-card${compact ? ' is-compact' : ''}${className ? ` ${className}` : ''}`}>
      <div className="workflow-template-card__header">
        <div>
          <div className="workflow-template-card__eyebrow">
            <span>{template.category}</span>
            <span>{template.triggerType}</span>
            <span>{template.setupTime}</span>
          </div>
          <h3>{template.name}</h3>
          <p>{template.description}</p>
        </div>
        <div className="workflow-template-card__badges">
          <span>{template.stepCount} steps</span>
          <span>{template.agentIds.length} agents</span>
          <span>{template.difficulty}</span>
        </div>
      </div>

      <WorkflowTemplateDiagram template={template} compact={compact} />

      <div className="workflow-template-card__details">
        <div>
          <strong>Outcome</strong>
          <span>{template.outcome}</span>
        </div>
        <div>
          <strong>Best for</strong>
          <span>{template.bestFor}</span>
        </div>
        <div>
          <strong>Trigger</strong>
          <span>{template.triggerSummary}</span>
        </div>
      </div>

      {footer ? <div className="workflow-template-card__footer">{footer}</div> : null}

      {(onPrimaryAction || onSecondaryAction) ? (
        <div className="workflow-template-card__actions">
          {onPrimaryAction ? (
            <Button tone="accent" onClick={() => onPrimaryAction(template)}>
              {primaryActionLabel}
            </Button>
          ) : null}
          {onSecondaryAction ? (
            <Button tone="ghost" onClick={() => onSecondaryAction(template)}>
              {secondaryActionLabel}
            </Button>
          ) : null}
        </div>
      ) : null}
    </div>
  );
}
