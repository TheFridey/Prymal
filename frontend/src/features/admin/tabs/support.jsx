// features/admin/tabs/support.jsx
import { useMemo, useState } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api, createIdempotentRequestInit } from '../../../lib/api';
import { formatDate, formatDateTime, formatNumber, getErrorMessage } from '../../../lib/utils';
import { Button, LoadingPanel, TextInput } from '../../../components/ui';
import { useAppStore } from '../../../stores/useAppStore';
import { AGENT_ID_OPTIONS, EMPTY_POWERUP } from '../constants';

export function EmailQueueTab({ query, status, onStatusChange, onProcess, isProcessing }) {
  const rows = query.data?.queue ?? [];

  return (
    <div className="staff-admin__activity-grid">
      <section className="staff-admin__surface staff-admin__surface--full">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">System</div>
            <h2>Email queue</h2>
          </div>
          <div className="staff-admin__surface-meta" style={{ display: 'flex', gap: '8px', alignItems: 'center', flexWrap: 'wrap' }}>
            <select
              className="field"
              value={status}
              onChange={(event) => onStatusChange(event.target.value)}
              style={{ padding: '6px 10px', fontSize: '0.85rem' }}
            >
              <option value="pending">Pending</option>
              <option value="sent">Sent</option>
            </select>
            {status === 'pending' ? (
              <Button tone="accent" onClick={onProcess} disabled={isProcessing}>
                {isProcessing ? 'Processing…' : 'Process queue'}
              </Button>
            ) : null}
          </div>
        </div>

        {query.isLoading ? (
          <div className="staff-admin__empty">Loading email queue…</div>
        ) : rows.length === 0 ? (
          <div className="staff-admin__empty">{status === 'pending' ? 'No emails pending.' : 'No sent emails in this window.'}</div>
        ) : (
          <div className="staff-admin__ledger">
            <article className="staff-admin__ledger-row staff-admin__ledger-row--header">
              <div><strong>To</strong></div>
              <div><strong>Template</strong></div>
              <div><strong>{status === 'sent' ? 'Sent at' : 'Send after'}</strong></div>
            </article>
            {rows.map((entry) => (
              <article key={entry.id} className="staff-admin__ledger-row">
                <div><strong>{entry.toEmail}</strong></div>
                <div><span>{entry.templateName}</span></div>
                <div><span>{formatDateTime(status === 'sent' ? entry.sentAt : entry.sendAfter)}</span></div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function WaitlistTab({ query, searchValue, onSearchChange }) {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const entries = query.data?.entries ?? [];
  const total = query.data?.total ?? 0;
  const [selectedIds, setSelectedIds] = useState(new Set());

  const filtered = useMemo(() => {
    const q = searchValue.trim().toLowerCase();
    if (!q) return entries;
    return entries.filter((entry) =>
      String(entry.email ?? '').toLowerCase().includes(q) ||
      String(entry.source ?? '').toLowerCase().includes(q),
    );
  }, [entries, searchValue]);

  const inviteMutation = useMutation({
    mutationFn: (ids) => api.post('/admin/waitlist/batch-invite', { ids }),
    onSuccess: (data) => {
      notify({
        type: 'success',
        title: 'Invites queued',
        message: `${data.queued} invite${data.queued !== 1 ? 's' : ''} queued for delivery. ${data.skipped > 0 ? `${data.skipped} already invited.` : ''}`,
      });
      setSelectedIds(new Set());
      queryClient.invalidateQueries({ queryKey: ['staff-admin-waitlist'] });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Invite failed', message: getErrorMessage(error) });
    },
  });

  const allFilteredIds = filtered.map((e) => e.id);
  const allSelected = allFilteredIds.length > 0 && allFilteredIds.every((id) => selectedIds.has(id));

  function toggleAll() {
    if (allSelected) {
      setSelectedIds((prev) => {
        const next = new Set(prev);
        allFilteredIds.forEach((id) => next.delete(id));
        return next;
      });
    } else {
      setSelectedIds((prev) => new Set([...prev, ...allFilteredIds]));
    }
  }

  function toggleOne(id) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }

  function handleExport() {
    const a = document.createElement('a');
    a.href = '/api/admin/waitlist/export';
    a.download = 'prymal-waitlist.csv';
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  }

  return (
    <div className="staff-admin__activity-grid">
      <section className="staff-admin__surface staff-admin__surface--full">
        <div className="staff-admin__surface-head">
          <div>
            <div className="staff-admin__surface-label">Early access list</div>
            <h2>Waitlist signups</h2>
          </div>
          <div className="staff-admin__surface-meta">
            {query.isLoading ? 'Loading…' : `${formatNumber(total)} total signups`}
          </div>
        </div>

        <div className="staff-admin__command-bar" style={{ marginBottom: '16px' }}>
          <label className="staff-admin__field staff-admin__field--search">
            <span className="staff-admin__field-label">Filter by email</span>
            <TextInput
              value={searchValue}
              onChange={(event) => onSearchChange(event.target.value)}
              placeholder="Search by email or source…"
            />
          </label>
          <Button tone="ghost" onClick={handleExport}>
            Export CSV
          </Button>
        </div>

        {selectedIds.size > 0 ? (
          <div style={{ display: 'flex', alignItems: 'center', gap: '12px', padding: '10px 14px', marginBottom: '12px', borderRadius: '10px', background: 'rgba(76,201,240,0.08)', border: '1px solid rgba(76,201,240,0.25)' }}>
            <span style={{ fontSize: '13px', color: 'var(--muted)' }}>{selectedIds.size} selected</span>
            <Button
              tone="accent"
              onClick={() => inviteMutation.mutate([...selectedIds])}
              disabled={inviteMutation.isPending}
            >
              {inviteMutation.isPending ? 'Inviting…' : 'Send invites'}
            </Button>
            <Button tone="ghost" onClick={() => setSelectedIds(new Set())}>
              Clear
            </Button>
          </div>
        ) : null}

        {query.isLoading ? (
          <div className="staff-admin__empty">Loading waitlist…</div>
        ) : filtered.length === 0 ? (
          <div className="staff-admin__empty">No entries matched your search.</div>
        ) : (
          <div className="staff-admin__ledger">
            <article className="staff-admin__ledger-row staff-admin__ledger-row--header">
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} style={{ cursor: 'pointer' }} />
                <strong>Email</strong>
              </div>
              <div><strong>Source</strong></div>
              <div><strong>Signed up</strong></div>
              <div><strong>Status</strong></div>
            </article>
            {filtered.map((entry) => (
              <article key={entry.id} className="staff-admin__ledger-row" style={{ opacity: entry.invitedAt ? 0.7 : 1 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                  <input
                    type="checkbox"
                    checked={selectedIds.has(entry.id)}
                    onChange={() => toggleOne(entry.id)}
                    style={{ cursor: 'pointer' }}
                  />
                  <strong>{entry.email}</strong>
                </div>
                <div><span>{entry.source ?? 'landing'}</span></div>
                <div><span>{formatDate(entry.createdAt)}</span></div>
                <div>
                  {entry.invitedAt
                    ? <span style={{ fontSize: '11px', padding: '2px 7px', borderRadius: '999px', background: 'rgba(24,199,160,0.12)', color: '#18c7a0', border: '1px solid rgba(24,199,160,0.3)' }}>Invited {formatDate(entry.invitedAt)}</span>
                    : <span style={{ fontSize: '11px', color: 'var(--muted)' }}>Pending</span>
                  }
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

export function PowerUpsTab({ query }) {
  const queryClient = useQueryClient();
  const notify = useAppStore((state) => state.addNotification);
  const [form, setForm] = useState(EMPTY_POWERUP);
  const [editingId, setEditingId] = useState(null);

  const powerups = query.data?.powerups ?? [];

  const saveMutation = useMutation({
    mutationFn: (payload) =>
      editingId
        ? api.patch(`/admin/powerups/${editingId}`, payload, createIdempotentRequestInit('admin-powerup-save'))
        : api.post('/admin/powerups', payload, createIdempotentRequestInit('admin-powerup-create')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-admin-powerups'] });
      setForm(EMPTY_POWERUP);
      setEditingId(null);
      notify({ type: 'success', title: editingId ? 'Power-up updated' : 'Power-up created', message: '' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Save failed', message: getErrorMessage(error, 'Could not save power-up.') });
    },
  });

  const deleteMutation = useMutation({
    mutationFn: (id) => api.delete(`/admin/powerups/${id}`, createIdempotentRequestInit('admin-powerup-delete')),
    onSuccess: async () => {
      await queryClient.invalidateQueries({ queryKey: ['staff-admin-powerups'] });
      notify({ type: 'success', title: 'Power-up deleted', message: '' });
    },
    onError: (error) => {
      notify({ type: 'error', title: 'Delete failed', message: getErrorMessage(error, 'Could not delete power-up.') });
    },
  });

  function startEdit(row) {
    setEditingId(row.id);
    setForm({ agentId: row.agentId, slug: row.slug, name: row.name, prompt: row.prompt });
  }

  function cancelEdit() {
    setEditingId(null);
    setForm(EMPTY_POWERUP);
  }

  return (
    <div style={{ display: 'grid', gap: '24px' }}>
      <section>
        <div className="section-label">{ editingId ? 'Edit power-up' : 'New power-up' }</div>
        <div style={{ display: 'grid', gap: '10px', maxWidth: '640px' }}>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '10px' }}>
            <div>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Agent</span>
                <select
                  value={form.agentId}
                  onChange={(e) => setForm((current) => ({ ...current, agentId: e.target.value }))}
                  style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--panel-soft)', color: 'var(--text-strong)', fontSize: '13px' }}
                >
                  {AGENT_ID_OPTIONS.map((id) => <option key={id} value={id}>{id}</option>)}
                </select>
              </label>
            </div>
            <div>
              <label style={{ display: 'grid', gap: '4px' }}>
                <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Slug (kebab-case)</span>
                <TextInput
                  value={form.slug}
                  onChange={(e) => setForm((current) => ({ ...current, slug: e.target.value }))}
                  placeholder="my-powerup"
                  disabled={Boolean(editingId)}
                />
              </label>
            </div>
          </div>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Name</span>
            <TextInput
              value={form.name}
              onChange={(e) => setForm((current) => ({ ...current, name: e.target.value }))}
              placeholder="Power-up name"
            />
          </label>
          <label style={{ display: 'grid', gap: '4px' }}>
            <span style={{ fontSize: '12px', color: 'var(--muted)' }}>Prompt template (use {'{{variable}}'} for inputs)</span>
            <textarea
              value={form.prompt}
              onChange={(e) => setForm((current) => ({ ...current, prompt: e.target.value }))}
              placeholder="Write a {{tone}} email about {{topic}}."
              rows={5}
              style={{ padding: '10px 14px', borderRadius: '12px', border: '1px solid var(--line)', background: 'var(--panel-soft)', color: 'var(--text-strong)', fontSize: '13px', resize: 'vertical', fontFamily: 'inherit' }}
            />
          </label>
          <div style={{ display: 'flex', gap: '10px' }}>
            <Button
              tone="accent"
              disabled={saveMutation.isPending || !form.slug.trim() || !form.name.trim() || !form.prompt.trim()}
              onClick={() => saveMutation.mutate(form)}
            >
              {saveMutation.isPending ? 'Saving...' : editingId ? 'Save changes' : 'Create power-up'}
            </Button>
            {editingId ? <Button tone="ghost" onClick={cancelEdit}>Cancel</Button> : null}
          </div>
        </div>
      </section>

      <section>
        <div className="section-label">Custom power-ups ({powerups.length})</div>
        {query.isLoading ? <LoadingPanel label="Loading power-ups..." /> : null}
        {!query.isLoading && powerups.length === 0 ? (
          <p style={{ color: 'var(--muted)', fontSize: '14px' }}>No custom power-ups yet. Create one above.</p>
        ) : (
          <div className="staff-admin__ledger">
            <article className="staff-admin__ledger-row staff-admin__ledger-row--header">
              <div><strong>Name</strong></div>
              <div><strong>Agent</strong></div>
              <div><strong>Slug</strong></div>
              <div><strong>Actions</strong></div>
            </article>
            {powerups.map((row) => (
              <article key={row.id} className="staff-admin__ledger-row">
                <div><strong>{row.name}</strong></div>
                <div><span>{row.agentId}</span></div>
                <div style={{ fontFamily: 'monospace', fontSize: '12px' }}>{row.slug}</div>
                <div style={{ display: 'flex', gap: '8px' }}>
                  <button
                    type="button"
                    onClick={() => startEdit(row)}
                    style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', border: '1px solid var(--line)', background: 'transparent', color: 'var(--text-strong)', cursor: 'pointer' }}
                  >
                    Edit
                  </button>
                  <button
                    type="button"
                    onClick={() => { if (window.confirm(`Delete "${row.name}"?`)) deleteMutation.mutate(row.id); }}
                    style={{ fontSize: '12px', padding: '4px 12px', borderRadius: '999px', border: '1px solid #ef4444', background: 'transparent', color: '#ef4444', cursor: 'pointer' }}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
