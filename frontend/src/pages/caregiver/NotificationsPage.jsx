import { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { api } from '../../services/api';
import { queryClient } from '../../lib/queryClient';

export default function NotificationsPage() {
  const { token } = useAuth();
  const [notifications, setNotifications] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');

  useEffect(() => {
    let isMounted = true;

    async function loadNotifications() {
      try {
        const res = await api.get('/caregivers/me/notifications', token);
        if (!isMounted) return;
        setNotifications(res?.notifications || []);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg('Failed to load notifications.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    if (token) loadNotifications();
    return () => {
      isMounted = false;
    };
  }, [token]);

  async function handleMarkRead(id) {
    try {
      await api.patch(`/caregivers/me/notifications/${id}/read`, null, token);
      setNotifications((prev) =>
        prev.map((n) => (n.id === id ? { ...n, read: true } : n))
      );
      queryClient.invalidateQueries({ queryKey: ['/caregivers/me/notifications'] });
    } catch {
      // Ignore
    }
  }

  async function handleMarkAllRead() {
    try {
      await api.patch('/caregivers/me/notifications/read-all', null, token);
      setNotifications((prev) => prev.map((n) => ({ ...n, read: true })));
      queryClient.invalidateQueries({ queryKey: ['/caregivers/me/notifications'] });
    } catch {
      // Ignore
    }
  }

  if (loading) {
    return <div className="loading-screen">Loading notification feed...</div>;
  }

  const unreadCount = notifications.filter((n) => !n.read).length;

  return (
    <div className="container-medium">
      <div className="page-header">
        <div>
          <h1 className="page-title">
            System Notifications
          </h1>
          <p className="page-subtitle">
            {unreadCount > 0 ? `You have ${unreadCount} unread alert${unreadCount > 1 ? 's' : ''}.` : 'All alerts are up to date.'}
          </p>
        </div>

        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleMarkAllRead}
            className="btn-outline-primary"
          >
            Mark all as read
          </button>
        )}
      </div>

      {errorMsg && (
        <div role="alert" className="alert alert-error">
          {errorMsg}
        </div>
      )}

      {notifications.length === 0 ? (
        <div className="card-dashed">
          <h2 className="section-title mb-2">
            No notifications on record
          </h2>
          <p className="text-sm">
            System notices regarding application reviews, training completions, and document approvals will appear here.
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
