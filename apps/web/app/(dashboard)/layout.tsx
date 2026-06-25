'use client';

import { useEffect, useState, useRef, useCallback } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import api from '@/lib/api';
import PullToRefresh from '@/components/PullToRefresh';
import { registerPushNotifications } from '@/lib/push';
import {
  GraduationCap,
  CalendarCheck,
  Receipt,
  BookOpen,
  UserCog,
  Bus,
  LayoutGrid,
  BarChart3,
  Bell,
  ClipboardList,
  Building2,
  ShoppingBag,
  Library,
  CalendarDays,
  Package,
  Settings2,
  Menu,
  X,
  LogOut,
  LayoutDashboard,
  UserPlus,
  Layers,
  KeyRound,
  Award,
  Users,
  Briefcase,
} from 'lucide-react';

interface NavItem {
  label: string;
  href: string;
  available: boolean;
  icon: any;
}

const ICON_MAP = {
  Dashboard: LayoutDashboard,
  Students: GraduationCap,
  Attendance: CalendarCheck,
  'Fee Management': Receipt,
  Examinations: ClipboardList,
  Timetable: LayoutGrid,
  Communication: Bell,
  LMS: BookOpen,
  Curriculum: BookOpen,
  'LMS / Curriculum': BookOpen,
  Staff: UserCog,
  HR: Briefcase,
  'School Profile': Settings2,
  'Manage Classes': Layers,
  Transport: Bus,
  Hostel: Building2,
  Store: ShoppingBag,
  Purchases: ShoppingBag,
  Library: Library,
  Events: CalendarDays,
  'Change Password': KeyRound,
  // Other roles
  'Join Requests': UserPlus,
  'Marks Entry': ClipboardList,
  Homework: BookOpen,
  Fees: Receipt,
  'Exams & Results': ClipboardList,
  Results: ClipboardList,
  Announcements: Bell,
  'Co-Curricular': Award,
  'CCA Grading': Award,
  'Progress Cards': BarChart3,
  'Progress Card': BarChart3,
  'My Teachers': Users,
};

function getIcon(label: string) {
  return ICON_MAP[label as keyof typeof ICON_MAP] || LayoutDashboard;
}

function getNavItems(role: AuthUser['role']): NavItem[] {
  let items: Omit<NavItem, 'icon'>[] = [];
  if (role === 'SCHOOL_ADMIN') {
    items = [
      { label: 'Dashboard', href: '/school', available: true },
      { label: 'Students', href: '/school/students', available: true },
      { label: 'Manage Classes', href: '/school/students/classes', available: true },
      { label: 'Attendance', href: '/school/attendance', available: true },
      { label: 'Fee Management', href: '/school/fees', available: true },
      { label: 'Examinations', href: '/school/exams', available: true },
      { label: 'Co-Curricular', href: '/school/cca', available: true },
      { label: 'Timetable', href: '/school/timetable', available: true },
      { label: 'Transport', href: '/school/transport', available: true },
      { label: 'Hostel', href: '/school/hostel', available: true },
      { label: 'Store', href: '/school/store', available: true },
      { label: 'Library', href: '/school/library', available: true },
      { label: 'Events', href: '/school/events', available: true },
      { label: 'Communication', href: '/school/communication', available: true },
      { label: 'LMS / Curriculum', href: '/school/curriculum', available: true },
      { label: 'Staff', href: '/school/staff', available: true },
      { label: 'HR', href: '/school/hr', available: true },
      { label: 'School Profile', href: '/school/profile', available: true },
    ];
  } else if (role === 'TEACHER') {
    items = [
      { label: 'Dashboard', href: '/teacher', available: true },
      { label: 'Students', href: '/teacher/students', available: true },
      { label: 'Timetable', href: '/teacher/timetable', available: true },
      { label: 'Attendance', href: '/teacher/attendance', available: true },
      { label: 'Marks Entry', href: '/teacher/marks', available: true },
      { label: 'CCA Grading', href: '/teacher/cca', available: true },
      { label: 'Progress Cards', href: '/teacher/progress', available: true },
      { label: 'Homework', href: '/teacher/homework', available: true },
      { label: 'LMS', href: '/teacher/lms', available: true },
      { label: 'Events', href: '/school/events', available: true },
      { label: 'Join Requests', href: '/teacher/join-requests', available: true },
    ];
  } else if (role === 'STAFF') {
    items = [
      { label: 'Dashboard', href: '/staff', available: true },
      { label: 'Change Password', href: '/change-password', available: true },
    ];
  } else if (role === 'STUDENT') {
    items = [
      { label: 'Dashboard', href: '/student', available: true },
      { label: 'Attendance', href: '/student?tab=attendance', available: true },
      { label: 'Fees', href: '/student?tab=fees', available: true },
      { label: 'Exams & Results', href: '/student?tab=exams', available: true },
      { label: 'Progress Card', href: '/student/progress', available: true },
      { label: 'My Teachers', href: '/student/teachers', available: true },
      { label: 'Homework', href: '/student?tab=homework', available: true },
      { label: 'LMS', href: '/student/lms', available: true },
      { label: 'Transport', href: '/student/transport', available: true },
      { label: 'Hostel', href: '/student/hostel', available: true },
      { label: 'Purchases', href: '/student/purchases', available: true },
      { label: 'Library', href: '/student/library', available: true },
      { label: 'Events', href: '/student/events', available: true },
      { label: 'Change Password', href: '/change-password', available: true },
    ];
  } else if (role === 'PARENT') {
    items = [
      { label: 'Dashboard', href: '/parent', available: true },
      { label: 'Attendance', href: '/parent?tab=attendance', available: true },
      { label: 'Fees', href: '/parent?tab=fees', available: true },
      { label: 'Results', href: '/parent?tab=exams', available: true },
      { label: 'Progress Card', href: '/parent/progress', available: true },
      { label: 'My Teachers', href: '/parent/teachers', available: true },
      { label: 'Homework', href: '/parent?tab=homework', available: true },
      { label: 'Transport', href: '/parent/transport', available: true },
      { label: 'Hostel', href: '/parent/hostel', available: true },
      { label: 'Purchases', href: '/parent/purchases', available: true },
      { label: 'Library', href: '/parent/library', available: true },
      { label: 'Events', href: '/parent/events', available: true },
      { label: 'Announcements', href: '/parent?tab=announcements', available: true },
    ];
  }

  return items.map(item => ({
    ...item,
    icon: getIcon(item.label),
  }));
}

