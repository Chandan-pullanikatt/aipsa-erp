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
  const [showPassword, setShowPassword] = useState(false);

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
              <div className="relative">
                <input
                  type={showPassword ? 'text' : 'password'}
                  required
                  autoComplete="current-password"
                  value={form.password}
                  onChange={(e) => setForm({ ...form, password: e.target.value })}
                  placeholder="••••••••"
                  className="w-full border border-gray-300 rounded-lg pl-3 pr-10 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((v) => !v)}
                  aria-label={showPassword ? 'Hide password' : 'Show password'}
                  aria-pressed={showPassword}
                  className="absolute inset-y-0 right-0 px-3 flex items-center text-gray-400 hover:text-gray-600 focus:outline-none focus:text-blue-600"
                >
                  {showPassword ? (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3.98 8.22A10.48 10.48 0 001.5 12s3.75 7.5 10.5 7.5c1.76 0 3.33-.51 4.68-1.28M6.23 6.23A10.45 10.45 0 0112 4.5c6.75 0 10.5 7.5 10.5 7.5a18.7 18.7 0 01-2.17 3.28M6.23 6.23l11.54 11.54M9.88 9.88a3 3 0 104.24 4.24M3 3l18 18" />
                    </svg>
                  ) : (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth={1.8} viewBox="0 0 24 24" aria-hidden="true">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.036 12.322a1.012 1.012 0 010-.639C3.423 7.51 7.36 4.5 12 4.5c4.638 0 8.573 3.007 9.963 7.178.07.207.07.431 0 .639C20.577 16.49 16.64 19.5 12 19.5c-4.638 0-8.573-3.007-9.964-7.178z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                  )}
                </button>
              </div>
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
