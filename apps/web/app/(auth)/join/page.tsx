'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

type Step = 'details' | 'link-student' | 'done';

export default function JoinSchoolPage() {
  const router = useRouter();
  const [step, setStep] = useState<Step>('details');
  const [role, setRole] = useState<'TEACHER' | 'PARENT'>('PARENT');
  const [form, setForm] = useState({ joinCode: '', firstName: '', lastName: '', email: '', password: '', confirm: '' });
  const [linkForm, setLinkForm] = useState({ admissionNumber: '', portalPin: '' });
  const [linkedName, setLinkedName] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  function setF(key: string, val: string) { setForm((f) => ({ ...f, [key]: val })); }

  async function handleJoin(e: React.FormEvent) {
    e.preventDefault();
    if (form.password !== form.confirm) { setError('Passwords do not match.'); return; }
    setError(''); setLoading(true);
    try {
      await api.post('/auth/join', { ...form, role });
      if (role === 'PARENT') {
        setStep('link-student');
      } else {
        setStep('done');
      }
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to create account.');
    } finally { setLoading(false); }
  }

  async function handleLinkStudent(e: React.FormEvent) {
    e.preventDefault();
    setError(''); setLoading(true);
    try {
      // Login first to get token, then link
      const loginRes = await api.post('/auth/login', { email: form.email, password: form.password });
      const { token } = loginRes.data;
      await api.post('/auth/link-student', linkForm, { headers: { Authorization: `Bearer ${token}` } });
      setLinkedName(loginRes.data.user.firstName);
      setStep('done');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not link student. Check the admission number and PIN.');
    } finally { setLoading(false); }
  }

  if (step === 'done') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="text-center max-w-md">
          <div className="text-5xl mb-4">✅</div>
          <h2 className="text-2xl font-bold text-gray-800 mb-2">You're in!</h2>
          <p className="text-gray-500 mb-6">
            {role === 'PARENT'
              ? "Your account is set up and linked to your child's record."
              : 'Your teacher account is ready. Log in to set up your profile.'}
          </p>
          <Link href="/login" className="inline-block bg-blue-600 text-white px-6 py-2.5 rounded-lg text-sm font-medium hover:bg-blue-700">
            Go to Login
          </Link>
        </div>
      </div>
    );
  }

  if (step === 'link-student') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold text-gray-900">Link Your Child</h1>
            <p className="text-gray-500 mt-1 text-sm">Enter the details given by the school office.</p>
          </div>
          <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
            <form onSubmit={handleLinkStudent} className="space-y-5">
              {error && <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Student Admission Number</label>
                <input
                  required value={linkForm.admissionNumber}
                  onChange={(e) => setLinkForm({ ...linkForm, admissionNumber: e.target.value.trim().toUpperCase() })}
                  placeholder="ADM-2025-0001"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Portal PIN</label>
                <input
                  required value={linkForm.portalPin}
                  onChange={(e) => setLinkForm({ ...linkForm, portalPin: e.target.value.trim() })}
                  placeholder="6-digit PIN from school"
                  maxLength={6}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 font-mono tracking-widest"
                />
                <p className="text-xs text-gray-400 mt-1">Ask the school office for your child's Portal PIN.</p>
              </div>
              <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60">
                {loading ? 'Linking...' : 'Link My Child'}
              </button>
              <button type="button" onClick={() => setStep('done')} className="w-full text-sm text-gray-400 hover:text-gray-600">
                Skip for now
              </button>
            </form>
          </div>
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

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">I am joining as</label>
              <div className="grid grid-cols-2 gap-3">
                {(['PARENT', 'TEACHER'] as const).map((r) => (
                  <button
                    key={r} type="button"
                    onClick={() => setRole(r)}
                    className={`py-2.5 rounded-lg text-sm font-medium border transition-colors ${role === r ? 'bg-blue-600 text-white border-blue-600' : 'bg-white text-gray-700 border-gray-300 hover:bg-gray-50'}`}
                  >
                    {r[0] + r.slice(1).toLowerCase()}
                  </button>
                ))}
              </div>
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
        </div>
      </div>
    </div>
  );
}