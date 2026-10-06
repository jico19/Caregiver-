import { useState } from 'react';
import { useAuth } from '../../../shared/hooks/useAuth';
import usePaginatedFetch from '../../../shared/hooks/usePaginatedFetch';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import FormField from '../../../shared/components/common/FormField';
import Pagination from '../../../shared/components/common/Pagination';
import { api } from '../../../shared/services/api';

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

  return (
    <PageContainer>
      <PageHeader
        title="In-Service Training & Compliance Tracking"
        description="Monitor caregiver course completion, track overdue requirements, and assign mandatory training."
        actions={
          <div className="flex items-center gap-2">
            <select
              id="filter-status"
              aria-label="Filter status"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="select select-bordered select-sm text-sm"
            >
              <option value="all">All Statuses</option>
              <option value="in_progress">In Progress</option>
              <option value="completed">Completed</option>
            </select>

            <button
              onClick={() => setShowAssignModal(true)}
              className="btn btn-primary btn-sm"
            >
              + Assign Course
            </button>
          </div>
        }
      />

      {message && (
        <div role="alert" className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'} mb-4 text-sm py-2 px-4 rounded-box`}>
          {message.text}
        </div>
      )}

      {error && (
        <div role="alert" className="alert alert-error mb-4 text-sm py-2 px-4 rounded-box">
          {error}
        </div>
      )}

      <Card className="overflow-hidden">
        {loading ? (
          <div className="py-12 text-center text-slate-500 text-sm">Loading training enrollments...</div>
        ) : enrollments.length === 0 ? (
          <div className="py-12 text-center text-slate-500 text-sm">
            No training enrollments found.
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="table table-sm w-full">
              <thead>
                <tr className="border-b border-base-200 text-slate-600 font-semibold text-xs">
                  <th>Caregiver</th>
                  <th>Course Name</th>
                  <th>Status</th>
                  <th>Enrolled At</th>
                  <th>Completed At</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-base-200 text-sm">
                {enrollments.map((enr) => {
                  const caregiver = enr.caregivers || {};
                  const course = enr.training_courses || {};
                  const cgName = caregiver.first_name ? `${caregiver.first_name} ${caregiver.last_name}` : 'Caregiver';

                  return (
                    <tr key={enr.id} className="hover:bg-base-200/40 transition-colors">
                      <td className="font-medium text-slate-900">
                        {cgName}
                      </td>
                      <td className="text-slate-600">
                        {course.name || 'Training Course'}
                      </td>
                      <td>
                        <StatusBadge
                          status={enr.status || 'not_started'}
                          label={enr.status ? enr.status.replace('_', ' ') : 'not started'}
                        />
                      </td>
                      <td className="text-slate-500 text-xs whitespace-nowrap">
                        {enr.enrolled_at ? new Date(enr.enrolled_at).toLocaleDateString() : 'N/A'}
                      </td>
                      <td className="text-slate-500 text-xs whitespace-nowrap">
                        {enr.completed_at ? new Date(enr.completed_at).toLocaleDateString() : '—'}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="p-4 border-t border-base-200">
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
      </Card>

      {showAssignModal && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center p-4 z-50">
          <Card className="p-6 max-w-md w-full shadow-lg">
            <div className="flex items-center justify-between pb-3 mb-4 border-b border-base-200">
              <h3 className="text-base font-semibold text-slate-900 m-0">Assign Training Course</h3>
              <button
                type="button"
                onClick={() => setShowAssignModal(false)}
                className="btn btn-ghost btn-xs btn-circle text-slate-400 hover:text-slate-600"
              >
                ✕
              </button>
            </div>
            <form onSubmit={handleAssignSubmit}>
              <div className="space-y-4 my-4">
                <FormField label="Caregiver" required htmlFor="assign-caregiver">
                  <select
                    id="assign-caregiver"
                    required
                    value={assignForm.caregiver_id}
                    onChange={(e) => setAssignForm({ ...assignForm, caregiver_id: e.target.value })}
                    className="select select-bordered select-sm w-full"
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
                </FormField>

                <FormField label="Course" required htmlFor="assign-course">
                  <select
                    id="assign-course"
                    required
                    value={assignForm.course_id}
                    onChange={(e) => setAssignForm({ ...assignForm, course_id: e.target.value })}
                    className="select select-bordered select-sm w-full"
                  >
                    <option value="">-- Choose Course --</option>
                    {coursesList.map((c) => (
                      <option key={c.id} value={c.id}>
                        {c.name} ({c.duration_hours}h)
                      </option>
                    ))}
                  </select>
                </FormField>
              </div>

              <div className="flex items-center justify-end gap-2 mt-6 pt-3 border-t border-base-200">
                <button
                  type="button"
                  onClick={() => setShowAssignModal(false)}
                  className="btn btn-ghost btn-sm"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="btn btn-primary btn-sm"
                >
                  {submitting ? 'Assigning...' : 'Assign Course'}
                </button>
              </div>
            </form>
          </Card>
        </div>
      )}
    </PageContainer>
  );
}
