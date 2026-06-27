'use client';

// Account & Privacy settings. Reachable at /settings/account for any logged-in
// dashboard user. Hosts the self-service account-deletion flow required by Google
// Play, backed by POST /auth/account/delete.
import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import api from '@/lib/api';
import { getUser, clearAuth } from '@/lib/auth';
import { Bell, ShieldAlert, Loader2 } from 'lucide-react';

export default function AccountSettingsPage() {
  const router = useRouter();
  const user = getUser();
  const [confirm, setConfirm] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [done, setDone] = useState(false);

  const canDelete = confirm.trim() === 'DELETE' && !busy;

  async function handleDelete() {
    if (!canDelete) return;
    setBusy(true);
    setError(null);
    try {
      await api.post('/auth/account/delete', { confirm: 'DELETE' });
      setDone(true);
      // Account is deactivated server-side; clear the local session and send the
      // user to login after a short confirmation.
      setTimeout(() => { clearAuth(); router.push('/login'); }, 2500);
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not process your request. Please try again.');
      setBusy(false);
    }
  }

  if (done) {
    return (
      <div className="max-w-2xl mx-auto">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-8 text-center">
          <h1 className="font-display text-[20px] font-bold text-[#1A1D23]">Account deletion requested</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-2">
            Your account has been deactivated. Your personal data will be removed within 30 days.
            Signing you out…
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="pb-4 border-b border-[#E5E7EB]">
        <h1 className="font-display text-[24px] font-bold text-[#1A1D23]">Account &amp; Privacy</h1>
        <p className="font-body text-[14px] text-[#6B7280] mt-1">Manage your account and privacy settings.</p>
      </div>

      {user && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] px-5 py-4">
          <p className="font-display text-[14px] font-semibold text-[#1A1D23]">{user.firstName} {user.lastName}</p>
          <p className="font-body text-[13px] text-[#6B7280] mt-0.5">{user.email}</p>
        </div>
      )}

      <Link
        href="/settings/notifications"
        className="flex items-center gap-4 bg-white rounded-xl border border-[#E5E7EB] px-5 py-4 hover:bg-gray-50 transition-colors"
      >
        <div className="w-9 h-9 rounded-lg bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center shrink-0">
          <Bell className="w-4.5 h-4.5" strokeWidth={1.75} />
        </div>
        <div className="flex-1 min-w-0">
          <p className="font-display text-[14px] font-semibold text-[#1A1D23]">Notification preferences</p>
          <p className="font-body text-[12px] text-[#6B7280]">Choose how you want to be notified.</p>
        </div>
        <span className="text-[#9CA3AF]">→</span>
      </Link>

      {/* Danger zone */}
      <div className="bg-white rounded-xl border border-[#FECACA] overflow-hidden">
        <div className="flex items-center gap-2 px-5 py-3 bg-[#FEF2F2] border-b border-[#FECACA]">
          <ShieldAlert className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
          <p className="font-display text-[14px] font-semibold text-[#B91C1C]">Delete account</p>
        </div>
        <div className="px-5 py-4 space-y-4">
          <p className="font-body text-[13px] text-[#6B7280]">
            This deactivates your account immediately and permanently removes your personal data within 30 days.
            Records your school must retain by law (such as fee receipts and results) are kept in anonymised form.
            This cannot be undone. Learn more on the{' '}
            <Link href="/account-deletion" className="text-[#1D7A4A] hover:underline">account deletion</Link> page.
          </p>

          <div>
            <label htmlFor="confirm-delete" className="block font-body text-[13px] text-[#374151] mb-1.5">
              Type <span className="font-semibold">DELETE</span> to confirm
            </label>
            <input
              id="confirm-delete"
              type="text"
              autoComplete="off"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="w-full rounded-lg border border-[#D1D5DB] px-3 py-2 text-[14px] focus:outline-none focus:ring-2 focus:ring-[#FCA5A5] focus:border-[#F87171]"
              placeholder="DELETE"
            />
          </div>

          {error && <p className="font-body text-[13px] text-[#DC2626]">{error}</p>}

          <button
            onClick={handleDelete}
            disabled={!canDelete}
            className="inline-flex items-center gap-2 rounded-lg bg-[#DC2626] px-4 py-2 text-[14px] font-semibold text-white transition-colors hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {busy && <Loader2 className="w-4 h-4 animate-spin" />}
            {busy ? 'Processing…' : 'Delete my account'}
          </button>
        </div>
      </div>
    </div>
  );
}
