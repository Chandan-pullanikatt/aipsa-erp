'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Library, Plus, Trash2, Search, Loader2, BookMarked, RotateCcw } from 'lucide-react';

const TABS = ['Catalog', 'Issued & Returns'] as const;
type Tab = typeof TABS[number];
const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

export default function LibraryPage() {
  const [tab, setTab] = useState<Tab>('Catalog');
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><Library className="w-6 h-6 text-[#1D7A4A]" /> Library</h1>
        <p className="text-sm text-[#6B7280] font-medium mt-1">Book catalog, issue/return with due dates, and overdue fines.</p>
      </div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Catalog' && <CatalogTab />}
      {tab === 'Issued & Returns' && <IssuesTab />}
    </div>
  );
}

function CatalogTab() {
  const [books, setBooks] = useState<any[]>([]);
  const [search, setSearch] = useState('');
  const [form, setForm] = useState({ title: '', author: '', isbn: '', category: '', readingLevel: '', totalCopies: '1', coverUrl: '' });
  const [uploading, setUploading] = useState(false);
  const load = useCallback(async () => { const { data } = await api.get('/library/books', { params: search ? { search } : {} }); setBooks(data); }, [search]);
  useEffect(() => { load(); }, [load]);
  async function uploadCover(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    setUploading(true);
    try { const fd = new FormData(); fd.append('file', file); fd.append('folder', 'library'); const { data } = await api.post('/uploads', fd, { headers: { 'Content-Type': undefined } as any }); setForm(f => ({ ...f, coverUrl: data.url })); }
    finally { setUploading(false); }
  }
  async function add(e: React.FormEvent) { e.preventDefault(); if (!form.title.trim()) return; await api.post('/library/books', form); setForm({ title: '', author: '', isbn: '', category: '', readingLevel: '', totalCopies: '1', coverUrl: '' }); await load(); }
  async function del(id: string) { if (!confirm('Delete book?')) return; await api.delete(`/library/books/${id}`); await load(); }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="bg-white rounded-xl border border-[#E5E7EB] p-4 grid grid-cols-2 sm:grid-cols-4 gap-2">
        <input placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm col-span-2" />
        <input placeholder="Author" value={form.author} onChange={e => setForm({ ...form, author: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="ISBN" value={form.isbn} onChange={e => setForm({ ...form, isbn: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="Category" value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="Reading level (e.g. Grade 3)" value={form.readingLevel} onChange={e => setForm({ ...form, readingLevel: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="Copies" type="number" value={form.totalCopies} onChange={e => setForm({ ...form, totalCopies: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <label className="px-3 py-2 rounded-lg border border-dashed border-[#E5E7EB] text-sm text-[#6B7280] cursor-pointer text-center">{uploading ? 'Uploading…' : form.coverUrl ? 'Cover ✓' : 'Cover image'}<input type="file" accept="image/*" onChange={uploadCover} className="hidden" /></label>
        <button className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1 col-span-2 sm:col-span-4"><Plus className="w-4 h-4" /> Add Book</button>
      </form>
      <div className="relative max-w-xs">
        <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
        <input placeholder="Search books…" value={search} onChange={e => setSearch(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {books.map(b => (
          <div key={b.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex gap-3">
            <div className="w-12 h-16 rounded bg-[#F3F4F6] overflow-hidden shrink-0 flex items-center justify-center">{b.coverUrl ? <img src={b.coverUrl} alt="" className="w-full h-full object-cover" /> : <BookMarked className="w-5 h-5 text-[#9CA3AF]" />}</div>
            <div className="flex-1 min-w-0">
              <div className="font-semibold text-[#1A1D23] text-sm truncate">{b.title}</div>
              {b.author && <div className="text-xs text-[#6B7280]">{b.author}</div>}
              <div className="text-xs text-[#9CA3AF] mt-1">{b.category || '—'}{b.readingLevel ? ` · ${b.readingLevel}` : ''}</div>
              <div className="flex items-center justify-between mt-2">
                <span className={`text-xs font-bold ${b.availableCopies > 0 ? 'text-[#1D7A4A]' : 'text-[#DC2626]'}`}>{b.availableCopies}/{b.totalCopies} available</span>
                <button onClick={() => del(b.id)}><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button>
              </div>
            </div>
          </div>
        ))}
        {books.length === 0 && <p className="text-sm text-[#9CA3AF] italic col-span-full text-center py-8">No books.</p>}
      </div>
    </div>
  );
}

function IssuesTab() {
  const [issues, setIssues] = useState<any[]>([]);
  const [filter, setFilter] = useState('issued');
  const [showIssue, setShowIssue] = useState(false);
  const [books, setBooks] = useState<any[]>([]);
  const [bookId, setBookId] = useState('');
  const [studentQ, setStudentQ] = useState(''); const [hits, setHits] = useState<any[]>([]); const [student, setStudent] = useState<any>(null);
  const [dueDate, setDueDate] = useState(new Date(Date.now() + 14 * 86400000).toISOString().split('T')[0]);
  const load = useCallback(async () => { const { data } = await api.get('/library/issues', { params: filter ? { status: filter } : {} }); setIssues(data); }, [filter]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { if (showIssue) api.get('/library/books').then(r => setBooks(r.data.filter((b: any) => b.availableCopies > 0))).catch(() => {}); }, [showIssue]);
  async function searchStudent(q: string) { setStudentQ(q); if (q.trim().length < 2) { setHits([]); return; } const { data } = await api.get('/sis/students', { params: { search: q, limit: 8 } }); setHits(data.students || []); }
  async function issue() { if (!bookId || !student) return; await api.post('/library/issues', { bookId, studentId: student.id, dueDate }); setShowIssue(false); setBookId(''); setStudent(null); setStudentQ(''); await load(); }
  async function ret(id: string) { await api.patch(`/library/issues/${id}/return`); await load(); }
  async function collect(id: string) { await api.patch(`/library/issues/${id}/collect-fine`); await load(); }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-center">
        {['issued', 'overdue', 'returned', ''].map(s => <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{s ? s[0].toUpperCase() + s.slice(1) : 'All'}</button>)}
        <button onClick={() => setShowIssue(true)} className="ml-auto px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Issue Book</button>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]"><tr>{['Book', 'Student', 'Issued', 'Due', 'Status', 'Fine', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {issues.map(i => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-medium text-[#1A1D23]">{i.book.title}</td>
                <td className="px-3 py-2">{i.student.firstName} {i.student.lastName}<div className="text-xs text-[#9CA3AF] font-mono">{i.student.admissionNumber}</div></td>
                <td className="px-3 py-2 text-[#6B7280]">{new Date(i.issuedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2 text-[#6B7280]">{new Date(i.dueDate).toLocaleDateString()}</td>
                <td className="px-3 py-2">{i.returnedAt ? <span className="text-xs font-bold text-[#1D7A4A]">Returned</span> : i.overdueDays > 0 ? <span className="text-xs font-bold text-[#DC2626]">Overdue {i.overdueDays}d</span> : <span className="text-xs font-bold text-[#A16207]">Issued</span>}</td>
                <td className="px-3 py-2 font-mono">{i.accruingFine > 0 ? <span className={i.fineCollected ? 'text-[#1D7A4A]' : 'text-[#DC2626]'}>{rupees(i.accruingFine)}{i.fineCollected ? ' ✓' : ''}</span> : '—'}</td>
                <td className="px-3 py-2">
                  <div className="flex gap-2">
                    {!i.returnedAt && <button onClick={() => ret(i.id)} className="text-xs font-semibold px-2 py-1 rounded bg-[#E5F6EE] text-[#1D7A4A] inline-flex items-center gap-1"><RotateCcw className="w-3 h-3" /> Return</button>}
                    {i.returnedAt && i.fineAmount > 0 && !i.fineCollected && <button onClick={() => collect(i.id)} className="text-xs font-semibold px-2 py-1 rounded bg-[#FEF9C3] text-[#A16207]">Collect fine</button>}
                  </div>
                </td>
              </tr>
            ))}
            {issues.length === 0 && <tr><td colSpan={7} className="text-center text-[#9CA3AF] italic py-8">Nothing here.</td></tr>}
          </tbody>
        </table>
      </div>

      {showIssue && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowIssue(false)}>
          <div onClick={e => e.stopPropagation()} className="bg-white rounded-xl p-6 w-full max-w-md space-y-3">
            <h2 className="text-lg font-bold text-[#1A1D23]">Issue a Book</h2>
            <select value={bookId} onChange={e => setBookId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm"><option value="">Select book…</option>{books.map(b => <option key={b.id} value={b.id}>{b.title} ({b.availableCopies} left)</option>)}</select>
            {student ? (
              <div className="flex items-center justify-between bg-[#F9FAFB] rounded-lg px-3 py-2 text-sm"><span>{student.firstName} {student.lastName}</span><button onClick={() => setStudent(null)} className="text-xs text-[#6B7280]">Change</button></div>
            ) : (
              <div className="relative">
                <input placeholder="Search student…" value={studentQ} onChange={e => searchStudent(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                {hits.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg">{hits.map(h => <button key={h.id} onClick={() => { setStudent(h); setHits([]); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB]">{h.firstName} {h.lastName} <span className="text-xs text-[#9CA3AF]">{h.admissionNumber}</span></button>)}</div>}
              </div>
            )}
            <label className="block text-xs font-semibold text-[#6B7280]">Due date<input type="date" value={dueDate} onChange={e => setDueDate(e.target.value)} className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" /></label>
            <div className="flex justify-end gap-2"><button onClick={() => setShowIssue(false)} className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold">Cancel</button><button onClick={issue} disabled={!bookId || !student} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold disabled:opacity-40">Issue</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
