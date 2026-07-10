'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ShoppingBag, Loader2 } from 'lucide-react';
import PurchasesView from '@/components/PurchasesView';
import StoreShopView from '@/components/StoreShopView';

const TABS = ['Shop', 'Purchases'] as const;
type Tab = typeof TABS[number];

export default function ParentPurchasesPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [active, setActive] = useState('');
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState<Tab>('Shop');
  const [refreshKey, setRefreshKey] = useState(0);
  useEffect(() => { api.get('/sis/parent/students').then(r => { setStudents(r.data); if (r.data[0]) setActive(r.data[0].id); }).finally(() => setLoading(false)); }, []);
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><ShoppingBag className="w-6 h-6 text-[#1D7A4A]" /> Store &amp; Purchases</h1>
      {loading ? <p className="text-sm text-[#6B7280] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        : students.length === 0 ? <p className="text-sm text-[#9CA3AF] italic">No linked students.</p>
        : <>
            {students.length > 1 && <div className="flex gap-2 mb-5 flex-wrap">{students.map(s => <button key={s.id} onClick={() => setActive(s.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${active === s.id ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{s.firstName} {s.lastName}</button>)}</div>}
            <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
              {TABS.map(t => (
                <button key={t} onClick={() => setTab(t)}
                  className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>
                  {t}
                </button>
              ))}
            </div>
            {active && (tab === 'Shop'
              ? <StoreShopView studentId={active} onPurchased={() => setRefreshKey(k => k + 1)} />
              : <PurchasesView key={`${active}-${refreshKey}`} studentId={active} />)}
          </>}
    </div>
  );
}
