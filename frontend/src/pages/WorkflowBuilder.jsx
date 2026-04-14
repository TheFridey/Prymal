import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import ReactFlow, {
  Background,
  BaseEdge,
  Controls,
  Handle,
  MarkerType,
  Position,
  addEdge,
  getBezierPath,
  useEdgesState,
  useNodesState,
} from 'reactflow';
import 'reactflow/dist/style.css';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api';
import { AGENT_LIBRARY } from '../lib/constants';
import { Button, InlineNotice, SectionLabel, TextArea, TextInput } from '../components/ui';
import { usePrymalReducedMotion } from '../components/motion';
import { useAppStore } from '../stores/useAppStore';
import { getErrorMessage } from '../lib/utils';

const NODE_STATE_META = {
  idle: { label: 'Standby', tint: 'rgba(160, 184, 215, 0.82)' },
  running: { label: 'Running', tint: '#68F5D0' },
  retrying: { label: 'Retrying', tint: '#F8C44F' },
  success: { label: 'Committed', tint: '#7FE0FF' },
  blocked: { label: 'Blocked', tint: '#BDB4FE' },
  failed: { label: 'Failed', tint: '#FF6B8B' },
};

const EDGE_STATE_META = {
  idle: { stroke: 'rgba(149, 168, 197, 0.38)', width: 1.8, dash: '5 10', opacity: 0.68 },
  running: { stroke: '#68F5D0', width: 2.6, dash: '10 10', opacity: 1, pulse: '#68F5D0' },
  retrying: { stroke: '#F8C44F', width: 2.5, dash: '4 8', opacity: 1, pulse: '#F8C44F' },
  success: { stroke: '#7FE0FF', width: 2.2, dash: undefined, opacity: 0.95, pulse: '#7FE0FF' },
  blocked: { stroke: '#BDB4FE', width: 2, dash: '2 8', opacity: 0.85 },
  failed: { stroke: '#FF6B8B', width: 2.3, dash: '3 7', opacity: 0.95, pulse: '#FF6B8B' },
};

const SIMULATION_VARIANTS = {
  success: {
    label: 'Success pass',
    description: 'Runs the graph cleanly and commits output through the final node.',
  },
  retry: {
    label: 'Retry path',
    description: 'Introduces a recovery cycle mid-run before continuing through the graph.',
  },
  blocked: {
    label: 'Blocked branch',
    description: 'Stops execution at a guarded node and marks downstream steps as blocked.',
  },
  failed: {
    label: 'Failure path',
    description: 'Halts execution on a failed node and visibly interrupts the rest of the graph.',
  },
};

const OPERATOR_OPTIONS = [
  { value: 'contains', label: 'contains' },
  { value: 'equals', label: 'equals' },
  { value: 'gt', label: 'greater than' },
  { value: 'lt', label: 'less than' },
  { value: 'not_empty', label: 'is not empty' },
];

const CRON_HUMANISE = {
  '0 9 * * 1': 'Every Monday at 09:00',
  '0 9 * * 1-5': 'Weekdays at 09:00',
  '0 9 * * *': 'Every day at 09:00',
  '0 * * * *': 'Every hour',
  '*/15 * * * *': 'Every 15 minutes',
  '0 0 * * *': 'Every day at midnight',
  '0 0 1 * *': 'First of each month at midnight',
};

let nodeCounter = 0;

function humaniseCron(expr) {
  return CRON_HUMANISE[expr?.trim()] ?? null;
}

function isValidCron(expr) {
  return /^(\S+ ){4}\S+$/.test((expr ?? '').trim());
}

function generateWebhookSecret() {
  const bytes = new Uint8Array(12);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((value) => value.toString(16).padStart(2, '0')).join('');
}

function withExecutionDefaults(data = {}) {
  return {
    executionState: 'idle',
    executionLabel: 'Standby',
    attemptCount: 0,
    latencyLabel: 'Ready',
    ...data,
  };
}

function createWorkflowEdge(params) {
  return {
    ...params,
    type: 'workflowEdge',
    markerEnd: {
      type: MarkerType.ArrowClosed,
      color: 'rgba(149, 168, 197, 0.58)',
      width: 16,
      height: 16,
    },
    data: {
      visualState: 'idle',
    },
  };
}

