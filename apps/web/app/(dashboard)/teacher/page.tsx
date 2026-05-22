'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { ClipboardCheck, FileText, BarChart3, CalendarDays, ArrowRight, Clock } from 'lucide-react';

const DAYS = ['SUNDAY','MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY'];

const QUICK_LINKS = [
  { 
    label: 'Mark Attendance', 
    href: '/teacher/attendance', 
    desc: "Mark today's class attendance", 
    color: 'hover:border-[#1D7A4A] hover:bg-[#E5F6EE]/30', 
    icon: ClipboardCheck,
    iconColor: 'text-[#1D7A4A] bg-[#E5F6EE]'
  },
  { 
    label: 'Post Homework', 
    href: '/teacher/homework', 
    desc: 'Assign homework to your class', 
    color: 'hover:border-[#1D7A4A] hover:bg-[#E5F6EE]/30', 
    icon: FileText,
    iconColor: 'text-[#1D7A4A] bg-[#E5F6EE]'
  },
  { 
    label: 'Enter Marks', 
    href: '/teacher/marks', 
    desc: 'Upload exam results', 
    color: 'hover:border-[#1D7A4A] hover:bg-[#E5F6EE]/30', 
    icon: BarChart3,
    iconColor: 'text-[#1D7A4A] bg-[#E5F6EE]'
  },
  { 
    label: 'My Timetable', 
    href: '/teacher/timetable', 
    desc: 'View your weekly schedule', 
    color: 'hover:border-[#1D7A4A] hover:bg-[#E5F6EE]/30', 
    icon: CalendarDays,
    iconColor: 'text-[#1D7A4A] bg-[#E5F6EE]'
  },
];

export default function TeacherDashboard() {
  const [user, setUser] = useState<any>(null);
  const [todayPeriods, setTodayPeriods] = useState<any[]>([]);
  const [recentHW, setRecentHW] = useState<any[]>([]);

  useEffect(() => {
    const u = getUser();
    if (!u) return;
    setUser(u);

    // Today's schedule
    const todayName = DAYS[new Date().getDay()];
    api.get('/timetable/teacher', { params: { teacherId: u.id } })
      .then(r => setTodayPeriods(r.data.filter((p: any) => p.dayOfWeek === todayName && !p.isBreak)))
      .catch(console.error);

    // Recent homework
    api.get('/homework', { params: { limit: 4 } })
      .then(r => setRecentHW(r.data.items))
      .catch(console.error);
  }, []);

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight">
          Welcome, {user?.firstName || 'Teacher'}
        </h1>
        <p className="text-sm text-gray-500 font-body">
          {new Date().toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long' })}
        </p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Today's schedule */}
        <div className="lg:col-span-2 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center gap-2 mb-4">
            <Clock className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
            <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-display">
              Today's Schedule
            </h2>
          </div>
          
          {todayPeriods.length === 0 ? (
            <div className="py-8 text-center bg-gray-50/50 rounded-lg border border-dashed border-gray-200">
              <p className="text-sm text-gray-400 font-body">No periods scheduled for today, or timetable not set up yet.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {todayPeriods.sort((a, b) => a.periodNumber - b.periodNumber).map(p => (
                <div key={p.id} className="flex items-center gap-4 p-4 bg-gray-50/60 rounded-xl border border-gray-100 hover:bg-gray-50 transition-colors">
                  <div className="text-right w-24 shrink-0 border-r border-gray-200 pr-4">
                    <p className="text-sm font-semibold text-[#1D7A4A] font-display">{p.startTime}</p>
                    <p className="text-[10px] font-medium text-gray-400 font-body">Period {p.periodNumber}</p>
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-gray-800 font-display">{p.subject?.name || 'Free Period'}</p>
                    <p className="text-xs text-gray-500 font-body">{p.class?.name}</p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Quick links */}
        <div className="space-y-3">
          {QUICK_LINKS.map(ql => {
            const Icon = ql.icon;
            return (
              <Link key={ql.label} href={ql.href}
                className={`flex items-center gap-4 bg-white rounded-xl border border-[#E5E7EB] p-4 transition-all hover:shadow-sm group ${ql.color}`}>
                <div className={`p-2.5 rounded-lg shrink-0 ${ql.iconColor}`}>
                  <Icon className="w-5 h-5" strokeWidth={1.75} />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="font-semibold text-gray-800 text-sm font-display group-hover:text-[#1D7A4A] transition-colors">{ql.label}</p>
                  <p className="text-xs text-gray-400 mt-0.5 font-body">{ql.desc}</p>
                </div>
                <ArrowRight className="w-4 h-4 text-gray-300 group-hover:text-[#1D7A4A] transition-colors shrink-0" strokeWidth={1.75} />
              </Link>
            );
          })}
        </div>
      </div>

      {/* Recent homework */}
      {recentHW.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center gap-2">
              <FileText className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
              <h2 className="text-xs font-semibold uppercase tracking-wider text-gray-500 font-display">
                Recent Homework
              </h2>
            </div>
            <Link href="/teacher/homework" className="text-xs font-medium text-[#1D7A4A] hover:text-[#155B37] transition-colors font-display">
              View all
            </Link>
          </div>
          <div className="divide-y divide-gray-100">
            {recentHW.map(hw => (
              <div key={hw.id} className="py-3 first:pt-0 last:pb-0 flex items-center justify-between gap-4">
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-gray-800 truncate font-display">{hw.title}</p>
                  <p className="text-xs text-gray-500 font-body mt-0.5">
                    {hw.class.name}{hw.subject ? ' · ' + hw.subject.name : ''}
                  </p>
                </div>
                {hw.dueDate && (
                  <span className="text-xs font-medium text-orange-600 bg-orange-50 border border-orange-100 px-2 py-0.5 rounded-full shrink-0 font-body">
                    Due {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </span>
                )}
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

