// School branding (logo + display name) shown in the app shell for every portal —
// admin, teacher, student and parent all render the same sidebar, so this is the
// single source for it.
//
// The layout mounts on every navigation, so the value is cached in sessionStorage:
// the first paint after a page change reuses the cached logo (no flash back to the
// wordmark) while a background refresh keeps it current. `clearBranding()` is called
// by the School Profile page after a save so the new logo shows immediately.

'use client';

import { useEffect, useState } from 'react';
import api from './api';

export interface Branding {
  logo: string | null;
  schoolName: string | null;
  // Letterhead detail for printed documents — report cards carry the issuing
  // school's address and board, not just its name.
  address: string | null;
  city: string | null;
  state: string | null;
  phone: string | null;
  board: string | null;
}

const EMPTY: Branding = { logo: null, schoolName: null, address: null, city: null, state: null, phone: null, board: null };

// Bumped when the shape grew: a v1 entry left over in a tab would render a
// letterhead with no address until the next refresh.
const KEY = 'school_branding_v2';

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

/**
 * Branding for anything rendered outside the shell — printed report cards, mark
 * sheets. The dashboard layout refreshes the cache on every navigation, so a cache
 * hit here is already current and needs no second request; only a cold pane (deep
 * link, hard reload) pays for a fetch.
 */
export function useBranding(): Branding {
  const [branding, setBranding] = useState<Branding | null>(() => getCachedBranding());

  useEffect(() => {
    if (getCachedBranding()) return;
    let alive = true;
    fetchBranding().then((b) => { if (alive && b) setBranding(b); });
    return () => { alive = false; };
  }, []);

  return branding ?? EMPTY;
}

export async function fetchBranding(): Promise<Branding | null> {
  try {
    const { data } = await api.get('/schools/profile');
    const branding: Branding = {
      logo: data?.logo || null,
      schoolName: data?.schoolName || null,
      address: data?.address || null,
      city: data?.city || null,
      state: data?.state || null,
      phone: data?.phone || null,
      board: data?.board || null,
    };
    try { sessionStorage.setItem(KEY, JSON.stringify(branding)); } catch { /* private mode */ }
    return branding;
  } catch {
    return null;
  }
}
