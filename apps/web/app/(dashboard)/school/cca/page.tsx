'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, Trash2, X, Award, Pencil, Check } from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface Teacher { id: string; firstName: string; lastName: string; }
interface CcaArea {
  id: string; name: string; sortOrder: number;
  class: { id: string; name: string };
  teacher: { id: string; firstName: string; lastName: string } | null;
}

export default function CcaConfigPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [classId, setClassId] = useState('');
  const [areas, setAreas] = useState<CcaArea[]>([]);
  const [form, setForm] = useState({ name: '', teacherId: '' });
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', teacherId: '' });
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sis/classes').then(r => { setClasses(r.data); if (r.data[0]) setClassId(r.data[0].id); }).catch(console.error);
    api.get('/schools/users', { params: { role: 'TEACHER', limit: 100 } }).then(r => setTeachers(r.data.users)).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    if (!classId) return;
    const { data } = await api.get('/progress/cca/areas', { params: { classId } });
    setAreas(data);
  }, [classId]);

  useEffect(() => { load(); }, [load]);

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try { await api.post('/progress/cca/areas', { classId, ...form }); setForm({ name: '', teacherId: '' }); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error adding activity.'); }
  }

  async function handleUpdate(id: string) {
    try { await api.put(`/progress/cca/areas/${id}`, editForm); setEditId(null); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error updating.'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this co-curricular activity and all its grades?')) return;
    try { await api.delete(`/progress/cca/areas/${id}`); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Cannot delete.'); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight flex items-center gap-2">
          <Award className="w-7 h-7 text-[#1D7A4A]" strokeWidth={2} /> Co-Curricular Activities
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Define the CCA areas your school offers per class and assign a grading teacher to each. These appear on the holistic progress card.</p>
      </div>

      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium max-w-3xl">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="max-w-3xl">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Class</label>
        <select value={classId} onChange={e => setClassId(e.target.value)}
          className="w-full sm:w-72 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 bg-white">
          {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
      </div>

      <form onSubmit={handleAdd} className="max-w-3xl bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row gap-3 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Activity Name *</label>
          <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Music, Art Education, Sports"
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20" />
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">CCA Teacher</label>
          <select value={form.teacherId} onChange={e => setForm({ ...form, teacherId: e.target.value })}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 bg-white">
            <option value="">No teacher assigned</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
        </div>
        <button type="submit" disabled={!classId} className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155D37] disabled:opacity-50 text-white h-[38px] px-4 rounded-lg font-semibold text-[13px] transition-colors shrink-0">
          <Plus className="w-4 h-4" strokeWidth={2} /> Add
        </button>
      </form>

      <div className="max-w-3xl space-y-2">
        {areas.map(a => (
          <div key={a.id} className="bg-white border border-[#E5E7EB] rounded-xl px-4 py-3 shadow-sm flex items-center justify-between gap-3">
            {editId === a.id ? (
              <>
                <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })}
                  className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm" />
                <select value={editForm.teacherId} onChange={e => setEditForm({ ...editForm, teacherId: e.target.value })}
                  className="border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm bg-white">
                  <option value="">No teacher</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </select>
                <button onClick={() => handleUpdate(a.id)} className="p-1.5 text-[#1D7A4A] hover:bg-gray-100 rounded"><Check className="w-4 h-4" /></button>
                <button onClick={() => setEditId(null)} className="p-1.5 text-gray-400 hover:bg-gray-100 rounded"><X className="w-4 h-4" /></button>
              </>
            ) : (
              <>
                <div className="flex items-center gap-3 min-w-0">
                  <span className="font-semibold text-[#1A1D23] font-display">{a.name}</span>
                  <span className="text-xs text-gray-400 font-body truncate">
                    {a.teacher ? `Graded by ${a.teacher.firstName} ${a.teacher.lastName}` : 'No teacher assigned'}
                  </span>
                </div>
                <div className="flex items-center gap-1 shrink-0">
                  <button onClick={() => { setEditId(a.id); setEditForm({ name: a.name, teacherId: a.teacher?.id || '' }); }} className="p-1.5 text-gray-400 hover:text-[#1D7A4A] hover:bg-gray-100 rounded"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => handleDelete(a.id)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded"><Trash2 className="w-4 h-4" /></button>
                </div>
              </>
            )}
          </div>
        ))}
        {areas.length === 0 && <p className="text-center text-gray-400 text-sm py-10 font-body">No co-curricular activities defined for this class yet.</p>}
      </div>
    </div>
  );
}
