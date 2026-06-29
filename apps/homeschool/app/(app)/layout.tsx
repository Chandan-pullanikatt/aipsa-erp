'use client';

import { useEffect, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import Link from 'next/link';
import { GraduationCap, LayoutDashboard, BookOpen, LogOut } from 'lucide-react';
import { getUser, clearAuth, AuthUser } from '@/lib/auth';

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const pathname = usePathname();
  const [user, setUser] = useState<AuthUser | null>(null);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const u = getUser();
    if (!u || u.role !== 'HS_PARENT') {
      router.replace('/login');
      return;
    }
    setUser(u);
    setReady(true);
  }, [router]);

  function logout() {
    clearAuth();
    router.replace('/login');
  }

  if (!ready) {
    return <div className="min-h-screen flex items-center justify-center text-[14px] text-[#6B7280]">Loading…</div>;
  }

  const nav = [
    { href: '/dashboard', label: 'Dashboard', icon: LayoutDashboard },
    { href: '/catalog', label: 'Catalog', icon: BookOpen },
  ];

  return (
    <div className="min-h-screen flex flex-col">
      <header className="bg-white border-b border-[#E5E7EB] sticky top-0 z-40">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 h-[60px] flex items-center justify-between">
          <Link href="/dashboard" className="flex items-center gap-2 font-display font-bold text-[16px] text-[#0B4D2E]">
            <GraduationCap className="w-5 h-5" /> AIPSA Home Schooling
          </Link>
          <nav className="flex items-center gap-1">
            {nav.map((n) => {
              const active = pathname === n.href || pathname.startsWith(n.href + '/');
              return (
                <Link key={n.href} href={n.href}
                  className={`flex items-center gap-1.5 px-3 h-[36px] rounded-lg text-[14px] font-medium transition-colors ${active ? 'bg-[#D6F0E4] text-[#0B4D2E]' : 'text-[#374151] hover:bg-[#F7F8FA]'}`}>
                  <n.icon className="w-4 h-4" strokeWidth={1.75} /> <span className="hidden sm:inline">{n.label}</span>
                </Link>
              );
            })}
            <button onClick={logout} className="flex items-center gap-1.5 px-3 h-[36px] rounded-lg text-[14px] font-medium text-[#374151] hover:bg-[#F7F8FA]">
              <LogOut className="w-4 h-4" strokeWidth={1.75} /> <span className="hidden sm:inline">Log out</span>
            </button>
          </nav>
        </div>
      </header>
      <main className="flex-1 max-w-5xl w-full mx-auto px-4 sm:px-6 py-8">{children}</main>
    </div>
  );
}
