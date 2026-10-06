import NotificationsView from '../../../shared/components/common/NotificationsView';

export default function NotificationsPage() {
  return (
    <NotificationsView
      endpoint="/caregivers/me/notifications"
      pageTitle="System Notifications"
      emptySubtitle="System notices regarding application reviews, training completions, and document approvals will appear here."
    />
  );
}
