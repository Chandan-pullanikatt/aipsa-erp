'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import api from '@/lib/api';
import { ShieldCheck, Mail, KeyRound, Eye, EyeOff } from 'lucide-react';

export default function SuperAdminProfilePage() {
  const [user, setUser] = useState<AuthUser | null>(null);

  const [form, setForm] = useState({ currentPassword: '', newPassword: '', confirm: '' });
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    setUser(getUser());
  }, []);

  function setF(key: keyof typeof form, val: string) {
    setForm((f) => ({ ...f, [key]: val }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');

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
      setSuccess('Password updated successfully.');
      setForm({ currentPassword: '', newPassword: '', confirm: '' });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change password. Please try again.');
    } finally {
      setLoading(false);
    }
  }

  if (!user) return null;

  return (
    <div className="max-w-2xl space-y-8">
      {/* Header */}
      <div className="pb-6 border-b border-[#E5E7EB]">
        <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">My Profile</h1>
        <p className="font-body text-[14px] text-[#6B7280] mt-1">Manage your platform admin account.</p>
      </div>

      {/* Identity card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-4">
          <div className="w-16 h-16 rounded-full bg-[#0B4D2E] text-white flex items-center justify-center font-display font-bold text-xl shrink-0">
            {(user.firstName?.[0] || '') + (user.lastName?.[0] || '')}
          </div>
          <div className="min-w-0">
            <p className="font-display text-[18px] font-semibold text-[#1A1D23]">
              {user.firstName} {user.lastName}
            </p>
            <p className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mt-1">
              <Mail className="w-3.5 h-3.5" strokeWidth={1.75} /> {user.email}
            </p>
            <span className="inline-flex items-center gap-1 mt-2 text-[11px] font-semibold px-2.5 py-0.5 rounded bg-[#D6F0E4] text-[#0F6E56]">
              <ShieldCheck className="w-3 h-3" strokeWidth={2} /> Super Admin
            </span>
          </div>
        </div>
      </div>

      {/* Change password */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex items-center gap-2 mb-5">
          <KeyRound className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
          <h2 className="font-display text-[16px] font-semibold text-[#1A1D23]">Change Password</h2>
        </div>

        {error && (
          <div className="bg-[#FCEBEB] border border-[#FCEBEB] text-[#A32D2D] text-[13px] rounded-lg px-4 py-3 mb-5">{error}</div>
        )}
        {success && (
          <div className="bg-[#D6F0E4] border border-[#D6F0E4] text-[#0F6E56] text-[13px] rounded-lg px-4 py-3 mb-5">{success}</div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block mb-1">Current Password</label>
            <div className="relative">
              <input
                required
                type={showCurrent ? 'text' : 'password'}
                value={form.currentPassword}
                onChange={(e) => setF('currentPassword', e.target.value)}
                className="pr-10"
              />
              <button type="button" onClick={() => setShowCurrent((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                {showCurrent ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-1">New Password</label>
            <div className="relative">
              <input
                required
                type={showNew ? 'text' : 'password'}
                value={form.newPassword}
                onChange={(e) => setF('newPassword', e.target.value)}
                placeholder="At least 8 characters"
                className="pr-10"
              />
              <button type="button" onClick={() => setShowNew((v) => !v)} className="absolute right-3 top-1/2 -translate-y-1/2 text-[#9CA3AF]">
                {showNew ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>
          <div>
            <label className="block mb-1">Confirm New Password</label>
            <input
              required
              type="password"
              value={form.confirm}
              onChange={(e) => setF('confirm', e.target.value)}
            />
          </div>
          <div className="pt-1">
            <button
              type="submit"
              disabled={loading}
              className="h-[44px] px-5 rounded-lg bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white font-semibold text-[14px] disabled:opacity-60"
            >
              {loading ? 'Saving…' : 'Update Password'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
