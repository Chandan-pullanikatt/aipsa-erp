import Cookies from 'js-cookie';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: 'SUPER_ADMIN' | 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  tenantId: string | null;
  tenantStatus: string | null;
  tenantSlug: string | null;
  mustChangePassword?: boolean;
}

export function getUser(): AuthUser | null {
  try {
    const raw = Cookies.get('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

// Token is managed server-side as an httpOnly cookie via the proxy layer.
// Only non-sensitive user profile data is stored in a JS-readable cookie.
export function setAuth(user: AuthUser) {
  Cookies.set('user', JSON.stringify(user), { expires: 7, sameSite: 'lax' });
}

export function clearAuth() {
  Cookies.remove('user');
  // Ask the server to clear the httpOnly token cookie.
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}

export function getDashboardPath(role: AuthUser['role']): string {
  switch (role) {
    case 'SUPER_ADMIN': return '/aipsa';
    case 'SCHOOL_ADMIN': return '/school';
    case 'TEACHER': return '/teacher';
    case 'STUDENT': return '/student';
    case 'PARENT': return '/parent';
    default: return '/login';
  }
}
