'use client';

import { useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { Camera } from 'lucide-react';

type Step = 'code' | 'details' | 'done';

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

// Personal Details fields mirror the admin admission form (school/students/new)
// so a student who self-registers via class code supplies the same profile a
// front-office admin would collect in person. The extra fields (gender, blood
// group, address, photo) are stored on the join request and carried onto the
// Student record when a teacher approves it.
export default function StudentJoinPage() {
  const [step, setStep] = useState<Step>('code');
  const [joinCode, setJoinCode] = useState('');
  const [classInfo, setClassInfo] = useState<{ classId: string; className: string; schoolName: string } | null>(null);
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: '', bloodGroup: '',
    phone: '', address: '', city: '', state: '', photoUrl: '',
    parentPhone: '', email: '',
  });
  const [uploadingPhoto, setUploadingPhoto] = useState(false);
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

  async function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError('');
    setUploadingPhoto(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('joinCode', joinCode.trim().toUpperCase());
      const { data } = await api.post('/auth/student-join/photo', fd, { headers: { 'Content-Type': undefined } as any });
      setF('photoUrl', data.url);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Photo upload failed.');
    } finally {
      setUploadingPhoto(false);
    }
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
        <div className="w-full max-w-lg">
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

            <form onSubmit={handleDetailsSubmit} className="space-y-5">
              {/* Passport photo — matches the admin admission form's ID-card photo */}
              <div className="flex items-center gap-4">
                <div className="w-16 h-20 rounded-lg border border-gray-200 bg-gray-50 overflow-hidden flex items-center justify-center shrink-0">
                  {form.photoUrl
                    ? <img src={form.photoUrl} alt="Student" className="w-full h-full object-cover" />
                    : <Camera className="w-5 h-5 text-gray-300" strokeWidth={1.5} />}
                </div>
                <div className="space-y-1">
                  <label className="block text-sm font-medium text-gray-700">Passport Photo</label>
                  <label className="inline-flex items-center gap-2 px-3 py-1.5 border border-gray-300 rounded-lg text-xs font-medium text-gray-600 bg-white hover:bg-gray-50 cursor-pointer transition-colors">
                    <Camera className="w-3.5 h-3.5" strokeWidth={1.75} />
                    {uploadingPhoto ? 'Uploading…' : form.photoUrl ? 'Change photo' : 'Upload photo'}
                    <input type="file" accept="image/*" className="hidden" onChange={handlePhoto} disabled={uploadingPhoto} />
                  </label>
                  <p className="text-[11px] text-gray-400">JPG/PNG, used on the student ID card.</p>
                </div>
              </div>

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

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Date of Birth</label>
                  <input
                    type="date" value={form.dateOfBirth}
                    onChange={e => setF('dateOfBirth', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Gender</label>
                  <select
                    value={form.gender} onChange={e => setF('gender', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select gender</option>
                    {GENDERS.map(g => <option key={g} value={g}>{g[0] + g.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Blood Group</label>
                  <select
                    value={form.bloodGroup} onChange={e => setF('bloodGroup', e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="">Select blood type</option>
                    {BLOOD_GROUPS.map(b => <option key={b} value={b}>{b}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Contact Phone</label>
                  <input
                    value={form.phone} onChange={e => setF('phone', e.target.value)}
                    placeholder="+91 98765 43210" type="tel"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Residential Address</label>
                <input
                  value={form.address} onChange={e => setF('address', e.target.value)}
                  placeholder="123 Main Street"
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                  <input
                    value={form.city} onChange={e => setF('city', e.target.value)}
                    placeholder="Mumbai"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">State / Province</label>
                  <input
                    value={form.state} onChange={e => setF('state', e.target.value)}
                    placeholder="Maharashtra"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              <div className="pt-1 border-t border-gray-100" />

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Parent&apos;s Phone Number</label>
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
                type="submit" disabled={loading || uploadingPhoto}
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
