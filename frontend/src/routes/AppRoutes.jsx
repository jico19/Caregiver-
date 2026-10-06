import { lazy, Suspense } from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../shared/layouts/PublicLayout';
import CaregiverLayout from '../shared/layouts/CaregiverLayout';
import ClientLayout from '../shared/layouts/ClientLayout';
import AdminLayout from '../shared/layouts/AdminLayout';
import LoadingState from '../shared/components/common/LoadingState';
import { useAuth } from '../shared/hooks/useAuth';

// Public pages
const StatePage = lazy(() => import('../features/public/pages/StatePage'));
const ServicesPage = lazy(() => import('../features/public/pages/ServicesPage'));
const CareersPage = lazy(() => import('../features/public/pages/CareersPage'));
const FormsPage = lazy(() => import('../features/public/pages/FormsPage'));
const LicensingPage = lazy(() => import('../features/public/pages/LicensingPage'));
const ContactPage = lazy(() => import('../features/public/pages/ContactPage'));

// Auth pages
const CaregiverLoginPage = lazy(() => import('../features/auth/pages/LoginPage'));
const ClientLoginPage = lazy(() => import('../features/auth/pages/ClientLoginPage'));

// Caregiver pages
const CaregiverDashboardPage = lazy(() => import('../features/caregiver/pages/DashboardPage'));
const CaregiverApplicationPage = lazy(() => import('../features/caregiver/pages/ApplicationPage'));
const CaregiverDocumentsPage = lazy(() => import('../features/caregiver/pages/DocumentsPage'));
const CaregiverTrainingPage = lazy(() => import('../features/caregiver/pages/TrainingPage'));
const CaregiverTrainingCertificatePage = lazy(() => import('../features/caregiver/pages/TrainingCertificatePage'));
const CaregiverProfilePage = lazy(() => import('../features/caregiver/pages/ProfilePage'));
const CaregiverNotificationsPage = lazy(() => import('../features/caregiver/pages/NotificationsPage'));
const CaregiverClientsPage = lazy(() => import('../features/caregiver/pages/ClientsPage'));
const CaregiverClientCarePlanPage = lazy(() => import('../features/caregiver/pages/ClientCarePlanPage'));
const CaregiverClientSchedulePage = lazy(() => import('../features/caregiver/pages/ClientSchedulePage'));

// Client pages
const ClientDashboardPage = lazy(() => import('../features/client/pages/DashboardPage'));
const ClientIntakePage = lazy(() => import('../features/client/pages/IntakePage'));
const ClientFormsPage = lazy(() => import('../features/client/pages/FormsPage'));
const ClientDocumentsPage = lazy(() => import('../features/client/pages/DocumentsPage'));
const ClientAuthorizationsPage = lazy(() => import('../features/client/pages/AuthorizationsPage'));
const ClientCarePlanPage = lazy(() => import('../features/client/pages/CarePlanPage'));
const ClientSchedulePage = lazy(() => import('../features/client/pages/SchedulePage'));
const ClientProfilePage = lazy(() => import('../features/client/pages/ProfilePage'));
const ClientNotificationsPage = lazy(() => import('../features/client/pages/NotificationsPage'));

// Admin pages
const AdminDashboardPage = lazy(() => import('../features/admin/pages/DashboardPage'));
const AdminCaregiversPage = lazy(() => import('../features/admin/pages/CaregiversPage'));
const AdminCaregiverDetailPage = lazy(() => import('../features/admin/pages/CaregiverDetailPage'));
const AdminClientsPage = lazy(() => import('../features/admin/pages/ClientsPage'));
const AdminClientDetailPage = lazy(() => import('../features/admin/pages/ClientDetailPage'));
const AdminDocumentsPage = lazy(() => import('../features/admin/pages/DocumentsPage'));
const AdminTrainingPage = lazy(() => import('../features/admin/pages/TrainingPage'));
const AdminAuthorizationsPage = lazy(() => import('../features/admin/pages/AuthorizationsPage'));
const AdminReferralsPage = lazy(() => import('../features/admin/pages/ReferralsPage'));
const AdminReportsPage = lazy(() => import('../features/admin/pages/ReportsPage'));
const AdminUsersPage = lazy(() => import('../features/admin/pages/UsersPage'));
const AdminSettingsPage = lazy(() => import('../features/admin/pages/SettingsPage'));
const AdminAuditLogsPage = lazy(() => import('../features/admin/pages/AuditLogsPage'));
const AdminAnnouncementsPage = lazy(() => import('../features/admin/pages/AnnouncementsPage'));
const AdminNotificationsPage = lazy(() => import('../features/admin/pages/NotificationsPage'));

function CaregiverApplicationRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <LoadingState message="Checking session..." />;
  }

  // Logged-in users get the framed portal chrome; public applicants get the bare form
  return user
    ? <CaregiverLayout><CaregiverApplicationPage /></CaregiverLayout>
    : <CaregiverApplicationPage />;
}

export default function AppRoutes() {
  return (
    <Suspense fallback={<LoadingState message="Loading portal..." />}>
      <Routes>
        <Route path="/" element={<Navigate to="/florida" replace />} />

        {/* Public state-scoped routes */}
        <Route path="/:state" element={<PublicLayout />}>
          <Route index element={<StatePage />} />
          <Route path="services" element={<ServicesPage />} />
          <Route path="careers" element={<CareersPage />} />
          <Route path="forms" element={<FormsPage />} />
          <Route path="licensing" element={<LicensingPage />} />
          <Route path="contact" element={<ContactPage />} />
        </Route>

        {/* Universal and portal login routes */}
        <Route path="/login" element={<CaregiverLoginPage />} />
        <Route path="/admin/login" element={<CaregiverLoginPage />} />

        {/* Caregiver portal & public application */}
        <Route path="/caregiver/login" element={<CaregiverLoginPage />} />
        <Route path="/caregiver/application" element={<CaregiverApplicationRoute />} />
        <Route path="/caregiver" element={<CaregiverLayout />}>
          <Route path="dashboard" element={<CaregiverDashboardPage />} />
          <Route path="clients" element={<CaregiverClientsPage />} />
          <Route path="clients/:clientId/care-plan" element={<CaregiverClientCarePlanPage />} />
          <Route path="clients/:clientId/schedule" element={<CaregiverClientSchedulePage />} />
          <Route path="documents" element={<CaregiverDocumentsPage />} />
          <Route path="training" element={<CaregiverTrainingPage />} />
          <Route path="training-certificate/:courseId" element={<CaregiverTrainingCertificatePage />} />
          <Route path="profile" element={<CaregiverProfilePage />} />
          <Route path="notifications" element={<CaregiverNotificationsPage />} />
        </Route>

        {/* Client portal */}
        <Route path="/client/login" element={<ClientLoginPage />} />
        <Route path="/client" element={<ClientLayout />}>
          <Route path="dashboard" element={<ClientDashboardPage />} />
          <Route path="intake" element={<ClientIntakePage />} />
          <Route path="forms" element={<ClientFormsPage />} />
          <Route path="documents" element={<ClientDocumentsPage />} />
          <Route path="authorizations" element={<ClientAuthorizationsPage />} />
          <Route path="care-plan" element={<ClientCarePlanPage />} />
          <Route path="schedule" element={<ClientSchedulePage />} />
          <Route path="profile" element={<ClientProfilePage />} />
          <Route path="notifications" element={<ClientNotificationsPage />} />
        </Route>

        {/* Admin dashboard */}
        <Route path="/admin" element={<AdminLayout />}>
          <Route path="dashboard" element={<AdminDashboardPage />} />
          <Route path="caregivers" element={<AdminCaregiversPage />} />
          <Route path="caregivers/:id" element={<AdminCaregiverDetailPage />} />
          <Route path="clients" element={<AdminClientsPage />} />
          <Route path="clients/:id" element={<AdminClientDetailPage />} />
          <Route path="documents" element={<AdminDocumentsPage />} />
          <Route path="training" element={<AdminTrainingPage />} />
          <Route path="authorizations" element={<AdminAuthorizationsPage />} />
          <Route path="referrals" element={<AdminReferralsPage />} />
          <Route path="reports" element={<AdminReportsPage />} />
          <Route path="users" element={<AdminUsersPage />} />
          <Route path="settings" element={<AdminSettingsPage />} />
          <Route path="audit-logs" element={<AdminAuditLogsPage />} />
          <Route path="announcements" element={<AdminAnnouncementsPage />} />
          <Route path="notifications" element={<AdminNotificationsPage />} />
        </Route>
      </Routes>
    </Suspense>
  );
}
