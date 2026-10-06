import NotificationsView from '../../../shared/components/common/NotificationsView';

export default function NotificationsPage() {
  return (
    <NotificationsView
      endpoint="/clients/me/notifications"
      pageTitle="Client Alerts & Notices"
      supportsMarkAllRead={false}
      emptySubtitle="Notices regarding authorizations, care plans, and nurse appointments will appear here."
    />
  );
}
