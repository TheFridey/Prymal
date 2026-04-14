import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CommandPaletteDialog } from '../../components/CommandPaletteDialog';
import { api } from '../../lib/api';
import { humanize } from './utils';

const TAB_COMMANDS = [
  { id: 'overview', label: 'Overview dashboard' },
  { id: 'organisations', label: 'Organisations' },
  { id: 'users', label: 'Users directory' },
  { id: 'billing', label: 'Billing and invoices' },
  { id: 'revenue', label: 'Revenue analytics' },
  { id: 'traces', label: 'Trace center' },
  { id: 'evals', label: 'Eval summaries' },
  { id: 'scorecards', label: 'Agent scorecards' },
  { id: 'model-usage', label: 'Model usage' },
  { id: 'workflow-ops', label: 'Workflow operations' },
  { id: 'audit-logs', label: 'Audit logs' },
  { id: 'credit-usage', label: 'Credit usage' },
  { id: 'product-events', label: 'Product events' },
  { id: 'waitlist', label: 'Waitlist' },
  { id: 'email-queue', label: 'Email queue' },
  { id: 'powerups', label: 'Power-ups' },
];

const KIND_META = {
  tab: { label: 'Tab', accent: '#8b5cf6' },
  organisation: { label: 'Org', accent: '#18c7a0' },
  user: { label: 'User', accent: '#58a6ff' },
  workflow: { label: 'Flow', accent: '#9b8cff' },
  workflow_run: { label: 'Run', accent: '#ff9f43' },
  trace: { label: 'Trace', accent: '#f97316' },
  lore_document: { label: 'Lore', accent: '#8b5cf6' },
  memory: { label: 'Memory', accent: '#14b8a6' },
  billing_entity: { label: 'Billing', accent: '#22c55e' },
};

function scoreMatch(text, query) {
  const haystack = String(text ?? '').toLowerCase();
  const needle = query.toLowerCase();

  if (haystack === needle) return 4;
  if (haystack.startsWith(needle)) return 3;
  if (haystack.includes(needle)) return 2;
  return 0;
}

export function AdminCommandPalette({
  organisations = [],
  users = [],
  onNavigateTab,
  onSelectOrg,
  onSelectUser,
  onSelectTrace,
  onSelectWorkflowRun,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const remoteSearchQuery = useQuery({
    queryKey: ['staff-admin-search', trimmedQuery],
    queryFn: () => api.get(`/admin/search?q=${encodeURIComponent(trimmedQuery)}&limit=6`),
    enabled: trimmedQuery.length >= 2,
    staleTime: 10_000,
  });

  const results = useMemo(() => {
    if (!trimmedQuery) {
      return TAB_COMMANDS.map((command) => ({
        kind: 'tab',
        id: command.id,
        title: command.label,
        subtitle: 'Jump directly to this control-plane surface.',
      }));
    }

    const localResults = [
      ...TAB_COMMANDS.map((command) => ({
        kind: 'tab',
        id: command.id,
        title: command.label,
        subtitle: 'Navigation shortcut',
        score: scoreMatch(command.label, trimmedQuery) + 10,
      })),
      ...organisations.map((organisation) => ({
        kind: 'organisation',
        id: organisation.id,
        title: organisation.name,
        subtitle: `${humanize(organisation.plan)} workspace | ${organisation.slug}`,
        score:
          Math.max(
            scoreMatch(organisation.name, trimmedQuery),
            scoreMatch(organisation.slug, trimmedQuery),
            scoreMatch(organisation.id, trimmedQuery),
          ) + 6,
      })),
      ...users.map((user) => {
        const name = [user.firstName, user.lastName].filter(Boolean).join(' ') || user.email;
        return {
          kind: 'user',
          id: user.id,
          title: name,
          subtitle: `${user.email} | ${humanize(user.role)}`,
          score:
            Math.max(
              scoreMatch(name, trimmedQuery),
              scoreMatch(user.email, trimmedQuery),
              scoreMatch(user.id, trimmedQuery),
            ) + 4,
        };
      }),
    ].filter((item) => item.score > 0);

    const remoteResults = (remoteSearchQuery.data?.results ?? []).map((item) => ({
      ...item,
      score:
        Math.max(
          scoreMatch(item.title, trimmedQuery),
          scoreMatch(item.subtitle, trimmedQuery),
          scoreMatch(item.id, trimmedQuery),
        ) + 8,
      subtitle: item.subtitle,
    }));

    const merged = [...localResults, ...remoteResults]
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, 14);

    return merged;
  }, [organisations, remoteSearchQuery.data?.results, trimmedQuery, users]);

  function handleSelect(result) {
    if (result.kind === 'tab') {
      onNavigateTab(result.id);
      onClose();
      return;
    }

    if (result.kind === 'organisation') {
      onSelectOrg(result.orgId ?? result.id);
      onClose();
      return;
    }

    if (result.kind === 'user') {
      onSelectUser(result.userId ?? result.id);
      onClose();
      return;
    }

    if (result.kind === 'trace' && result.traceId) {
      onNavigateTab('traces');
      onSelectTrace(result.traceId);
      onClose();
      return;
    }

    if (result.kind === 'workflow_run' && result.workflowRunId) {
      onNavigateTab('workflow-ops');
      onSelectWorkflowRun(result.workflowRunId, result.orgId ?? null);
      onClose();
      return;
    }

    if (result.targetTab) {
      onNavigateTab(result.targetTab);
    }
    onClose();
  }

  const dialogResults = results.map((result) => ({
    ...result,
    kindLabel: KIND_META[result.kind]?.label ?? humanize(result.kind ?? 'item'),
    accent: KIND_META[result.kind]?.accent ?? '#8b5cf6',
  }));

  return (
    <CommandPaletteDialog
      title="Prymal staff command"
      query={query}
      onQueryChange={setQuery}
      placeholder="Jump to a tab, organisation, user, trace, workflow run, or knowledge record"
      results={dialogResults}
      onSelect={handleSelect}
      onClose={onClose}
      emptyLabel={
        remoteSearchQuery.isLoading
          ? 'Searching the control plane...'
          : 'No matching staff routes, organisations, users, traces, or workflow runs.'
      }
    />
  );
}
