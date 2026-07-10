'use client';

import { useState } from 'react';
import { ShoppingBag } from 'lucide-react';
import PurchasesView from '@/components/PurchasesView';
import StoreShopView from '@/components/StoreShopView';

const TABS = ['Shop', 'My Purchases'] as const;
type Tab = typeof TABS[number];

export default function StudentPurchasesPage() {
  const [tab, setTab] = useState<Tab>('Shop');
  // bump to force the purchases list to refetch after a successful buy
  const [refreshKey, setRefreshKey] = useState(0);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><ShoppingBag className="w-6 h-6 text-[#1D7A4A]" /> Store &amp; Purchases</h1>

      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>
            {t}
          </button>
        ))}
      </div>

      {tab === 'Shop'
        ? <StoreShopView onPurchased={() => setRefreshKey(k => k + 1)} />
        : <PurchasesView key={refreshKey} />}
    </div>
  );
}
