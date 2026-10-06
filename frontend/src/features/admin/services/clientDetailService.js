import { api } from '../../../shared/services/api';

export async function fetchClientDetailBundle(id, token) {
  const [res, planRes, schedRes, asgnRes, cgRes] = await Promise.all([
    api.get(`/admin/clients/${id}`, token),
    api.get(`/admin/clients/${id}/care-plan`, token),
    api.get(`/admin/clients/${id}/schedule`, token),
    api.get(`/admin/clients/${id}/assignments`, token),
    api.get('/admin/caregivers', token),
  ]);
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
