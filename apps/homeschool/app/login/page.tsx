'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, ArrowLeft } from 'lucide-react';
import api from '@/lib/api';
import { setAuth } from '@/lib/auth';

export default function LoginPage() {
  const router = useRouter();
  const [form, setForm] = useState({ email: '', password: '' });
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError('');
    try {
      const { data } = await api.post('/auth/login', form);
      if (data.user?.role !== 'HS_PARENT') {
        setError('This login is for home-schooling families. Please use the correct app.');
        setLoading(false);
        return;
      }
      setAuth(data.user);
      router.push('/dashboard');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Login failed. Check your details.');
      setLoading(false);
    }
  }

  return (
    <div className="min-h-screen flex items-center justify-center px-4">
      <div className="w-full max-w-[400px]">
        <Link href="/" className="flex items-center justify-center gap-2 font-display font-bold text-[18px] text-[#0B4D2E] mb-6">
          <GraduationCap className="w-6 h-6" /> AIPSA Home Schooling
        </Link>
        <div className="bg-white border border-[#E5E7EB] rounded-2xl p-7">
          <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">Welcome back</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">Log in to your family account.</p>

          {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-[13px] px-4 py-2.5 rounded-lg mt-4">{error}</div>}

          <form onSubmit={handleSubmit} className="space-y-4 mt-5">
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Email</label>
              <input type="email" required value={form.email} onChange={(e) => setForm({ ...form, email: e.target.value })} className="w-full" />
            </div>
            <div>
              <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Password</label>
              <input type="password" required value={form.password} onChange={(e) => setForm({ ...form, password: e.target.value })} className="w-full" />
            </div>
            <button type="submit" disabled={loading} className="w-full bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white font-medium h-[42px] rounded-lg transition-colors disabled:opacity-50">
              {loading ? 'Logging in…' : 'Log in'}
            </button>
          </form>
        </div>
        <p className="text-center text-[14px] text-[#6B7280] mt-5">
          New here? <Link href="/signup" className="text-[#1D7A4A] font-medium hover:underline">Create a family account</Link>
        </p>
        <Link href="/" className="flex items-center justify-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#0B4D2E] mt-4">
          <ArrowLeft className="w-4 h-4" /> Back to home
        </Link>
      </div>
    </div>
  );
}
