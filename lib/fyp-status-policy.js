export const FYP_REVIEW_STATUSES = ['DRAFT', 'PENDING_REVIEW', 'APPROVED', 'NEEDS_CHANGES'];

const FYP_TRANSITIONS = {
  DRAFT: new Set(['DRAFT', 'PENDING_REVIEW']),
  PENDING_REVIEW: new Set(['PENDING_REVIEW', 'APPROVED', 'NEEDS_CHANGES']),
  NEEDS_CHANGES: new Set(['NEEDS_CHANGES', 'DRAFT', 'PENDING_REVIEW']),
  APPROVED: new Set(['APPROVED']),
};

export function normalizeFypSaveStatus(status) {
  return status === 'DRAFT' ? 'DRAFT' : 'PENDING_REVIEW';
}

export function canTransitionFypStatus(from, to) {
  return Boolean(FYP_TRANSITIONS[from]?.has(to));
}
