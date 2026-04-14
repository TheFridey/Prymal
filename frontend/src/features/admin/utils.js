import { truncate } from '../../lib/utils';

export function displayName(user) {
  const name = [user.firstName, user.lastName].filter(Boolean).join(' ').trim();
  return name || user.email || user.id;
}

export function matchesSearch(query, fields) {
  if (!query) {
    return true;
  }

  return fields.some((field) => String(field ?? '').toLowerCase().includes(query));
}

export function humanize(value) {
  return String(value ?? '')
    .replace(/[_-]+/g, ' ')
    .replace(/\b\w/g, (character) => character.toUpperCase());
}

export function getPercent(value, total) {
  const numerator = Number(value ?? 0);
  const denominator = Number(total ?? 0);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) {
    return 0;
  }
  return Math.min((numerator / denominator) * 100, 100);
}

export function getOrganisationAttentionScore(organisation) {
  let score = 0;
  if ((organisation.integrationCount ?? 0) === 0) score += 3;
  if ((organisation.workflowCount ?? 0) === 0) score += 2;
  if ((organisation.documentCount ?? 0) > 0 && (organisation.indexedDocumentCount ?? 0) === 0) score += 3;
  if ((organisation.pendingInvites ?? 0) > 0) score += 1;
  if (getPercent(organisation.creditsUsed, organisation.monthlyCreditLimit) >= 90) score += 2;
  return score;
}

export function getPlanTone(plan) {
  if (plan === 'agency') return 'violet';
  if (plan === 'teams') return 'blue';
  if (plan === 'pro') return 'mint';
  if (plan === 'solo') return 'amber';
  return 'slate';
}

export function getRoleTone(role) {
  if (role === 'owner') return 'rose';
  if (role === 'admin') return 'amber';
  return 'blue';
}

export function formatCurrency(amount, currency = 'gbp') {
  const normalizedAmount = Number(amount ?? 0);
  const normalizedCurrency = String(currency ?? 'gbp').toUpperCase();

  return new Intl.NumberFormat('en-GB', {
    style: 'currency',
    currency: normalizedCurrency,
    maximumFractionDigits: 0,
  }).format(normalizedAmount / 100);
}

export function flattenMeta(meta) {
  try {
    return JSON.stringify(meta ?? {});
  } catch {
    return '';
  }
}

export function summarizeMeta(meta) {
  if (!meta || typeof meta !== 'object') {
    return 'No metadata attached.';
  }

  const entries = Object.entries(meta)
    .filter(([key]) => !['conversationId', 'workflowId', 'documentId'].includes(key))
    .slice(0, 3)
    .map(([key, value]) => `${humanize(key)}: ${truncate(String(value), 36)}`);
  return entries.length > 0 ? entries.join(' / ') : 'No metadata attached.';
}

export function getActivityTitle(entry) {
  const label = String(entry.label ?? '');
  const titles = {
    'activation.useful_output': 'Useful output created',
    'chat.message_completed': 'Chat response completed',
    'onboarding.completed': 'Workspace onboarding completed',
    'team.invitation.sent': 'Team invitation sent',
    'team.member.joined': 'Teammate joined workspace',
    'staff.admin.organisation_updated': 'Workspace controls updated',
    'staff.admin.user_updated': 'User record updated',
  };

  return titles[label] ?? humanize(label.replace(/^staff\.admin\./, ''));
}

export function getActivityHighlights(entry) {
  const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const chips = [entry.kind === 'audit' ? 'Audit log' : 'Product event'];

  if (meta.agentId) chips.push(humanize(meta.agentId));
  if (meta.outputType) chips.push(humanize(meta.outputType));
  if (meta.orgName) chips.push(meta.orgName);
  if (entry.targetType) chips.push(humanize(entry.targetType));
  if (meta.conversationId) chips.push(`Chat ${truncate(String(meta.conversationId), 10)}`);
  if (meta.workflowId) chips.push(`Workflow ${truncate(String(meta.workflowId), 10)}`);
  if (meta.documentId) chips.push(`Doc ${truncate(String(meta.documentId), 10)}`);

  return chips.slice(0, 4);
}

export function describeActivity(entry) {
  const label = String(entry.label ?? '');
  const meta = entry.meta && typeof entry.meta === 'object' ? entry.meta : {};
  const actor = entry.kind === 'audit'
    ? (entry.actorUserId ? `Staff ${truncate(entry.actorUserId, 12)}` : 'Prymal staff')
    : (entry.actorUserId ? `User ${truncate(entry.actorUserId, 12)}` : 'The platform');
  const agent = meta.agentId ? humanize(meta.agentId) : null;
  const target = meta.orgName
    ? meta.orgName
    : entry.targetType
      ? `${humanize(entry.targetType)}${entry.targetId ? ` ${truncate(entry.targetId, 12)}` : ''}`
      : 'the platform';

  if (label === 'activation.useful_output') {
    const output = meta.outputType ? humanize(meta.outputType).toLowerCase() : 'useful output';
    return `${actor} produced a ${output}${agent ? ` with ${agent}` : ''}.`;
  }

  if (label === 'chat.message_completed') {
    return `${actor} finished a conversation response${agent ? ` with ${agent}` : ''}.`;
  }

  if (label === 'onboarding.completed') {
    return `${actor} completed workspace onboarding for ${target}.`;
  }

  if (label === 'team.invitation.sent') {
    return `${actor} sent a teammate invitation for ${target}.`;
  }

  if (label === 'team.member.joined') {
    return `${actor} joined a workspace and consumed a seat in ${target}.`;
  }

  if (label === 'staff.admin.organisation_updated') {
    return `${actor} updated workspace plan, credits, or seat controls for ${target}.`;
  }

  if (label === 'staff.admin.user_updated') {
    return `${actor} updated a user's access or organisation assignment.`;
  }

  if (entry.kind === 'audit') {
    return `${actor} changed ${target}.`;
  }

  return `${actor} triggered ${humanize(label).toLowerCase()} in ${target}.`;
}
