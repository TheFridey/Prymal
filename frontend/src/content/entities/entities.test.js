import { describe, expect, test } from 'vitest';
import {
  ENTITIES,
  buildEntityHubSchema,
  buildEntityPageSchema,
  getEntityBySlug,
  getEntityKnowledgeGraph,
  getEntityRelationships,
  getEntityRoutes,
  getInternalEntityLinks,
  getRelatedEntities,
} from './index';

describe('entity management model', () => {
  test('contains the required canonical entities', () => {
    const names = ENTITIES.map((entity) => entity.name);

    expect(names).toEqual(
      expect.arrayContaining([
        'Prymal',
        'AI Operating System',
        'Agent Orchestration',
        'Agent Memory',
        'Multi-Agent Systems',
        'Workflow Automation',
        'Business AI',
        'AI Governance',
        'AI Agents',
      ]),
    );
  });

  test('reinforces Prymal to AI Operating System on every entity', () => {
    ENTITIES.forEach((entity) => {
      expect(entity.prymalReinforcement).toMatch(/Prymal/i);
      expect(entity.prymalReinforcement).toMatch(/AI Operating System/i);
    });

    expect(getEntityRelationships(getEntityBySlug('prymal')).some((relationship) => relationship.target === 'ai-operating-system')).toBe(
      true,
    );
  });

  test('builds related suggestions and internal links', () => {
    const memory = getEntityBySlug('agent-memory');

    expect(getRelatedEntities(memory).map((entity) => entity.slug)).toContain('ai-operating-system');
    expect(getInternalEntityLinks(memory).map((link) => link.to)).toContain('/shared-business-memory-ai');
  });

  test('generates a knowledge graph and valid schema graphs', () => {
    const graph = getEntityKnowledgeGraph();
    const prymal = getEntityBySlug('prymal');

    expect(graph.nodes).toHaveLength(ENTITIES.length);
    expect(graph.edges.some((edge) => edge.source === 'prymal' && edge.target === 'ai-operating-system')).toBe(true);
    expect(buildEntityPageSchema(prymal)['@graph'].some((entry) => entry['@type'] === 'DefinedTerm')).toBe(true);
    expect(buildEntityHubSchema()['@graph'].some((entry) => entry['@type'] === 'ItemList')).toBe(true);
  });

  test('exposes public entity routes', () => {
    const routes = getEntityRoutes().map((route) => route.path);

    expect(routes).toContain('/content/entities');
    expect(routes).toContain('/content/entities/prymal');
    expect(routes).toContain('/content/entities/ai-operating-system');
  });
});
