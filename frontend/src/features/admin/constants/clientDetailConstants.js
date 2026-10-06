export { CLIENT_STATUS_LABELS, CLIENT_STATUS_BADGE } from '../../../shared/constants/clientStatus';

export const ALLOWED_CLIENT_TRANSITIONS = {
  pending: ['approved', 'rejected'],
  approved: ['active', 'rejected', 'discharged'],
  active: ['discharged'],
  discharged: [],
  rejected: [],
};

export const DAY_OPTIONS = [
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
  'Sunday',
];

export const PLAN_STATUS_LABELS = {
  active: 'Active',
  pending: 'Pending',
  inactive: 'Inactive',
};

export const PLAN_STATUS_BADGE = {
  active: 'badge badge-success',
  pending: 'badge badge-warning',
  inactive: 'badge badge-neutral',
};

export const SCHEDULE_STATUS_LABELS = {
  scheduled: 'Scheduled',
  confirmed: 'Confirmed',
  completed: 'Completed',
  cancelled: 'Cancelled',
};

export const SCHEDULE_STATUS_BADGE = {
  scheduled: 'badge badge-info',
  confirmed: 'badge badge-success',
  completed: 'badge badge-neutral',
  cancelled: 'badge badge-error',
};

export const SERVICE_OPTIONS = [
  'Personal Care Assistance (PCA)',
  'Home Health Aide (HHA)',
  'Companion & Homemaker Services',
  'Respite Care Services',
];

export const ACTIVITY_OPTIONS = [
  'Bathing & Grooming Support',
  'Dressing Assistance',
  'Mobility & Transfer Support',
  'Toileting / Incontinence Care',
  'Feeding & Meal Preparation',
  'Medication Reminders',
  'Companionship & Conversation',
  'Light Housekeeping',
  'Errands & Appointments',
  'Respite Care',
];

export const FREQUENCY_OPTIONS = [
  '2x daily',
  '3x daily',
  'As needed (PRN)',
  'Morning only',
  'Evening only',
  'Twice weekly',
  'Weekly',
];

export const EMPTY_ACTIVITY = {
  task: '',
  frequency: '',
  notes: '',
  custom: false,
  freqCustom: false,
};
