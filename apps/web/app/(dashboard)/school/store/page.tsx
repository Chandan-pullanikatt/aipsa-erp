'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { ShoppingBag, Plus, Trash2, Search, Loader2, X } from 'lucide-react';

const CATEGORIES = ['UNIFORM', 'BOOKS', 'MATERIALS', 'OTHER'];
const TABS = ['Catalog', 'Record Purchase', 'History', 'Not Purchased'] as const;
type Tab = typeof TABS[number];
const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');

export default function StorePage() {
  const [tab, setTab] = useState<Tab>('Catalog');
  const [classes, setClasses] = useState<any[]>([]);
  useEffect(() => { api.get('/sis/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><ShoppingBag className="w-6 h-6 text-[#1D7A4A]" /> Store & Purchases</h1>
        <p className="text-sm text-[#6B7280] font-medium mt-1">Sellable items (uniform, books, materials) and per-student purchase records.</p>
      </div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)} className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>{t}</button>
        ))}
      </div>
      {tab === 'Catalog' && <CatalogTab />}
      {tab === 'Record Purchase' && <RecordTab />}
      {tab === 'History' && <HistoryTab classes={classes} />}
      {tab === 'Not Purchased' && <NotPurchasedTab classes={classes} />}
    </div>
  );
}

function CatalogTab() {
  const [items, setItems] = useState<any[]>([]);
  const [form, setForm] = useState({ name: '', category: 'UNIFORM', price: '', description: '' });
  const load = useCallback(async () => { const { data } = await api.get('/purchases/items', { params: { includeInactive: true } }); setItems(data); }, []);
  useEffect(() => { load(); }, [load]);
  async function add(e: React.FormEvent) { e.preventDefault(); if (!form.name.trim() || form.price === '') return; await api.post('/purchases/items', form); setForm({ name: '', category: 'UNIFORM', price: '', description: '' }); await load(); }
  async function del(id: string) { if (!confirm('Delete item?')) return; await api.delete(`/purchases/items/${id}`); await load(); }
  return (
    <div className="space-y-4">
      <form onSubmit={add} className="bg-white rounded-xl border border-[#E5E7EB] p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <input placeholder="Item name" value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
          {CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}
        </select>
        <input placeholder="Price" type="number" value={form.price} onChange={e => setForm({ ...form, price: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <button className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add</button>
      </form>
      <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
        {items.map(i => (
          <div key={i.id} className="flex items-center justify-between px-4 py-3">
            <div><span className="font-semibold text-[#1A1D23]">{i.name}</span> <span className="text-xs bg-[#F3F4F6] px-2 py-0.5 rounded ml-2">{i.category}</span>{!i.isActive && <span className="text-xs text-[#DC2626] ml-2">inactive</span>}{i.description && <span className="text-xs text-[#9CA3AF] ml-2">{i.description}</span>}</div>
            <div className="flex items-center gap-3"><span className="font-mono font-semibold text-[#1A1D23]">{rupees(i.price)}</span><button onClick={() => del(i.id)}><Trash2 className="w-4 h-4 text-[#DC2626]" /></button></div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[#9CA3AF] italic text-center py-8">No items yet.</p>}
      </div>
    </div>
  );
}

function RecordTab() {
  const [items, setItems] = useState<any[]>([]);
  const [query, setQuery] = useState(''); const [hits, setHits] = useState<any[]>([]);
  const [student, setStudent] = useState<any>(null);
  const [form, setForm] = useState({ storeItemId: '', itemName: '', category: 'UNIFORM', quantity: '1', amount: '', purchasedAt: new Date().toISOString().split('T')[0], note: '' });
  const [done, setDone] = useState('');
  useEffect(() => { api.get('/purchases/items').then(r => setItems(r.data)).catch(() => {}); }, []);
  async function search(q: string) { setQuery(q); if (q.trim().length < 2) { setHits([]); return; } const { data } = await api.get('/sis/students', { params: { search: q, limit: 8 } }); setHits(data.students || []); }
  function pickItem(id: string) {
    const it = items.find(i => i.id === id);
    setForm(f => ({ ...f, storeItemId: id, itemName: it?.name || '', category: it?.category || f.category, amount: it ? String(it.price * (parseInt(f.quantity) || 1)) : f.amount }));
  }
  async function submit(e: React.FormEvent) {
    e.preventDefault(); if (!student) return;
    await api.post('/purchases', { ...form, studentId: student.id });
    setDone(`Recorded for ${student.firstName} ${student.lastName}.`);
    setForm({ storeItemId: '', itemName: '', category: 'UNIFORM', quantity: '1', amount: '', purchasedAt: new Date().toISOString().split('T')[0], note: '' });
  }
  return (
    <div className="max-w-xl space-y-4">
      {done && <p className="text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] rounded-lg px-4 py-2">{done}</p>}
      {!student ? (
        <div className="relative">
          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
          <input placeholder="Search student…" value={query} onChange={e => search(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          {hits.length > 0 && <div className="absolute z-10 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg">{hits.map(h => <button key={h.id} onClick={() => { setStudent(h); setHits([]); setQuery(''); }} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] flex justify-between"><span>{h.firstName} {h.lastName}</span><span className="text-xs text-[#9CA3AF]">{h.admissionNumber}</span></button>)}</div>}
        </div>
      ) : (
        <form onSubmit={submit} className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
          <div className="flex items-center justify-between"><span className="font-semibold text-[#1A1D23]">{student.firstName} {student.lastName} <span className="text-xs text-[#9CA3AF]">{student.admissionNumber}</span></span><button type="button" onClick={() => setStudent(null)} className="text-xs text-[#6B7280] font-semibold">Change</button></div>
          <select value={form.storeItemId} onChange={e => pickItem(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
            <option value="">— Custom item —</option>
            {items.map(i => <option key={i.id} value={i.id}>{i.name} ({rupees(i.price)})</option>)}
          </select>
          <div className="grid grid-cols-2 gap-3">
            <input placeholder="Item name" value={form.itemName} onChange={e => setForm({ ...form, itemName: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <select value={form.category} onChange={e => setForm({ ...form, category: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select>
            <input placeholder="Qty" type="number" value={form.quantity} onChange={e => setForm({ ...form, quantity: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <input placeholder="Amount ₹" type="number" value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <input type="date" value={form.purchasedAt} onChange={e => setForm({ ...form, purchasedAt: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <input placeholder="Note" value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          </div>
          <button className="w-full px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold">Record Purchase</button>
        </form>
      )}
    </div>
  );
}

function HistoryTab({ classes }: { classes: any[] }) {
  const [rows, setRows] = useState<any[]>([]);
  const [classId, setClassId] = useState(''); const [category, setCategory] = useState('');
  const load = useCallback(async () => { const { data } = await api.get('/purchases', { params: { ...(classId && { classId }), ...(category && { category }) } }); setRows(data); }, [classId, category]);
  useEffect(() => { load(); }, [load]);
  const total = rows.reduce((a, r) => a + r.amount, 0);
  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <select value={classId} onChange={e => setClassId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm"><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm"><option value="">All categories</option>{CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select>
        <span className="ml-auto text-sm font-semibold text-[#1A1D23] self-center">Total: {rupees(total)}</span>
      </div>
      <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]"><tr>{['Student', 'Class', 'Item', 'Category', 'Qty', 'Amount', 'Date', ''].map(h => <th key={h} className="text-left px-3 py-2 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
          <tbody className="divide-y divide-[#F3F4F6]">
            {rows.map(r => (
              <tr key={r.id}>
                <td className="px-3 py-2">{r.student.firstName} {r.student.lastName}<div className="text-xs text-[#9CA3AF] font-mono">{r.student.admissionNumber}</div></td>
                <td className="px-3 py-2 text-[#6B7280]">{r.student.class?.name || '—'}</td>
                <td className="px-3 py-2">{r.itemName}</td>
                <td className="px-3 py-2"><span className="text-xs bg-[#F3F4F6] px-2 py-0.5 rounded">{r.category}</span></td>
                <td className="px-3 py-2">{r.quantity}</td>
                <td className="px-3 py-2 font-mono">{rupees(r.amount)}</td>
                <td className="px-3 py-2 text-[#6B7280]">{new Date(r.purchasedAt).toLocaleDateString()}</td>
                <td className="px-3 py-2"><button onClick={async () => { if (confirm('Delete?')) { await api.delete(`/purchases/${r.id}`); load(); } }}><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button></td>
              </tr>
            ))}
            {rows.length === 0 && <tr><td colSpan={8} className="text-center text-[#9CA3AF] italic py-8">No purchases.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NotPurchasedTab({ classes }: { classes: any[] }) {
  const [classId, setClassId] = useState(''); const [category, setCategory] = useState('UNIFORM');
  const [data, setData] = useState<any>(null); const [loading, setLoading] = useState(false);
  async function run() { setLoading(true); try { const { data } = await api.get('/purchases/not-purchased', { params: { category, ...(classId && { classId }) } }); setData(data); } finally { setLoading(false); } }
  return (
    <div className="space-y-4">
      <div className="flex gap-2 items-end">
        <select value={category} onChange={e => setCategory(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">{CATEGORIES.map(c => <option key={c} value={c}>{c[0] + c.slice(1).toLowerCase()}</option>)}</select>
        <select value={classId} onChange={e => setClassId(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm"><option value="">All classes</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        <button onClick={run} disabled={loading} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-2">{loading && <Loader2 className="w-4 h-4 animate-spin" />} Find</button>
      </div>
      {data && (
        <>
          <p className="text-sm font-semibold text-[#991B1B] bg-[#FEE2E2]/40 border border-[#EF4444]/20 rounded-lg px-4 py-2">{data.missingCount} of {data.total} students have not bought any <strong>{data.category}</strong> item.</p>
          <div className="bg-white rounded-xl border border-[#E5E7EB] divide-y divide-[#F3F4F6]">
            {data.missing.map((s: any) => (
              <div key={s.id} className="flex items-center justify-between px-4 py-2.5 text-sm"><span className="font-medium text-[#1A1D23]">{s.firstName} {s.lastName} <span className="text-xs text-[#9CA3AF] font-mono">{s.admissionNumber}</span></span><span className="text-xs text-[#6B7280]">{s.class?.name || '—'}{s.section?.name ? ` · ${s.section.name}` : ''}</span></div>
            ))}
            {data.missing.length === 0 && <p className="text-sm text-[#0F6E56] font-semibold text-center py-8">Everyone has bought a {data.category} item. 🎉</p>}
          </div>
        </>
      )}
    </div>
  );
}