interface NavGroup {
  title: string;
  items: NavItem[];
}

function groupNavItems(items: NavItem[], role: AuthUser['role']): { standalone: NavItem[]; groups: NavGroup[] } {
  if (role !== 'SCHOOL_ADMIN') {
    // Other roles get a simple structure: Dashboard standalone, others under active category or no groups
    const dashboard = items.find(i => i.label === 'Dashboard');
    const others = items.filter(i => i.label !== 'Dashboard');
    return {
      standalone: dashboard ? [dashboard] : [],
      groups: others.length > 0 ? [{ title: 'GENERAL', items: others }] : [],
    };
  }

  const dashboard = items.find(i => i.label === 'Dashboard');

  const academicsList = ['Students', 'Manage Classes', 'Attendance', 'LMS / Curriculum', 'Examinations', 'Co-Curricular', 'Timetable'];
  const financeList = ['Fee Management', 'Store'];
  const operationsList = ['Staff', 'HR', 'Transport', 'Hostel', 'Library'];
  const managementList = ['Communication', 'Events', 'School Profile'];

  const groups: NavGroup[] = [
    {
      title: 'ACADEMICS',
      items: items.filter(i => academicsList.includes(i.label)),
    },
    {
      title: 'FINANCE',
      items: items.filter(i => financeList.includes(i.label)),
    },
    {
      title: 'OPERATIONS',
      items: items.filter(i => operationsList.includes(i.label)),
    },
    {
      title: 'MANAGEMENT',
      items: items.filter(i => managementList.includes(i.label)),
    },
  ];

  return {
    standalone: dashboard ? [dashboard] : [],
    groups: groups.filter(g => g.items.length > 0),
  };
}

interface NotifItem {
  id: string;
  title: string;
  body: string;
  isRead: boolean;
  createdAt: string;
  type: string;
}

