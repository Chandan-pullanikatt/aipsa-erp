import axios from 'axios';
import Cookies from 'js-cookie';

const api = axios.create({
  baseURL: '/api/proxy',
  headers: { 'Content-Type': 'application/json' },
});

// Token lives in an httpOnly cookie injected by the proxy route — no auth header here.
api.interceptors.response.use(
  (res) => res,
  (err) => {
    const publicEndpoints = ['/homeschool/login', '/homeschool/signup'];
    const isPublic = publicEndpoints.some((r) => err.config?.url?.includes(r));
    if (err.response?.status === 401 && !isPublic) {
      Cookies.remove('user');
      fetch('/api/auth/logout', { method: 'POST' }).catch(() => {});
      window.location.href = '/login';
    }
    return Promise.reject(err);
  },
);

export default api;
