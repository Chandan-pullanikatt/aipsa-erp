'use client';

import { useState, useEffect, useCallback } from 'react';
import api from '@/lib/api';
import { CheckCircle, XCircle, Clock, RefreshCw } from 'lucide-react';

type RequestStatus = 'PENDING' | 'APPROVED' | 'REJECTED';

interface JoinRequest {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  parentPhone: string;
  dateOfBirth: string | null;
  status: RequestStatus;
  createdAt: string;
  class: { id: string; name: string };
  reviewedBy: { firstName: string; lastName: string } | null;
}

const STATUS_STYLES: Record<RequestStatus, string> = {
  PENDING: 'bg-amber-100 text-amber-700',
  APPROVED: 'bg-green-100 text-green-700',
  REJECTED: 'bg-red-100 text-red-700',
};

export default function JoinRequestsPage() {
  const [requests, setRequests] = useState<JoinRequest[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState<RequestStatus>('PENDING');
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [approvalInfo, setApprovalInfo] = useState<{ admissionNumber: string; defaultPassword: string } | null>(null);

  const fetchRequests = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/sis/join-requests', { params: { status: statusFilter, limit: 50 } });
      setRequests(data.requests);
      setTotal(data.total);
    } catch { /* ignore */ } finally { setLoading(false); }
  }, [statusFilter]);

  useEffect(() => { fetchRequests(); }, [fetchRequests]);

  async function handleApprove(id: string) {
    setActionLoading(id);
    try {
      const { data } = await api.patch(`/sis/join-requests/${id}/approve`);
      setApprovalInfo({ admissionNumber: data.admissionNumber, defaultPassword: data.defaultPassword });
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to approve request.');
    } finally { setActionLoading(null); }
  }

  async function handleReject(id: string) {
    if (!confirm('Reject this registration request?')) return;
    setActionLoading(id);
    try {
      await api.patch(`/sis/join-requests/${id}/reject`);
      fetchRequests();
    } catch (err: any) {
      alert(err.response?.data?.error || 'Failed to reject request.');
    } finally { setActionLoading(null); }
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="font-display text-2xl font-bold text-[#1A1D23]">Student Join Requests</h1>
          <p className="text-sm text-gray-500 mt-0.5">Review and approve students who registered using a class code.</p>
        </div>
        <button
          onClick={fetchRequests}
          className="flex items-center gap-2 text-sm text-gray-500 hover:text-gray-700 border border-gray-200 rounded-lg px-3 py-2"
        >
          <RefreshCw className="w-3.5 h-3.5" />
          Refresh
        </button>
      </div>

      {/* Approval info banner */}
      {approvalInfo && (
        <div className="bg-green-50 border border-green-200 rounded-xl p-4">
          <p className="text-sm font-semibold text-green-800 mb-2">✅ Student approved successfully!</p>
          <div className="space-y-1 font-mono text-xs bg-white border border-green-100 rounded-lg p-3">
            <p><span className="text-gray-500">Admission No:</span> <strong>{approvalInfo.admissionNumber}</strong></p>
            <p><span className="text-gray-500">Temp Password:</span> <strong>{approvalInfo.defaultPassword}</strong></p>
          </div>
          <p className="text-xs text-green-600 mt-2">Share these login details with the student. They will be asked to change their password on first login.</p>
          <button onClick={() => setApprovalInfo(null)} className="text-xs text-green-700 underline mt-1">Dismiss</button>
        </div>
      )}

      {/* Status filter tabs */}
      <div className="flex gap-2">
        {(['PENDING', 'APPROVED', 'REJECTED'] as RequestStatus[]).map(s => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            className={`px-4 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              statusFilter === s ? 'bg-[#0B4D2E] text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            {s.charAt(0) + s.slice(1).toLowerCase()}
          </button>
        ))}
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center py-16 text-gray-400 text-sm">Loading...</div>
        ) : requests.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <Clock className="w-8 h-8 mb-2 opacity-40" />
            <p className="text-sm">No {statusFilter.toLowerCase()} requests</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Class</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Email</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Parent Phone</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Submitted</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Status</th>
                  {statusFilter === 'PENDING' && (
                    <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide">Actions</th>
                  )}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {requests.map(req => (
                  <tr key={req.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 font-medium text-gray-900">
                      {req.firstName} {req.lastName}
                      {req.dateOfBirth && (
                        <span className="block text-xs text-gray-400 font-normal">
                          DOB: {new Date(req.dateOfBirth).toLocaleDateString('en-IN')}
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{req.class.name}</td>
                    <td className="px-4 py-3 text-gray-600">{req.email}</td>
                    <td className="px-4 py-3 text-gray-600">{req.parentPhone}</td>
                    <td className="px-4 py-3 text-gray-400 text-xs">
                      {new Date(req.createdAt).toLocaleDateString('en-IN')}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${STATUS_STYLES[req.status]}`}>
                        {req.status.charAt(0) + req.status.slice(1).toLowerCase()}
                      </span>
                      {req.reviewedBy && (
                        <span className="block text-xs text-gray-400 mt-0.5">
                          by {req.reviewedBy.firstName}
                        </span>
                      )}
                    </td>
                    {statusFilter === 'PENDING' && (
                      <td className="px-4 py-3 text-right">
                        <div className="flex items-center justify-end gap-2">
                          <button
                            onClick={() => handleApprove(req.id)}
                            disabled={actionLoading === req.id}
                            className="flex items-center gap-1 bg-green-600 hover:bg-green-700 text-white text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <CheckCircle className="w-3.5 h-3.5" />
                            {actionLoading === req.id ? 'Approving...' : 'Approve'}
                          </button>
                          <button
                            onClick={() => handleReject(req.id)}
                            disabled={actionLoading === req.id}
                            className="flex items-center gap-1 bg-red-50 hover:bg-red-100 text-red-600 text-xs font-medium px-3 py-1.5 rounded-lg disabled:opacity-50 transition-colors"
                          >
                            <XCircle className="w-3.5 h-3.5" />
                            Reject
                          </button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {total > 0 && (
          <div className="px-4 py-3 border-t border-gray-100 text-xs text-gray-400">
            {total} total {statusFilter.toLowerCase()} request{total !== 1 ? 's' : ''}
          </div>
        )}
      </div>
    </div>
  );
}
