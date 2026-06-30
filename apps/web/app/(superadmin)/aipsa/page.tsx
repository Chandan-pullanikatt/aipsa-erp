'use client';

import { useEffect, useState, useCallback } from 'react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import Link from 'next/link';
import {
  Building2,
  CheckCircle2,
  Clock,
  Ban,
  Users,
  TrendingUp,
  ArrowRight,
  MapPin,
  Calendar,
} from 'lucide-react';

interface Stats {
  totalSchools: number;
  activeSchools: number;
  pendingSchools: number;
  suspendedSchools: number;
  totalUsers: number;
}

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

function initials(name: string) {
  return name.split(' ').slice(0, 2).map((w) => w[0]).join('').toUpperCase();
}

function timeAgo(dateStr: string) {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return 'Today';
  if (days === 1) return 'Yesterday';
  if (days < 30) return `${days}d ago`;
  const months = Math.floor(days / 30);
  return `${months}mo ago`;
}

export default function AipsaDashboard() {
  const [adminName, setAdminName] = useState('');
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentSchools, setRecentSchools] = useState<School[]>([]);
  const [loadingStats, setLoadingStats] = useState(true);
  const [loadingSchools, setLoadingSchools] = useState(true);
  const [approvingId, setApprovingId] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u) setAdminName(u.firstName);
  }, []);

  const fetchStats = useCallback(async () => {
    try {
      const { data } = await api.get('/superadmin/stats');
      setStats(data);
    } catch { /* ignore */ } finally {
      setLoadingStats(false);
    }
  }, []);

  const fetchRecent = useCallback(async () => {
    try {
      const { data } = await api.get('/superadmin/schools', { params: { limit: 6 } });
      setRecentSchools(data.tenants);
    } catch { /* ignore */ } finally {
      setLoadingSchools(false);
    }
  }, []);

  useEffect(() => {
    fetchStats();
    fetchRecent();
  }, [fetchStats, fetchRecent]);

  async function handleApprove(id: string) {
    setApprovingId(id);
    try {
      await api.patch(`/superadmin/schools/${id}/approve`);
      fetchStats();
      fetchRecent();
    } finally {
      setApprovingId(null);
    }
  }

  const statCards = stats
    ? [
        {
          label: 'Total Schools',
          value: stats.totalSchools,
          icon: Building2,
          iconBg: 'bg-[#EEF2FF]',
          iconColor: 'text-[#4338CA]',
          valueColor: 'text-[#1A1D23]',
        },
        {
          label: 'Active Schools',
          value: stats.activeSchools,
          icon: CheckCircle2,
          iconBg: 'bg-[#D6F0E4]',
          iconColor: 'text-[#0F6E56]',
          valueColor: 'text-[#0F6E56]',
        },
        {
          label: 'Pending Approval',
          value: stats.pendingSchools,
          icon: Clock,
          iconBg: 'bg-[#FAEEDA]',
          iconColor: 'text-[#854F0B]',
          valueColor: 'text-[#854F0B]',
        },
        {
          label: 'Suspended',
          value: stats.suspendedSchools,
          icon: Ban,
          iconBg: 'bg-[#FCEBEB]',
          iconColor: 'text-[#A32D2D]',
          valueColor: 'text-[#A32D2D]',
        },
        {
          label: 'Total Users',
          value: stats.totalUsers,
          icon: Users,
          iconBg: 'bg-[#F3F4F6]',
          iconColor: 'text-[#374151]',
          valueColor: 'text-[#1A1D23]',
        },
      ]
    : [];

  return (
    <div className="space-y-8">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">
            Platform Overview
          </h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Welcome back, {adminName}. Here's the current state of the EduBridge platform.
          </p>
        </div>
        <Link
          href="/aipsa/schools"
          className="inline-flex items-center gap-2 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[40px] px-5 rounded-lg font-semibold text-[14px] transition-colors shrink-0"
        >
          <Building2 className="w-4 h-4" strokeWidth={1.75} />
          Manage Schools
        </Link>
      </div>

      {/* Stats Grid */}
      {loadingStats ? (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="bg-white rounded-xl border border-[#E5E7EB] p-5 animate-pulse">
              <div className="w-9 h-9 rounded-lg bg-gray-100 mb-4" />
              <div className="h-8 bg-gray-100 rounded w-1/2 mb-2" />
              <div className="h-3 bg-gray-100 rounded w-3/4" />
            </div>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
          {statCards.map((card) => {
            const Icon = card.icon;
            return (
              <div key={card.label} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <div className={`w-9 h-9 rounded-lg ${card.iconBg} flex items-center justify-center ${card.iconColor} mb-4`}>
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <p className={`font-display text-[28px] font-bold leading-none ${card.valueColor}`}>
                  {card.value}
                </p>
                <p className="font-body text-[13px] text-[#6B7280] mt-1.5">{card.label}</p>
              </div>
            );
          })}
        </div>
      )}

      {/* Body: two columns */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Recent Registrations — 2/3 width */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
          <div className="flex items-center justify-between px-5 py-4 border-b border-[#E5E7EB]">
            <div className="flex items-center gap-2">
              <TrendingUp className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
              <span className="font-display text-[15px] font-semibold text-[#1A1D23]">Recent Registrations</span>
            </div>
            <Link
              href="/aipsa/schools"
              className="inline-flex items-center gap-1 text-[13px] font-medium text-[#1D7A4A] hover:text-[#0B4D2E] transition-colors"
            >
              View all <ArrowRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          {loadingSchools ? (
            <div className="divide-y divide-[#F3F4F6]">
              {Array.from({ length: 4 }).map((_, i) => (
                <div key={i} className="px-5 py-4 flex items-center gap-4 animate-pulse">
                  <div className="w-10 h-10 rounded-xl bg-gray-100 shrink-0" />
                  <div className="flex-1 space-y-2">
                    <div className="h-3.5 bg-gray-100 rounded w-1/3" />
                    <div className="h-3 bg-gray-100 rounded w-1/4" />
                  </div>
                </div>
              ))}
            </div>
          ) : recentSchools.length === 0 ? (
            <div className="py-16 text-center">
              <Building2 className="w-8 h-8 text-[#D1D5DB] mx-auto mb-3" strokeWidth={1.75} />
              <p className="font-body text-[14px] text-[#6B7280]">No schools registered yet.</p>
            </div>
          ) : (
            <div className="divide-y divide-[#F3F4F6]">
              {recentSchools.map((school) => {
                const displayName = school.profile?.schoolName || school.name;
                return (
                  <div key={school.id} className="px-5 py-4 flex items-center gap-4 hover:bg-[#F9FAFB] transition-colors">
                    {/* Avatar */}
                    <div className="w-10 h-10 rounded-xl bg-[#EEF2FF] text-[#4338CA] flex items-center justify-center font-display font-bold text-sm shrink-0">
                      {initials(displayName)}
                    </div>

                    {/* Info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <Link
                          href={`/aipsa/schools/${school.id}`}
                          className="font-display text-[14px] font-semibold text-[#1A1D23] hover:text-[#1D7A4A] transition-colors truncate"
                        >
                          {displayName}
                        </Link>
                        <span className={`text-[11px] font-semibold px-2 py-0.5 rounded ${STATUS_STYLE[school.status]}`}>
                          {school.status}
                        </span>
                      </div>
                      <div className="flex items-center gap-3 mt-1 text-[12px] text-[#6B7280]">
                        {(school.profile?.city || school.profile?.state) && (
                          <span className="flex items-center gap-1">
                            <MapPin className="w-3 h-3" strokeWidth={1.75} />
                            {[school.profile?.city, school.profile?.state].filter(Boolean).join(', ')}
                          </span>
                        )}
                        <span className="flex items-center gap-1">
                          <Users className="w-3 h-3" strokeWidth={1.75} />
                          {school._count.users} users
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="w-3 h-3" strokeWidth={1.75} />
                          {timeAgo(school.createdAt)}
                        </span>
                      </div>
                    </div>

                    {/* Action */}
                    <div className="shrink-0">
                      {school.status === 'PENDING' && (
                        <button
                          onClick={() => handleApprove(school.id)}
                          disabled={approvingId === school.id}
                          className="inline-flex items-center h-[30px] px-3 bg-[#D6F0E4] hover:bg-[#26A96B]/25 text-[#0F6E56] rounded-md font-semibold text-[12px] transition-colors disabled:opacity-50"
                        >
                          {approvingId === school.id ? 'Approving…' : 'Approve'}
                        </button>
                      )}
                      {school.status === 'ACTIVE' && (
                        <Link
                          href={`/aipsa/schools/${school.id}`}
                          className="inline-flex items-center h-[30px] px-3 bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[#6B7280] rounded-md font-semibold text-[12px] transition-colors"
                        >
                          View
                        </Link>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Column — Platform Pulse */}
        <div className="space-y-4">
          {/* Pending Approvals Alert */}
          {stats && stats.pendingSchools > 0 && (
            <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 rounded-xl p-5">
              <div className="flex items-start gap-3">
                <div className="w-8 h-8 rounded-lg bg-[#F59E0B]/20 flex items-center justify-center shrink-0 mt-0.5">
                  <Clock className="w-4 h-4 text-[#854F0B]" strokeWidth={1.75} />
                </div>
                <div>
                  <p className="font-display text-[14px] font-semibold text-[#854F0B]">
                    {stats.pendingSchools} Pending {stats.pendingSchools === 1 ? 'Approval' : 'Approvals'}
                  </p>
                  <p className="font-body text-[12px] text-[#92400E] mt-1 leading-relaxed">
                    {stats.pendingSchools === 1
                      ? 'A school is waiting for your approval to go live.'
                      : 'Schools are waiting for your approval to go live.'}
                  </p>
                  <Link
                    href="/aipsa/schools?status=PENDING"
                    className="inline-flex items-center gap-1 mt-3 text-[12px] font-semibold text-[#854F0B] hover:text-[#78350F] transition-colors"
                  >
                    Review now <ArrowRight className="w-3 h-3" strokeWidth={2} />
                  </Link>
                </div>
              </div>
            </div>
          )}

          {/* Platform Health */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p className="font-display text-[14px] font-semibold text-[#1A1D23] mb-4">Platform Health</p>
            <div className="space-y-3">
              {[
                {
                  label: 'Active Rate',
                  value: stats
                    ? stats.totalSchools > 0
                      ? `${Math.round((stats.activeSchools / stats.totalSchools) * 100)}%`
                      : '—'
                    : '…',
                  color: 'text-[#0F6E56]',
                  bg: 'bg-[#D6F0E4]',
                },
                {
                  label: 'Avg. Users / School',
                  value: stats
                    ? stats.activeSchools > 0
                      ? (stats.totalUsers / stats.activeSchools).toFixed(1)
                      : '—'
                    : '…',
                  color: 'text-[#4338CA]',
                  bg: 'bg-[#EEF2FF]',
                },
                {
                  label: 'Suspension Rate',
                  value: stats
                    ? stats.totalSchools > 0
                      ? `${Math.round((stats.suspendedSchools / stats.totalSchools) * 100)}%`
                      : '—'
                    : '…',
                  color: 'text-[#A32D2D]',
                  bg: 'bg-[#FCEBEB]',
                },
              ].map((item) => (
                <div key={item.label} className="flex items-center justify-between">
                  <span className="font-body text-[13px] text-[#6B7280]">{item.label}</span>
                  <span className={`font-display text-[13px] font-bold px-2.5 py-0.5 rounded ${item.bg} ${item.color}`}>
                    {item.value}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* Quick Actions */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <p className="font-display text-[14px] font-semibold text-[#1A1D23] mb-3">Quick Actions</p>
            <div className="space-y-2">
              <Link
                href="/aipsa/schools"
                className="flex items-center justify-between w-full p-3 rounded-lg border border-[#E5E7EB] hover:border-[#26A96B]/40 hover:bg-[#F7F8FA] transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Building2 className="w-4 h-4 text-[#6B7280] group-hover:text-[#1D7A4A]" strokeWidth={1.75} />
                  <span className="font-body text-[13px] font-medium text-[#374151] group-hover:text-[#1A1D23]">
                    All Schools
                  </span>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-[#D1D5DB] group-hover:text-[#1D7A4A] transition-colors" strokeWidth={2} />
              </Link>
              <Link
                href="/aipsa/schools?status=PENDING"
                className="flex items-center justify-between w-full p-3 rounded-lg border border-[#E5E7EB] hover:border-[#F59E0B]/40 hover:bg-[#FAEEDA]/30 transition-all group"
              >
                <div className="flex items-center gap-2.5">
                  <Clock className="w-4 h-4 text-[#6B7280] group-hover:text-[#854F0B]" strokeWidth={1.75} />
                  <span className="font-body text-[13px] font-medium text-[#374151] group-hover:text-[#1A1D23]">
                    Pending Approvals
                  </span>
                </div>
                {stats && stats.pendingSchools > 0 && (
                  <span className="text-[11px] font-bold bg-[#FAEEDA] text-[#854F0B] px-1.5 py-0.5 rounded">
                    {stats.pendingSchools}
                  </span>
                )}
              </Link>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
