import { useState, useCallback } from 'react';
import { ACTIVITY_OPTIONS, FREQUENCY_OPTIONS, EMPTY_ACTIVITY } from '../constants/clientDetailConstants';
import { saveCarePlanApi } from '../services/clientDetailService';

export function useCarePlanManagement(id, token, setErrorMsg, setSuccessMsg) {
  const [carePlan, setCarePlan] = useState(null);
  const [cpStatus, setCpStatus] = useState('active');
  const [cpEffectiveDate, setCpEffectiveDate] = useState('');
  const [cpPrimaryNurse, setCpPrimaryNurse] = useState('');
  const [cpEmergencyProtocol, setCpEmergencyProtocol] = useState('');
  const [activities, setActivities] = useState([]);
  const [savingPlan, setSavingPlan] = useState(false);

  const applyCarePlan = useCallback((plan) => {
    setCarePlan(plan);
    if (plan) {
      setCpStatus(plan.status || 'active');
      setCpEffectiveDate(plan.effective_date || '');
      setCpPrimaryNurse(plan.primary_nurse || '');
      setCpEmergencyProtocol(plan.emergency_protocol || '');
      setActivities((plan.activities || []).map((a) => ({
        task: a.task || '',
        frequency: a.frequency || '',
        notes: a.notes || '',
        custom: !ACTIVITY_OPTIONS.includes(a.task || ''),
        freqCustom: !FREQUENCY_OPTIONS.includes(a.frequency || ''),
      })));
    } else {
      setActivities([]);
    }
  }, []);

  const setActivityField = (idx, key, val) => {
    setActivities((rows) => rows.map((row, i) => (i === idx ? { ...row, [key]: val } : row)));
  };

  const addActivityRow = () => {
    setActivities((rows) => [...rows, { ...EMPTY_ACTIVITY }]);
  };

  const removeActivityRow = (idx) => {
    setActivities((rows) => rows.filter((_, i) => i !== idx));
  };

  const handleSavePlan = async (e, onSaved) => {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');
    setSavingPlan(true);
    const cleanedActivities = activities
      .filter((a) => a.task.trim())
      .map(({ task, frequency, notes }) => ({
        task: task.trim(),
        frequency: frequency.trim(),
        notes: notes.trim(),
      }));

    try {
      const res = await saveCarePlanApi(
        id,
        {
          status: cpStatus,
          effective_date: cpEffectiveDate || null,
          primary_nurse: cpPrimaryNurse.trim() || null,
          emergency_protocol: cpEmergencyProtocol.trim() || null,
          activities: cleanedActivities,
        },
        token
      );
      setCarePlan(res?.care_plan || null);
      setSuccessMsg('Care plan saved successfully.');
      if (onSaved) await onSaved();
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to save care plan.');
    } finally {
      setSavingPlan(false);
    }
  };

  return {
    carePlan,
    applyCarePlan,
    cpStatus,
    setCpStatus,
    cpEffectiveDate,
    setCpEffectiveDate,
    cpPrimaryNurse,
    setCpPrimaryNurse,
    cpEmergencyProtocol,
    setCpEmergencyProtocol,
    activities,
    savingPlan,
    setActivityField,
    addActivityRow,
    removeActivityRow,
    handleSavePlan,
  };
}
