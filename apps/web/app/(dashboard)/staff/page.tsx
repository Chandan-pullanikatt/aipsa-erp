'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getUser } from '@/lib/auth';
import { CalendarPlus, CalendarCheck, X } from 'lucide-react';

type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface LeaveRecord {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewNote: string | null;
  createdAt: string;
}

const STATUS_STYLES: Record<LeaveStatus, string> = {
  PENDING: 'bg-[#FAEEDA] text-[#854F0B]',
  APPROVED: 'bg-[#D6F0E4] text-[#0F6E56]',
  REJECTED: 'bg-[#FCEBEB] text-[#A32D2D]',
};

export default function StaffDashboardPage() {
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ fromDate: '', toDate: '', reason: '' });
  const [submitting, setSubmitting] = useState(false);

  const user = typeof window !== 'undefined' ? getUser() : null;

  const fetchLeaves = useCallback(async () => {
    try {
      const { data } = await api.get('/attendance/leave', { params: { limit: 100 } });
      setLeaves(data.leaves || []);
    } catch {
      setError('Failed to load your leave requests.');
    }
  }, []);

  useEffect(() => {
    setLoading(true);
    fetchLeaves().finally(() => setLoading(false));
  }, [fetchLeaves]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (form.toDate < form.fromDate) {
      setError('The end date cannot be before the start date.');
      return;
    }
    setSubmitting(true);
    setError('');
    try {
      await api.post('/attendance/leave', form);
      setSuccess('Leave request submitted for approval.');
      setForm({ fromDate: '', toDate: '', reason: '' });
      setShowForm(false);
      fetchLeaves();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to submit leave request.');
    } finally {
      setSubmitting(false);
    }
  }

  const pendingCount = leaves.filter((l) => l.status === 'PENDING').length;

  if (loading) {
    return (
      <div className="py-40 text-center text-sm text-[#6B7280]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#26A96B] mx-auto mb-4"></div>
        Loading your workspace...
      </div>
    );
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">
            Welcome{user ? `, ${user.firstName}` : ''}
          </h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Apply for leave and track the status of your requests.
          </p>
        </div>
        <button
          onClick={() => { setForm({ fromDate: '', toDate: '', reason: '' }); setShowForm(true); }}
          className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] shrink-0 self-start sm:self-center"
        >
          <CalendarPlus className="mr-2 w-4 h-4" strokeWidth={1.75} /> Apply for Leave
        </button>
      </div>

      {error && (
        <div className="bg-[#FCEBEB] text-[#A32D2D] text-[14px] px-4 py-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-[#D6F0E4] text-[#0F6E56] text-[14px] px-4 py-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      <div className="grid grid-cols-2 gap-4 max-w-md">
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <p className="font-body text-[12px] font-medium uppercase tracking-wide text-[#6B7280]">Total Requests</p>
          <p className="font-display text-[28px] font-bold text-[#1A1D23] mt-1">{leaves.length}</p>
        </div>
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5">
          <p className="font-body text-[12px] font-medium uppercase tracking-wide text-[#6B7280]">Pending</p>
          <p className="font-display text-[28px] font-bold text-[#854F0B] mt-1">{pendingCount}</p>
        </div>
      </div>

      <div>
        <h2 className="font-display text-[16px] font-semibold text-[#1A1D23] mb-3">My Leave Requests</h2>
        {leaves.length === 0 ? (
          <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
            <CalendarCheck className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
            <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No leave requests yet</h3>
            <p className="font-body text-[14px] text-[#6B7280] mt-1">Use “Apply for Leave” to submit your first request.</p>
          </div>
        ) : (
          <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-x-auto">
            <table className="w-full min-w-[720px] text-[13px]">
              <thead className="bg-[#F7F8FA] text-[#6B7280] text-left">
                <tr>
                  <th className="px-4 py-3 font-medium">Dates</th>
                  <th className="px-4 py-3 font-medium">Reason</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                  <th className="px-4 py-3 font-medium">Note</th>
                </tr>
              </thead>
              <tbody>
                {leaves.map((l) => (
                  <tr key={l.id} className="border-t border-[#E5E7EB]">
                    <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                      {new Date(l.fromDate).toLocaleDateString('en-IN')} – {new Date(l.toDate).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3 text-[#374151] max-w-xs truncate" title={l.reason}>{l.reason}</td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_STYLES[l.status]}`}>{l.status}</span>
                    </td>
                    <td className="px-4 py-3 text-[#6B7280]">{l.reviewNote || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[480px] max-w-[92vw] p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[20px] font-semibold text-[#1A1D23]">Apply for Leave</h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" strokeWidth={1.75} /></button>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4 mt-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">From</label>
                  <input type="date" required value={form.fromDate} onChange={(e) => setForm({ ...form, fromDate: e.target.value })} className="w-full" />
                </div>
                <div>
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">To</label>
                  <input type="date" required value={form.toDate} min={form.fromDate} onChange={(e) => setForm({ ...form, toDate: e.target.value })} className="w-full" />
                </div>
              </div>
              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Reason</label>
                <textarea required rows={3} value={form.reason} onChange={(e) => setForm({ ...form, reason: e.target.value })} className="w-full" placeholder="Brief reason for the leave" />
              </div>
              <div className="flex justify-end gap-3 pt-4 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setShowForm(false)} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium text-[14px]">Cancel</button>
                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium text-[14px] disabled:opacity-50">
                  {submitting ? 'Submitting...' : 'Submit Request'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
