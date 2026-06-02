'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser, setAuth, getDashboardPath } from '@/lib/auth';
import { Eye, EyeOff, KeyRound } from 'lucide-react';

export default function ChangePasswordPage() {
  const router = useRouter();
  const user = getUser();
  const isForced = user?.mustChangePassword === true;
  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');

    if (form.newPassword !== form.confirm) {
      setError('New passwords do not match.');
      return;
    }
    if (form.newPassword.length < 8) {
      setError('New password must be at least 8 characters.');
      return;
    }

    setLoading(true);
    try {
      await api.post('/auth/change-password', {
        currentPassword: form.currentPassword,
        newPassword: form.newPassword,
      });
      // Clear mustChangePassword flag in the cookie and redirect to dashboard
      const user = getUser();
      if (user) {
        user.mustChangePassword = false;
        setAuth(user);
        router.push(getDashboardPath(user.role));
      } else {
        router.push('/login');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password. Please try again.');
    } finally { setLoading(false); }
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className={`w-14 h-14 ${isForced ? 'bg-amber-100' : 'bg-[#E5F6EE]'} rounded-full flex items-center justify-center mx-auto mb-4`}>
            <KeyRound className={`w-6 h-6 ${isForced ? 'text-amber-600' : 'text-[#1D7A4A]'}`} strokeWidth={1.75} />
          </div>
          <h1 className="text-2xl font-bold text-gray-900">
            {isForced ? 'Set Your Password' : 'Change Password'}
          </h1>
          <p className="text-gray-500 mt-1 text-sm">
            {isForced
              ? "You're using a temporary password. Please set a new one before continuing."
              : 'Enter your current password, then choose a new one.'}
          </p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Current (Temporary) Password</label>
              <div className="relative">
                <input
                  required
                  type={showCurrent ? 'text' : 'password'}
                  value={form.currentPassword}
                  onChange={e => setF('currentPassword', e.target.value)}
                  placeholder="Enter your temporary password"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowCurrent(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">New Password</label>
              <div className="relative">
                <input
                  required
                  type={showNew ? 'text' : 'password'}
                  value={form.newPassword}
                  onChange={e => setF('newPassword', e.target.value)}
                  placeholder="At least 8 characters"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 pr-10 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <button
                  type="button"
                  onClick={() => setShowNew(v => !v)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400"
                >
                  {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm New Password</label>
              <input
                required
                type="password"
                value={form.confirm}
                onChange={e => setF('confirm', e.target.value)}
                placeholder="Repeat your new password"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            <button
              type="submit" disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Saving...' : 'Set New Password & Continue'}
            </button>
          </form>
        </div>
      </div>
    </div>
  );
}
