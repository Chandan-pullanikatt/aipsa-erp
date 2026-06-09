'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { ShoppingBag, Loader2 } from 'lucide-react';

const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

export default function PurchasesView({ studentId }: { studentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const { data } = await api.get('/purchases/student', { params: studentId ? { studentId } : {} }); setData(data); }
    catch (e: any) { setError(e.response?.data?.error || 'Could not load purchases.'); }
    finally { setLoading(false); }
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  if (error) return <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</p>;

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-center justify-between">
        <span className="text-sm font-semibold text-[#6B7280]">Total spent</span>
        <span className="text-2xl font-bold text-[#1D7A4A] font-mono">{rupees(data.total)}</span>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]"><tr>{['Item', 'Category', 'Qty', 'Amount', 'Date'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {data.purchases.map((p: any) => (
              <tr key={p.id}>
                <td className="px-4 py-3 font-medium text-[#1A1D23]">{p.itemName}{p.note ? <span className="text-xs text-[#9CA3AF] ml-1">({p.note})</span> : ''}</td>
                <td className="px-4 py-3"><span className="text-xs bg-[#F3F4F6] px-2 py-0.5 rounded">{p.category}</span></td>
                <td className="px-4 py-3">{p.quantity}</td>
                <td className="px-4 py-3 font-mono">{rupees(p.amount)}</td>
                <td className="px-4 py-3 text-[#6B7280]">{new Date(p.purchasedAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data.purchases.length === 0 && <tr><td colSpan={5} className="text-center text-[#9CA3AF] italic py-10">No purchases recorded.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
