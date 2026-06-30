'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';

type Step = 'code' | 'details' | 'done';

export default function StudentJoinPage() {
  const [step, setStep] = useState<Step>('code');
  const [joinCode, setJoinCode] = useState('');
  const [classInfo, setClassInfo] = useState<{ classId: string; className: string; schoolName: string } | null>(null);
  const [form, setForm] = useState({ firstName: '', lastName: '', dateOfBirth: '', parentPhone: '', email: '' });
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF(key: string, val: string) { setForm(f => ({ ...f, [key]: val })); }

  async function handleCodeSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      const { data } = await api.get(`/auth/class-code/${joinCode.trim().toUpperCase()}`);
      setClassInfo(data);
      setStep('details');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Invalid class code. Please check with your school.');
    } finally { setLoading(false); }
  }

  async function handleDetailsSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      await api.post('/auth/student-join', { joinCode: joinCode.trim().toUpperCase(), ...form });
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to submit request.');
    } finally { setLoading(false); }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">📋</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">Request Submitted!</h2>
          <p className="text-gray-500 mb-2">
            Your request to join <strong>{classInfo?.className}</strong> at <strong>{classInfo?.schoolName}</strong> has been sent to your class teacher.
          </p>
          <p className="text-gray-400 text-sm mb-6">
            Once your teacher approves your request, you will receive your login details. Please keep your email handy.
          </p>
          <Link
            href="/login"
            className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700"
          >
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'details' && classInfo) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
        <div className="w-full max-w-md">
          <div className="text-center mb-6">
            <h1 className="text-2xl font-bold text-gray-900">EduBridge</h1>
            <p className="text-gray-500 mt-1 text-sm">Student Registration</p>
          </div>

          {/* Class confirmation banner */}
          <div className="bg-green-50 border border-green-200 rounded-xl px-4 py-3 mb-6 text-center">
            <p className="text-sm font-semibold text-green-800">
              Joining: <span className="font-bold">{classInfo.className}</span>
            </p>
            <p className="text-xs text-green-600 mt-0.5">{classInfo.schoolName}</p>
          </div>

          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
            )}

            <form onSubmit={handleDetailsSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">First Name</label>
                  <input
                    required value={form.firstName}
                    onChange={e => setF('firstName', e.target.value)}
                    placeholder="Rahul"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Last Name</label>
                  <input
                    required value={form.lastName}
                    onChange={e => setF('lastName', e.target.value)}
                    placeholder="Sharma"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                <input
                  type="date" value={form.dateOfBirth}
                  onChange={e => setF('dateOfBirth', e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent's Phone Number</label>
                <input
                  required value={form.parentPhone}
                  onChange={e => setF('parentPhone', e.target.value)}
                  placeholder="+91 98765 43210"
                  type="tel"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                <input
                  required value={form.email}
                  onChange={e => setF('email', e.target.value)}
                  placeholder="rahul@example.com"
                  type="email"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
                <p className="text-xs text-gray-400 mt-1">Your login details will be sent here after approval.</p>
              </div>

              <button
                type="submit" disabled={loading}
                className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 mt-2"
              >
                {loading ? 'Submitting...' : 'Submit Registration Request'}
              </button>

              <button
                type="button"
                onClick={() => { setStep('code'); setError(''); }}
                className="w-full text-sm text-gray-400 hover:text-gray-600"
              >
                ← Use a different code
              </button>
            </form>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">EduBridge</h1>
          <p className="text-gray-500 mt-1">Student Registration</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3 mb-5">{error}</div>
          )}

          <form onSubmit={handleCodeSubmit} className="space-y-5">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Class Join Code</label>
              <input
                required value={joinCode}
                onChange={e => setJoinCode(e.target.value.toUpperCase())}
                placeholder="e.g. 8BXX-A3B2"
                maxLength={9}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest uppercase"
              />
              <p className="text-xs text-gray-400 mt-1">Ask your class teacher for this code.</p>
            </div>

            <button
              type="submit" disabled={loading || joinCode.length < 4}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60"
            >
              {loading ? 'Looking up...' : 'Continue'}
            </button>
          </form>

          <div className="mt-6 pt-5 border-t border-gray-100 text-center">
            <p className="text-sm text-gray-500">
              Already have an account?{' '}
              <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
            </p>
            <p className="text-sm text-gray-500 mt-2">
              Are you a teacher or parent?{' '}
              <Link href="/join" className="text-blue-600 hover:underline font-medium">Join here</Link>
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
