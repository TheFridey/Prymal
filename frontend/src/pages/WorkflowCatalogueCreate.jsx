import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Link } from 'react-router-dom';
import { api } from '../lib/api';
import { getErrorMessage } from '../lib/utils';
import { Button, EmptyState, InlineNotice, LoadingPanel, PageHeader, PageShell, SurfaceCard } from '../components/ui';
import { useAppStore } from '../stores/useAppStore';

const CATEGORIES = ['Marketing', 'Sales', 'Content', 'Operations', 'Agencies', 'Support', 'Finance', 'Automation'];

export default function WorkflowCatalogueCreate() {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const workflowsQuery = useQuery({ queryKey: ['workflows'], queryFn: () => api.get('/workflows') });
  const workflows = workflowsQuery.data?.workflows ?? [];
  const [workflowId, setWorkflowId] = useState('');
  const [form, setForm] = useState({
    title: '',
    shortDescription: '',
    category: 'Automation',
    difficulty: 'beginner',
    expectedOutput: '',
    requiredInputs: '',
    pricingType: 'free',
  });

  const selectedWorkflow = useMemo(() => workflows.find((workflow) => workflow.id === workflowId), [workflowId, workflows]);

  const createMutation = useMutation({
    mutationFn: () => api.post(`/workflow-catalogue/from-workflow/${workflowId}`, {
      title: form.title || selectedWorkflow?.name,
      shortDescription: form.shortDescription,
      category: form.category,
      difficulty: form.difficulty,
      expectedOutput: splitLines(form.expectedOutput),
      requiredInputs: splitLines(form.requiredInputs),
      pricingType: form.pricingType,
    }),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['workflow-catalogue-mine'] });
      notify({ type: 'success', title: 'Draft created', message: 'Your workflow listing is ready to review and submit.' });
    },
    onError: (error) => notify({ type: 'error', title: 'Draft failed', message: getErrorMessage(error) }),
  });

  return (
    <PageShell>
      <PageHeader
        eyebrow="Workflow Catalogue"
        title="Share a workflow"
        description="Create a curated listing from one of your existing workflows, then submit it for review."
        accent="#4CC9F0"
        actions={<Link className="pm-btn pm-btn--ghost" to="/app/workflows/catalogue/submissions">View submissions</Link>}
      />
      <SurfaceCard title="Create listing draft" subtitle="Premium submissions are disabled while marketplace payments are being proven." accent="#4CC9F0">
        {workflowsQuery.isLoading ? <LoadingPanel label="Loading your workflows..." /> : null}
        {workflows.length === 0 && !workflowsQuery.isLoading ? (
          <EmptyState title="No workflows to share" description="Build a workflow first, then return here to create a catalogue listing." accent="#4CC9F0" />
        ) : (
          <form
            className="settings-panel__form"
            onSubmit={(event) => {
              event.preventDefault();
              createMutation.mutate();
            }}
          >
            <label>
              Source workflow
              <select required value={workflowId} onChange={(event) => setWorkflowId(event.target.value)}>
                <option value="">Choose a workflow</option>
                {workflows.map((workflow) => <option key={workflow.id} value={workflow.id}>{workflow.name}</option>)}
              </select>
            </label>
            <label>
              Title
              <input required value={form.title} onChange={(event) => setForm({ ...form, title: event.target.value })} />
            </label>
            <label>
              Short description
              <textarea required value={form.shortDescription} onChange={(event) => setForm({ ...form, shortDescription: event.target.value })} />
            </label>
            <label>
              Category
              <select value={form.category} onChange={(event) => setForm({ ...form, category: event.target.value })}>
                {CATEGORIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
              </select>
            </label>
            <label>
              Difficulty
              <select value={form.difficulty} onChange={(event) => setForm({ ...form, difficulty: event.target.value })}>
                <option value="beginner">Beginner</option>
                <option value="intermediate">Intermediate</option>
                <option value="advanced">Advanced</option>
              </select>
            </label>
            <label>
              Expected output
              <textarea required value={form.expectedOutput} onChange={(event) => setForm({ ...form, expectedOutput: event.target.value })} placeholder="One item per line" />
            </label>
            <label>
              Required inputs
              <textarea required value={form.requiredInputs} onChange={(event) => setForm({ ...form, requiredInputs: event.target.value })} placeholder="One item per line" />
            </label>
            <label>
              Pricing
              <select value={form.pricingType} onChange={(event) => setForm({ ...form, pricingType: event.target.value })}>
                <option value="free">Free</option>
                <option value="premium" disabled>Premium - coming soon</option>
              </select>
            </label>
            <Button tone="accent" disabled={!workflowId || createMutation.isPending}>
              Create draft
            </Button>
          </form>
        )}
        {createMutation.isError ? <InlineNotice tone="danger">{getErrorMessage(createMutation.error)}</InlineNotice> : null}
      </SurfaceCard>
    </PageShell>
  );
}

function splitLines(value) {
  return String(value ?? '').split('\n').map((entry) => entry.trim()).filter(Boolean);
}
