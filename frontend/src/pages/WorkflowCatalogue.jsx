import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Link, useSearchParams } from 'react-router-dom';
import { api } from '../lib/api';
import { formatNumber, getErrorMessage } from '../lib/utils';
import { EmptyState, InlineNotice, LoadingPanel, PageHeader, PageShell, StatusPill, SurfaceCard } from '../components/ui';

const CATEGORIES = ['Featured', 'Marketing', 'Sales', 'Content', 'Operations', 'Agencies', 'Support', 'Finance', 'Automation', 'Research', 'Strategy'];
const DIFFICULTIES = ['beginner', 'intermediate', 'advanced'];

export default function WorkflowCatalogue() {
  const [searchParams] = useSearchParams();
  const requestedMode = searchParams.get('mode');
  const [category, setCategory] = useState('Featured');
  const [pricingType, setPricingType] = useState('all');
  const [difficulty, setDifficulty] = useState('all');
  const [publisher, setPublisher] = useState('all');
  const [modeTag, setModeTag] = useState(['simple', 'advanced'].includes(requestedMode) ? requestedMode : 'all');

  const query = useQuery({
    queryKey: ['workflow-catalogue', category, pricingType, difficulty, modeTag],
    queryFn: () => {
      const params = new URLSearchParams({ sort: category === 'Featured' ? 'official' : 'popular' });
      if (category !== 'Featured') params.set('category', category);
      if (pricingType !== 'all') params.set('pricingType', pricingType);
      if (difficulty !== 'all') params.set('difficulty', difficulty);
      if (modeTag !== 'all') params.set('tag', modeTag);
      return api.get(`/workflow-catalogue?${params.toString()}`);
    },
  });

  const items = useMemo(() => {
    const all = query.data?.items ?? [];
    if (publisher === 'official') return all.filter((item) => item.publisherType === 'prymal_official');
    if (publisher === 'community') return all.filter((item) => item.publisherType === 'user_creator');
    return all;
  }, [publisher, query.data?.items]);

  const featuredOfficial = items.filter((item) => item.publisherType === 'prymal_official').slice(0, 3);
  const startSimple = items.filter((item) => item.tags?.includes('simple')).slice(0, 4);
  const advancedSystems = items.filter((item) => item.tags?.includes('advanced')).slice(0, 4);

  return (
    <PageShell>
      <PageHeader
        eyebrow="NEXUS"
        title="Workflow Catalogue"
        description="Start from proven workflows, customise them, and build your own."
        accent="#4CC9F0"
        actions={<Link className="pm-btn pm-btn--primary" to="/app/workflows/catalogue/create">Share a workflow</Link>}
      />

      <SurfaceCard
        title="Browse proven workflows"
        subtitle="Install a workflow into your workspace, then run it through normal Prymal credits and usage controls."
        accent="#4CC9F0"
      >
        <div className="workflow-catalogue-filters">
          {CATEGORIES.map((entry) => (
            <button key={entry} type="button" className={`pm-filter-chip${category === entry ? ' is-active' : ''}`} onClick={() => setCategory(entry)}>
              {entry}
            </button>
          ))}
        </div>
        <div className="workflow-catalogue-controls">
          <select className="workflow-catalogue-select" aria-label="Pricing filter" value={pricingType} onChange={(event) => setPricingType(event.target.value)}>
            <option value="all">Free / Premium</option>
            <option value="free">Free</option>
            <option value="premium">Premium</option>
          </select>
          <select className="workflow-catalogue-select" aria-label="Difficulty filter" value={difficulty} onChange={(event) => setDifficulty(event.target.value)}>
            <option value="all">All difficulty</option>
            {DIFFICULTIES.map((entry) => <option key={entry} value={entry}>{entry}</option>)}
          </select>
          <select className="workflow-catalogue-select" aria-label="Publisher filter" value={publisher} onChange={(event) => setPublisher(event.target.value)}>
            <option value="all">Official / Community</option>
            <option value="official">Official</option>
            <option value="community">Community</option>
          </select>
          <div className="workflow-catalogue-mode-filter" role="group" aria-label="Simple or advanced filter">
            {['all', 'simple', 'advanced'].map((entry) => (
              <button key={entry} type="button" className={`pm-filter-chip${modeTag === entry ? ' is-active' : ''}`} onClick={() => setModeTag(entry)}>
                {entry === 'all' ? 'All modes' : entry === 'simple' ? 'Simple' : 'Advanced'}
              </button>
            ))}
          </div>
        </div>

        {query.isLoading ? <LoadingPanel label="Loading workflow catalogue..." /> : null}
        {query.isError ? <InlineNotice tone="danger">{getErrorMessage(query.error)}</InlineNotice> : null}
        {!query.isLoading && items.length === 0 ? (
          <EmptyState title="No workflows found" description="Try a different category or filter. Curated workflows are added through the admin review queue." accent="#4CC9F0" />
        ) : null}

        {featuredOfficial.length ? <Collection title="Featured official workflows" items={featuredOfficial} /> : null}
        {startSimple.length ? <Collection title="Start simple" items={startSimple} compact /> : null}
        {advancedSystems.length ? <Collection title="Advanced systems" items={advancedSystems} compact /> : null}

        <div className="workflow-catalogue-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(260px, 1fr))', gap: 14, marginTop: 18 }}>
          {items.map((item) => <WorkflowCard key={item.id} item={item} />)}
        </div>
      </SurfaceCard>
    </PageShell>
  );
}

