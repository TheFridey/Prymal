import { describe, expect, test } from 'vitest';
import {
  WORKFLOW_TEMPLATES,
  createWorkflowTemplatePayload,
  findWorkflowTemplate,
  getFeaturedWorkflowTemplates,
  getRecommendedWorkflowTemplateForProfile,
} from './workflow-templates';

describe('workflow templates', () => {
  test('ships ten default workflow blueprints with unique slugs', () => {
    expect(WORKFLOW_TEMPLATES).toHaveLength(10);

    const slugs = WORKFLOW_TEMPLATES.map((template) => template.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  test('builds workflow payloads without UI-only template metadata', () => {
    const payload = createWorkflowTemplatePayload('support-triage-and-response');

    expect(payload).toMatchObject({
      name: 'Support Triage and Response',
      triggerType: 'event',
      triggerConfig: { eventType: 'support.ticket.created' },
    });
    expect(payload.nodes).toHaveLength(5);
    expect(payload.edges).toHaveLength(5);
    expect(payload.nodes[0]).not.toHaveProperty('position');
  });

  test('finds templates by slug or name', () => {
    expect(findWorkflowTemplate('weekly-client-report')?.name).toBe('Weekly Client Report');
    expect(findWorkflowTemplate('Launch Campaign War Room')?.slug).toBe('launch-campaign-war-room');
  });

  test('returns featured workflow templates for dashboard quick starts', () => {
    expect(getFeaturedWorkflowTemplates(4)).toHaveLength(4);
    expect(getFeaturedWorkflowTemplates(4).every((template) => template.featured)).toBe(true);
  });

  test('recommends strong workflows for onboarding profiles', () => {
    expect(
      getRecommendedWorkflowTemplateForProfile({
        primaryGoal: 'Handle support and client comms',
        workspaceFocus: 'agency',
      })?.slug,
    ).toBe('support-triage-and-response');

    expect(
      getRecommendedWorkflowTemplateForProfile({
        primaryGoal: 'Run weekly reporting',
        workspaceFocus: 'service_business',
      })?.slug,
    ).toBe('weekly-client-report');
  });
});
