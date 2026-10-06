import { useState, useEffect, useCallback } from 'react';
import { CLIENT_STATUS_LABELS } from '../constants/clientDetailConstants';
import {
  fetchClientDetailBundle,
  assignCaregiverApi,
  endAssignmentApi,
  updateAdmissionApi,
  addScheduleSlotApi,
  deleteScheduleSlotApi,
} from '../services/clientDetailService';
import { useCarePlanManagement } from './useCarePlanManagement';

export function useClientDetailData(id, token) {
  const [client, setClient] = useState(null);
  const [schedule, setSchedule] = useState([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Admission decision state
  const [serviceStartDate, setServiceStartDate] = useState('');
  const [admissionNotes, setAdmissionNotes] = useState('');
  const [rejectionReason, setRejectionReason] = useState('');
  const [submittingAdmission, setSubmittingAdmission] = useState(false);

  // Schedule form state
  const [schedDay, setSchedDay] = useState('Monday');
  const [schedStart, setSchedStart] = useState('09:00');
  const [schedEnd, setSchedEnd] = useState('13:00');
  const [schedService, setSchedService] = useState('');
  const [schedCustomService, setSchedCustomService] = useState('');
  const [schedStatus, setSchedStatus] = useState('scheduled');
  const [schedNotes, setSchedNotes] = useState('');
  const [addingSched, setAddingSched] = useState(false);

  // Caregiver assignment state
  const [assignments, setAssignments] = useState([]);
  const [availableCaregivers, setAvailableCaregivers] = useState([]);
  const [selectedCaregiverId, setSelectedCaregiverId] = useState('');
  const [selectedRole, setSelectedRole] = useState('primary');
  const [assigning, setAssigning] = useState(false);

  const carePlanMgmt = useCarePlanManagement(
    id,
    token,
    setErrorMsg,
    setSuccessMsg
  );

  const applyClientPayload = useCallback(({ res, planRes, schedRes, asgnRes, cgRes }) => {
    const c = res?.client || null;
    setClient(c);
    if (c) {
      setServiceStartDate(c.service_start_date || '');
      setAdmissionNotes(c.admission_notes || '');
      setRejectionReason(c.rejection_reason || '');
    }
    setSchedule(schedRes?.schedule || []);
    setAssignments(asgnRes?.assignments || []);
    const cgs = cgRes?.caregivers || (Array.isArray(cgRes) ? cgRes : []);
    setAvailableCaregivers(cgs);
    carePlanMgmt.applyCarePlan(planRes?.care_plan || null);
  }, [carePlanMgmt]);

  const refreshDetail = useCallback(async () => {
    try {
      const bundle = await fetchClientDetailBundle(id, token);
      applyClientPayload(bundle);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to refresh client details.');
    }
  }, [id, token, applyClientPayload]);

  useEffect(() => {
    if (!token || !id) return;
    let isMounted = true;

    async function loadInitial() {
      try {
        const bundle = await fetchClientDetailBundle(id, token);
        if (!isMounted) return;
        applyClientPayload(bundle);
      } catch (err) {
        if (!isMounted) return;
        setErrorMsg(err.detail || 'Failed to load client details.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadInitial();
    return () => {
      isMounted = false;
    };
  }, [id, token, applyClientPayload]);

  const handleAssignCaregiver = async (e) => {
    e.preventDefault();
    if (!selectedCaregiverId) return;
    setErrorMsg('');
    setSuccessMsg('');
    setAssigning(true);
    try {
      await assignCaregiverApi(id, selectedCaregiverId, selectedRole, token);
      setSuccessMsg('Caregiver assigned successfully.');
      setSelectedCaregiverId('');
      await refreshDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to assign caregiver.');
    } finally {
      setAssigning(false);
    }
  };

  const handleEndAssignment = async (caregiverId) => {
    if (!window.confirm('End this caregiver assignment?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      await endAssignmentApi(id, caregiverId, token);
      setSuccessMsg('Caregiver assignment ended.');
      await refreshDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to end caregiver assignment.');
    }
  };

  const handleUpdateAdmission = async (targetStatus) => {
    setErrorMsg('');
    setSuccessMsg('');
    if (targetStatus === 'rejected' && !rejectionReason.trim() && !admissionNotes.trim()) {
      setErrorMsg('A rejection reason is required when rejecting a client admission.');
      return;
    }
    setSubmittingAdmission(true);
    try {
      await updateAdmissionApi(
        id,
        {
          status: targetStatus,
          service_start_date: serviceStartDate || null,
          notes: admissionNotes.trim() || null,
          rejection_reason: targetStatus === 'rejected' ? (rejectionReason.trim() || admissionNotes.trim()) : null,
        },
        token
      );
      setSuccessMsg(`Client admission status updated to ${CLIENT_STATUS_LABELS[targetStatus] || targetStatus}.`);
      await refreshDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to update client admission status.');
    } finally {
      setSubmittingAdmission(false);
    }
  };

  const handleAddSchedule = async (e) => {
    e.preventDefault();
    const serviceName = schedService === 'other' ? schedCustomService.trim() : schedService;
    if (!serviceName) {
      setErrorMsg('Please specify a service type.');
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setAddingSched(true);
    try {
      const res = await addScheduleSlotApi(
        id,
        {
          day_of_week: schedDay,
          start_time: schedStart,
          end_time: schedEnd,
          service_type: serviceName,
          status: schedStatus,
          notes: schedNotes.trim() || null,
        },
        token
      );
      setSchedule(res?.schedule || []);
      setSuccessMsg('Schedule slot added.');
      setSchedNotes('');
      setSchedCustomService('');
      await refreshDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to add schedule slot.');
    } finally {
      setAddingSched(false);
    }
  };

  const handleDeleteSchedule = async (entryIndex) => {
    if (!window.confirm('Remove this schedule slot?')) return;
    setErrorMsg('');
    setSuccessMsg('');
    try {
      const res = await deleteScheduleSlotApi(id, entryIndex, token);
      setSchedule(res?.schedule || []);
      setSuccessMsg('Schedule slot removed.');
      await refreshDetail();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to remove schedule slot.');
    }
  };

  return {
    client,
    carePlan: carePlanMgmt.carePlan,
    schedule,
    loading,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    // Admission
    serviceStartDate,
    setServiceStartDate,
    admissionNotes,
    setAdmissionNotes,
    rejectionReason,
    setRejectionReason,
    submittingAdmission,
    handleUpdateAdmission,
    // Care Plan
    cpStatus: carePlanMgmt.cpStatus,
    setCpStatus: carePlanMgmt.setCpStatus,
    cpEffectiveDate: carePlanMgmt.cpEffectiveDate,
    setCpEffectiveDate: carePlanMgmt.setCpEffectiveDate,
    cpPrimaryNurse: carePlanMgmt.cpPrimaryNurse,
    setCpPrimaryNurse: carePlanMgmt.setCpPrimaryNurse,
    cpEmergencyProtocol: carePlanMgmt.cpEmergencyProtocol,
    setCpEmergencyProtocol: carePlanMgmt.setCpEmergencyProtocol,
    activities: carePlanMgmt.activities,
    savingPlan: carePlanMgmt.savingPlan,
    setActivityField: carePlanMgmt.setActivityField,
    addActivityRow: carePlanMgmt.addActivityRow,
    removeActivityRow: carePlanMgmt.removeActivityRow,
    handleSavePlan: (e) => carePlanMgmt.handleSavePlan(e, refreshDetail),
    // Schedule
    schedDay,
    setSchedDay,
    schedStart,
    setSchedStart,
    schedEnd,
    setSchedEnd,
    schedService,
    setSchedService,
    schedCustomService,
    setSchedCustomService,
    schedStatus,
    setSchedStatus,
    schedNotes,
    setSchedNotes,
    addingSched,
    handleAddSchedule,
    handleDeleteSchedule,
    // Assignments
    assignments,
    availableCaregivers,
    selectedCaregiverId,
    setSelectedCaregiverId,
    selectedRole,
    setSelectedRole,
    assigning,
    handleAssignCaregiver,
    handleEndAssignment,
  };
}
