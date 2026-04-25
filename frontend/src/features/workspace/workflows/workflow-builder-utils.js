export const CRON_HUMANISE = {
  '0 9 * * 1': 'Every Monday at 09:00',
  '0 9 * * 1-5': 'Weekdays at 09:00',
  '0 9 * * *': 'Every day at 09:00',
  '0 * * * *': 'Every hour',
  '*/15 * * * *': 'Every 15 minutes',
  '0 0 * * *': 'Every day at midnight',
  '0 0 1 * *': 'First of each month at midnight',
  '0 8 * * 1': 'Every Monday at 08:00',
  '0 7 1 * *': 'First day of the month at 07:00',
};

export function humaniseCron(expr) {
  return CRON_HUMANISE[String(expr ?? '').trim()] ?? null;
}

export function isValidCron(expr) {
  return /^(\S+ ){4}\S+$/.test(String(expr ?? '').trim());
}

export function getTriggerConfigError(triggerType, triggerConfig = {}) {
  if (triggerType === 'schedule') {
    if (!triggerConfig.cron?.trim()) return 'Cron expression is required for scheduled workflows.';
    if (!isValidCron(triggerConfig.cron)) return 'Cron expression must have 5 fields (for example "0 9 * * 1").';
  }

  if (triggerType === 'webhook') {
    if (!triggerConfig.webhookSecret?.trim()) return 'Webhook secret is required.';
    if (triggerConfig.webhookSecret.length < 8) return 'Webhook secret must be at least 8 characters.';
  }

  if (triggerType === 'event' && !triggerConfig.eventType?.trim()) {
    return 'Event type is required.';
  }

  return null;
}

function getNodeDisplayName(node, index) {
  return node?.data?.label?.trim() || node?.data?.agentName || node?.label || node?.agentId || `step ${index + 1}`;
}

export function getWorkflowDraftValidation({ triggerType = 'manual', triggerConfig = {}, nodes = [], edges = [] } = {}) {
  const blockingIssues = [];
  const guidance = [];
  const triggerConfigError = getTriggerConfigError(triggerType, triggerConfig);

  if (triggerConfigError) {
    blockingIssues.push(triggerConfigError);
  }

  if (nodes.length === 0) {
    blockingIssues.push('Add at least one agent step to the canvas.');
  }

  const missingPrompts = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !String(node?.data?.prompt ?? '').trim())
    .map(({ node, index }) => getNodeDisplayName(node, index));

  if (missingPrompts.length > 0) {
    blockingIssues.push(`Add a prompt for ${missingPrompts.slice(0, 3).join(', ')}${missingPrompts.length > 3 ? ', and the remaining empty steps' : ''}.`);
  }

  const missingOutputVars = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => !String(node?.data?.outputVar ?? '').trim())
    .map(({ node, index }) => getNodeDisplayName(node, index));

  if (missingOutputVars.length > 0) {
    blockingIssues.push(`Add an output variable for ${missingOutputVars.slice(0, 3).join(', ')}${missingOutputVars.length > 3 ? ', and the remaining empty steps' : ''}.`);
  }

  const duplicateOutputVars = Array.from(
    nodes.reduce((duplicates, node) => {
      const outputVar = String(node?.data?.outputVar ?? '').trim();
      if (!outputVar) {
        return duplicates;
      }
      duplicates.set(outputVar, (duplicates.get(outputVar) ?? 0) + 1);
      return duplicates;
    }, new Map())
      .entries(),
  )
    .filter(([, count]) => count > 1)
    .map(([outputVar]) => outputVar);

  if (duplicateOutputVars.length > 0) {
    blockingIssues.push(`Output variables must be unique. Fix ${duplicateOutputVars.slice(0, 3).join(', ')}${duplicateOutputVars.length > 3 ? ', and other duplicates' : ''}.`);
  }

  const invalidConditions = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => (
      (node?.data?.conditions ?? []).some((condition) => {
        if (!String(condition.field ?? '').trim()) {
          return true;
        }

        if (condition.operator === 'not_empty') {
          return false;
        }

        return !String(condition.value ?? '').trim();
      })
    ))
    .map(({ node, index }) => getNodeDisplayName(node, index));

  if (invalidConditions.length > 0) {
    blockingIssues.push(`Finish the condition fields on ${invalidConditions.slice(0, 3).join(', ')}${invalidConditions.length > 3 ? ', and the remaining gated steps' : ''}.`);
  }

  if (nodes.length > 1 && edges.length === 0) {
    guidance.push('Connect your steps so context can move between agents.');
  }

  const connectedNodeIds = new Set(edges.flatMap((edge) => [edge.source, edge.target]));
  const isolatedNodes = nodes
    .map((node, index) => ({ node, index }))
    .filter(({ node }) => nodes.length > 1 && !connectedNodeIds.has(node.id))
    .map(({ node, index }) => getNodeDisplayName(node, index));

  if (isolatedNodes.length > 0) {
    guidance.push(`These steps are isolated right now: ${isolatedNodes.slice(0, 3).join(', ')}${isolatedNodes.length > 3 ? ', and more' : ''}.`);
  }

  const nextStep = blockingIssues[0]
    ?? guidance[0]
    ?? 'Ready to save. You can still keep refining prompts or conditions before you run it live.';

  return {
    blockingIssues,
    guidance,
    nextStep,
    readyToSave: blockingIssues.length === 0,
  };
}
