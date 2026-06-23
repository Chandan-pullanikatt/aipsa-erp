'use client';

import { useEffect, useState } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Link from 'next/link';
import { getUser, clearAuth } from '@/lib/auth';
import type { AuthUser } from '@/lib/auth';
import { LayoutDashboard, Building2, LogOut, Menu, UserCog } from 'lucide-react';

const NAV_ITEMS = [
  { label: 'Dashboard', href: '/aipsa', exact: true, icon: LayoutDashboard },
  { label: 'Schools', href: '/aipsa/schools', exact: false, icon: Building2 },
  { label: 'My Profile', href: '/aipsa/profile', exact: false, icon: UserCog },
];

export default function SuperAdminLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [sidebarOpen, setSidebarOpen] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'SUPER_ADMIN') router.push('/login');
    else setUser(u);
  }, [router]);

  // Lock body scroll while the mobile sidebar is open.
  useEffect(() => {
    document.body.classList.toggle('sidebar-open', sidebarOpen);
    return () => document.body.classList.remove('sidebar-open');
  }, [sidebarOpen]);

  if (!user) return null;

  return (
    <div className="h-[100dvh] flex overflow-hidden bg-[#F7F8FA] font-body text-[14px] text-[#1A1D23]">
      {/* Sidebar */}
      <aside
        className={`app-sidebar fixed inset-y-0 left-0 z-50 w-[70%] max-w-[320px] lg:w-[240px] bg-[#0B4D2E] flex flex-col transform transition-transform duration-200 ease-in-out shrink-0 ${
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        } lg:relative lg:translate-x-0`}
      >
        {/* Logo */}
        <div className="h-[60px] flex flex-col justify-center px-5 border-b border-white/10 shrink-0">
          <p className="font-display text-[16px] font-bold text-white tracking-wide leading-none">AIPSA Digital School</p>
          <p className="text-[11px] font-medium tracking-wide text-white/50 mt-1 uppercase">Global Admin</p>
        </div>

        {/* Nav */}
        <nav className="flex-1 overflow-y-auto py-4 space-y-0.5">
          <p className="text-[11px] uppercase tracking-widest text-white/40 px-4 pt-2 pb-2 font-display font-semibold">
            PLATFORM
          </p>
          {NAV_ITEMS.map((item) => {
            const isActive = item.exact ? pathname === item.href : pathname.startsWith(item.href);
            const Icon = item.icon;
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setSidebarOpen(false)}
                className={`flex items-center h-11 px-4 rounded-md mx-2 text-[14px] font-medium transition-all gap-2 ${
                  isActive
                    ? 'bg-white/10 text-white border-l-[3px] border-[#26A96B] pl-[13px]'
                    : 'text-white/70 hover:text-white hover:bg-white/5'
                }`}
              >
                <Icon
                  className={`w-[18px] h-[18px] shrink-0 ${isActive ? 'text-white' : 'text-white/60'}`}
                  strokeWidth={1.75}
                />
                <span>{item.label}</span>
              </Link>
            );
          })}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-white/10 shrink-0 bg-black/10">
          <Link
            href="/aipsa/profile"
            onClick={() => setSidebarOpen(false)}
            className="block mb-3 rounded px-1.5 py-1 -mx-1.5 hover:bg-white/5 transition-colors"
          >
            <p className="text-xs font-semibold text-white truncate font-display">
              {user.firstName} {user.lastName}
            </p>
            <p className="text-[11px] text-white/60 truncate mt-0.5">{user.email}</p>
          </Link>
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
        <div
          className="fixed inset-0 z-40 bg-black/40 backdrop-blur-[2px] lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {/* Content */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="lg:hidden bg-white border-b border-[#E5E7EB] h-[60px] px-4 flex items-center gap-3 shrink-0 z-30">
          <button
            onClick={() => setSidebarOpen(true)}
            className="p-1.5 rounded-lg text-gray-500 hover:bg-gray-100"
          >
            <Menu className="w-5 h-5" strokeWidth={1.75} />
          </button>
          <span className="font-display font-semibold text-gray-800 text-sm">AIPSA Digital School</span>
        </header>
        <main className="flex-1 overflow-auto p-6 max-w-[1280px] w-full mx-auto">{children}</main>
      </div>
    </div>
  );
}
