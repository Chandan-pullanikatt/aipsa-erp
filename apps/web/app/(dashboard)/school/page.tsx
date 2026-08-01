'use client';

import { useEffect, useState } from 'react';
import { getUser, clearAuth } from '@/lib/auth';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';

interface Profile {
  schoolName: string;
  logo: string | null;
  city: string;
  state: string;
  board: string;
  phone: string;
  email: string;
}

import {
  GraduationCap,
  CalendarCheck,
  Receipt,
  BookOpen,
  UserCog,
  LayoutGrid,
  Bell,
  ClipboardList,
  Settings2
} from 'lucide-react';

interface Profile {
  schoolName: string;
  logo: string | null;
  city: string;
  state: string;
  board: string;
  phone: string;
  email: string;
}

const MODULES = [
  { label: 'Students', href: '/school/students', available: true, desc: 'Admissions & student records', icon: GraduationCap },
  { label: 'Attendance', href: '/school/attendance', available: true, desc: 'Daily attendance tracking', icon: CalendarCheck },
  { label: 'Fee Management', href: '/school/fees', available: true, desc: 'Collections & due tracking', icon: Receipt },
  { label: 'Examinations', href: '/school/exams', available: true, desc: 'Exams, marks & report cards', icon: ClipboardList },
  { label: 'Timetable', href: '/school/timetable', available: true, desc: 'Class & teacher schedules', icon: LayoutGrid },
  { label: 'Communication', href: '/school/communication', available: true, desc: 'Announcements & circulars', icon: Bell },
  { label: 'LMS / Curriculum', href: '/school/curriculum', available: true, desc: 'Courses, syllabus & lesson planning', icon: BookOpen },
  { label: 'Staff', href: '/school/staff', available: true, desc: 'Manage credentials & roles', icon: UserCog },
  { label: 'School Profile', href: '/school/profile', available: true, desc: 'Update school information', icon: Settings2 },
];

export default function SchoolDashboard() {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const [profile, setProfile] = useState<Profile | null>(null);

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUser(u);
      if (u.tenantStatus !== 'PENDING') {
        api.get('/schools/profile').then((r) => setProfile(r.data)).catch(console.error);
      }
    } else {
      router.push('/login');
    }
  }, [router]);

  if (!user) return null;

  if (user.tenantStatus === 'PENDING') {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <div className="text-center max-w-md bg-white rounded-xl border border-border p-6 shadow-none">
          <p className="text-4xl mb-4">⏳</p>
          <h2 className="font-display text-[22px] font-semibold text-text-primary mb-2">Pending EduBridge Approval</h2>
          <p className="font-body text-[14px] text-text-muted mb-6 leading-relaxed">
            Your school registration is under review. You'll receive an email once approved.
          </p>
          <button
            onClick={() => { clearAuth(); router.push('/login'); }}
            className="font-body text-[14px] text-danger hover:text-red-700 transition-colors font-medium"
          >
            Logout
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center gap-4">
        {profile?.logo && (
          <img
            src={profile.logo}
            alt=""
            className="w-14 h-14 rounded-lg object-contain border border-border bg-white p-1 shrink-0"
          />
        )}
        <div>
        <h1 className="font-display text-[32px] font-bold leading-tight text-text-primary">
          {profile?.schoolName || 'School Dashboard'}
        </h1>
        <p className="font-body text-[14px] text-text-muted mt-2 leading-relaxed">
          Welcome back, {user.firstName}. Select an operational module to manage your school.
        </p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return mod.available ? (
            <Link
              key={mod.label}
              href={mod.href}
              className="bg-white rounded-xl border border-border p-6 hover:border-primary-500 transition-colors flex flex-col justify-between group shadow-none"
            >
              <div className="space-y-3">
                <div className="w-10 h-10 rounded-lg bg-primary-100 flex items-center justify-center text-primary-900 shrink-0">
                  <Icon className="w-5 h-5 text-[#0B4D2E]" strokeWidth={1.75} />
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-semibold text-text-primary group-hover:text-primary-700 transition-colors">
                    {mod.label}
                  </h3>
                  <p className="font-body text-[12px] text-text-muted mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>
            </Link>
          ) : (
            <div
              key={mod.label}
              className="bg-white rounded-xl border border-border p-6 opacity-50 cursor-not-allowed select-none shadow-none flex flex-col justify-between"
            >
              <div className="space-y-3">
                <div className="flex items-start justify-between">
                  <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-gray-400 shrink-0">
                    <Icon className="w-5 h-5" strokeWidth={1.75} />
                  </div>
                  <span className="text-[11px] font-semibold uppercase tracking-wider bg-gray-150 text-gray-500 px-2 py-0.5 rounded">
                    Soon
                  </span>
                </div>
                <div>
                  <h3 className="font-display text-[16px] font-semibold text-gray-500">
                    {mod.label}
                  </h3>
                  <p className="font-body text-[12px] text-gray-400 mt-1 leading-relaxed">
                    {mod.desc}
                  </p>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
