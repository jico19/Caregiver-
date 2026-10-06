import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import { queryClient } from '../../../shared/lib/queryClient';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import FormField from '../../../shared/components/common/FormField';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import EmptyState from '../../../shared/components/common/EmptyState';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import Pagination from '../../../shared/components/common/Pagination';

const AUDIENCE_OPTIONS = [
  { value: 'caregiver', label: 'Caregivers' },
  { value: 'client', label: 'Clients' },
  { value: 'all', label: 'All Roles' },
];

const STATE_OPTIONS = [
  { value: '', label: 'All states' },
  { value: '1', label: 'Florida (FL)' },
  { value: '2', label: 'Indiana (IN)' },
  { value: '3', label: 'Georgia (GA)' },
];

const EMPTY_FORM = { title: '', body: '', audience: 'caregiver', state_id: '' };

export default function AnnouncementsPage() {
  const { token } = useAuth();
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const {
    items: announcements,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    reload,
  } = usePaginatedFetch({
    url: '/admin/announcements',
    token,
    listKey: 'announcements',
  });

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  function invalidateAnnouncementCaches() {
    queryClient.invalidateQueries({ queryKey: ['/caregivers/me/announcements'] });
    queryClient.invalidateQueries({ queryKey: ['/clients/me/announcements'] });
  }

  async function handleCreate(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    if (!form.title.trim() || !form.body.trim()) {
      setErrorMsg('Title and message body are required.');
      return;
    }
    setBusy(true);
    try {
      await api.post('/admin/announcements', {
        title: form.title.trim(),
        body: form.body.trim(),
        audience: form.audience,
        state_id: form.state_id ? parseInt(form.state_id, 10) : null,
        is_active: true,
      }, token);
      setSuccessMsg('Announcement published to the caregiver/client portals.');
      setForm(EMPTY_FORM);
      setPage(1);
      reload();
      invalidateAnnouncementCaches();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to create announcement.');
    } finally {
      setBusy(false);
    }
  }

  async function handleToggle(ann) {
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await api.patch(`/admin/announcements/${ann.id}`, { is_active: !ann.is_active }, token);
      reload();
      invalidateAnnouncementCaches();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update announcement.');
    }
  }

  async function handleDelete(ann) {
    setErrorMsg('');
    setSuccessMsg('');
    if (!window.confirm(`Delete announcement "${ann.title}"?`)) return;
    try {
      await api.delete(`/admin/announcements/${ann.id}`, token);
      setSuccessMsg('Announcement deleted.');
      reload();
      invalidateAnnouncementCaches();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to delete announcement.');
    }
  }

  return (
    <PageContainer>
      <PageHeader
        title="Announcements"
        description="Broadcast in-app messages to caregivers and clients. Announcements appear on the relevant portal dashboard."
      />

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-4 text-sm py-2 px-4 rounded-box">
          {successMsg}
        </div>
      )}

      <Card className="p-6 mb-6">
        <h2 className="text-base font-semibold text-slate-900 m-0 pb-3 mb-4 border-b border-base-200">
          Publish New Announcement
        </h2>
        <form onSubmit={handleCreate} className="space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <FormField label="Title" required htmlFor="ann-title">
              <input
                id="ann-title"
                type="text"
                maxLength={200}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="E.g., Holiday schedule update"
                className="input input-bordered input-sm w-full"
              />
            </FormField>
            <FormField label="Audience" required htmlFor="ann-audience">
              <select
                id="ann-audience"
                value={form.audience}
                onChange={(e) => setField('audience', e.target.value)}
                className="select select-bordered select-sm w-full"
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FormField>
            <FormField label="State" htmlFor="ann-state">
              <select
                id="ann-state"
                value={form.state_id}
                onChange={(e) => setField('state_id', e.target.value)}
                className="select select-bordered select-sm w-full"
              >
                {STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </FormField>
          </div>
          <FormField label="Message" required htmlFor="ann-body">
            <textarea
              id="ann-body"
              rows={3}
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
              placeholder="Short in-app message shown on the portal dashboard."
              className="textarea textarea-bordered text-sm w-full"
            />
          </FormField>
          <div className="flex justify-end pt-2">
            <button type="submit" disabled={busy} className="btn btn-primary btn-sm">
              {busy ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </Card>

      <Card className="overflow-hidden">
        <div className="p-4 border-b border-base-200">
          <h2 className="text-sm font-semibold text-slate-900 m-0">
            Published Announcements ({total})
          </h2>
        </div>

        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading announcements...</div>
        ) : announcements.length === 0 ? (
          <EmptyState
            title="No announcements published yet"
            message="Use the form above to post announcements visible across portal dashboards."
          />
        ) : (
          <div className="divide-y divide-base-200">
            {announcements.map((ann) => (
              <div key={ann.id} className="p-4 flex flex-col gap-2 hover:bg-base-200/40 transition-colors">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm text-slate-900 m-0">{ann.title}</h3>
                    <StatusBadge
                      status={ann.is_active ? 'active' : 'draft'}
                      label={ann.is_active ? 'Active' : 'Draft'}
                    />
                    <span className="badge badge-sm badge-ghost font-medium">
                      {AUDIENCE_OPTIONS.find((o) => o.value === ann.audience)?.label || ann.audience}
                    </span>
                    {ann.states?.code && (
                      <span className="badge badge-sm badge-ghost font-medium">{ann.states.code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-3">
                    <button
                      type="button"
                      onClick={() => handleToggle(ann)}
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      {ann.is_active ? 'Archive' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann)}
                      className="text-xs font-medium text-error hover:underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-slate-600 text-sm leading-normal m-0">
                  {ann.body}
                </p>
                <p className="text-xs text-slate-400 m-0">
                  {ann.users?.email || 'Administrator'} · {new Date(ann.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="p-4 border-t border-base-200">
          <Pagination
            page={page}
            pages={pages}
            total={total}
            pageSize={pageSize}
            listLabel="announcements"
            onPageChange={setPage}
            onPageSizeChange={setPageSize}
          />
        </div>
      </Card>
    </PageContainer>
  );
}
