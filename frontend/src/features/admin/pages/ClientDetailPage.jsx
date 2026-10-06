import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { CLIENT_STATUS_LABELS } from '../constants/clientDetailConstants';
import { useClientDetailData } from '../hooks/useClientDetailData';
import PageContainer from '../../../shared/components/common/PageContainer';
import PageHeader from '../../../shared/components/common/PageHeader';
import StatusBadge from '../../../shared/components/common/StatusBadge';
import ClientDetailsCard from '../components/client-detail/ClientDetailsCard';
import AdmissionDecisionSection from '../components/client-detail/AdmissionDecisionSection';
import CarePlanSection from '../components/client-detail/CarePlanSection';
import ScheduleSection from '../components/client-detail/ScheduleSection';
import CaregiverAssignmentsSection from '../components/client-detail/CaregiverAssignmentsSection';

export default function ClientDetailPage() {
  const { id } = useParams();
  const { token } = useAuth();
  const detail = useClientDetailData(id, token);

  if (detail.loading) {
    return (
      <PageContainer>
        <div className="py-12 text-center text-slate-500 text-sm">Loading client details...</div>
      </PageContainer>
    );
  }

  if (!detail.client) {
    return (
      <PageContainer>
        <div role="alert" className="alert alert-error mb-4">
          <span>Client not found.</span>
        </div>
        <Link to="/admin/clients" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to Clients
        </Link>
      </PageContainer>
    );
  }

  return (
    <PageContainer>
      <div className="mb-2">
        <Link to="/admin/clients" className="text-xs font-semibold text-emerald-700 hover:text-emerald-800">
          ← Back to Clients
        </Link>
      </div>

      <PageHeader
        title={`${detail.client.first_name} ${detail.client.last_name}`}
        subtitle={`${detail.client.states?.name || `State #${detail.client.state_id}`} · Client File`}
        actions={
          <div className="flex items-center gap-2">
            <StatusBadge
              status={detail.client.status}
              label={CLIENT_STATUS_LABELS[detail.client.status] || detail.client.status}
            />
            <Link
              to={`/admin/authorizations?client_id=${detail.client.id}&state_id=${detail.client.state_id}`}
              className="btn btn-outline btn-xs"
            >
              Authorizations →
            </Link>
          </div>
        }
      />

      {/* Notifications */}
      {detail.errorMsg && (
        <div role="alert" className="alert alert-error mb-6">
          <span>{detail.errorMsg}</span>
        </div>
      )}
      {detail.successMsg && (
        <div role="status" className="alert alert-success mb-6">
          <span>{detail.successMsg}</span>
        </div>
      )}

      {/* Client Overview Card */}
      <ClientDetailsCard client={detail.client} />

      {/* Admission Decision Section */}
      <AdmissionDecisionSection
        client={detail.client}
        serviceStartDate={detail.serviceStartDate}
        setServiceStartDate={detail.setServiceStartDate}
        admissionNotes={detail.admissionNotes}
        setAdmissionNotes={detail.setAdmissionNotes}
        rejectionReason={detail.rejectionReason}
        setRejectionReason={detail.setRejectionReason}
        submittingAdmission={detail.submittingAdmission}
        handleUpdateAdmission={detail.handleUpdateAdmission}
      />

      {/* Care Plan Section */}
      <CarePlanSection
        carePlan={detail.carePlan}
        cpStatus={detail.cpStatus}
        setCpStatus={detail.setCpStatus}
        cpEffectiveDate={detail.cpEffectiveDate}
        setCpEffectiveDate={detail.setCpEffectiveDate}
        cpPrimaryNurse={detail.cpPrimaryNurse}
        setCpPrimaryNurse={detail.setCpPrimaryNurse}
        cpEmergencyProtocol={detail.cpEmergencyProtocol}
        setCpEmergencyProtocol={detail.setCpEmergencyProtocol}
        activities={detail.activities}
        setActivityField={detail.setActivityField}
        addActivityRow={detail.addActivityRow}
        removeActivityRow={detail.removeActivityRow}
        savingPlan={detail.savingPlan}
        handleSavePlan={detail.handleSavePlan}
      />

      {/* Caregiver Assignments Section */}
      <CaregiverAssignmentsSection
        assignments={detail.assignments}
        availableCaregivers={detail.availableCaregivers}
        selectedCaregiverId={detail.selectedCaregiverId}
        setSelectedCaregiverId={detail.setSelectedCaregiverId}
        selectedRole={detail.selectedRole}
        setSelectedRole={detail.setSelectedRole}
        assigning={detail.assigning}
        handleAssignCaregiver={detail.handleAssignCaregiver}
        handleEndAssignment={detail.handleEndAssignment}
      />

      {/* Service Schedule Section */}
      <ScheduleSection
        schedule={detail.schedule}
        schedDay={detail.schedDay}
        setSchedDay={detail.setSchedDay}
        schedStart={detail.schedStart}
        setSchedStart={detail.setSchedStart}
        schedEnd={detail.schedEnd}
        setSchedEnd={detail.setSchedEnd}
        schedService={detail.schedService}
        setSchedService={detail.setSchedService}
        schedCustomService={detail.schedCustomService}
        setSchedCustomService={detail.setSchedCustomService}
        schedStatus={detail.schedStatus}
        setSchedStatus={detail.setSchedStatus}
        schedNotes={detail.schedNotes}
        setSchedNotes={detail.setSchedNotes}
        addingSched={detail.addingSched}
        handleAddSchedule={detail.handleAddSchedule}
        handleDeleteSchedule={detail.handleDeleteSchedule}
      />
    </PageContainer>
  );
}