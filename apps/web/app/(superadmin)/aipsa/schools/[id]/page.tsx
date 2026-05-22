'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ArrowLeft,
  Building2,
  MapPin,
  Phone,
  Mail,
  Globe,
  BookOpen,
  Calendar,
  Users,
  CheckCircle2,
  Clock,
  Ban,
  Hash,
  GraduationCap,
  UserCog,
  User,
} from 'lucide-react';

interface SchoolProfile {
  schoolName: string;
  address: string | null;
  city: string | null;
  state: string | null;
  country: string;
  phone: string | null;
  email: string | null;
  website: string | null;
  logo: string | null;
  board: string | null;
  establishedYear: number | null;
}

interface SchoolUser {
  id: string;
  email: string;
  role: string;
  firstName: string;
  lastName: string;
  isActive: boolean;
  createdAt: string;
}

interface SchoolDetail {
  id: string;
  name: string;
  slug: string;
  status: 'PENDING' | 'ACTIVE' | 'SUSPENDED';
  createdAt: string;
  profile: SchoolProfile | null;
  users: SchoolUser[];
}

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-[#D6F0E4] text-[#0F6E56]',
  PENDING: 'bg-[#FAEEDA] text-[#854F0B]',
  SUSPENDED: 'bg-[#FCEBEB] text-[#A32D2D]',
};

const ROLE_STYLE: Record<string, string> = {
  SCHOOL_ADMIN: 'bg-[#EEF2FF] text-[#4338CA]',
  TEACHER: 'bg-[#D6F0E4] text-[#0F6E56]',
  STUDENT: 'bg-[#F3F4F6] text-[#374151]',
  PARENT: 'bg-[#FFF7ED] text-[#854F0B]',
};

const ROLE_ICON: Record<string, any> = {
  SCHOOL_ADMIN: UserCog,
  TEACHER: BookOpen,
  STUDENT: GraduationCap,
  PARENT: User,
};

function initials(firstName: string, lastName: string) {
  return `${firstName[0] || ''}${lastName[0] || ''}`.toUpperCase();
}

function InfoRow({ icon: Icon, label, value }: { icon: any; label: string; value: string | null | undefined }) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3">
      <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] flex items-center justify-center shrink-0 mt-0.5">
        <Icon className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
      </div>
      <div className="min-w-0">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9CA3AF]">{label}</p>
        <p className="text-[14px] font-medium text-[#1A1D23] mt-0.5 break-words">{value}</p>
      </div>
    </div>
  );
}

