export function buildMemoryExplanation(memoryRow, opts = {}) {
  const learned =
    memoryRow.createdAt instanceof Date ? memoryRow.createdAt.toISOString().slice(0, 10) : String(memoryRow.createdAt ?? '');
  const sourceType = memoryRow.memorySourceKind ?? 'conversation';
  const confidenceScore = memoryRow.confidence ?? 0.7;

  const answer = `I know this because it was recorded as ${sourceType.replace(/_/g, ' ')} memory on ${learned}.`;

  const canEdit =
    opts.actorRole === 'admin'
    || opts.actorRole === 'owner'
    || (memoryRow.scope === 'user' && opts.actorUserId && memoryRow.userId === opts.actorUserId);

  const canDelete = canEdit && memoryRow.scope !== 'agent_private';

  return {
    memoryId: memoryRow.id,
    answer,
    sourceType,
    confidenceScore,
    scope: memoryRow.scope,
    visibility: memoryRow.visibility ?? 'org_shared',
    lastUsedAt: memoryRow.lastUsedAt ?? null,
    retrievedBecause:
      opts.retrievedBecause ?? 'Matched active policy filters and ranking for this agent turn.',
    canEdit,
    canDelete,
    provenanceKind: memoryRow.provenanceKind ?? 'inferred',
    authorityScore: memoryRow.authorityScore ?? memoryRow.authority_score ?? null,
  };
}