function buildExecutionOrder(nodes, edges) {
  const nodeIds = nodes.map((node) => node.id);
  const positionById = Object.fromEntries(nodes.map((node) => [node.id, node.position ?? { x: 0, y: 0 }]));
  const incomingCount = new Map(nodeIds.map((id) => [id, 0]));
  const outgoing = new Map(nodeIds.map((id) => [id, []]));

  for (const edge of edges) {
    if (!incomingCount.has(edge.target) || !outgoing.has(edge.source)) {
      continue;
    }
    incomingCount.set(edge.target, (incomingCount.get(edge.target) ?? 0) + 1);
    outgoing.get(edge.source).push(edge.target);
  }

  const queue = nodeIds
    .filter((id) => (incomingCount.get(id) ?? 0) === 0)
    .sort((left, right) => {
      const leftPos = positionById[left];
      const rightPos = positionById[right];
      return leftPos.x - rightPos.x || leftPos.y - rightPos.y;
    });

  const orderedIds = [];

  while (queue.length > 0) {
    const current = queue.shift();
    orderedIds.push(current);

    for (const nextId of outgoing.get(current) ?? []) {
      const nextCount = (incomingCount.get(nextId) ?? 1) - 1;
      incomingCount.set(nextId, nextCount);

      if (nextCount === 0) {
        queue.push(nextId);
        queue.sort((left, right) => {
          const leftPos = positionById[left];
          const rightPos = positionById[right];
          return leftPos.x - rightPos.x || leftPos.y - rightPos.y;
        });
      }
    }
  }

  if (orderedIds.length < nodeIds.length) {
    const remainder = nodeIds
      .filter((id) => !orderedIds.includes(id))
      .sort((left, right) => {
        const leftPos = positionById[left];
        const rightPos = positionById[right];
        return leftPos.x - rightPos.x || leftPos.y - rightPos.y;
      });
    orderedIds.push(...remainder);
  }

  return orderedIds.map((id) => nodes.find((node) => node.id === id)).filter(Boolean);
}

function pickScenarioTarget(order, mode) {
  if (order.length === 0) {
    return null;
  }

  if (mode === 'retry') {
    return order[Math.min(1, order.length - 1)];
  }

  if (mode === 'blocked') {
    return order.find((node) => (node.data.conditions?.length ?? 0) > 0) ?? order[Math.min(1, order.length - 1)];
  }

  if (mode === 'failed') {
    return order[Math.min(2, order.length - 1)] ?? order[order.length - 1];
  }

  return null;
}

function handleStyle(color) {
  return {
    width: 10,
    height: 10,
    background: color,
    border: '2px solid rgba(8, 13, 23, 0.88)',
  };
}

function WorkflowStateEdge(props) {
  const reducedMotion = usePrymalReducedMotion();
  const visualState = props.data?.visualState ?? 'idle';
  const meta = EDGE_STATE_META[visualState] ?? EDGE_STATE_META.idle;
  const [edgePath, labelX, labelY] = getBezierPath(props);

  return (
    <>
      <BaseEdge
        path={edgePath}
        markerEnd={props.markerEnd}
        style={{
          stroke: meta.stroke,
          strokeWidth: meta.width,
          strokeDasharray: meta.dash,
          opacity: meta.opacity,
          filter: meta.pulse ? `drop-shadow(0 0 8px ${meta.pulse})` : undefined,
          transition: 'stroke 180ms ease, stroke-width 180ms ease, opacity 180ms ease',
        }}
      />

      {!reducedMotion && meta.pulse ? (
        <circle r="4" fill={meta.pulse}>
          <animateMotion dur={visualState === 'retrying' ? '1.3s' : '1.7s'} repeatCount="indefinite" path={edgePath} />
        </circle>
      ) : null}

      {(visualState === 'blocked' || visualState === 'failed') ? (
        <text
          x={labelX}
          y={labelY - 6}
          textAnchor="middle"
          style={{
            fill: meta.stroke,
            fontSize: 10,
            letterSpacing: '0.16em',
            textTransform: 'uppercase',
            fontFamily: 'var(--ff-mono)',
          }}
        >
          {visualState}
        </text>
      ) : null}
    </>
  );
}

function AgentNode({ data, selected }) {
  const executionState = data.executionState ?? 'idle';
  const hasConditions = (data.conditions?.length ?? 0) > 0;
  const meta = NODE_STATE_META[executionState] ?? NODE_STATE_META.idle;

  return (
    <div
      className={`workflow-node workflow-node--${executionState}${selected ? ' is-selected' : ''}`}
      style={{
        '--node-accent': data.color,
        '--node-state': meta.tint,
      }}
    >
      <Handle type="target" position={Position.Left} style={handleStyle(data.color)} />
      <div className="workflow-node__head">
        <div>
          <div className="workflow-node__agent">{data.agentName}</div>
          <div className="workflow-node__label">{data.label || 'Untitled step'}</div>
        </div>
        <span className="workflow-node__state">{data.executionLabel ?? meta.label}</span>
      </div>
      <div className="workflow-node__meta">
        <span>{data.outputVar || 'output_var'}</span>
        <span>{data.latencyLabel ?? 'Ready'}</span>
      </div>
      {hasConditions ? (
        <div className="workflow-node__condition-chip" title={`${data.conditions.length} condition${data.conditions.length > 1 ? 's' : ''}`}>
          {data.conditions.length} gate{data.conditions.length === 1 ? '' : 's'}
        </div>
      ) : null}
      {data.attemptCount > 1 ? <div className="workflow-node__attempt">Attempt {data.attemptCount}</div> : null}
      <Handle type="source" position={Position.Right} style={handleStyle(data.color)} />
    </div>
  );
}

