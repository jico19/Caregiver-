import { Link, useParams } from 'react-router-dom';
import { useAuth } from '../../../shared/hooks/useAuth';
import { CLIENT_STATUS_LABELS } from '../constants/clientDetailConstants';
import { useClientDetailData } from '../hooks/useClientDetailData';
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
    return <div className="loading-screen">Loading client details...</div>;
  }

  if (!detail.client) {
    return (
      <div className="container-medium">
        <div className="card text-center p-8">
          <p className="text-secondary mb-4">Client not found.</p>
          <Link to="/admin/clients" className="btn-primary">
            ← Back to Clients
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="container-medium">
      {/* Header */}
      <div className="mb-6 flex justify-between items-center flex-wrap gap-3">
        <div>
          <Link to="/admin/clients" className="text-sm text-secondary hover:text-ink">
            ← Back to Clients
          </Link>
          <h1 className="page-title m-0 mt-1">
            {detail.client.first_name} {detail.client.last_name}
          </h1>
          <p className="page-subtitle m-0">
            {detail.client.states?.name || `State #${detail.client.state_id}`} · Status:{' '}
            <span className="font-semibold text-ink">
              {CLIENT_STATUS_LABELS[detail.client.status] || detail.client.status}
            </span>
          </p>
        </div>
        <div className="flex gap-2">
          <a
            href={`/admin/authorizations?client_id=${detail.client.id}&state_id=${detail.client.state_id}`}
            className="btn-outline-secondary btn-sm"
          >
            Manage Authorizations →
          </a>
        </div>
      </div>

      {/* Notifications */}
      {detail.errorMsg && (
        <div role="alert" className="alert alert-error mb-4">
          {detail.errorMsg}
        </div>
      )}
      {detail.successMsg && (
        <div role="status" className="alert alert-success mb-4">
          {detail.successMsg}
        </div>
      )}

      {/* Client Overview Card */}
      <ClientDetailsCard client={detail.client} />

      {/* Admission Decision Section */}
      <AdmissionDecisionSection
        client={detail.client}
        serviceStartDate={detail.serviceStartDate}
        onServiceStartDateChange={detail.setServiceStartDate}
        admissionNotes={detail.admissionNotes}
        onAdmissionNotesChange={detail.setAdmissionNotes}
        rejectionReason={detail.rejectionReason}
        onRejectionReasonChange={detail.setRejectionReason}
        submittingAdmission={detail.submittingAdmission}
        onUpdateAdmission={detail.handleUpdateAdmission}
      />

      {/* Care Plan Section */}
      <CarePlanSection
        carePlan={detail.carePlan}
        cpStatus={detail.cpStatus}
        onCpStatusChange={detail.setCpStatus}
        cpEffectiveDate={detail.cpEffectiveDate}
        onCpEffectiveDateChange={detail.setCpEffectiveDate}
        cpPrimaryNurse={detail.cpPrimaryNurse}
        onCpPrimaryNurseChange={detail.setCpPrimaryNurse}
        cpEmergencyProtocol={detail.cpEmergencyProtocol}
        onCpEmergencyProtocolChange={detail.setCpEmergencyProtocol}
        activities={detail.activities}
        onActivityFieldChange={detail.setActivityField}
        onAddActivityRow={detail.addActivityRow}
        onRemoveActivityRow={detail.removeActivityRow}
        savingPlan={detail.savingPlan}
        onSavePlan={detail.handleSavePlan}
      />

      {/* Caregiver Assignments Section */}
      <CaregiverAssignmentsSection
        assignments={detail.assignments}
        availableCaregivers={detail.availableCaregivers}
        selectedCaregiverId={detail.selectedCaregiverId}
        onSelectCaregiverId={detail.setSelectedCaregiverId}
        selectedRole={detail.selectedRole}
        onSelectRole={detail.setSelectedRole}
        assigning={detail.assigning}
        onAssignCaregiver={detail.handleAssignCaregiver}
        onEndAssignment={detail.handleEndAssignment}
      />

      {/* Service Schedule Section */}
      <ScheduleSection
        schedule={detail.schedule}
        schedDay={detail.schedDay}
        onSchedDayChange={detail.setSchedDay}
        schedStart={detail.schedStart}
        onSchedStartChange={detail.setSchedStart}
        schedEnd={detail.schedEnd}
        onSchedEndChange={detail.setSchedEnd}
        schedService={detail.schedService}
        onSchedServiceChange={detail.setSchedService}
        schedCustomService={detail.schedCustomService}
        onSchedCustomServiceChange={detail.setSchedCustomService}
        schedStatus={detail.schedStatus}
        onSchedStatusChange={detail.setSchedStatus}
        schedNotes={detail.schedNotes}
        onSchedNotesChange={detail.setSchedNotes}
        addingSched={detail.addingSched}
        onAddSchedule={detail.handleAddSchedule}
        onDeleteSchedule={detail.handleDeleteSchedule}
      />
    </div>
  );
}