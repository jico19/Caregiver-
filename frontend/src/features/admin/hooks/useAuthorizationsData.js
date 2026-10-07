import { useState, useEffect, useMemo, useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';
import { api } from '../../../shared/services/api';
import {
  STATE_CODE_MAP,
  getTodayStr,
  computeFutureDateStr,
  generateAuthNumber,
  calculateAuthMetrics,
  filterAndSortAuthorizations,
} from '../constants/authorizationConstants';

export function useAuthorizationsData(token) {
  const [searchParams] = useSearchParams();

  const [authorizations, setAuthorizations] = useState([]);
  const [clients, setClients] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const [successMsg, setSuccessMsg] = useState('');

  // Pending-review actions
  const [reviewingId, setReviewingId] = useState(null);
  const [reviewAction, setReviewAction] = useState('');

  // UI state
  const [showForm, setShowForm] = useState(Boolean(searchParams.get('client_id')));
  const [editingAuth, setEditingAuth] = useState(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [filterState, setFilterState] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [sortBy, setSortBy] = useState('end_date_asc');
  const [copiedAuthId, setCopiedAuthId] = useState(null);

  // Form fields
  const [clientId, setClientId] = useState(searchParams.get('client_id') || '');
  const [stateId, setStateId] = useState(searchParams.get('state_id') || '1');
  const [authNumber, setAuthNumber] = useState('');
  const [startDate, setStartDate] = useState(getTodayStr());
  const [endDate, setEndDate] = useState(computeFutureDateStr(getTodayStr(), 180));
  const [notes, setNotes] = useState('');
  const [hcpcsCode, setHcpcsCode] = useState('T1019');
  const [serviceDescription, setServiceDescription] = useState('Personal Care Services');
  const [totalUnits, setTotalUnits] = useState('120');
  const [unitsUsed, setUnitsUsed] = useState('0');
  const [maxWeeklyHours, setMaxWeeklyHours] = useState('30');
  const [unitType, setUnitType] = useState('15_min');

  const refreshAuthorizations = useCallback(async () => {
    try {
      const res = await api.get('/admin/authorizations?page_size=100', token);
      setAuthorizations(res?.authorizations || []);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to refresh authorizations.');
    }
  }, [token]);

  useEffect(() => {
    let isMounted = true;
    const initialParamClientId = searchParams.get('client_id');

    async function loadData() {
      try {
        const [authRes, clientRes] = await Promise.all([
          api.get('/admin/authorizations?page_size=100', token),
          api.get('/admin/clients?page_size=100', token),
        ]);

        if (!isMounted) return;
        setAuthorizations(authRes?.authorizations || []);
        const cl = clientRes?.clients || [];
        setClients(cl);

        const targetClient = initialParamClientId
          ? cl.find((c) => c.id === initialParamClientId)
          : cl[0];

        if (targetClient) {
          setClientId(targetClient.id);
          const sId = String(targetClient.state_id || 1);
          setStateId(sId);
          const stateCode = targetClient.states?.code || STATE_CODE_MAP[sId] || 'FL';
          setAuthNumber(generateAuthNumber(stateCode));
        } else {
          setAuthNumber(generateAuthNumber('FL'));
        }
      } catch {
        if (!isMounted) return;
        setErrorMsg('Failed to load authorization records.');
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    loadData();
    return () => {
      isMounted = false;
    };
  }, [token, searchParams]);

  const selectedClient = useMemo(() => {
    return clients.find((c) => c.id === clientId) || null;
  }, [clients, clientId]);

  function handleClientChange(newClientId) {
    setClientId(newClientId);
    const cl = clients.find((c) => c.id === newClientId);
    if (cl) {
      const sId = String(cl.state_id || 1);
      setStateId(sId);
      const code = cl.states?.code || STATE_CODE_MAP[sId] || 'FL';
      setAuthNumber(generateAuthNumber(code));
    }
  }

  function handleRegenerateAuthNumber() {
    const code = selectedClient?.states?.code || STATE_CODE_MAP[stateId] || 'FL';
    setAuthNumber(generateAuthNumber(code));
  }

  function applyDurationPreset(days) {
    const base = startDate || getTodayStr();
    setEndDate(computeFutureDateStr(base, days));
  }

  function handleCopyAuthNumber(num, id) {
    if (!num) return;
    navigator.clipboard.writeText(num);
    setCopiedAuthId(id);
    setTimeout(() => setCopiedAuthId(null), 2000);
  }

  function handleStartEdit(auth) {
    setEditingAuth(auth);
    setClientId(auth.client_id || '');
    setStateId(String(auth.state_id || 1));
    setAuthNumber(auth.authorization_number || '');
    setStartDate(auth.start_date || getTodayStr());
    setEndDate(auth.end_date || computeFutureDateStr(getTodayStr(), 180));
    setNotes(auth.notes || '');
    setHcpcsCode(auth.hcpcs_code || 'T1019');
    setServiceDescription(auth.service_description || 'Personal Care Services');
    setTotalUnits(String(auth.total_units_authorized ?? 0));
    setUnitsUsed(String(auth.units_used ?? 0));
    setMaxWeeklyHours(auth.max_weekly_hours ? String(auth.max_weekly_hours) : '');
    setUnitType(auth.unit_type || '15_min');
    setShowForm(true);
  }

  function handleCloseForm() {
    setShowForm(false);
    setEditingAuth(null);
  }

  async function handleCreateAuth(e) {
    e.preventDefault();
    setErrorMsg('');
    setSuccessMsg('');

    if (!authNumber.trim()) {
      setErrorMsg('Authorization number cannot be empty.');
      return;
    }

    if (new Date(startDate) >= new Date(endDate)) {
      setErrorMsg('End date must be after start date.');
      return;
    }

    setSubmitting(true);

    const payload = {
      authorization_number: authNumber.trim(),
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
      hcpcs_code: hcpcsCode || 'T1019',
      service_description: serviceDescription || 'Personal Care Services',
      total_units_authorized: parseInt(totalUnits, 10) || 0,
      units_used: parseInt(unitsUsed, 10) || 0,
      max_weekly_hours: maxWeeklyHours ? parseFloat(maxWeeklyHours) : null,
      unit_type: unitType || '15_min',
    };

    try {
      if (editingAuth) {
        await api.patch(`/admin/authorizations/${editingAuth.id}`, payload, token);
        setSuccessMsg(`Authorization ${payload.authorization_number} updated successfully.`);
      } else {
        await api.post(
          '/admin/authorizations',
          {
            ...payload,
            client_id: clientId,
            state_id: parseInt(stateId, 10),
          },
          token
        );
        setSuccessMsg(`Authorization ${payload.authorization_number} issued successfully.`);
      }

      const code = selectedClient?.states?.code || STATE_CODE_MAP[stateId] || 'FL';
      setAuthNumber(generateAuthNumber(code));
      setStartDate(getTodayStr());
      setEndDate(computeFutureDateStr(getTodayStr(), 180));
      setNotes('');
      setEditingAuth(null);

      await refreshAuthorizations();
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err.detail || (editingAuth ? 'Failed to update authorization.' : 'Failed to issue authorization.'));
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(authorizationId, action, reviewDetails = {}) {
    if (!window.confirm(`Mark this authorization ${action === 'approved' ? 'approved (Active)' : 'rejected'}? The client will be notified.`)) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setReviewingId(authorizationId);
    setReviewAction(action);
    try {
      await api.post(`/admin/authorizations/${authorizationId}/review`, { status: action, ...reviewDetails }, token);
      setSuccessMsg(action === 'approved'
        ? 'Authorization approved and activated.'
        : 'Authorization rejected.');
      setReviewingId(null);
      setReviewAction('');
      await refreshAuthorizations();
    } catch (err) {
      setErrorMsg(err.detail || `Failed to ${action} the authorization.`);
      setReviewingId(null);
      setReviewAction('');
    }
  }

  const metrics = useMemo(() => calculateAuthMetrics(authorizations), [authorizations]);

  const filteredAuthorizations = useMemo(
    () => filterAndSortAuthorizations(authorizations, searchTerm, filterState, filterStatus, sortBy),
    [authorizations, searchTerm, filterState, filterStatus, sortBy]
  );

  const hasActiveFilters = searchTerm !== '' || filterState !== 'all' || filterStatus !== 'all';

  function handleResetFilters() {
    setSearchTerm('');
    setFilterState('all');
    setFilterStatus('all');
    setSortBy('end_date_asc');
  }

  return {
    authorizations,
    clients,
    loading,
    submitting,
    errorMsg,
    setErrorMsg,
    successMsg,
    setSuccessMsg,
    reviewingId,
    reviewAction,
    showForm,
    setShowForm,
    editingAuth,
    searchTerm,
    setSearchTerm,
    filterState,
    setFilterState,
    filterStatus,
    setFilterStatus,
    sortBy,
    setSortBy,
    copiedAuthId,
    clientId,
    selectedClient,
    handleClientChange,
    authNumber,
    setAuthNumber,
    handleRegenerateAuthNumber,
    startDate,
    setStartDate,
    endDate,
    setEndDate,
    applyDurationPreset,
    notes,
    setNotes,
    hcpcsCode,
    setHcpcsCode,
    serviceDescription,
    setServiceDescription,
    totalUnits,
    setTotalUnits,
    unitsUsed,
    setUnitsUsed,
    maxWeeklyHours,
    setMaxWeeklyHours,
    unitType,
    setUnitType,
    handleStartEdit,
    handleCloseForm,
    handleCreateAuth,
    handleReview,
    handleCopyAuthNumber,
    metrics,
    filteredAuthorizations,
    hasActiveFilters,
    handleResetFilters,
  };
}
