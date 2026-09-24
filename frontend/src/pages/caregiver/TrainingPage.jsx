import { useState } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { queryClient } from '../../lib/queryClient';
import useFetch from '../../hooks/useFetch';

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
    return <div className="loading-screen">Loading in-service training modules...</div>;
  }

  const completedCount = courses.filter((c) => c.enrollment_status === 'completed').length;
  const inProgressCount = courses.filter((c) => c.enrollment_status === 'in_progress').length;

  return (
    <div className="container-wide">
      <div className="mb-6">
        <h1 className="page-title">
          Caregiver In-Service Training
        </h1>
        <p className="page-subtitle">
          Mandatory compliance education covering client safety, privacy standards, and state healthcare regulations.
        </p>
      </div>

      {(errorMsg || listError) && (
        <div role="alert" className="alert alert-error">
          {errorMsg || listError}
        </div>
      )}

      {successMsg && (
        <div role="status" className="alert alert-success">
          {successMsg}
        </div>
      )}

      {/* Progress Cards */}
      <div className="grid grid-cols-3 max-md:grid-cols-1 gap-4 mb-8">
        <div className="stat-card">
          <div className="text-xs text-muted font-semibold mb-1">Total Modules</div>
          <div className="stat-value">{courses.length}</div>
        </div>

        <div className="stat-card stat-card-warning">
          <div className="stat-label-warning">In Progress</div>
          <div className="stat-value-warning">{inProgressCount}</div>
        </div>

        <div className="stat-card stat-card-success">
          <div className="stat-label-success">Completed</div>
          <div className="stat-value-success">{completedCount}</div>
        </div>
      </div>

      {/* Courses List */}
      <div className="grid-cards">
        {courses.map((course) => {
          const status = course.enrollment_status;
          const isBusy = actionLoading === course.id;

          const badgeClass =
            status === 'completed'
              ? 'badge badge-green'
              : status === 'in_progress'
              ? 'badge badge-yellow'
              : 'badge badge-gray';

          return (
            <div
              key={course.id}
              className={`course-card ${status === 'completed' ? 'course-card-completed' : ''}`}
            >
              <div>
                <div className="flex justify-between items-start gap-2 mb-2">
                  <h2 className="font-semibold text-sm m-0">{course.name}</h2>
                  <span className={badgeClass}>
                    {status.replace('_', ' ')}
                  </span>
                </div>

                <div className="text-xs text-primary font-semibold mb-2">
                  Duration: {course.duration_hours} hour{course.duration_hours > 1 ? 's' : ''}
                </div>

                <p className="text-secondary text-sm leading-normal mb-4">
                  {course.description}
                </p>
              </div>

              <div>
                {status === 'not_started' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleEnroll(course.id)}
                    className="btn-primary btn-full"
                  >
                    {isBusy ? 'Enrolling...' : 'Enroll Module'}
                  </button>
                )}

                {status === 'in_progress' && (
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => handleComplete(course.id)}
                    className="btn-success btn-full"
                  >
                    {isBusy ? 'Saving...' : 'Mark as Completed'}
                  </button>
                )}

                {status === 'completed' && (
                  <div className="flex flex-col gap-2">
                    <div className="alert alert-success text-center font-semibold text-xs m-0">
                      Completed on {course.completed_at ? new Date(course.completed_at).toLocaleDateString() : 'Record'} ✓
                    </div>
                    <Link
                      to={`/caregiver/training-certificate/${course.id}`}
                      className="btn-outline-secondary btn-full btn-sm text-center"
                    >
                      View Certificate →
                    </Link>
                  </div>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
