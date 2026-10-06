import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { api } from '../../../shared/services/api';
import { queryClient } from '../../../shared/lib/queryClient';
import useFetch from '../../../shared/hooks/useFetch';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import Card from '../../../shared/components/common/Card';
import StatusBadge from '../../../shared/components/common/StatusBadge';

export default function TrainingPage() {
  const { token } = useAuth();
  const [actionLoading, setActionLoading] = useState(null);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  const { data, isLoading: loading, error: loadError } = useFetch('/training/courses', { enabled: !!token, defaultData: [] });
  const courses = data?.courses || [];
  const listError = loadError || '';

  async function handleEnroll(courseId) {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(courseId);

    try {
      await api.post(`/training/courses/${courseId}/enroll`, null, token);
      setSuccessMsg('You have enrolled in the training course.');
      queryClient.invalidateQueries({ queryKey: ['/training/courses'] });
    } catch (err) {
      setErrorMsg(err.detail || 'Enrollment failed.');
    } finally {
      setActionLoading(null);
    }
  }

  async function handleComplete(courseId) {
    setErrorMsg('');
    setSuccessMsg('');
    setActionLoading(courseId);

    try {
      await api.post(`/training/courses/${courseId}/complete`, null, token);
      setSuccessMsg('Course successfully marked as completed.');
      queryClient.invalidateQueries({ queryKey: ['/training/courses'] });
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to complete course.');
    } finally {
      setActionLoading(null);
    }
  }

  if (loading) {
    return (
      <PageContainer size="wide">
        <div className="py-12 text-center text-slate-500 text-sm">
          Loading in-service training modules...
        </div>
      </PageContainer>
    );
  }

  const completedCount = courses.filter((c) => c.enrollment_status === 'completed').length;
  const inProgressCount = courses.filter((c) => c.enrollment_status === 'in_progress').length;

  return (
    <PageContainer size="wide">
      <PageHeader
        title="Caregiver In-Service Training"
        subtitle="Mandatory compliance education covering client safety, privacy standards, and state healthcare regulations."
      />

      {(errorMsg || listError) && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{errorMsg || listError}</span>
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{successMsg}</span>
        </div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
        <Card className="p-4">
          <div className="text-xs text-slate-500 font-medium mb-1">Total Modules</div>
          <div className="text-2xl font-bold text-slate-900">{courses.length}</div>
        </Card>

        <Card className="p-4 bg-amber-50/30 border-amber-200">
          <div className="text-xs text-amber-800 font-medium mb-1">In Progress</div>
          <div className="text-2xl font-bold text-amber-900">{inProgressCount}</div>
        </Card>

        <Card className="p-4 bg-emerald-50/30 border-emerald-200">
          <div className="text-xs text-emerald-800 font-medium mb-1">Completed</div>
          <div className="text-2xl font-bold text-emerald-900">{completedCount}</div>
        </Card>
      </div>

      {/* Courses List */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {courses.map((course) => {
          const status = course.enrollment_status;
          const isBusy = actionLoading === course.id;

          return (
            <Card
              key={course.id}
              className={`p-5 flex flex-col justify-between ${
                status === 'completed' ? 'border-emerald-200 bg-emerald-50/10' : ''
              }`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h2 className="font-semibold text-sm text-slate-900 m-0">{course.name}</h2>
                  <StatusBadge
                    status={status}
                    label={status.replace('_', ' ')}
                  />
                </div>

                <div className="text-xs text-emerald-700 font-medium mb-2">
                  Duration: {course.duration_hours} hour{course.duration_hours > 1 ? 's' : ''}
                </div>

                <p className="text-slate-600 text-xs leading-normal mb-4">
                  {course.description}
                </p>
              </div>

              <div>
                {status === 'not_started' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleEnroll(course.id)}
                    className="btn btn-primary btn-sm w-full"
                  >
                    {isBusy ? 'Enrolling...' : 'Enroll Module'}
                  </button>
                )}

                {status === 'in_progress' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleComplete(course.id)}
                    className="btn btn-primary btn-sm w-full"
                  >
                    {isBusy ? 'Saving...' : 'Mark as Completed'}
                  </button>
                )}

                {status === 'completed' && (
                  <div className="space-y-2">
                    <div className="text-center font-medium text-xs text-emerald-700 bg-emerald-50 py-1.5 px-2 rounded border border-emerald-200">
                      Completed on {course.completed_at ? new Date(course.completed_at).toLocaleDateString() : 'Record'} ✓
                    </div>
                    <Link
                      to={`/caregiver/training-certificate/${course.id}`}
                      className="btn btn-outline btn-xs w-full text-center"
                    >
                      View Certificate
                    </Link>
                  </div>
                )}
              </div>
            </Card>
          );
        })}
      </div>
    </PageContainer>
  );
}
