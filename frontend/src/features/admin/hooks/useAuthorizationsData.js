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
      client_id: clientId,
      state_id: parseInt(stateId, 10),
      authorization_number: authNumber.trim(),
      start_date: startDate,
      end_date: endDate,
      notes: notes.trim() || null,
    };

    try {
      await api.post('/admin/authorizations', payload, token);
      setSuccessMsg(`Authorization ${payload.authorization_number} issued successfully.`);

      const code = selectedClient?.states?.code || STATE_CODE_MAP[stateId] || 'FL';
      setAuthNumber(generateAuthNumber(code));
      setStartDate(getTodayStr());
      setEndDate(computeFutureDateStr(getTodayStr(), 180));
      setNotes('');

      await refreshAuthorizations();
      setShowForm(false);
    } catch (err) {
      setErrorMsg(err.detail || 'Failed to issue authorization.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleReview(authorizationId, action) {
    if (!window.confirm(`Mark this authorization ${action === 'approved' ? 'approved (Active)' : 'rejected'}? The client will be notified.`)) {
      return;
    }
    setErrorMsg('');
    setSuccessMsg('');
    setReviewingId(authorizationId);
    setReviewAction(action);
    try {
      await api.post(`/admin/authorizations/${authorizationId}/review`, { status: action }, token);
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
    handleCreateAuth,
    handleReview,
    handleCopyAuthNumber,
    metrics,
    filteredAuthorizations,
    hasActiveFilters,
    handleResetFilters,
  };
}
