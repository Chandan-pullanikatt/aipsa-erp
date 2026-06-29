import Cookies from 'js-cookie';

export interface AuthUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: string;
  tenantId: string | null;
  tenantStatus: string | null;
}

export function getUser(): AuthUser | null {
  try {
    const raw = Cookies.get('user');
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function setAuth(user: AuthUser) {
  Cookies.set('user', JSON.stringify(user), { expires: 7, sameSite: 'lax' });
}

export function clearAuth() {
  Cookies.remove('user');
  fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
}
