'use client';

import { useEffect, useState, useCallback, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { Search, Building2, MapPin, Users, Calendar, CheckCircle2, Clock, Ban, ChevronRight, Plus, X } from 'lucide-react';

interface School {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  profile: { schoolName: string; city: string; state: string; phone: string; email: string } | null;
  _count: { users: number };
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-[#D6F0E4] text-[#0F6E56]',
  PENDING: 'bg-[#FAEEDA] text-[#854F0B]',
  SUSPENDED: 'bg-[#FCEBEB] text-[#A32D2D]',
};

const TABS = [
  { value: '', label: 'All Schools', icon: Building2 },
  { value: 'PENDING', label: 'Pending', icon: Clock },
  { value: 'ACTIVE', label: 'Active', icon: CheckCircle2 },
  { value: 'SUSPENDED', label: 'Suspended', icon: Ban },
];

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function SchoolsContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const initialStatus = searchParams.get('status') || '';

  const [schools, setSchools] = useState<School[]>([]);
  const [total, setTotal] = useState(0);
  const [statusFilter, setStatusFilter] = useState(initialStatus);
  const [search, setSearch] = useState('');
  const [loading, setLoading] = useState(true);
  const [actionId, setActionId] = useState<string | null>(null);
  const [confirmSuspend, setConfirmSuspend] = useState<string | null>(null);
  const [showCreate, setShowCreate] = useState(false);

  const fetchSchools = useCallback(async (status: string) => {
    setLoading(true);
    try {
      const { data } = await api.get('/superadmin/schools', { params: { status, limit: 100 } });
      setSchools(data.tenants);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchSchools(statusFilter);
  }, [statusFilter, fetchSchools]);

  async function handleApprove(id: string) {
    setActionId(id);
    try {
      await api.patch(`/superadmin/schools/${id}/approve`);
      fetchSchools(statusFilter);
    } finally { setActionId(null); }
  }

  async function handleSuspend(id: string) {
    setActionId(id);
    setConfirmSuspend(null);
    try {
      await api.patch(`/superadmin/schools/${id}/suspend`);
      fetchSchools(statusFilter);
    } finally { setActionId(null); }
  }

  const filtered = search.trim()
    ? schools.filter((s) => {
        const name = (s.profile?.schoolName || s.name).toLowerCase();
        const city = (s.profile?.city || '').toLowerCase();
        const state = (s.profile?.state || '').toLowerCase();
        const q = search.toLowerCase();
        return name.includes(q) || city.includes(q) || state.includes(q);
      })
    : schools;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">School Management</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            {total} {total === 1 ? 'school' : 'schools'} registered on the platform.
          </p>
        </div>
        <button
          onClick={() => setShowCreate(true)}
          className="inline-flex items-center justify-center gap-2 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[44px] px-5 rounded-lg font-semibold text-[14px] transition-colors shrink-0"
        >
          <Plus className="w-4 h-4" strokeWidth={2} />
          Add School
        </button>
      </div>

      {showCreate && (
        <CreateSchoolModal
          onClose={() => setShowCreate(false)}
          onCreated={() => { setShowCreate(false); fetchSchools(statusFilter); }}
        />
      )}

      {/* Search + Filter Row */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center">
        {/* Search */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF]" strokeWidth={1.75} />
          <input
            type="text"
            placeholder="Search schools, city, state…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 h-[38px] rounded-lg border border-[#E5E7EB] bg-white text-[14px] text-[#1A1D23] placeholder:text-[#9CA3AF] focus:outline-none focus:ring-2 focus:ring-[#26A96B]/30 focus:border-[#26A96B] transition-colors"
          />
        </div>

        {/* Status Tabs */}
        <div className="flex items-center gap-1 border-b border-[#E5E7EB] w-full sm:w-auto">
          {TABS.map((tab) => {
            const isActive = statusFilter === tab.value;
            return (
              <button
                key={tab.value}
                onClick={() => setStatusFilter(tab.value)}
                className={`inline-flex items-center gap-1.5 px-3 py-2.5 text-[13px] font-semibold border-b-2 transition-all whitespace-nowrap ${
                  isActive
                    ? 'border-[#26A96B] text-[#1D7A4A]'
                    : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
                }`}
              >
                {tab.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        {loading ? (
          <div className="divide-y divide-[#F3F4F6]">
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                <div className="flex-1 space-y-2">
                  <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                  <div className="h-3 bg-gray-100 rounded w-1/4" />
                </div>
                <div className="h-6 bg-gray-100 rounded w-16" />
              </div>
            ))}
          </div>
        ) : filtered.length === 0 ? (
          <div className="py-20 text-center">
            <Building2 className="w-10 h-10 text-[#D1D5DB] mx-auto mb-3" strokeWidth={1.75} />
            <h3 className="font-display text-[16px] font-semibold text-[#374151]">No schools found</h3>
            <p className="font-body text-[14px] text-[#6B7280] mt-1">
              {search ? 'Try adjusting your search.' : 'No schools match this filter.'}
            </p>
          </div>
        ) : (
          <>
            {/* Table Header */}
            <div className="hidden sm:flex bg-[#F7F8FA] border-b border-[#E5E7EB] px-5 py-3 gap-4 items-center">
              <span className="flex-1 text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">School</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] text-center w-24">Status</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] text-center w-16">Users</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] w-28">Registered</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] text-right w-32">Actions</span>
            </div>

            <div className="divide-y divide-[#F3F4F6]">
              {filtered.map((school) => {
                const displayName = school.profile?.schoolName || school.name;
                return (
                  <div
                    key={school.id}
                    className="px-4 sm:px-5 py-4 flex flex-col gap-3 sm:flex-row sm:gap-4 sm:items-center hover:bg-[#F9FAFB] transition-colors group"
                  >
                    {/* School Info */}
                    <div className="flex items-center gap-3 min-w-0 sm:flex-1">
                      <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center font-display font-bold text-sm shrink-0">
                        {initials(displayName)}
                      </div>
                      <div className="min-w-0">
                        <Link
                          href={`/aipsa/schools/${school.id}`}
                          className="font-display text-[14px] font-semibold text-[#1A1D23] group-hover:text-[#1D7A4A] transition-colors truncate block"
                        >
                          {displayName}
                        </Link>
                        {(school.profile?.city || school.profile?.state) && (
                          <span className="flex items-center gap-1 text-[12px] text-[#6B7280] mt-0.5">
                            <MapPin className="w-3 h-3 shrink-0" strokeWidth={1.75} />
                            {[school.profile?.city, school.profile?.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Meta: stacks under name on mobile (flex-wrap), becomes table cells on desktop */}
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-2 sm:contents">
                    {/* Status */}
                    <div className="sm:w-24 sm:text-center">
                      <span className={`inline-flex text-[11px] font-semibold px-2.5 py-0.5 rounded ${STATUS_STYLE[school.status]}`}>
                        {school.status}
                      </span>
                    </div>

                    {/* Users */}
                    <div className="sm:w-16 sm:text-center">
                      <span className="inline-flex items-center gap-1 text-[13px] text-[#6B7280]">
                        <Users className="w-3.5 h-3.5" strokeWidth={1.75} />
                        {school._count.users}
                      </span>
                    </div>

                    {/* Date */}
                    <div className="sm:w-28">
                      <span className="text-[12px] text-[#6B7280]">
                        {new Date(school.createdAt).toLocaleDateString('en-IN', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Actions */}
                    <div className="w-full sm:w-32 flex items-center justify-end gap-2">
                      {school.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(school.id)}
                          disabled={actionId === school.id}
                          className="inline-flex items-center h-[30px] px-3 bg-[#D6F0E4] hover:bg-[#26A96B]/25 text-[#0F6E56] rounded-md font-semibold text-[12px] transition-colors disabled:opacity-50"
                        >
                          {actionId === school.id ? '…' : 'Approve'}
                        </button>
                      )}
                      {school.status === 'ACTIVE' && (
                        <>
                          {confirmSuspend === school.id ? (
                            <>
                              <button
                                onClick={() => handleSuspend(school.id)}
                                disabled={actionId === school.id}
                                className="inline-flex items-center h-[30px] px-2.5 bg-[#FCEBEB] hover:bg-[#DC2626]/20 text-[#A32D2D] rounded-md font-semibold text-[12px] transition-colors disabled:opacity-50"
                              >
                                Confirm
                              </button>
                              <button
                                onClick={() => setConfirmSuspend(null)}
                                className="inline-flex items-center h-[30px] px-2.5 bg-white border border-[#E5E7EB] text-[#6B7280] rounded-md font-semibold text-[12px] hover:bg-[#F7F8FA] transition-colors"
                              >
                                Cancel
                              </button>
                            </>
                          ) : (
                            <button
                              onClick={() => setConfirmSuspend(school.id)}
                              className="inline-flex items-center h-[30px] px-3 bg-white border border-[#E5E7EB] hover:bg-[#FCEBEB] hover:border-[#FCEBEB] text-[#6B7280] hover:text-[#A32D2D] rounded-md font-semibold text-[12px] transition-colors"
                            >
                              Suspend
                            </button>
                          )}
                        </>
                      )}
                      <Link
                        href={`/aipsa/schools/${school.id}`}
                        className="inline-flex items-center justify-center w-[30px] h-[30px] rounded-md bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[#6B7280] transition-colors"
                      >
                        <ChevronRight className="w-4 h-4" strokeWidth={1.75} />
                      </Link>
                    </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>

      {/* Results count */}
      {!loading && filtered.length > 0 && (
        <p className="font-body text-[13px] text-[#6B7280] text-center">
          Showing {filtered.length} of {total} schools
        </p>
      )}
    </div>
  );
}

function CreateSchoolModal({ onClose, onCreated }: { onClose: () => void; onCreated: () => void }) {
  const [form, setForm] = useState({
    schoolName: '', city: '', state: '', phone: '',
    adminFirstName: '', adminLastName: '', adminEmail: '', adminPassword: '',
  });
  const [error, setError] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSaving(true);
    try {
      await api.post('/superadmin/schools', form);
      onCreated();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Could not create school.');
    } finally {
      setSaving(false);
    }
  }

  const update = (k: keyof typeof form) => (e: React.ChangeEvent<HTMLInputElement>) =>
    setForm({ ...form, [k]: e.target.value });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/40" onClick={onClose}>
      <div
        className="modal-content bg-white rounded-xl w-full max-w-lg max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB] sticky top-0 bg-white">
          <h2 className="font-display text-[18px] font-semibold text-[#1A1D23]">Add New School</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg text-[#6B7280] hover:bg-[#F3F4F6]" aria-label="Close">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          {error && (
            <div className="bg-[#FCEBEB] border border-[#FCEBEB] text-[#A32D2D] text-[13px] rounded-lg px-4 py-3">{error}</div>
          )}
          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF]">School Information</p>
          <div>
            <label className="block mb-1">School Name *</label>
            <input type="text" required value={form.schoolName} onChange={update('schoolName')} placeholder="St. Mary's High School" />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">City</label>
              <input type="text" value={form.city} onChange={update('city')} placeholder="Mumbai" />
            </div>
            <div>
              <label className="block mb-1">State</label>
              <input type="text" value={form.state} onChange={update('state')} placeholder="Maharashtra" />
            </div>
          </div>
          <div>
            <label className="block mb-1">Phone</label>
            <input type="tel" value={form.phone} onChange={update('phone')} placeholder="+91 98765 43210" />
          </div>

          <p className="text-[11px] font-semibold uppercase tracking-wider text-[#9CA3AF] pt-1">Admin Account</p>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block mb-1">First Name *</label>
              <input type="text" required value={form.adminFirstName} onChange={update('adminFirstName')} />
            </div>
            <div>
              <label className="block mb-1">Last Name *</label>
              <input type="text" required value={form.adminLastName} onChange={update('adminLastName')} />
            </div>
          </div>
          <div>
            <label className="block mb-1">Admin Email *</label>
            <input type="email" required value={form.adminEmail} onChange={update('adminEmail')} placeholder="principal@school.com" />
          </div>
          <div>
            <label className="block mb-1">Password *</label>
            <input type="password" required value={form.adminPassword} onChange={update('adminPassword')} placeholder="Min. 8 characters" />
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button type="button" onClick={onClose} className="h-[44px] px-4 rounded-lg border border-[#E5E7EB] text-[#374151] font-semibold text-[14px] hover:bg-[#F7F8FA]">
              Cancel
            </button>
            <button type="submit" disabled={saving} className="h-[44px] px-5 rounded-lg bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white font-semibold text-[14px] disabled:opacity-60">
              {saving ? 'Creating…' : 'Create School'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

export default function SchoolsPage() {
  return (
    <Suspense fallback={<div className="py-20 text-center text-[#6B7280]">Loading…</div>}>
      <SchoolsContent />
    </Suspense>
  );
}