function Collection({ title, items, compact = false }) {
  return (
    <section style={{ display: 'grid', gap: 12, marginBottom: 20 }} aria-labelledby={`${slugify(title)}-heading`}>
      <h2 id={`${slugify(title)}-heading`} style={{ margin: 0, color: 'var(--text-strong)', fontSize: compact ? '1rem' : '1.2rem' }}>{title}</h2>
      <div className="workflow-catalogue-grid" style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(240px, 1fr))', gap: 12 }}>
        {items.map((item) => <WorkflowCard key={`${title}-${item.id}`} item={item} compact={compact} />)}
      </div>
    </section>
  );
}

function WorkflowCard({ item, compact = false }) {
  const mode = item.tags?.includes('advanced') ? 'advanced' : 'simple';

  return (
    <Link to={`/app/workflows/catalogue/${item.slug}`} className="workflow-catalogue-card" style={{ textDecoration: 'none' }}>
      <article className="workspace-workflow-panel__workflow" style={{ height: '100%', padding: 16 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 10 }}>
          <StatusPill color={item.publisherType === 'prymal_official' ? '#00FFD1' : '#BDE0FE'}>
            {item.publisherType === 'prymal_official' ? 'Official' : 'Community'}
          </StatusPill>
          <StatusPill color={mode === 'advanced' ? '#BDB4FE' : '#00FFD1'}>{mode === 'advanced' ? 'Advanced' : 'Simple'}</StatusPill>
          <StatusPill color={item.pricingType === 'premium' ? '#F59E0B' : '#22C55E'}>
            {item.pricingType === 'premium' ? 'Premium coming soon' : 'Free'}
          </StatusPill>
        </div>
        <h3 style={{ margin: '0 0 8px' }}>{item.title}</h3>
        <p style={{ color: 'var(--text-muted)', minHeight: compact ? 0 : 44 }}>{item.shortDescription}</p>
        <div className="workspace-workflow-panel__workflow-meta">
          <span>{item.category}</span>
          <span>{item.difficulty}</span>
          <span>{item.expectedRuntimeLabel || 'Runtime varies'}</span>
        </div>
        <div className="workspace-workflow-panel__workflow-meta" style={{ marginTop: 10 }}>
          <span>{formatNumber(item.estimatedExecutionCredits ?? 0)} credits est.</span>
          <span>{formatNumber(item.installCount ?? 0)} installs</span>
          <span>{item.ratingAverage ? `${item.ratingAverage.toFixed(1)} rating` : 'No rating yet'}</span>
        </div>
        {!compact ? (
          <div className="workflow-catalogue-card__blueprint" aria-hidden="true">
            <div className="workflow-blueprint workflow-blueprint--compact" style={{ '--workflow-blueprint-accent': mode === 'advanced' ? '#BDB4FE' : '#00FFD1' }}>
              <ol className="workflow-blueprint__rail">
                <li className="workflow-blueprint__step"><div className="workflow-blueprint__node"><span className="workflow-blueprint__node-index">1</span></div><div className="workflow-blueprint__node-copy"><strong>Trigger</strong><span>Manual run</span></div></li>
                <li className="workflow-blueprint__step"><div className="workflow-blueprint__node"><span className="workflow-blueprint__node-index">2</span></div><div className="workflow-blueprint__node-copy"><strong>Agents</strong><span>{mode === 'advanced' ? 'Multi-step' : 'Guided'}</span></div></li>
                <li className="workflow-blueprint__step"><div className="workflow-blueprint__node"><span className="workflow-blueprint__node-index">3</span></div><div className="workflow-blueprint__node-copy"><strong>Output</strong><span>Structured</span></div></li>
              </ol>
            </div>
          </div>
        ) : null}
      </article>
    </Link>
  );
}

function slugify(value) {
  return value.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-+|-+$/g, '');
}
