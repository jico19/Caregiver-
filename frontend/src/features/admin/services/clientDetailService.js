import { api } from '../../../shared/services/api';

// #region agent log
let _bundleCallCount = 0;
// #endregion

export async function fetchClientDetailBundle(id, token) {
  // #region agent log
  _bundleCallCount += 1;
  const callNum = _bundleCallCount;
  const stack = new Error().stack?.split('\n').slice(0, 8).join(' | ') || '';
  fetch('http://127.0.0.1:7819/ingest/214caf9e-054b-4d1c-90b8-118c8b6c9a4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08186c'},body:JSON.stringify({sessionId:'08186c',runId:'post-fix',hypothesisId:'A',location:'clientDetailService.js:fetchClientDetailBundle',message:'bundle fetch started',data:{callNum,id,tokenPresent:!!token,stack},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  const [res, planRes, schedRes, asgnRes, cgRes] = await Promise.all([
    api.get(`/admin/clients/${id}`, token),
    api.get(`/admin/clients/${id}/care-plan`, token),
    api.get(`/admin/clients/${id}/schedule`, token),
    api.get(`/admin/clients/${id}/assignments`, token),
    api.get('/admin/caregivers', token),
  ]);
  // #region agent log
  fetch('http://127.0.0.1:7819/ingest/214caf9e-054b-4d1c-90b8-118c8b6c9a4e',{method:'POST',headers:{'Content-Type':'application/json','X-Debug-Session-Id':'08186c'},body:JSON.stringify({sessionId:'08186c',runId:'post-fix',hypothesisId:'D',location:'clientDetailService.js:fetchClientDetailBundle',message:'bundle fetch completed',data:{callNum,id,endpoints:5},timestamp:Date.now()})}).catch(()=>{});
  // #endregion
  return { res, planRes, schedRes, asgnRes, cgRes };
}

export function assignCaregiverApi(id, caregiverId, role, token) {
  return api.post(
    `/admin/clients/${id}/assignments`,
    { caregiver_id: caregiverId, role },
    token
  );
}

export function endAssignmentApi(id, caregiverId, token) {
  return api.delete(`/admin/clients/${id}/assignments/${caregiverId}`, token);
}

export function updateAdmissionApi(id, payload, token) {
  return api.post(`/admin/clients/${id}/admission`, payload, token);
}

export function saveCarePlanApi(id, payload, token) {
  return api.put(`/admin/clients/${id}/care-plan`, payload, token);
}

export function addScheduleSlotApi(id, payload, token) {
  return api.post(`/admin/clients/${id}/schedule`, payload, token);
}

export function deleteScheduleSlotApi(id, entryIndex, token) {
  return api.delete(`/admin/clients/${id}/schedule/${entryIndex}`, token);
}
