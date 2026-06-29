// The "active learner" (which child you're currently working with) is kept in
// localStorage so catalog/course/lesson pages know whose progress to record.
const KEY = 'hs_active_learner';

export function getActiveLearner(): string | null {
  if (typeof window === 'undefined') return null;
  return window.localStorage.getItem(KEY);
}

export function setActiveLearner(id: string) {
  window.localStorage.setItem(KEY, id);
}
