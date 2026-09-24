import { Routes, Route, Navigate } from 'react-router-dom';
import PublicLayout from '../layouts/PublicLayout';
import CaregiverLayout from '../layouts/CaregiverLayout';
import ClientLayout from '../layouts/ClientLayout';
import AdminLayout from '../layouts/AdminLayout';
import { useAuth } from '../contexts/AuthContext';

import StatePage from '../pages/public/StatePage';
import ServicesPage from '../pages/public/ServicesPage';
import CareersPage from '../pages/public/CareersPage';
import FormsPage from '../pages/public/FormsPage';
import LicensingPage from '../pages/public/LicensingPage';
import ContactPage from '../pages/public/ContactPage';

import CaregiverLoginPage from '../pages/caregiver/LoginPage';
import CaregiverDashboardPage from '../pages/caregiver/DashboardPage';
import CaregiverApplicationPage from '../pages/caregiver/ApplicationPage';
import CaregiverDocumentsPage from '../pages/caregiver/DocumentsPage';
import CaregiverTrainingPage from '../pages/caregiver/TrainingPage';
import CaregiverTrainingCertificatePage from '../pages/caregiver/TrainingCertificatePage';
import CaregiverProfilePage from '../pages/caregiver/ProfilePage';
import CaregiverNotificationsPage from '../pages/caregiver/NotificationsPage';

import ClientLoginPage from '../pages/client/LoginPage';
import ClientDashboardPage from '../pages/client/DashboardPage';
import ClientIntakePage from '../pages/client/IntakePage';
import ClientFormsPage from '../pages/client/FormsPage';
import ClientDocumentsPage from '../pages/client/DocumentsPage';
import ClientAuthorizationsPage from '../pages/client/AuthorizationsPage';
import ClientCarePlanPage from '../pages/client/CarePlanPage';
import ClientSchedulePage from '../pages/client/SchedulePage';
import ClientProfilePage from '../pages/client/ProfilePage';
import ClientNotificationsPage from '../pages/client/NotificationsPage';

import AdminDashboardPage from '../pages/admin/DashboardPage';
import AdminCaregiversPage from '../pages/admin/CaregiversPage';
import AdminCaregiverDetailPage from '../pages/admin/CaregiverDetailPage';
import AdminClientsPage from '../pages/admin/ClientsPage';
import AdminClientDetailPage from '../pages/admin/ClientDetailPage';
import AdminDocumentsPage from '../pages/admin/DocumentsPage';
import AdminTrainingPage from '../pages/admin/TrainingPage';
import AdminAuthorizationsPage from '../pages/admin/AuthorizationsPage';
import AdminReferralsPage from '../pages/admin/ReferralsPage';
import AdminReportsPage from '../pages/admin/ReportsPage';
import AdminUsersPage from '../pages/admin/UsersPage';
import AdminSettingsPage from '../pages/admin/SettingsPage';
import AdminAuditLogsPage from '../pages/admin/AuditLogsPage';
import AdminAnnouncementsPage from '../pages/admin/AnnouncementsPage';

function CaregiverApplicationRoute() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-screen">Loading...</div>;
  }

  // Logged-in users get the framed portal chrome; public applicants get the bare form
  return user
    ? <CaregiverLayout><CaregiverApplicationPage /></CaregiverLayout>
    : <CaregiverApplicationPage />;
}

export default function AppRoutes() {
  return (
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
      </Route>
    </Routes>
  );
}
