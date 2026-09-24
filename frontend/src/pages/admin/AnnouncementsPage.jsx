import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import LoadingState from '../../components/common/LoadingState';

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
  const [announcements, setAnnouncements] = useState([]);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState(EMPTY_FORM);
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  function loadAnnouncements() {
    return api.get('/admin/announcements', token)
      .then((res) => setAnnouncements(res?.announcements || []))
      .catch(() => setErrorMsg('Failed to load announcements.'));
  }

  useEffect(() => {
    let isMounted = true;
    setLoading(true);
    api.get('/admin/announcements', token)
      .then((res) => {
        if (!isMounted) return;
        setAnnouncements(res?.announcements || []);
      })
      .catch((err) => {
        if (!isMounted) return;
        setErrorMsg(err.detail || 'Failed to load announcements.');
      })
      .finally(() => {
        if (isMounted) setLoading(false);
      });
    return () => {
      isMounted = false;
    };
  }, [token]);

  function setField(key, val) {
    setForm((f) => ({ ...f, [key]: val }));
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
      await loadAnnouncements().catch(() => {});
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
      await loadAnnouncements().catch(() => {});
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
      await loadAnnouncements().catch(() => {});
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to delete announcement.');
    }
  }

  return (
    <div className="page-container">
      <div className="page-head">
        <h1 className="page-title">
          Announcements
        </h1>
        <p className="page-subtitle">
          Broadcast in-app messages to caregivers and clients. Announcements appear on the relevant portal dashboard.
        </p>
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      <div className="admin-card mb-6">
        <h2 className="section-title">
          Publish New Announcement
        </h2>
        <form onSubmit={handleCreate} className="flex flex-col gap-4 mt-4">
          <div className="form-grid-2">
            <div>
              <label htmlFor="ann-title">Title *</label>
              <input
                id="ann-title"
                type="text"
                maxLength={200}
                value={form.title}
                onChange={(e) => setField('title', e.target.value)}
                placeholder="E.g., Holiday schedule update"
              />
            </div>
            <div>
              <label htmlFor="ann-audience">Audience *</label>
              <select
                id="ann-audience"
                value={form.audience}
                onChange={(e) => setField('audience', e.target.value)}
              >
                {AUDIENCE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="form-grid-2 col-span-2">
              <label htmlFor="ann-state">State</label>
              <select
                id="ann-state"
                value={form.state_id}
                onChange={(e) => setField('state_id', e.target.value)}
              >
                {STATE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label htmlFor="ann-body">Message *</label>
            <textarea
              id="ann-body"
              rows={3}
              value={form.body}
              onChange={(e) => setField('body', e.target.value)}
              placeholder="Short in-app message shown on the portal dashboard."
            />
          </div>
          <div>
            <button type="submit" disabled={busy} className="btn-primary">
              {busy ? 'Publishing...' : 'Publish Announcement'}
            </button>
          </div>
        </form>
      </div>

      <div className="admin-card">
        <h2 className="section-title">
          Published Announcements ({announcements.length})
        </h2>

        {loading ? (
          <LoadingState title="Loading announcements..." variant="cards" count={1} />
        ) : announcements.length === 0 ? (
          <div className="table-empty-sm">
            No announcements published yet.
          </div>
        ) : (
          <div className="flex flex-col gap-3 mt-4">
            {announcements.map((ann) => (
              <div key={ann.id} className="card p-4 flex flex-col gap-2">
                <div className="flex justify-between items-center flex-wrap gap-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <h3 className="font-semibold text-sm m-0">{ann.title}</h3>
                    <span className={`badge ${ann.is_active ? 'badge-green' : 'badge-gray'}`}>
                      {ann.is_active ? 'Active' : 'Draft'}
                    </span>
                    <span className="chip-neutral">
                      {AUDIENCE_OPTIONS.find((o) => o.value === ann.audience)?.label || ann.audience}
                    </span>
                    {ann.states?.code && (
                      <span className="chip-neutral">{ann.states.code}</span>
                    )}
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => handleToggle(ann)}
                      className="text-xs font-semibold text-primary underline"
                    >
                      {ann.is_active ? 'Archive' : 'Activate'}
                    </button>
                    <button
                      type="button"
                      onClick={() => handleDelete(ann)}
                      className="text-xs font-semibold text-red-600 underline"
                    >
                      Delete
                    </button>
                  </div>
                </div>
                <p className="text-secondary text-sm leading-normal m-0">
                  {ann.body}
                </p>
                <p className="text-xs text-muted m-0">
                  {ann.users?.email || 'Administrator'} · {new Date(ann.created_at).toLocaleString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}