export default function SchoolDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [school, setSchool] = useState<SchoolDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [confirmSuspend, setConfirmSuspend] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchSchool = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get(`/superadmin/schools/${id}`);
      setSchool(data);
    } catch {
      setError('Failed to load school details.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    fetchSchool();
  }, [fetchSchool]);

  async function handleApprove() {
    setActionLoading(true);
    try {
      await api.patch(`/superadmin/schools/${id}/approve`);
      fetchSchool();
    } finally { setActionLoading(false); }
  }

  async function handleSuspend() {
    setActionLoading(true);
    setConfirmSuspend(false);
    try {
      await api.patch(`/superadmin/schools/${id}/suspend`);
      fetchSchool();
    } finally { setActionLoading(false); }
  }

  if (loading) {
    return (
      <div className="space-y-6 animate-pulse">
        <div className="h-8 bg-gray-100 rounded w-48" />
        <div className="h-24 bg-gray-100 rounded-xl" />
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 h-64 bg-gray-100 rounded-xl" />
          <div className="h-64 bg-gray-100 rounded-xl" />
        </div>
      </div>
    );
  }

  if (error || !school) {
    return (
      <div className="py-20 text-center">
        <p className="text-[#6B7280]">{error || 'School not found.'}</p>
        <Link href="/aipsa/schools" className="mt-4 inline-flex items-center gap-1.5 text-[#1D7A4A] font-medium text-[14px]">
          <ArrowLeft className="w-4 h-4" strokeWidth={1.75} /> Back to Schools
        </Link>
      </div>
    );
  }

  const displayName = school.profile?.schoolName || school.name;
  const location = [school.profile?.city, school.profile?.state, school.profile?.country]
    .filter(Boolean).join(', ');

  const roleCounts = school.users.reduce<Record<string, number>>((acc, u) => {
    acc[u.role] = (acc[u.role] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="space-y-6">
      {/* Back */}
      <Link
        href="/aipsa/schools"
        className="inline-flex items-center gap-1.5 text-[13px] font-medium text-[#6B7280] hover:text-[#1A1D23] transition-colors"
      >
        <ArrowLeft className="w-4 h-4" strokeWidth={1.75} />
        Back to Schools
      </Link>

      {/* School Header Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
        <div className="flex flex-col sm:flex-row sm:items-start justify-between gap-4">
          <div className="flex items-center gap-4">
            <div className="w-14 h-14 rounded-2xl bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center font-display font-bold text-xl shrink-0">
              {displayName.slice(0, 2).toUpperCase()}
            </div>
            <div>
              <div className="flex items-center gap-3 flex-wrap">
                <h1 className="font-display text-[24px] font-bold text-[#1A1D23] leading-tight">{displayName}</h1>
                <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded ${STATUS_STYLE[school.status]}`}>
                  {school.status}
                </span>
              </div>
              {location && (
                <p className="flex items-center gap-1.5 text-[13px] text-[#6B7280] mt-1.5">
                  <MapPin className="w-3.5 h-3.5" strokeWidth={1.75} />
                  {location}
                </p>
              )}
              <p className="flex items-center gap-1.5 text-[12px] text-[#9CA3AF] mt-1">
                <Hash className="w-3 h-3" strokeWidth={1.75} />
                Slug: {school.slug}
              </p>
            </div>
          </div>

          {/* Actions */}
          <div className="flex items-center gap-2 shrink-0">
            {school.status === 'PENDING' && (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 h-[38px] px-4 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white rounded-lg font-semibold text-[13px] transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                {actionLoading ? 'Approving…' : 'Approve School'}
              </button>
            )}
            {school.status === 'ACTIVE' && (
              confirmSuspend ? (
                <>
                  <button
                    onClick={handleSuspend}
                    disabled={actionLoading}
                    className="inline-flex items-center gap-2 h-[38px] px-4 bg-[#FCEBEB] hover:bg-[#DC2626]/20 text-[#A32D2D] rounded-lg font-semibold text-[13px] transition-colors disabled:opacity-50"
                  >
                    <Ban className="w-4 h-4" strokeWidth={1.75} />
                    Confirm Suspend
                  </button>
                  <button
                    onClick={() => setConfirmSuspend(false)}
                    className="inline-flex items-center h-[38px] px-4 bg-white border border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F8FA] rounded-lg font-semibold text-[13px] transition-colors"
                  >
                    Cancel
                  </button>
                </>
              ) : (
                <button
                  onClick={() => setConfirmSuspend(true)}
                  className="inline-flex items-center gap-2 h-[38px] px-4 bg-white border border-[#E5E7EB] hover:bg-[#FCEBEB] hover:border-[#FCEBEB] hover:text-[#A32D2D] text-[#6B7280] rounded-lg font-semibold text-[13px] transition-colors"
                >
                  <Ban className="w-4 h-4" strokeWidth={1.75} />
                  Suspend School
                </button>
              )
            )}
            {school.status === 'SUSPENDED' && (
              <button
                onClick={handleApprove}
                disabled={actionLoading}
                className="inline-flex items-center gap-2 h-[38px] px-4 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white rounded-lg font-semibold text-[13px] transition-colors disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" strokeWidth={1.75} />
                {actionLoading ? 'Reactivating…' : 'Reactivate School'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Body: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Profile Info — 2/3 */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6">
            <h2 className="font-display text-[16px] font-semibold text-[#1A1D23] mb-5">School Profile</h2>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-5">
              <InfoRow icon={Building2} label="School Name" value={school.profile?.schoolName} />
              <InfoRow icon={MapPin} label="Address" value={school.profile?.address} />
              <InfoRow icon={MapPin} label="City" value={school.profile?.city} />
              <InfoRow icon={MapPin} label="State" value={school.profile?.state} />
              <InfoRow icon={BookOpen} label="Board / Affiliation" value={school.profile?.board} />
              <InfoRow icon={Calendar} label="Established Year" value={school.profile?.establishedYear?.toString()} />
              <InfoRow icon={Phone} label="Phone" value={school.profile?.phone} />
              <InfoRow icon={Mail} label="Email" value={school.profile?.email} />
              <InfoRow icon={Globe} label="Website" value={school.profile?.website} />
              <InfoRow icon={Calendar} label="Registered On" value={new Date(school.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' })} />
            </div>
          </div>
        </div>

        {/* Stats sidebar — 1/3 */}
        <div className="space-y-4">
          {/* User Summary */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-center gap-2 mb-4">
              <Users className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
              <h3 className="font-display text-[14px] font-semibold text-[#1A1D23]">User Breakdown</h3>
            </div>
            <div className="space-y-2.5">
              <div className="flex items-center justify-between">
                <span className="font-body text-[13px] text-[#6B7280]">Total Users</span>
                <span className="font-display text-[20px] font-bold text-[#1A1D23]">{school.users.length}</span>
              </div>
              <div className="border-t border-[#F3F4F6] pt-2.5 space-y-2">
                {Object.entries(roleCounts).map(([role, count]) => {
                  const style = ROLE_STYLE[role] || 'bg-[#F3F4F6] text-[#374151]';
                  return (
                    <div key={role} className="flex items-center justify-between">
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${style}`}>
                        {role.replace('_', ' ')}
                      </span>
                      <span className="font-display text-[13px] font-bold text-[#1A1D23]">{count}</span>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>

          {/* Platform Status */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <h3 className="font-display text-[14px] font-semibold text-[#1A1D23] mb-4">Platform Status</h3>
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="font-body text-[13px] text-[#6B7280]">Status</span>
                <span className={`text-[12px] font-semibold px-2.5 py-0.5 rounded ${STATUS_STYLE[school.status]}`}>
                  {school.status}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-[13px] text-[#6B7280]">Registered</span>
                <span className="font-body text-[13px] text-[#1A1D23]">
                  {new Date(school.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span className="font-body text-[13px] text-[#6B7280]">Tenant ID</span>
                <span className="font-mono text-[11px] text-[#9CA3AF] truncate max-w-[120px]">{school.id}</span>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
        <div className="px-5 py-4 border-b border-[#E5E7EB] flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
            <h2 className="font-display text-[15px] font-semibold text-[#1A1D23]">School Users</h2>
          </div>
          <span className="text-[12px] font-semibold bg-[#F3F4F6] text-[#6B7280] px-2.5 py-0.5 rounded">
            {school.users.length} total
          </span>
        </div>

        {school.users.length === 0 ? (
          <div className="py-16 text-center">
            <Users className="w-8 h-8 text-[#D1D5DB] mx-auto mb-3" strokeWidth={1.75} />
            <p className="font-body text-[14px] text-[#6B7280]">No users in this school yet.</p>
          </div>
        ) : (
          <>
            {/* Header */}
            <div className="bg-[#F7F8FA] border-b border-[#E5E7EB] px-5 py-2.5 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center">
              <div className="w-8" />
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280]">Name</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] w-28">Role</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] w-16 text-center">Status</span>
              <span className="text-[11px] font-semibold uppercase tracking-wide text-[#6B7280] w-28">Joined</span>
            </div>

            <div className="divide-y divide-[#F3F4F6]">
              {school.users.map((u) => {
                const RoleIcon = ROLE_ICON[u.role] || User;
                return (
                  <div
                    key={u.id}
                    className="px-5 py-3.5 grid grid-cols-[auto_1fr_auto_auto_auto] gap-4 items-center hover:bg-[#F9FAFB] transition-colors"
                  >
                    {/* Avatar */}
                    <div className="w-8 h-8 rounded-lg bg-[#F3F4F6] text-[#6B7280] flex items-center justify-center font-display font-bold text-xs">
                      {initials(u.firstName, u.lastName)}
                    </div>

                    {/* Name + Email */}
                    <div className="min-w-0">
                      <p className="font-display text-[14px] font-semibold text-[#1A1D23] truncate">
                        {u.firstName} {u.lastName}
                      </p>
                      <p className="text-[12px] text-[#6B7280] truncate">{u.email}</p>
                    </div>

                    {/* Role */}
                    <div className="w-28">
                      <span className={`inline-flex items-center gap-1 text-[11px] font-semibold px-2 py-0.5 rounded ${ROLE_STYLE[u.role] || 'bg-[#F3F4F6] text-[#374151]'}`}>
                        <RoleIcon className="w-3 h-3" strokeWidth={1.75} />
                        {u.role.replace('_', ' ')}
                      </span>
                    </div>

                    {/* Active */}
                    <div className="w-16 text-center">
                      {u.isActive ? (
                        <span className="text-[11px] font-semibold text-[#0F6E56]">Active</span>
                      ) : (
                        <span className="text-[11px] font-semibold text-[#A32D2D]">Disabled</span>
                      )}
                    </div>

                    {/* Joined */}
                    <div className="w-28">
                      <span className="text-[12px] text-[#6B7280]">
                        {new Date(u.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    </div>
                  </div>
                );
              })}
            </div>
          </>
        )}
      </div>
    </div>
  );
}
