import { useState } from 'react';
import { useAuth } from '../../hooks/useAuth';
import useFetch from '../../hooks/useFetch';
import { api } from '../../services/api';
import { queryClient } from '../../lib/queryClient';

export default function NotificationsView({
  endpoint,
  pageTitle,
  supportsMarkAllRead = true,
  emptySubtitle = 'System notices, compliance updates, and operations will appear here.',
}) {
  const { token, user } = useAuth();
  const [errorMsg, setErrorMsg] = useState('');

  const { data: rawData, isLoading, error: fetchError } = useFetch(endpoint, {
    enabled: !!token,
    defaultData: [],
  });

  const notifications = rawData?.notifications || (Array.isArray(rawData) ? rawData : []);

  async function handleMarkRead(id) {
    try {
      await api.patch(`${endpoint}/${id}/read`, null, token);
      queryClient.setQueryData([endpoint, {}, user?.id], (old) => {
        if (!old) return old;
        const list = old.notifications || (Array.isArray(old) ? old : []);
        const updated = list.map((n) => (n.id === id ? { ...n, read: true } : n));
        return old.notifications ? { ...old, notifications: updated } : updated;
      });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch {
      setErrorMsg('Failed to mark notification as read.');
    }
  }

  async function handleMarkAllRead() {
    if (!supportsMarkAllRead) return;
    try {
      await api.patch(`${endpoint}/read-all`, null, token);
      queryClient.setQueryData([endpoint, {}, user?.id], (old) => {
        if (!old) return old;
        const list = old.notifications || (Array.isArray(old) ? old : []);
        const updated = list.map((n) => ({ ...n, read: true }));
        return old.notifications ? { ...old, notifications: updated } : updated;
      });
      queryClient.invalidateQueries({ queryKey: [endpoint] });
    } catch {
      setErrorMsg('Failed to mark all notifications as read.');
    }
  }

  if (isLoading) {
    return <div className="loading-screen">Loading notification feed...</div>;
  }


  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container-medium">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            {pageTitle}
          </h1>
          <p className="page-subtitle">
            {unreadCount > 0
              ? `You have ${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}.`
              : 'All alerts are up to date.'}
          </p>
        </div>

        {supportsMarkAllRead && unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="btn-outline-primary"
          >
            Mark all as read
          </button>
        )}
      </div>

      {(errorMsg || fetchError) && (
        <div role="alert" className="alert alert-error">
          {errorMsg || fetchError}
        </div>
      )}


      {notifications.length === 0 ? (
        <div className="card-dashed">
          <h2 className="section-title mb-2">
            No notifications on record
          </h2>
          <p className="text-sm">
            {emptySubtitle}
          </p>
        </div>
      ) : (
        <div className="flex flex-col gap-3">
          {notifications.map((n) => (
            <div
              key={n.id}
              className={`notification-item ${!n.read ? 'notification-item-unread' : ''}`}
            >
              <div className="flex-1 mr-4">
                <div className="flex items-center gap-2 mb-2">
                  {!n.read && (
                    <span className="notification-dot" />
                  )}
                  <h2 className="font-semibold text-sm m-0">
                    {n.title}
                  </h2>
                </div>
                <p className="text-sm text-secondary leading-snug mb-1">
                  {n.body}
                </p>
                <span className="text-xs text-muted">
                  {new Date(n.created_at).toLocaleString()}
                </span>
              </div>

              {!n.read && (
                <button
                  type="button"
                  onClick={() => handleMarkRead(n.id)}
                  className="btn-outline-secondary btn-sm whitespace-nowrap"
                >
                  Mark read
                </button>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
