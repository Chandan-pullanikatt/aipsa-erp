'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

export default function RegisterPage() {
  const router = useRouter();
  const [form, setForm] = useState({
    schoolName: '', city: '', state: '', phone: '',
    adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '',
  });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await api.post('/auth/register', form);
      router.push('/login?registered=1');
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Registration failed.');
    } finally {
      setLoading(false);
    }
  }

  const field = (label: string, key: keyof typeof form, type = 'text', placeholder = '') => (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-1">{label}</label>
      <input
        type={type}
        required
        value={form[key]}
        onChange={(e) => setForm({ ...form, [key]: e.target.value })}
        placeholder={placeholder}
        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
      />
    </div>
  );

  return (
    <div className="min-h-screen flex items-center justify-center bg-gray-50 px-4 py-10">
      <div className="w-full max-w-xl">
        <div className="text-center mb-8">
          <h1 className="text-3xl font-bold text-gray-900">Register Your School</h1>
          <p className="text-gray-500 mt-1">Join the AIPSA platform. Approval takes 1–2 business days.</p>
        </div>

        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-8">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                {error}
              </div>
            )}

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400">School Information</p>
            {field('School Name', 'schoolName', 'text', 'St. Mary\'s High School')}
            <div className="grid grid-cols-2 gap-4">
              {field('City', 'city', 'text', 'Mumbai')}
              {field('State', 'state', 'text', 'Maharashtra')}
            </div>
            {field('Phone', 'phone', 'tel', '+91 98765 43210')}

            <p className="text-xs font-semibold uppercase tracking-wider text-gray-400 pt-2">Admin Account</p>
            <div className="grid grid-cols-2 gap-4">
              {field('First Name', 'adminFirstName')}
              {field('Last Name', 'adminLastName')}
            </div>
            {field('Admin Email', 'adminEmail', 'email', 'principal@school.com')}
            {field('Password', 'adminPassword', 'password', 'Min. 8 characters')}

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 text-white py-2.5 rounded-lg font-medium text-sm hover:bg-blue-700 disabled:opacity-60 transition-colors"
            >
              {loading ? 'Submitting...' : 'Submit Registration'}
            </button>
          </form>

          <p className="text-center text-sm text-gray-500 mt-6">
            Already registered?{' '}
            <Link href="/login" className="text-blue-600 hover:underline font-medium">Sign in</Link>
          </p>
        </div>
      </div>
    </div>
  );
}
