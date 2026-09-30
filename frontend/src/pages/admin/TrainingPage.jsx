import { useState } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import usePaginatedFetch from '../../hooks/usePaginatedFetch';
import useFetch from '../../hooks/useFetch';
import Pagination from '../../components/common/Pagination';
import { api } from '../../services/api';

export default function TrainingPage() {
  const { token } = useAuth();
  const [statusFilter, setStatusFilter] = useState('all');
  const [showAssignModal, setShowAssignModal] = useState(false);
  const [assignForm, setAssignForm] = useState({ caregiver_id: '', course_id: '' });
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState(null);

  const {
    items: enrollments,
    total,
    pages,
    page,
    pageSize,
    loading,
    error,
    setPage,
    setPageSize,
    refetch,
  } = usePaginatedFetch({
    url: '/admin/training',
    token,
    params: statusFilter === 'all' ? {} : { status: statusFilter },
    listKey: 'enrollments',
  });

  const { data: coursesData } = useFetch('/training/courses', { enabled: !!token, defaultData: [] });
  const coursesList = coursesData?.courses || (Array.isArray(coursesData) ? coursesData : []);

  const { data: caregiversData } = useFetch('/admin/caregivers', { enabled: !!token, defaultData: [] });
  const caregiversList = caregiversData?.applications || (Array.isArray(caregiversData) ? caregiversData : []);

  async function handleAssignSubmit(e) {
    e.preventDefault();
    if (!assignForm.caregiver_id || !assignForm.course_id) return;
    setSubmitting(true);
    setMessage(null);

    try {
      await api.post('/admin/training', assignForm, token);
      setMessage({ type: 'success', text: 'Training course assigned successfully.' });
      setShowAssignModal(false);
      setAssignForm({ caregiver_id: '', course_id: '' });
      refetch();
    } catch (err) {
      setMessage({ type: 'error', text: err.message || 'Failed to assign training course.' });
    } finally {
      setSubmitting(false);
    }
  }

  function badgeClass(status) {
    switch (status) {
      case 'completed': return 'badge badge-green';
      case 'in_progress': return 'badge badge-blue';
      default: return 'badge badge-gray';
    }
  }

  return (
    <div className="page-container">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            In-Service Training & Compliance Tracking
          </h1>
          <p className="page-subtitle">
            Monitor caregiver course completion, track overdue requirements, and assign mandatory training.
          </p>
        </div>

        <div className="flex items-center gap-3">
          <div className="flex items-center gap-2">
            <label htmlFor="filter-status" className="filter-label">
              Status:
            </label>
            <select
              id="filter-status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select-compact"
            >
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>
          </div>

          <button
            onClick={() => setShowAssignModal(true)}
            className="btn-primary"
          >
            + Assign Course
          </button>
        </div>
      </div>

      {message && (
        <div role="alert" className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'}`}>
          {message.text}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error">
          {error}
        </div>
      )}

      <div className="admin-card">
        {loading ? (
          <div className="table-loading-sm">Loading training enrollments...</div>
        ) : enrollments.length === 0 ? (
          <div className="table-empty-sm">
            No training enrollments found.
          </div>
        ) : (
          <div className="table-responsive">
            <table className="table-admin">
              <thead>
                <tr>
                  <th>Caregiver</th>
                  <th>Course Name</th>
                  <th>Status</th>
                  <th>Enrolled At</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody>
                {enrollments.map((enr) => {
                  const caregiver = enr.caregivers || {};
                  const course = enr.training_courses || {};
                  const cgName = caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Caregiver';

                  return (
                    <tr key={enr.id}>
                      <td className="cell-strong">
                        {cgName}
                      </td>
                      <td className="cell-muted font-medium">
                        {course.name || 'Training Course'}
                      </td>
                      <td>
                        <span className={badgeClass(enr.status)}>
                          {enr.status ? enr.status.replace('_', ' ') : 'not started'}
                        </span>
                      </td>
                      <td className="cell-muted">
                        {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="cell-muted">
                        {enr.completed_at ? new Date(enr.completed_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <Pagination
          page={page}
          pages={pages}
          total={total}
          pageSize={pageSize}
          listLabel="enrollments"
          onPageChange={setPage}
          onPageSizeChange={setPageSize}
        />
      </div>

      {showAssignModal && (
        <div className="modal-overlay" tabIndex={-1}>
          <div className="modal-card">
            <div className="modal-header">
              <h3 className="modal-title">Assign Training Course</h3>
              <button onClick={() => setShowAssignModal(false)} className="btn-close">×</button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="space-y-4 my-4">
                <div>
                  <label className="form-label">Select Caregiver</label>
                  <select
                    required
                    value={assignForm.caregiver_id}
                    onChange={(e) => setAssignForm({ ...assignForm, caregiver_id: e.target.value })}
                    className="select-field"
                  >
                    <option value="">-- Choose Caregiver --</option>
                    {caregiversList.map((app) => {
                      const cg = app.caregivers || {};
                      const cid = app.caregiver_id || cg.id;
                      if (!cid) return null;
                      return (
                        <option key={app.id} value={cid}>
                          {cg.first_name ? `${cg.first_name} ${cg.last_name}` : 'Applicant'} ({app.states?.code || 'FL'})
                        </option>
                      );
                    })}
                  </select>
                </div>

                <div>
                  <label className="form-label">Select Course</label>
                  <select
                    required
                    value={assignForm.course_id}
                    onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })}
                    className="select-field"
                  >
                    <option value="">-- Choose Course --</option>
                    {coursesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.duration_hours}h)
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="modal-actions">
                <button type="button" onClick={() => setShowAssignModal(false)} className="btn-secondary">
                  Cancel
                </button>
                <button type="submit" disabled={submitting} className="btn-primary">
                  {submitting ? 'Assigning...' : 'Assign Course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
