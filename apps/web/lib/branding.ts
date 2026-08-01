// School branding (logo + display name) shown in the app shell for every portal —
// admin, teacher, student and parent all render the same sidebar, so this is the
// single source for it.
//
// The layout mounts on every navigation, so the value is cached in sessionStorage:
// the first paint after a page change reuses the cached logo (no flash back to the
// wordmark) while a background refresh keeps it current. `clearBranding()` is called
// by the School Profile page after a save so the new logo shows immediately.

import api from './api';

export interface Branding {
  logo: string | null;
  schoolName: string | null;
}

const KEY = 'school_branding';

export function getCachedBranding(): Branding | null {
  if (typeof window === 'undefined') return null;
  try {
    const raw = sessionStorage.getItem(KEY);
    return raw ? (JSON.parse(raw) as Branding) : null;
  } catch {
    return null;
  }
}

export function clearBranding() {
  if (typeof window === 'undefined') return;
  try { sessionStorage.removeItem(KEY); } catch { /* private mode */ }
}

export async function fetchBranding(): Promise<Branding | null> {
  try {
    const { data } = await api.get('/schools/profile');
    const branding: Branding = {
      logo: data?.logo || null,
      schoolName: data?.schoolName || null,
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(branding)); } catch { /* private mode */ }
    return branding;
  } catch {
    return null;
  }
}
