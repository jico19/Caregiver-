export const ROADMAP_STEPS = [
  { key: 'application', label: '1. Application', to: '/caregiver/application' },
  { key: 'credentials', label: '2. Credentials', to: '/caregiver/documents' },
  { key: 'training', label: '3. Training', to: '/caregiver/training' },
];

export const ONBOARDING_STEPS = ROADMAP_STEPS;

// Single source of truth for how every status is DISPLAYED.
// The database keeps its own statuses (submitted, under_review, approved,
// onboarding, rejected) — here we merge confusing pairs into clear groups so
// the applicant always understands where they are and what to do next.
export const STATUS_META = {
  draft: {
    label: 'Not Started',
    badge: 'badge-gray',
    panelClass: '',
    group: 'not_started',
    locked: false,
  },
  submitted: {
    label: 'Under Review',
    badge: 'badge-blue',
    panelClass: 'banner-info',
    group: 'review',
    locked: true,
  },
  under_review: {
    label: 'Under Review',
    badge: 'badge-yellow',
    panelClass: 'banner-info',
    group: 'review',
    locked: true,
  },
  approved: {
    label: 'Onboarding',
    badge: 'badge-green',
    panelClass: 'stat-card-success',
    group: 'onboarding',
    locked: true,
  },
  onboarding: {
    label: 'Onboarding',
    badge: 'badge-purple',
    panelClass: 'stat-card-success',
    group: 'onboarding',
    locked: true,
  },
  rejected: {
    label: 'Not Approved',
    badge: 'badge-red',
    panelClass: 'panel-rejected',
    group: 'rejected',
    locked: false,
  },
};

// What the applicant should see as the one "next thing" for their stage.
// `appStatus` may be null/absent when the caregiver has not started yet.
export function milestoneMeta(appStatus) {
  const status = appStatus || 'not_started';
  const group = STATUS_META[status]?.group || 'not_started';

  switch (group) {
    case 'review':
      return {
        title: 'Under Review',
        message:
          'Our compliance team is verifying your details (typically 1–2 business days). No action needed — but you can get ahead by uploading your credentials now.',
        nextAction: { label: 'Upload Credentials →', to: '/caregiver/documents' },
      };
    case 'onboarding':
      return {
        title: 'Onboarding — Almost There!',
        message:
          'Your application is approved. Finish your credentials and in-service training to be ready to care for clients.',
        nextAction: { label: 'Go to Training →', to: '/caregiver/training' },
      };
    case 'rejected':
      return {
        title: 'Not Approved',
        message:
          'Review the reason below, update your details, and resubmit to begin a new review.',
        nextAction: { label: 'View Reason & Resubmit →', to: '/caregiver/application' },
      };
    case 'not_started':
    default:
      return {
        title: 'Not Started',
        message:
          "Let's get started! Fill out the application so our team can review you as a caregiver.",
        nextAction: { label: 'Start Application →', to: '/caregiver/application' },
      };
  }
}

export function badgeClass(status) {
  const meta = STATUS_META[status];
  return `badge ${meta ? meta.badge : 'badge-gray'}`;
}

export function stepBadge(appStatus, step) {
  const group = STATUS_META[appStatus]?.group || 'not_started';
  if (step.key === 'application') {
    if (group === 'onboarding') return 'badge-green';
    if (group === 'rejected') return 'badge-red';
    if (group === 'review') return 'badge-blue';
    return 'badge-gray';
  }
  if (group === 'onboarding') return 'badge-blue';
  return 'badge-gray';
}

export function milestoneDescription(appStatus) {
  return milestoneMeta(appStatus).message;
}

export function milestoneActionLabel(appStatus) {
  return milestoneMeta(appStatus).nextAction.label;
}