'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Library, Loader2, BookMarked } from 'lucide-react';

const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

export default function LibraryView({ studentId }: { studentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const load = useCallback(async () => {
    try { const { data } = await api.get('/library/student', { params: studentId ? { studentId } : {} }); setData(data); }
    catch (e: any) { setError(e.response?.data?.error || 'Could not load library info.'); }
    finally { setLoading(false); }
  }, [studentId]);
  useEffect(() => { load(); }, [load]);

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  if (error) return <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</p>;

  const row = (i: any) => (
    <div key={i.id} className="flex items-center gap-3 px-4 py-3">
      <div className="w-9 h-12 rounded bg-[#F3F4F6] overflow-hidden shrink-0 flex items-center justify-center">{i.book.coverUrl ? <img src={i.book.coverUrl} alt="" className="w-full h-full object-cover" /> : <BookMarked className="w-4 h-4 text-[#9CA3AF]" />}</div>
      <div className="flex-1 min-w-0">
        <div className="font-medium text-[#1A1D23] text-sm truncate">{i.book.title}</div>
        {i.book.author && <div className="text-xs text-[#9CA3AF]">{i.book.author}</div>}
      </div>
      <div className="text-right text-xs">
        {i.returnedAt
          ? <span className="text-[#1D7A4A] font-semibold">Returned {new Date(i.returnedAt).toLocaleDateString()}</span>
          : <span className={i.overdueDays > 0 ? 'text-[#DC2626] font-semibold' : 'text-[#A16207] font-semibold'}>Due {new Date(i.dueDate).toLocaleDateString()}{i.overdueDays > 0 ? ` · ${i.overdueDays}d late` : ''}</span>}
        {i.accruingFine > 0 && <div className="text-[#DC2626] font-mono">{rupees(i.accruingFine)} fine{i.fineCollected ? ' (paid)' : ''}</div>}
      </div>
    </div>
  );

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center"><div className="text-2xl font-bold text-[#1D7A4A]">{data.current.length}</div><div className="text-xs text-[#6B7280] font-semibold uppercase mt-1">Currently issued</div></div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 text-center"><div className="text-2xl font-bold text-[#1D7A4A]">{data.booksRead}</div><div className="text-xs text-[#6B7280] font-semibold uppercase mt-1">Books read</div></div>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB]">
        <p className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] px-4 pt-4 flex items-center gap-1.5"><Library className="w-4 h-4 text-[#1D7A4A]" /> Currently Issued</p>
        <div className="divide-y divide-[#F3F4F6] mt-2">{data.current.map(row)}{data.current.length === 0 && <p className="text-sm text-[#9CA3AF] italic px-4 py-6">No books currently issued.</p>}</div>
      </div>
      {data.history.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB]">
          <p className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] px-4 pt-4">Reading History</p>
          <div className="divide-y divide-[#F3F4F6] mt-2">{data.history.map(row)}</div>
        </div>
      )}
    </div>
  );
}
