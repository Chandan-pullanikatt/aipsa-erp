'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Award, Plus, Trash2, X, Users } from 'lucide-react';

interface ProgramItem { id: string; name: string; fee: number | null; }
interface Program {
  id: string;
  type: string;
  category: string | null;
  title: string;
  description: string | null;
  bannerUrl: string | null;
  fee: number;
  audience: string;
  capacity: number | null;
  closesAt: string | null;
  requiresTeacherMatch: boolean;
  isActive: boolean;
  tenantId: string | null;
  items: ProgramItem[];
}
interface Registration {
  id: string;
  status: string;
  paymentStatus: string;
  amount: number;
  program: { id: string; title: string; type: string };
  programItem: { id: string; name: string } | null;
  registrant: { firstName: string; lastName: string; email: string };
  assignedTeacher: { id: string; firstName: string; lastName: string } | null;
  createdAt: string;
}
interface Teacher { id: string; firstName: string; lastName: string; }

const TYPES = ['COMPETITION', 'TUITION', 'TRAINING', 'COUNSELING', 'EVENT'];
const AUDIENCES = ['ANYONE', 'STUDENT', 'PARENT', 'TEACHER', 'PRINCIPAL'];
const rupee = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN')}`;

const emptyForm = {
  type: 'COMPETITION', category: '', title: '', description: '', bannerUrl: '',
  fee: '0', audience: 'ANYONE', capacity: '', closesAt: '', requiresTeacherMatch: false,
  items: [] as { name: string; fee: string }[],
};

