import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { CommandPaletteDialog } from '../../../components/CommandPaletteDialog';
import { api } from '../../../lib/api';
// Motion imports — MotionList, MotionListItem, MotionPresence are used inside CommandPaletteDialog
import { MotionList, MotionListItem, MotionPresence } from '../../../components/motion';

const KIND_META = {
  destination: { label: 'Jump', accent: '#6d8aff' },
  agent: { label: 'Agent', accent: '#18c7a0' },
  conversation: { label: 'Chat', accent: '#ff9f43' },
};

function scoreMatch(text, query) {
  const haystack = String(text ?? '').toLowerCase();
  const needle = query.toLowerCase();

  if (haystack === needle) return 4;
  if (haystack.startsWith(needle)) return 3;
  if (haystack.includes(needle)) return 2;
  return 0;
}

export function WorkspaceCommandPalette({
  railItems = [],
  agents = [],
  onNavigate,
  onClose,
}) {
  const [query, setQuery] = useState('');
  const trimmedQuery = query.trim();

  const conversationsQuery = useQuery({
    queryKey: ['workspace-command-search', trimmedQuery],
    queryFn: () => api.get(`/agents/conversations/search?q=${encodeURIComponent(trimmedQuery)}`),
    enabled: trimmedQuery.length >= 2,
    staleTime: 10_000,
  });

  const results = useMemo(() => {
    const baseDestinations = railItems.map((item) => ({
      kind: 'destination',
      id: item.to,
      title: item.label,
      subtitle: 'Open this workspace surface.',
      to: item.to,
      score: trimmedQuery ? scoreMatch(item.label, trimmedQuery) + 8 : 1,
    }));

    const agentResults = agents.map((agent) => ({
      kind: 'agent',
      id: agent.id,
      title: agent.name,
      subtitle: agent.title ?? agent.description ?? 'Open agent workspace',
      to: `/app/agents/${agent.id}`,
      score: trimmedQuery
        ? Math.max(
            scoreMatch(agent.name, trimmedQuery),
            scoreMatch(agent.title, trimmedQuery),
            scoreMatch(agent.description, trimmedQuery),
          ) + 6
        : 1,
    }));

    const conversationResults = (conversationsQuery.data?.conversations ?? []).map((conversation) => ({
      kind: 'conversation',
      id: conversation.id,
      title: conversation.title || 'Untitled conversation',
      subtitle: `${conversation.agentId} | recent conversation`,
      to: `/app/agents/${conversation.agentId}?cid=${conversation.id}`,
      score: trimmedQuery
        ? Math.max(
            scoreMatch(conversation.title, trimmedQuery),
            scoreMatch(conversation.agentId, trimmedQuery),
            scoreMatch(conversation.id, trimmedQuery),
          ) + 10
        : 0,
    }));

    return [...baseDestinations, ...agentResults, ...conversationResults]
      .filter((item) => item.score > 0)
      .sort((left, right) => right.score - left.score || left.title.localeCompare(right.title))
      .slice(0, 14)
      .map((item) => ({
        ...item,
        kindLabel: KIND_META[item.kind]?.label ?? 'Item',
        accent: KIND_META[item.kind]?.accent ?? '#6d8aff',
      }));
  }, [agents, conversationsQuery.data?.conversations, railItems, trimmedQuery]);

  return (
    <CommandPaletteDialog
      title="Workspace command"
      query={query}
      onQueryChange={setQuery}
      placeholder="Jump to an agent, page, or recent conversation"
      results={results}
      onSelect={(result) => {
        onNavigate(result.to);
        onClose();
      }}
      onClose={onClose}
      emptyLabel={
        conversationsQuery.isLoading
          ? 'Searching workspace history...'
          : 'No matching destinations, agents, or recent conversations.'
      }
    />
  );
}