const nodeTypes = { agentNode: AgentNode };
const edgeTypes = { workflowEdge: WorkflowStateEdge };

export default function WorkflowBuilder({ onClose }) {
  const [nodes, setNodes, onNodesChange] = useNodesState([]);
  const [edges, setEdges, onEdgesChange] = useEdgesState([]);
  const [workflowName, setWorkflowName] = useState('');
  const [triggerType, setTriggerType] = useState('manual');
  const [triggerConfig, setTriggerConfig] = useState({});
  const [selectedId, setSelectedId] = useState(null);
  const [saveFeedback, setSaveFeedback] = useState(null);
  const [rfInstance, setRfInstance] = useState(null);
  const [simulationState, setSimulationState] = useState({ mode: null, status: 'idle' });
  const [simulationLog, setSimulationLog] = useState([]);
  const wrapperRef = useRef(null);
  const simulationRunRef = useRef(0);
  const pendingTimersRef = useRef([]);
  const notify = useAppStore((state) => state.addNotification);
  const queryClient = useQueryClient();

  const selectedNode = nodes.find((node) => node.id === selectedId) ?? null;
  const triggerConfigError = getTriggerConfigError(triggerType, triggerConfig);

  useEffect(() => () => {
    stopSimulation();
  }, []);

  const queueDelay = useCallback((ms) => new Promise((resolve) => {
    const timerId = window.setTimeout(() => {
      pendingTimersRef.current = pendingTimersRef.current.filter((value) => value !== timerId);
      resolve();
    }, ms);

    pendingTimersRef.current.push(timerId);
  }), []);

  const appendSimulationLog = useCallback((message, tone = 'default') => {
    setSimulationLog((current) => [
      ...current.slice(-5),
      { id: `${Date.now()}-${Math.random().toString(16).slice(2)}`, message, tone },
    ]);
  }, []);

  const updateExecutionState = useCallback((nodeId, executionState, patch = {}) => {
    const meta = NODE_STATE_META[executionState] ?? NODE_STATE_META.idle;

    setNodes((currentNodes) =>
      currentNodes.map((node) =>
        node.id === nodeId
          ? {
              ...node,
              data: {
                ...node.data,
                executionState,
                executionLabel: patch.executionLabel ?? meta.label,
                attemptCount: patch.attemptCount ?? node.data.attemptCount ?? 0,
                latencyLabel: patch.latencyLabel ?? node.data.latencyLabel ?? 'Ready',
              },
            }
          : node,
      ),
    );
  }, [setNodes]);

  const updateDownstreamStates = useCallback((nodeIds, executionState, executionLabel) => {
    if (nodeIds.length === 0) {
      return;
    }

    const meta = NODE_STATE_META[executionState] ?? NODE_STATE_META.idle;

    setNodes((currentNodes) =>
      currentNodes.map((node) => (
        nodeIds.includes(node.id)
          ? {
              ...node,
              data: {
                ...node.data,
                executionState,
                executionLabel: executionLabel ?? meta.label,
                latencyLabel: executionState === 'blocked' ? 'Waiting on branch' : 'No output',
              },
            }
          : node
      )),
    );
  }, [setNodes]);

  const updateEdgeStates = useCallback((edgeIds, visualState) => {
    if (!edgeIds.length) {
      return;
    }

    setEdges((currentEdges) =>
      currentEdges.map((edge) => (
        edgeIds.includes(edge.id)
          ? {
              ...edge,
              data: {
                ...edge.data,
                visualState,
              },
            }
          : edge
      )),
    );
  }, [setEdges]);

  const resetExecutionStory = useCallback(() => {
    setNodes((currentNodes) =>
      currentNodes.map((node) => ({
        ...node,
        data: withExecutionDefaults(node.data),
      })),
    );
    setEdges((currentEdges) =>
      currentEdges.map((edge) => ({
        ...edge,
        data: {
          ...edge.data,
          visualState: 'idle',
        },
      })),
    );
    setSimulationState({ mode: null, status: 'idle' });
    setSimulationLog([]);
  }, [setEdges, setNodes]);

  function stopSimulation() {
    simulationRunRef.current += 1;
    pendingTimersRef.current.forEach((timerId) => window.clearTimeout(timerId));
    pendingTimersRef.current = [];
  }

  const runSimulation = useCallback(async (mode) => {
    if (nodes.length === 0) {
      return;
    }

    stopSimulation();
    resetExecutionStory();

    const currentRunId = simulationRunRef.current;
    const order = buildExecutionOrder(nodes, edges);
    const targetNode = pickScenarioTarget(order, mode);
    const label = SIMULATION_VARIANTS[mode]?.label ?? 'Execution story';

    setSimulationState({ mode, status: 'running' });
    appendSimulationLog(`${label} started across ${order.length} node${order.length === 1 ? '' : 's'}.`);

    for (let index = 0; index < order.length; index += 1) {
      if (simulationRunRef.current !== currentRunId) {
        return;
      }

      const node = order[index];
      const incomingEdgeIds = edges.filter((edge) => edge.target === node.id).map((edge) => edge.id);
      const outgoingEdgeIds = edges.filter((edge) => edge.source === node.id).map((edge) => edge.id);

      updateEdgeStates(incomingEdgeIds, 'running');
      updateExecutionState(node.id, 'running', {
        executionLabel: 'Executing',
        attemptCount: 1,
        latencyLabel: `${650 + index * 180} ms`,
      });
      appendSimulationLog(`${node.data.agentName} is executing.`);
      await queueDelay(640);

      if (mode === 'retry' && targetNode?.id === node.id) {
        updateExecutionState(node.id, 'retrying', {
          executionLabel: 'Repairing',
          attemptCount: 2,
          latencyLabel: 'Retry branch',
        });
        updateEdgeStates([...incomingEdgeIds, ...outgoingEdgeIds], 'retrying');
        appendSimulationLog(`${node.data.agentName} triggered a repair cycle and is retrying.`, 'warning');
        await queueDelay(860);
        updateExecutionState(node.id, 'success', {
          executionLabel: 'Recovered',
          attemptCount: 2,
          latencyLabel: 'Recovered on retry',
        });
        updateEdgeStates(outgoingEdgeIds, 'success');
        appendSimulationLog(`${node.data.agentName} recovered and handed the run forward.`, 'success');
        await queueDelay(220);
        continue;
      }

      if (mode === 'blocked' && targetNode?.id === node.id) {
        const downstream = order.slice(index + 1).map((item) => item.id);
        updateExecutionState(node.id, 'blocked', {
          executionLabel: 'Awaiting branch',
          attemptCount: 1,
          latencyLabel: 'Condition unresolved',
        });
        updateEdgeStates(outgoingEdgeIds, 'blocked');
        updateDownstreamStates(downstream, 'blocked', 'Waiting');
        appendSimulationLog(`${node.data.agentName} paused on a branch condition and blocked downstream nodes.`, 'warning');
        setSimulationState({ mode, status: 'blocked' });
        return;
      }

      if (mode === 'failed' && targetNode?.id === node.id) {
        const downstream = order.slice(index + 1).map((item) => item.id);
        updateExecutionState(node.id, 'failed', {
          executionLabel: 'Run halted',
          attemptCount: 1,
          latencyLabel: 'Unhandled error',
        });
        updateEdgeStates([...incomingEdgeIds, ...outgoingEdgeIds], 'failed');
        updateDownstreamStates(downstream, 'blocked', 'Interrupted');
        appendSimulationLog(`${node.data.agentName} failed and the rest of the graph was interrupted.`, 'error');
        setSimulationState({ mode, status: 'failed' });
        return;
      }

      updateExecutionState(node.id, 'success', {
        executionLabel: 'Committed',
        attemptCount: 1,
        latencyLabel: `${720 + index * 140} ms`,
      });
      updateEdgeStates(outgoingEdgeIds, 'success');
      appendSimulationLog(`${node.data.agentName} committed output to the next step.`, 'success');
      await queueDelay(220);
    }

    setSimulationState({ mode, status: mode === 'retry' ? 'recovered' : 'completed' });
    appendSimulationLog(
      mode === 'retry'
        ? 'Workflow completed after a successful recovery path.'
        : 'Workflow completed successfully.',
      'success',
    );
  }, [
    appendSimulationLog,
    edges,
    nodes,
    queueDelay,
    resetExecutionStory,
    updateDownstreamStates,
    updateEdgeStates,
    updateExecutionState,
  ]);

  const onConnect = useCallback(
    (params) => setEdges((currentEdges) => addEdge(createWorkflowEdge(params), currentEdges)),
    [setEdges],
  );

  const onDragOver = useCallback((event) => {
    event.preventDefault();
    event.dataTransfer.dropEffect = 'move';
  }, []);

  const onDrop = useCallback((event) => {
    event.preventDefault();
    const agentId = event.dataTransfer.getData('application/axiom-agent');
    if (!agentId || !rfInstance) {
      return;
    }

    const agent = AGENT_LIBRARY.find((entry) => entry.id === agentId);
    if (!agent) {
      return;
    }

    const position = rfInstance.screenToFlowPosition({
      x: event.clientX,
      y: event.clientY,
    });

    nodeCounter += 1;
    const id = `${agentId}_${nodeCounter}`;

    setNodes((currentNodes) => [
      ...currentNodes,
      {
        id,
        type: 'agentNode',
        position,
        data: withExecutionDefaults({
          agentId,
          agentName: agent.name,
          color: agent.color,
          label: '',
          prompt: '',
          outputVar: `${agentId}_output_${nodeCounter}`,
          conditions: [],
        }),
      },
    ]);
    setSelectedId(id);
    setSaveFeedback(null);
  }, [rfInstance, setNodes]);

  const updateNodeData = useCallback((field, value) => {
    if (!selectedId) {
      return;
    }

    setNodes((currentNodes) =>
      currentNodes.map((node) => (
        node.id === selectedId
          ? {
              ...node,
              data: {
                ...node.data,
                [field]: value,
              },
            }
          : node
      )),
    );
    setSaveFeedback(null);
  }, [selectedId, setNodes]);

  const removeSelected = useCallback(() => {
    if (!selectedId) {
      return;
    }

    setNodes((currentNodes) => currentNodes.filter((node) => node.id !== selectedId));
    setEdges((currentEdges) => currentEdges.filter((edge) => edge.source !== selectedId && edge.target !== selectedId));
    setSelectedId(null);
    setSaveFeedback(null);
  }, [selectedId, setEdges, setNodes]);

  const saveMutation = useMutation({
    mutationFn: () =>
      api.post('/workflows', {
        name: workflowName.trim() || 'Untitled workflow',
        triggerType,
        triggerConfig,
        nodes: nodes.map((node) => ({
          id: node.id,
          agentId: node.data.agentId,
          label: node.data.label || node.data.agentName,
          prompt: node.data.prompt,
          outputVar: node.data.outputVar,
          conditions: node.data.conditions?.length ? node.data.conditions : undefined,
        })),
        edges: edges.map((edge) => ({ from: edge.source, to: edge.target })),
      }),
    onSuccess: async () => {
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ['workflows'] }),
        queryClient.invalidateQueries({ queryKey: ['workspace-workflows'] }),
      ]);

      setSaveFeedback({
        message: 'Your workflow was validated and added to the workspace.',
        showWebhookTip: triggerType !== 'webhook',
      });
      notify({
        type: 'success',
        title: 'Workflow saved',
        message: 'Your workflow was validated and added to the workspace.',
      });
    },
    onError: (error) => {
      setSaveFeedback(null);
      notify({ type: 'error', title: 'Save failed', message: getErrorMessage(error) });
    },
  });

  const selectedNodeMeta = useMemo(
    () => (selectedNode ? NODE_STATE_META[selectedNode.data.executionState ?? 'idle'] ?? NODE_STATE_META.idle : null),
    [selectedNode],
  );

  return (
    <div className="workflow-builder">
      {saveFeedback ? (
        <div style={{ display: 'grid', gap: '8px' }}>
          <InlineNotice tone="success">{saveFeedback.message}</InlineNotice>
          {saveFeedback.showWebhookTip ? (
            <div style={{ color: 'var(--muted)', fontSize: '13px', lineHeight: 1.7 }}>
              Add outbound webhooks in the Workflows panel to receive HTTP callbacks when this workflow runs.
            </div>
          ) : null}
        </div>
      ) : null}

      <div className="workflow-builder__header">
        <TextInput
          placeholder="Workflow name"
          value={workflowName}
          onChange={(event) => {
            setWorkflowName(event.target.value);
            setSaveFeedback(null);
          }}
          style={{ flex: '1', minWidth: '180px' }}
        />

        <select
          value={triggerType}
          onChange={(event) => {
            setTriggerType(event.target.value);
            setTriggerConfig({});
            setSaveFeedback(null);
          }}
          style={selectStyle}
        >
          <option value="manual">Manual</option>
          <option value="schedule">Scheduled</option>
          <option value="webhook">Webhook</option>
          <option value="event">Event</option>
        </select>

        <Button
          tone="accent"
          onClick={() => saveMutation.mutate()}
          disabled={saveMutation.isPending || nodes.length === 0 || Boolean(triggerConfigError)}
        >
          {saveMutation.isPending ? 'Saving…' : 'Save workflow'}
        </Button>

        {onClose ? (
          <Button tone="ghost" onClick={onClose}>
            Done
          </Button>
        ) : null}
      </div>

      {renderTriggerCard(triggerType, triggerConfig, triggerConfigError, setTriggerConfig, setSaveFeedback)}

      <div className="workflow-builder__simulation">
        <div>
          <div className="eyebrow" style={{ '--eyebrow-accent': '#68F5D0' }}>Execution storytelling</div>
          <h3>Preview how this graph behaves under pressure before it ever runs live.</h3>
          <p>
            Use the state layer to watch clean execution, retry behavior, blocked branches, and hard failures move through the canvas.
          </p>
        </div>

        <div className="workflow-builder__simulation-actions">
          {Object.entries(SIMULATION_VARIANTS).map(([variant, meta]) => (
            <Button
              key={variant}
              tone={simulationState.mode === variant ? 'accent' : 'ghost'}
              onClick={() => runSimulation(variant)}
              disabled={nodes.length === 0}
              title={meta.description}
            >
              {meta.label}
            </Button>
          ))}
          <Button tone="ghost" onClick={() => { stopSimulation(); resetExecutionStory(); }} disabled={nodes.length === 0}>
            Reset
          </Button>
        </div>

        <div className="workflow-builder__legend">
          {Object.entries(NODE_STATE_META).map(([state, meta]) => (
            <div key={state} className="workflow-builder__legend-chip">
              <span style={{ background: meta.tint }} />
              {meta.label}
            </div>
          ))}
        </div>

        {simulationState.mode ? (
          <InlineNotice tone={simulationState.status === 'failed' ? 'error' : simulationState.status === 'blocked' ? 'warning' : 'default'}>
            {SIMULATION_VARIANTS[simulationState.mode]?.label} · {simulationState.status}
          </InlineNotice>
        ) : null}
      </div>

      <div className="workflow-builder__layout">
        <div className="workflow-builder__rail">
          <SectionLabel>Agents</SectionLabel>
          <div className="workflow-builder__agent-palette">
            {AGENT_LIBRARY.map((agent) => (
              <div
                key={agent.id}
                draggable
                onDragStart={(event) => event.dataTransfer.setData('application/axiom-agent', agent.id)}
                className="workflow-builder__agent-pill"
                style={{ '--agent-accent': agent.color }}
              >
                <span>{agent.name}</span>
                <small>{agent.title}</small>
              </div>
            ))}
          </div>
        </div>
        <div className="workflow-builder__main">
          <div ref={wrapperRef} className="workflow-builder__canvas-shell">
            <div className="workflow-builder__canvas-overlay">
              <div>
                <span>Live canvas</span>
                <strong>{nodes.length} node{nodes.length === 1 ? '' : 's'} · {edges.length} edge{edges.length === 1 ? '' : 's'}</strong>
              </div>
              <div className="workflow-builder__canvas-status">
                {simulationState.mode ? (
                  <>
                    <span className="workflow-builder__pulse-dot" />
                    {SIMULATION_VARIANTS[simulationState.mode]?.label}
                  </>
                ) : (
                  'Awaiting story'
                )}
              </div>
            </div>

            <ReactFlow
              nodes={nodes}
              edges={edges}
              onNodesChange={onNodesChange}
              onEdgesChange={onEdgesChange}
              onConnect={onConnect}
              onInit={setRfInstance}
              onDrop={onDrop}
              onDragOver={onDragOver}
              onNodeClick={(_, node) => setSelectedId(node.id)}
              onPaneClick={() => setSelectedId(null)}
              nodeTypes={nodeTypes}
              edgeTypes={edgeTypes}
              defaultEdgeOptions={{ type: 'workflowEdge' }}
              fitView
              deleteKeyCode="Delete"
            >
              <Background color="rgba(148, 163, 184, 0.16)" gap={24} />
              <Controls />
            </ReactFlow>
          </div>

          <div className="workflow-builder__inspector-grid">
            <div className="workflow-builder__inspector workflow-builder__inspector--editor">
              {selectedNode ? (
                <>
                  <div className="workflow-builder__inspector-head">
                    <div>
                      <SectionLabel>Edit step</SectionLabel>
                      <div className="workflow-builder__inspector-title">{selectedNode.data.agentName}</div>
                    </div>
                    <div
                      className="workflow-builder__inspector-badge"
                      style={{ '--badge-accent': selectedNodeMeta?.tint ?? 'rgba(160, 184, 215, 0.82)' }}
                    >
                      {selectedNode.data.executionLabel ?? selectedNodeMeta?.label}
                    </div>
                  </div>

                  <TextInput
                    placeholder="Step label"
                    value={selectedNode.data.label}
                    onChange={(event) => updateNodeData('label', event.target.value)}
                  />
                  <TextInput
                    placeholder="Output variable (e.g. summary_output)"
                    value={selectedNode.data.outputVar}
                    onChange={(event) => updateNodeData('outputVar', event.target.value)}
                  />
                  <TextArea
                    placeholder="Prompt for this agent step…"
                    value={selectedNode.data.prompt}
                    onChange={(event) => updateNodeData('prompt', event.target.value)}
                    rows={4}
                  />

                  <div>
                    <div className="workflow-builder__condition-head">
                      <SectionLabel>Conditions</SectionLabel>
                      {(selectedNode.data.conditions?.length ?? 0) < 10 ? (
                        <button type="button" onClick={() => addCondition(selectedNode, updateNodeData)} style={addConditionBtnStyle}>
                          + Add condition
                        </button>
                      ) : null}
                    </div>

                    {(selectedNode.data.conditions ?? []).length === 0 ? (
                      <div style={{ fontSize: '12px', color: 'var(--muted-2)' }}>
                        No conditions. This step always runs.
                      </div>
                    ) : (
                      <div style={{ display: 'grid', gap: '6px' }}>
                        {(selectedNode.data.conditions ?? []).map((condition, index) => (
                          <div key={index} style={{ display: 'flex', gap: '6px', alignItems: 'center', flexWrap: 'wrap' }}>
                            <input
                              type="text"
                              placeholder="output_var_name"
                              value={condition.field}
                              onChange={(event) => updateCondition(selectedNode, index, { field: event.target.value }, updateNodeData)}
                              style={conditionFieldStyle}
                            />
                            <select
                              value={condition.operator}
                              onChange={(event) => updateCondition(selectedNode, index, { operator: event.target.value }, updateNodeData)}
                              style={conditionSelectStyle}
                            >
                              {OPERATOR_OPTIONS.map((option) => (
                                <option key={option.value} value={option.value}>
                                  {option.label}
                                </option>
                              ))}
                            </select>
                            {condition.operator !== 'not_empty' ? (
                              <input
                                type="text"
                                placeholder="value"
                                value={condition.value ?? ''}
                                onChange={(event) => updateCondition(selectedNode, index, { value: event.target.value }, updateNodeData)}
                                style={conditionFieldStyle}
                              />
                            ) : (
                              <div style={{ minWidth: '80px' }} />
                            )}
                            <button
                              type="button"
                              onClick={() => removeCondition(selectedNode, index, updateNodeData)}
                              style={removeConditionBtnStyle}
                              aria-label="Remove condition"
                            >
                              ×
                            </button>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>

                  <Button tone="danger" onClick={removeSelected}>
                    Remove node
                  </Button>
                </>
              ) : (
                <div className="workflow-builder__empty-inspector">
                  <SectionLabel>Node inspector</SectionLabel>
                  <p>
                    Drag an agent onto the canvas, connect steps, then click a node to edit its prompt, output variable, and branch conditions.
                  </p>
                </div>
              )}
            </div>

            <div className="workflow-builder__inspector">
              <SectionLabel>Simulation log</SectionLabel>
              <div className="workflow-builder__log">
                {simulationLog.length === 0 ? (
                  <div className="workflow-builder__log-empty">
                    Run one of the execution stories above to preview how the graph behaves under clean, retry, blocked, and failed conditions.
                  </div>
                ) : (
                  simulationLog.map((entry) => (
                    <div key={entry.id} className={`workflow-builder__log-entry workflow-builder__log-entry--${entry.tone}`}>
                      {entry.message}
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function addCondition(selectedNode, updateNodeData) {
  const conditions = selectedNode?.data.conditions ?? [];
  if (conditions.length >= 10) {
    return;
  }
  updateNodeData('conditions', [...conditions, { field: '', operator: 'contains', value: '' }]);
}

function updateCondition(selectedNode, index, patch, updateNodeData) {
  const conditions = [...(selectedNode?.data.conditions ?? [])];
  conditions[index] = { ...conditions[index], ...patch };
  updateNodeData('conditions', conditions);
}

function removeCondition(selectedNode, index, updateNodeData) {
  const conditions = [...(selectedNode?.data.conditions ?? [])];
  conditions.splice(index, 1);
  updateNodeData('conditions', conditions);
}

function getTriggerConfigError(triggerType, triggerConfig) {
  if (triggerType === 'schedule') {
    if (!triggerConfig.cron?.trim()) return 'Cron expression is required for scheduled workflows.';
    if (!isValidCron(triggerConfig.cron)) return 'Cron expression must have 5 fields (e.g. "0 9 * * 1").';
  }

  if (triggerType === 'webhook') {
    if (!triggerConfig.webhookSecret?.trim()) return 'Webhook secret is required.';
    if (triggerConfig.webhookSecret.length < 8) return 'Webhook secret must be at least 8 characters.';
  }

  if (triggerType === 'event') {
    if (!triggerConfig.eventType?.trim()) return 'Event type is required.';
  }

  return null;
}

function renderTriggerCard(triggerType, triggerConfig, triggerConfigError, setTriggerConfig, setSaveFeedback) {
  if (triggerType === 'schedule') {
    return (
      <div style={triggerConfigCard}>
        <SectionLabel>Cron expression</SectionLabel>
        <TextInput
          placeholder="0 9 * * 1"
          value={triggerConfig.cron ?? ''}
          onChange={(event) => {
            setTriggerConfig((current) => ({ ...current, cron: event.target.value }));
            setSaveFeedback(null);
          }}
        />
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          Standard cron format: minute hour day month weekday
        </div>
        {triggerConfig.cron?.trim() ? (
          <div style={{ fontSize: '12px', color: 'var(--accent)', marginTop: '4px' }}>
            {humaniseCron(triggerConfig.cron) ?? triggerConfig.cron.trim()}
          </div>
        ) : null}
        {triggerConfigError ? <InlineNotice tone="warning">{triggerConfigError}</InlineNotice> : null}
      </div>
    );
  }

  if (triggerType === 'webhook') {
    return (
      <div style={triggerConfigCard}>
        <SectionLabel>Webhook secret</SectionLabel>
        <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
          <input
            type="password"
            placeholder="min 8 characters"
            value={triggerConfig.webhookSecret ?? ''}
            onChange={(event) => {
              setTriggerConfig((current) => ({ ...current, webhookSecret: event.target.value }));
              setSaveFeedback(null);
            }}
            style={{ ...conditionFieldStyle, flex: 1, minWidth: '200px', padding: '10px 14px' }}
          />
          <Button
            tone="ghost"
            onClick={() => {
              setTriggerConfig((current) => ({ ...current, webhookSecret: generateWebhookSecret() }));
              setSaveFeedback(null);
            }}
          >
            Generate
          </Button>
        </div>
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          Include this secret in the <code>X-Prymal-Secret</code> header when calling the webhook URL.
        </div>
        {triggerConfigError ? <InlineNotice tone="warning">{triggerConfigError}</InlineNotice> : null}
      </div>
    );
  }

  if (triggerType === 'event') {
    return (
      <div style={triggerConfigCard}>
        <SectionLabel>Event type</SectionLabel>
        <TextInput
          placeholder="crm.lead.created"
          value={triggerConfig.eventType ?? ''}
          onChange={(event) => {
            setTriggerConfig((current) => ({ ...current, eventType: event.target.value.slice(0, 120) }));
            setSaveFeedback(null);
          }}
        />
        <div style={{ fontSize: '12px', color: 'var(--muted)', marginTop: '4px' }}>
          The internal event name that will trigger this workflow.
        </div>
        {triggerConfigError ? <InlineNotice tone="warning">{triggerConfigError}</InlineNotice> : null}
      </div>
    );
  }

  return null;
}

const selectStyle = {
  background: 'var(--panel-soft)',
  border: '1px solid var(--line)',
  borderRadius: '10px',
  color: 'var(--text-strong)',
  padding: '9px 12px',
  fontSize: '14px',
};

const triggerConfigCard = {
  padding: '14px',
  borderRadius: '18px',
  border: '1px solid var(--line)',
  background: 'var(--panel-soft)',
  display: 'grid',
  gap: '8px',
};

const conditionFieldStyle = {
  flex: 1,
  minWidth: '80px',
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  background: 'var(--panel)',
  color: 'var(--text-strong)',
  fontSize: '13px',
  outline: 'none',
};

const conditionSelectStyle = {
  padding: '7px 10px',
  borderRadius: '8px',
  border: '1px solid var(--line)',
  background: 'var(--panel-soft)',
  color: 'var(--text-strong)',
  fontSize: '13px',
  outline: 'none',
};

const addConditionBtnStyle = {
  background: 'none',
  border: '1px solid var(--line)',
  borderRadius: '8px',
  color: 'var(--muted)',
  cursor: 'pointer',
  fontSize: '12px',
  padding: '4px 10px',
};

const removeConditionBtnStyle = {
  background: 'none',
  border: 'none',
  color: '#ef4444',
  cursor: 'pointer',
  fontSize: '16px',
  padding: '0 4px',
};
