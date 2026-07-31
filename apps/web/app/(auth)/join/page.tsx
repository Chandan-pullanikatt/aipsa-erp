'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

export default function JoinSchoolPage() {
  const [done, setDone] = useState(false);
  const [form, setForm] = useState({ joinCode: '', firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/join', { ...form, role: 'TEACHER' });
      setDone(true);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to create account.');
    } finally { setLoading(false); }
  }

  if (done) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">You&apos;re in!</h2>
          <p className="text-gray-500 mb-6">Your teacher account is ready. Log in to set up your profile.</p>
          <Link href="/login" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">EduBridge</h1>
          <p className="text-gray-500 mt-1">Join your school workspace</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>}

          <form onSubmit={handleJoin} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">School Join Code</label>
              <input
                required value={form.joinCode}
                onChange={(e) => setF('joinCode', e.target.value.trim().toUpperCase())}
                placeholder="e.g. STJN-4X9K"
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest uppercase"
              />
              <p className="text-xs text-gray-400 mt-1">Get this code from your school admin.</p>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                <input required value={form.firstName} onChange={(e) => setF('firstName', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                <input required value={form.lastName} onChange={(e) => setF('lastName', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setF('email', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Password</label>
              <input type="password" required minLength={8} value={form.password} onChange={(e) => setF('password', e.target.value)} placeholder="Min. 8 characters" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Confirm Password</label>
              <input type="password" required value={form.confirm} onChange={(e) => setF('confirm', e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500" />
            </div>

            <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors">
              {loading ? 'Creating account...' : 'Create Account'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already have an account?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>
          <p className="text-center text-sm text-gray-500 mt-2">
            Parent or Student?{' '}
            <Link href="/portal-login" className="text-blue-600 hover:underline font-medium">Sign in with admission number</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
