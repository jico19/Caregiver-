import NotificationsView from '../../../shared/components/common/NotificationsView';

export default function NotificationsPage() {
  return (
    <NotificationsView
      endpoint="/admin/notifications"
      pageTitle="Admin Notifications"
      emptySubtitle="System notices regarding client referrals, compliance updates, and operations will appear here."
    />
  );
}
