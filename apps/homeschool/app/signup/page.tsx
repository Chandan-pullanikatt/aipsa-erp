'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function SignupPage() {
  const router = useRouter();
  const [form, setForm] = useState({ parentFirstName: '', parentLastName: '', email: '', password: '', phone: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.');
      return;
    }
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/homeschool/signup', form);
      setAuth(data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create your account.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-[440px]">
        <Link href="/" className="flex items-center justify-center gap-2 font-display font-bold text-[18px] text-[#0B4D2E] mb-6">
          <GraduationCap className="w-6 h-6" /> AIPSA Home Schooling
        </Link>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-7">
          <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">Create your family account</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">One account for the whole family. Add your children after signing up.</p>

          {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-[13px] px-4 py-2.5 rounded-lg mt-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4 mt-5">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">First name</label>
                <input required value={form.parentFirstName} onChange={(e) => setForm({ ...form, parentFirstName: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Last name</label>
                <input required value={form.parentLastName} onChange={(e) => setForm({ ...form, parentLastName: e.target.value })} className="w-full" />
              </div>
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Phone <span className="text-[#9CA3AF]">(optional)</span></label>
              <input value={form.phone} onChange={(e) => setForm({ ...form, phone: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Password</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full" />
              <p className="text-[12px] text-[#9CA3AF] mt-1">At least 8 characters.</p>
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white font-medium h-[42px] rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Creating account…' : 'Create account'}
            </button>
          </form>
        </div>
        <p className="text-center text-[14px] text-[#6B7280] mt-5">
          Already have an account? <Link href="/login" className="text-[#1D7A4A] font-medium hover:underline">Log in</Link>
        </p>
      </div>
    </div>
  );
}