function NotificationBell({ tenantId }: { tenantId: string }) {
  const [count, setCount] = useState(0);
  const [open, setOpen] = useState(false);
  const [notifs, setNotifs] = useState<NotifItem[]>([]);
  const ref = useRef<HTMLDivElement>(null);

  const fetchCount = useCallback(async () => {
    try {
      const { data } = await api.get('/communication/notifications/unread-count');
      setCount(data.count);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    fetchCount();
    const id = setInterval(fetchCount, 60000);
    return () => clearInterval(id);
  }, [fetchCount]);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handleClick);
    return () => document.removeEventListener('mousedown', handleClick);
  }, []);

  async function handleOpen() {
    if (!open) {
      try {
        const { data } = await api.get('/communication/notifications', { params: { limit: 10 } });
        setNotifs(data.items);
      } catch { /* ignore */ }
    }
    setOpen(o => !o);
  }

  async function markAllRead() {
    await api.patch('/communication/notifications/read-all');
    setCount(0);
    setNotifs(n => n.map(i => ({ ...i, isRead: true })));
  }

  async function markOneRead(id: string) {
    await api.patch(`/communication/notifications/${id}/read`);
    setNotifs(n => n.map(i => i.id === id ? { ...i, isRead: true } : i));
    setCount(c => Math.max(0, c - 1));
  }

  const TYPE_COLOR: Record<string, string> = {
    ANNOUNCEMENT: 'bg-blue-100 text-blue-600',
    CIRCULAR: 'bg-purple-100 text-purple-600',
    EVENT: 'bg-green-100 text-green-600',
    ALERT: 'bg-red-100 text-red-600',
    INFO: 'bg-gray-100 text-gray-600',
  };

  return (
    <div className="relative" ref={ref}>
      <button onClick={handleOpen} className="relative p-1.5 rounded-lg text-white/60 hover:text-white hover:bg-white/10 transition-colors">
        <Bell className="w-4 h-4" strokeWidth={1.75} />
        {count > 0 && (
          <span className="absolute -top-0.5 -right-0.5 bg-[#DC2626] text-white text-[9px] font-bold rounded-full min-w-[14px] h-3.5 flex items-center justify-center px-0.5 leading-none">
            {count > 99 ? '99+' : count}
          </span>
        )}
      </button>

      {open && (
        <div className="fixed left-4 bottom-[76px] w-80 max-w-[calc(100vw-32px)] bg-white rounded-xl shadow-xl border border-[#E5E7EB] z-50 overflow-hidden">
          <div className="flex items-center justify-between px-4 py-3 border-b border-gray-100">
            <span className="text-sm font-semibold text-gray-800">Notifications</span>
            {count > 0 && <button onClick={markAllRead} className="text-xs text-primary-500 hover:text-primary-700 font-medium">Mark all read</button>}
          </div>
          <div className="max-h-80 overflow-y-auto divide-y divide-gray-50">
            {notifs.length === 0 && <p className="text-gray-400 text-sm text-center py-6">No notifications</p>}
            {notifs.map(n => (
              <button key={n.id} onClick={() => !n.isRead && markOneRead(n.id)}
                className={`w-full text-left px-4 py-3 hover:bg-gray-50 transition-colors ${!n.isRead ? 'bg-primary-100/30' : ''}`}>
                <div className="flex items-start gap-2">
                  <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded mt-0.5 shrink-0 ${TYPE_COLOR[n.type] || TYPE_COLOR.INFO}`}>{n.type}</span>
                  <div className="min-w-0">
                    <p className={`text-xs font-medium truncate ${!n.isRead ? 'text-gray-900' : 'text-gray-600'}`}>{n.title}</p>
                    <p className="text-xs text-gray-400 truncate mt-0.5">{n.body}</p>
                    <p className="text-[10px] text-gray-300 mt-1">{new Date(n.createdAt).toLocaleDateString('en-IN')}</p>
                  </div>
                  {!n.isRead && <span className="w-1.5 h-1.5 bg-primary-500 rounded-full shrink-0 mt-1.5" />}
                </div>
              </button>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [activeTab, setActiveTab] = useState('overview');

  useEffect(() => {
    const u = getUser();
    if (!u) router.push('/login');
    else {
      setUser(u);
      // Register for native push now that we have a logged-in user. PwaProvider only
      // fires on a cold start that's already authenticated; a fresh login lands here.
      registerPushNotifications();
    }
  }, [router]);

  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search);
      setActiveTab(params.get('tab') || 'overview');
    }
  }, [pathname]);

  // Lock body scroll while the mobile sidebar is open.
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  if (!user) return null;

  const navItems = getNavItems(user.role);
  const { standalone, groups } = groupNavItems(navItems, user.role);
  const roleLabel: Record<string, string> = { SCHOOL_ADMIN: 'School Admin', TEACHER: 'Teacher', STUDENT: 'Student', PARENT: 'Parent' };

  const renderLink = (item: NavItem) => {
    const [itemPath, itemQuery] = item.href.split('?');
    const hasQuery = !!itemQuery;
    const queryVal = itemQuery ? itemQuery.split('=')[1] : '';
    const isActive = hasQuery
      ? pathname === itemPath && activeTab === queryVal
      : pathname === item.href || (pathname.startsWith(item.href + '/') && item.href !== '/');

    const Icon = item.icon;

    if (!item.available) {
      return (
        <div key={item.href} className="flex items-center justify-between h-11 px-4 rounded-md mx-2 text-[14px] text-white/30 cursor-not-allowed select-none">
          <div className="flex items-center gap-2">
            <Icon className="w-[18px] h-[18px] shrink-0" strokeWidth={1.75} />
            <span>{item.label}</span>
          </div>
          <span className="text-[10px] bg-white/5 text-white/40 px-1.5 py-0.5 rounded uppercase tracking-wide">Soon</span>
        </div>
      );
    }

    return (
      <Link
        key={item.href}
        href={item.href}
        onClick={() => setSidebarOpen(false)}
        className={`flex items-center h-11 px-4 rounded-md mx-2 text-[14px] font-body font-medium transition-all gap-2 ${
          isActive
            ? 'bg-white/10 text-white border-l-[3px] border-[#26A96B] pl-[13px]'
            : 'text-white/70 hover:text-white hover:bg-white/5'
        }`}
      >
        <Icon className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`} strokeWidth={1.75} />
        <span>{item.label}</span>
      </Link>
    );
  };

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#F7F8FA] font-body text-[14px] text-[#1A1D23]">
      {/* Sidebar */}
      <aside className={`app-sidebar fixed inset-y-0 left-0 z-50 w-[70%] max-w-[320px] lg:w-[240px] bg-[#0B4D2E] flex flex-col transform transition-transform duration-200 ease-in-out shrink-0 ${sidebarOpen ? 'translate-x-0' : '-translate-x-full'} lg:relative lg:translate-x-0`}>
        {/* Logo */}
        <div className="h-[60px] flex flex-col justify-center px-5 border-b border-white/10 shrink-0">
          <p className="font-display text-[16px] font-bold text-white tracking-wide leading-none">AIPSA Digital School</p>
          <p className="text-[11px] font-medium tracking-wide text-white/50 mt-1 uppercase">{roleLabel[user.role]}</p>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-1">
          {/* Standalone items */}
          {standalone.map(renderLink)}

          {/* Grouped items */}
          {groups.map(group => (
            <div key={group.title} className="space-y-0.5">
              <p className="text-[11px] uppercase tracking-widest text-white/40 px-4 pt-5 pb-1 font-display font-semibold">
                {group.title}
              </p>
              {group.items.map(renderLink)}
            </div>
          ))}
        </nav>

        {/* User profile & footer */}
        <div className="p-4 border-t border-white/10 shrink-0 bg-black/10">
          <div className="flex items-center justify-between gap-2 mb-3">
            <div className="min-w-0">
              <p className="text-xs font-semibold text-white truncate font-display">{user.firstName} {user.lastName}</p>
              <p className="text-[11px] text-white/60 truncate mt-0.5">{user.email}</p>
            </div>
            {user.tenantId && <NotificationBell tenantId={user.tenantId} />}
          </div>
          <button
            onClick={() => { clearAuth(); router.push('/login'); }}
            className="flex items-center text-xs font-medium text-red-300 hover:text-red-100 transition-colors w-full gap-1.5 py-1 px-1.5 rounded hover:bg-white/5"
          >
            <LogOut className="w-3.5 h-3.5" strokeWidth={1.75} />
            <span>Sign out</span>
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden" onClick={() => setSidebarOpen(false)} />
      )}

      {/* Main Content Area */}
      <div className="flex-1 flex flex-col min-w-0">
        {/* Mobile Header */}
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] h-[60px] px-4 flex items-center justify-between shrink-0 z-30">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Menu">
              <Menu className="w-5 h-5" strokeWidth={1.75} />
            </button>
            <span className="font-display font-semibold text-gray-800 text-sm">AIPSA Digital School</span>
          </div>
        </header>

        <PullToRefresh className="flex-1 overflow-auto">
          <main className="p-6 max-w-[1280px] w-full mx-auto">{children}</main>
        </PullToRefresh>
      </div>
    </div>
  );
}
