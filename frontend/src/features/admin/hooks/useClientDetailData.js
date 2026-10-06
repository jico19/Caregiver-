import { useState, useEffect, useCallback, useRef } from 'react';
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

  // Stabilize: depend on applyCarePlan (useCallback []) not the whole carePlanMgmt object,
  // which is a new identity every render and was retriggering the load effect forever.
  const { applyCarePlan } = carePlanMgmt;

  // #region agent log
  const carePlanMgmtRef = useRef(carePlanMgmt);
  const applyRef = useRef(null);
  const effectRunCount = useRef(0);
  const carePlanMgmtChanged = carePlanMgmtRef.current !== carePlanMgmt;
  carePlanMgmtRef.current = carePlanMgmt;
  // #endregion

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
    applyCarePlan(planRes?.care_plan || null);
  }, [applyCarePlan]);

  // #region agent log
  const applyChanged = applyRef.current !== applyClientPayload;
  applyRef.current = applyClientPayload;
  if (carePlanMgmtChanged || applyChanged) {
    fetch('http://127.0.0.1:7819/ingest/214caf9e-054b-4d1c-90b8-118c8b6c9a4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08186c'},body:JSON.stringify({sessionId:'08186c',runId:'post-fix',hypothesisId:'A',location:'useClientDetailData.js:identity',message:'unstable identities detected',data:{carePlanMgmtChanged,applyChanged,id},timestamp:Date.now()})}).catch(()=>{});
  }
  // #endregion

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

    // #region agent log
    effectRunCount.current += 1;
    const run = effectRunCount.current;
    fetch('http://127.0.0.1:7819/ingest/214caf9e-054b-4d1c-90b8-118c8b6c9a4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08186c'},body:JSON.stringify({sessionId:'08186c',runId:'post-fix',hypothesisId:'A',location:'useClientDetailData.js:useEffect',message:'loadInitial effect fired',data:{run,id,tokenPresent:!!token,applyChangedSinceLast:applyChanged,carePlanMgmtChanged},timestamp:Date.now()})}).catch(()=>{});
    // #endregion

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
