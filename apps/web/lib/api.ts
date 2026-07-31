import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
});

// Token is stored in an httpOnly cookie managed server-side — no Authorization
// header is needed here; the proxy route injects it from the secure cookie.

// The JSON content-type above is right for almost every call, but axios keeps a
// header it was given explicitly — so a FormData body would be sent labelled as
// JSON, without the multipart boundary, and the API would see no file at all.
// Dropping it here lets axios set `multipart/form-data; boundary=…` itself.
api.interceptors.request.use((config) => {
  if (typeof FormData !== 'undefined' && config.data instanceof FormData) {
    if (typeof config.headers?.delete === 'function') config.headers.delete('Content-Type');
    else delete (config.headers as Record<string, unknown>)['Content-Type'];
  }
  return config;
});

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const publicAuthEndpoints = [
      '/auth/login',
      '/auth/pin-login',
      '/auth/register',
      '/auth/join',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/accept-invite',
      '/auth/student-join',
      '/auth/class-code',
    ];
    const isPublicAuthRoute = publicAuthEndpoints.some(route => err.config?.url?.includes(route));

    if (err.response?.status === 401 && !isPublicAuthRoute) {
      Cookies.remove('user');
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
