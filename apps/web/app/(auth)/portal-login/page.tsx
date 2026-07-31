'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { setAuth, getDashboardPath } from '@/lib/auth';

export default function PortalLoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ admissionNumber: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data } = await api.post('/auth/pin-login', form);
      setAuth(data.user);
      router.push(getDashboardPath(data.user.role));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Sign in failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">EduBridge</h1>
          <p className="text-gray-500 mt-1">Parent &amp; Student sign in</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Admission Number</label>
              <input
                required
                value={form.admissionNumber}
                onChange={(e) => setForm({ ...form, admissionNumber: e.target.value.trim().toUpperCase() })}
                placeholder="ADM-2025-0001"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input
                type="password"
                required
                autoComplete="current-password"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                placeholder="••••••••"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
              <p className="text-xs text-gray-400 mt-1">Shared by your school. You can change it after signing in.</p>
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Signing in...' : 'Sign In'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Staff member?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in with email</Link>
          </p>
        </div>

        <p className="mt-6 text-center text-[11px] text-gray-400">
          Powered by All India Private Schools Association
        </p>
      </div>
    </div>
  );
}
