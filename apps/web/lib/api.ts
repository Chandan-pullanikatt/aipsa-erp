import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
});

// Token is stored in an httpOnly cookie managed server-side — no Authorization
// header is needed here; the proxy route injects it from the secure cookie.

api.interceptors.response.use(
  (res) => res,
  (err) => {
    const publicAuthEndpoints = [
      '/auth/login',
      '/auth/register',
      '/auth/join',
      '/auth/forgot-password',
      '/auth/reset-password',
      '/auth/accept-invite'
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
