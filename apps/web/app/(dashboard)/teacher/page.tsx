'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import {
  ClipboardCheck, FileText, BarChart3, CalendarDays, ArrowRight, Clock,
  UserPlus, CheckCircle2, AlertCircle, BookOpen, Users, ChevronRight,
  CalendarPlus,
} from 'lucide-react';

const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];

const QUICK_LINKS = [
  { label: 'Mark Attendance', href: '/teacher/attendance', desc: "Mark today's class attendance", icon: ClipboardCheck },
  { label: 'Post Homework', href: '/teacher/homework', desc: 'Assign homework to your class', icon: FileText },
  { label: 'Enter Marks', href: '/teacher/marks', desc: 'Upload exam results', icon: BarChart3 },
  { label: 'My Timetable', href: '/teacher/timetable', desc: 'View your weekly schedule', icon: CalendarDays },
  { label: 'My Students', href: '/teacher/students', desc: 'Browse your class roster', icon: Users },
  { label: 'Leave Requests', href: '/teacher/leave', desc: 'Apply for leave & track approval', icon: CalendarPlus },
];

export default function TeacherDashboard() {
  const [user, setUser] = useState<any>(null);
  const [todayPeriods, setTodayPeriods] = useState<any[]>([]);
  const [recentHW, setRecentHW] = useState<any[]>([]);
  const [totalHwCount, setTotalHwCount] = useState(0);
  const [pendingCount, setPendingCount] = useState(0);
  const [attendanceStatus, setAttendanceStatus] = useState<Record<string, boolean>>({});
  const [loadingSchedule, setLoadingSchedule] = useState(true);

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);

    const todayName = DAYS[new Date().getDay()];
    const todayStr = new Date().toISOString().split('T')[0];

    Promise.allSettled([
      api.get('/timetable/teacher', { params: { teacherId: u.id } }),
      api.get('/homework', { params: { limit: 4 } }),
      api.get('/sis/join-requests', { params: { status: 'PENDING', limit: 1 } }),
    ]).then(([ttRes, hwRes, jrRes]) => {
      if (ttRes.status === 'fulfilled') {
        const all = ttRes.value.data;
        const periods = all
          .filter((p: any) => p.dayOfWeek === todayName && !p.isBreak)
          .sort((a: any, b: any) => a.periodNumber - b.periodNumber);
        setTodayPeriods(periods);

        const uniqueClassIds = [...new Set(periods.map((p: any) => p.classId).filter(Boolean))] as string[];
        Promise.allSettled(
          uniqueClassIds.map((classId) =>
            api.get('/attendance/students/summary', { params: { classId, date: todayStr } })
          )
        ).then((results) => {
          const status: Record<string, boolean> = {};
          uniqueClassIds.forEach((classId, i) => {
            const r = results[i];
            status[classId] = r.status === 'fulfilled' && (r.value.data?.total ?? 0) > 0;
          });
          setAttendanceStatus(status);
        });
      }

      if (hwRes.status === 'fulfilled') {
        setRecentHW(hwRes.value.data.items ?? []);
        setTotalHwCount(hwRes.value.data.total ?? (hwRes.value.data.items ?? []).length);
      }

      if (jrRes.status === 'fulfilled') {
        setPendingCount(jrRes.value.data.total ?? 0);
      }

      setLoadingSchedule(false);
    });
  }, []);

  const uniqueTodayClasses = todayPeriods.reduce((acc: any[], p) => {
    if (p.classId && !acc.find((c: any) => c.id === p.classId)) {
      acc.push({ id: p.classId, name: p.class?.name });
    }
    return acc;
  }, []);

  const markedCount = uniqueTodayClasses.filter((c) => attendanceStatus[c.id]).length;
  const allMarked = uniqueTodayClasses.length > 0 && markedCount === uniqueTodayClasses.length;

  const stats = [
    {
      label: 'Periods Today',
      value: loadingSchedule ? '—' : String(todayPeriods.length),
      sub: `${uniqueTodayClasses.length} class${uniqueTodayClasses.length !== 1 ? 'es' : ''}`,
      icon: CalendarDays,
      cardCls: 'border-[#1D7A4A]/15 bg-[#E5F6EE]/30',
      iconCls: 'bg-[#E5F6EE] text-[#1D7A4A]',
      valueCls: 'text-[#1D7A4A]',
    },
    {
      label: 'Attendance Today',
      value: loadingSchedule ? '—' : `${markedCount}/${uniqueTodayClasses.length}`,
      sub: allMarked ? 'All classes marked' : uniqueTodayClasses.length === 0 ? 'No classes today' : `${uniqueTodayClasses.length - markedCount} still pending`,
      icon: ClipboardCheck,
      cardCls: allMarked ? 'border-emerald-100 bg-emerald-50/40' : 'border-amber-100 bg-amber-50/30',
      iconCls: allMarked ? 'bg-emerald-100 text-emerald-600' : 'bg-amber-100 text-amber-600',
      valueCls: allMarked ? 'text-emerald-700' : 'text-amber-700',
    },
    {
      label: 'Active Homework',
      value: String(totalHwCount),
      sub: 'assignments posted',
      icon: BookOpen,
      cardCls: 'border-blue-100 bg-blue-50/30',
      iconCls: 'bg-blue-100 text-blue-600',
      valueCls: 'text-blue-700',
    },
    {
      label: 'Join Requests',
      value: String(pendingCount),
      sub: pendingCount > 0 ? 'awaiting review' : 'none pending',
      icon: UserPlus,
      cardCls: pendingCount > 0 ? 'border-rose-100 bg-rose-50/30' : 'border-gray-200 bg-gray-50/40',
      iconCls: pendingCount > 0 ? 'bg-rose-100 text-rose-600' : 'bg-gray-100 text-gray-400',
      valueCls: pendingCount > 0 ? 'text-rose-700' : 'text-gray-500',
    },
  ];

  return (
    <div className="max-w-5xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 border-b border-gray-100 pb-5">
        <div>
          <h1 className="font-display text-[30px] font-bold text-[#1A1D23] leading-tight">
            Welcome back, {user?.firstName || 'Teacher'}
          </h1>
          <p className="text-sm text-gray-400 font-body mt-1">
            {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
          </p>
        </div>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {stats.map((s) => {
          const Icon = s.icon;
          return (
            <div key={s.label} className={`bg-white rounded-xl border p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)] ${s.cardCls}`}>
              <div className={`inline-flex p-2 rounded-lg mb-3 ${s.iconCls}`}>
                <Icon className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <p className={`text-2xl font-black font-display ${s.valueCls}`}>{s.value}</p>
              <p className="text-[10px] font-bold uppercase tracking-wider text-gray-500 mt-0.5 font-display">{s.label}</p>
              <p className="text-[11px] text-gray-400 mt-1 font-body">{s.sub}</p>
            </div>
          );
        })}
      </div>

      {/* Schedule + Quick actions */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-display">
                Today's Schedule
              </h2>
            </div>
            <Link
              href="/teacher/timetable"
              className="text-xs font-medium text-[#1D7A4A] hover:text-[#155B37] flex items-center gap-1 font-display"
            >
              Full timetable <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>

          {loadingSchedule ? (
            <div className="py-8 flex items-center justify-center">
              <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1D7A4A]" />
            </div>
          ) : todayPeriods.length === 0 ? (
            <div className="py-8 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-body">No periods scheduled for today.</p>
            </div>
          ) : (
            <div className="space-y-2.5">
              {todayPeriods.map((p) => {
                const marked = p.classId != null ? attendanceStatus[p.classId] : null;
                return (
                  <div
                    key={p.id}
                    className="flex items-center gap-4 p-3.5 bg-gray-50/60 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors"
                  >
                    <div className="text-right w-20 shrink-0 border-r border-gray-200 pr-3">
                      <p className="text-sm font-bold text-[#1D7A4A] font-display">{p.startTime}</p>
                      <p className="text-[10px] font-medium text-gray-400 font-body">Period {p.periodNumber}</p>
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-800 font-display">
                        {p.subject?.name || 'Free Period'}
                      </p>
                      <p className="text-xs text-gray-400 font-body">{p.class?.name}</p>
                    </div>
                    {marked !== null && (
                      <span className={`shrink-0 inline-flex items-center gap-1.5 text-[10px] font-bold px-2.5 py-1 rounded-full border font-display ${
                        marked
                          ? 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/15'
                          : 'bg-amber-50 text-amber-700 border-amber-200'
                      }`}>
                        {marked ? (
                          <><CheckCircle2 className="w-3 h-3" strokeWidth={2.5} />Marked</>
                        ) : (
                          <><AlertCircle className="w-3 h-3" strokeWidth={2} />Pending</>
                        )}
                      </span>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Quick actions */}
        <div className="space-y-2.5">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-400 font-display px-1 mb-1">
            Quick Actions
          </h2>
          {QUICK_LINKS.map((ql) => {
            const Icon = ql.icon;
            return (
              <Link
                key={ql.label}
                href={ql.href}
                className="flex items-center gap-3.5 bg-white rounded-xl border border-[#E5E7EB] px-4 py-3.5 transition-all hover:border-[#1D7A4A]/40 hover:bg-[#E5F6EE]/20 hover:shadow-sm group"
              >
                <div className="p-2 rounded-lg bg-[#E5F6EE] text-[#1D7A4A] shrink-0">
                  <Icon className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm font-display group-hover:text-[#1D7A4A] transition-colors leading-snug">
                    {ql.label}
                  </p>
                  <p className="text-[11px] text-gray-400 mt-0.5 font-body truncate">{ql.desc}</p>
                </div>
                <ArrowRight className="w-3.5 h-3.5 text-gray-300 group-hover:text-[#1D7A4A] transition-colors shrink-0" strokeWidth={1.75} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Pending join requests */}
      {pendingCount > 0 && (
        <Link
          href="/teacher/join-requests"
          className="flex items-center gap-4 bg-amber-50 border border-amber-200 rounded-xl p-4 hover:bg-amber-100 transition-colors group"
        >
          <div className="p-2.5 rounded-lg bg-amber-100 shrink-0">
            <UserPlus className="w-5 h-5 text-amber-700" strokeWidth={1.75} />
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-amber-800 text-sm font-display">
              {pendingCount} Student Registration Request{pendingCount !== 1 ? 's' : ''} Pending
            </p>
            <p className="text-xs text-amber-600 mt-0.5 font-body">
              Review and approve students who registered with your class code.
            </p>
          </div>
          <ArrowRight className="w-4 h-4 text-amber-400 group-hover:text-amber-600 transition-colors shrink-0" strokeWidth={1.75} />
        </Link>
      )}

      {/* Recent homework */}
      {recentHW.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4 pb-3 border-b border-gray-100">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-display">
                Recent Homework
              </h2>
            </div>
            <Link
              href="/teacher/homework"
              className="text-xs font-medium text-[#1D7A4A] hover:text-[#155B37] flex items-center gap-1 font-display"
            >
              View all <ChevronRight className="w-3.5 h-3.5" strokeWidth={2} />
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentHW.map((hw) => (
              <div key={hw.id} className="py-3.5 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate font-display">{hw.title}</p>
                  <p className="text-xs text-gray-400 font-body mt-0.5">
                    {hw.class?.name}{hw.subject ? ' · ' + hw.subject.name : ''}
                  </p>
                </div>
                <div className="flex items-center gap-2.5 shrink-0">
                  {hw.dueDate && (
                    <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full font-body">
                      Due {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                    </span>
                  )}
                  <Link
                    href="/teacher/homework"
                    className="text-[10px] font-bold text-[#1D7A4A] bg-[#E5F6EE] border border-[#1D7A4A]/15 px-2.5 py-1 rounded-full hover:bg-[#1D7A4A] hover:text-white transition-colors font-display"
                  >
                    Submissions
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