export default function AdminProgramsPage() {
  const [programs, setPrograms] = useState<Program[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ ...emptyForm });
  const [saving, setSaving] = useState(false);
  const [selected, setSelected] = useState<Program | null>(null);
  const [regs, setRegs] = useState<Registration[]>([]);
  const [loadingRegs, setLoadingRegs] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/programs', { params: { includeInactive: true } });
      setPrograms(data);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load programs.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
    api.get('/schools/users', { params: { role: 'TEACHER', limit: 200 } })
      .then(r => setTeachers(r.data.users)).catch(() => {});
  }, [load]);

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null);
    try {
      await api.post('/programs', {
        type: form.type,
        category: form.category || undefined,
        title: form.title,
        description: form.description || undefined,
        bannerUrl: form.bannerUrl || undefined,
        fee: parseFloat(form.fee) || 0,
        audience: form.audience,
        capacity: form.capacity ? parseInt(form.capacity) : undefined,
        closesAt: form.closesAt || undefined,
        requiresTeacherMatch: form.requiresTeacherMatch,
        items: form.items.filter(i => i.name.trim()).map(i => ({ name: i.name, fee: i.fee ? parseFloat(i.fee) : null })),
      });
      setShowForm(false); setForm({ ...emptyForm });
      await load();
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not create program.');
    } finally {
      setSaving(false);
    }
  }

  async function toggleActive(p: Program) {
    await api.put(`/programs/${p.id}`, { isActive: !p.isActive });
    await load();
  }

  async function remove(p: Program) {
    if (!confirm(`Delete "${p.title}"? This removes its registrations too.`)) return;
    await api.delete(`/programs/${p.id}`);
    if (selected?.id === p.id) setSelected(null);
    await load();
  }

  async function openRegs(p: Program) {
    setSelected(p); setLoadingRegs(true); setRegs([]);
    try {
      const { data } = await api.get('/programs/manage/registrations', { params: { programId: p.id } });
      setRegs(data);
    } finally {
      setLoadingRegs(false);
    }
  }

  async function assignTeacher(regId: string, teacherId: string) {
    if (!teacherId) return;
    await api.post(`/programs/registrations/${regId}/assign-teacher`, { teacherId });
    if (selected) openRegs(selected);
  }

  return (
    <div className="space-y-6 font-body">
      {/* Header */}
      <div className="flex items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center">
            <Award className="w-5 h-5" strokeWidth={1.75} />
          </div>
          <div>
            <h1 className="font-display text-xl font-bold text-[#1A1D23]">Programs &amp; Registrations</h1>
            <p className="text-xs text-gray-500 mt-0.5">Create competitions, tuition, training, counseling &amp; events</p>
          </div>
        </div>
        <button onClick={() => { setForm({ ...emptyForm }); setShowForm(true); }}
          className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-semibold rounded-lg px-4 py-2.5">
          <Plus className="w-4 h-4" /> New Program
        </button>
      </div>

      {error && <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-lg">{error}</div>}

      {/* List */}
      {loading ? (
        <div className="py-24 text-center text-gray-400 text-sm">Loading…</div>
      ) : programs.length === 0 ? (
        <div className="py-24 text-center border border-[#E5E7EB] bg-white rounded-xl">
          <p className="text-gray-500 text-sm">No programs yet. Create your first one.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm overflow-hidden">
          <div className="divide-y divide-gray-50">
            {programs.map(p => (
              <div key={p.id} className="flex items-center gap-3 px-4 py-3 hover:bg-gray-50/50">
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium text-gray-800 truncate">{p.title}</p>
                    {p.tenantId === null && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-600">AIPSA</span>}
                    {!p.isActive && <span className="text-[9px] font-bold px-1.5 py-0.5 rounded bg-gray-100 text-gray-400">HIDDEN</span>}
                  </div>
                  <p className="text-[11px] text-gray-400 mt-0.5">
                    {p.type}{p.category ? ` · ${p.category}` : ''} · {p.fee > 0 ? rupee(p.fee) : 'Free'}
                    {p.items.length > 0 && ` · ${p.items.length} options`}
                    {p.requiresTeacherMatch && ' · needs teacher'}
                  </p>
                </div>
                <button onClick={() => openRegs(p)} className="text-[11px] font-medium text-[#1D7A4A] hover:underline inline-flex items-center gap-1">
                  <Users className="w-3.5 h-3.5" /> Registrations
                </button>
                <button onClick={() => toggleActive(p)} className="text-[11px] font-medium text-gray-500 hover:text-gray-800">
                  {p.isActive ? 'Hide' : 'Show'}
                </button>
                {/* AIPSA-global programs are not deletable by a school admin */}
                {p.tenantId !== null && (
                  <button onClick={() => remove(p)} className="text-gray-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Registrations drawer */}
      {selected && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-display font-semibold text-sm text-[#1A1D23]">Registrations — {selected.title}</h2>
            <button onClick={() => setSelected(null)} className="text-gray-400 hover:text-gray-700"><X className="w-4 h-4" /></button>
          </div>
          {loadingRegs ? (
            <p className="text-xs text-gray-400 py-6 text-center">Loading…</p>
          ) : regs.length === 0 ? (
            <p className="text-xs text-gray-400 py-6 text-center">No registrations yet.</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead>
                  <tr className="text-left text-gray-400 border-b border-gray-100">
                    <th className="py-2 pr-3 font-medium">Registrant</th>
                    <th className="py-2 pr-3 font-medium">Option</th>
                    <th className="py-2 pr-3 font-medium">Status</th>
                    <th className="py-2 pr-3 font-medium">Amount</th>
                    {selected.requiresTeacherMatch && <th className="py-2 pr-3 font-medium">Teacher</th>}
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {regs.map(r => (
                    <tr key={r.id}>
                      <td className="py-2 pr-3">
                        <p className="font-medium text-gray-800">{r.registrant.firstName} {r.registrant.lastName}</p>
                        <p className="text-gray-400 text-[10px]">{r.registrant.email}</p>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{r.programItem?.name || '—'}</td>
                      <td className="py-2 pr-3">
                        <span className={`text-[10px] font-semibold px-1.5 py-0.5 rounded ${
                          r.status === 'CONFIRMED' ? 'bg-emerald-50 text-emerald-700'
                            : r.status === 'PENDING' ? 'bg-amber-50 text-amber-700' : 'bg-gray-100 text-gray-500'
                        }`}>{r.status}</span>
                      </td>
                      <td className="py-2 pr-3 text-gray-600">{r.amount > 0 ? rupee(r.amount) : 'Free'}</td>
                      {selected.requiresTeacherMatch && (
                        <td className="py-2 pr-3">
                          <select
                            value={r.assignedTeacher?.id || ''}
                            onChange={e => assignTeacher(r.id, e.target.value)}
                            className="border border-[#E5E7EB] rounded px-2 py-1 text-[11px] bg-white focus:outline-none focus:ring-1 focus:ring-[#1D7A4A]"
                          >
                            <option value="">Assign…</option>
                            {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                          </select>
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* Create form modal */}
      {showForm && (
        <div className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[2px] flex items-start justify-center overflow-y-auto p-4">
          <form onSubmit={handleCreate} className="bg-white rounded-xl shadow-xl w-full max-w-lg my-8 p-6 space-y-4">
            <div className="flex items-center justify-between">
              <h2 className="font-display font-semibold text-base text-[#1A1D23]">New Program</h2>
              <button type="button" onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-700"><X className="w-5 h-5" /></button>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Type</span>
                <select value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </label>
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Category (label)</span>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))}
                  placeholder="e.g. Olympiad, Arts Festival"
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
              </label>
            </div>

            <label className="text-xs block">
              <span className="text-gray-500 font-medium">Title</span>
              <input required value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
                className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
            </label>

            <label className="text-xs block">
              <span className="text-gray-500 font-medium">Description</span>
              <textarea value={form.description} onChange={e => setForm(f => ({ ...f, description: e.target.value }))} rows={2}
                className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
            </label>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Fee (₹, 0 = free)</span>
                <input type="number" min="0" value={form.fee} onChange={e => setForm(f => ({ ...f, fee: e.target.value }))}
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
              </label>
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Audience</span>
                <select value={form.audience} onChange={e => setForm(f => ({ ...f, audience: e.target.value }))}
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]">
                  {AUDIENCES.map(a => <option key={a} value={a}>{a}</option>)}
                </select>
              </label>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Capacity (blank = ∞)</span>
                <input type="number" min="1" value={form.capacity} onChange={e => setForm(f => ({ ...f, capacity: e.target.value }))}
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
              </label>
              <label className="text-xs">
                <span className="text-gray-500 font-medium">Closes on</span>
                <input type="date" value={form.closesAt} onChange={e => setForm(f => ({ ...f, closesAt: e.target.value }))}
                  className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
              </label>
            </div>

            <label className="text-xs block">
              <span className="text-gray-500 font-medium">Banner image URL (optional)</span>
              <input value={form.bannerUrl} onChange={e => setForm(f => ({ ...f, bannerUrl: e.target.value }))}
                placeholder="/images/programs/…"
                className="mt-1 w-full border border-[#E5E7EB] rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
            </label>

            <label className="flex items-center gap-2 text-xs text-gray-600">
              <input type="checkbox" checked={form.requiresTeacherMatch}
                onChange={e => setForm(f => ({ ...f, requiresTeacherMatch: e.target.checked }))} />
              Requires teacher assignment (1-to-1 tuition)
            </label>

            {/* Sub-items */}
            <div className="border-t border-gray-100 pt-3">
              <div className="flex items-center justify-between mb-2">
                <span className="text-xs font-medium text-gray-500">Options / sub-items (e.g. arts categories, olympiad subjects)</span>
                <button type="button" onClick={() => setForm(f => ({ ...f, items: [...f.items, { name: '', fee: '' }] }))}
                  className="text-[11px] text-[#1D7A4A] font-medium inline-flex items-center gap-1"><Plus className="w-3 h-3" /> Add</button>
              </div>
              {form.items.map((it, idx) => (
                <div key={idx} className="flex items-center gap-2 mb-2">
                  <input placeholder="Option name" value={it.name}
                    onChange={e => setForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, name: e.target.value } : x) }))}
                    className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
                  <input placeholder="Fee" type="number" min="0" value={it.fee}
                    onChange={e => setForm(f => ({ ...f, items: f.items.map((x, i) => i === idx ? { ...x, fee: e.target.value } : x) }))}
                    className="w-24 border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]" />
                  <button type="button" onClick={() => setForm(f => ({ ...f, items: f.items.filter((_, i) => i !== idx) }))}
                    className="text-gray-300 hover:text-rose-500"><Trash2 className="w-4 h-4" /></button>
                </div>
              ))}
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)}
                className="text-xs font-medium text-gray-600 px-4 py-2.5 rounded-lg hover:bg-gray-100">Cancel</button>
              <button type="submit" disabled={saving}
                className="text-xs font-semibold text-white bg-[#1D7A4A] hover:bg-[#155B37] disabled:opacity-60 px-5 py-2.5 rounded-lg">
                {saving ? 'Creating…' : 'Create Program'}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
