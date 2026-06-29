'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import { Plus, BookOpen, Eye, EyeOff, Trash2, X, Layers, Users } from 'lucide-react';
import api from '@/lib/api';

interface Course {
  id: string; title: string; subject: string; gradeLevel: string;
  description: string | null; board: string | null; isPublished: boolean; sortOrder: number;
  _count: { modules: number; enrollments: number };
}

const EMPTY = { title: '', subject: '', gradeLevel: '', description: '', board: '', isPublished: false };

export default function HomeschoolCatalogPage() {
  const [courses, setCourses] = useState<Course[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hs-catalog/courses');
      setCourses(data);
    } catch { setError('Failed to load courses.'); }
  }, []);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function createCourse(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true);
    setError('');
    try {
      await api.post('/hs-catalog/courses', form);
      setForm(EMPTY);
      setShowForm(false);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not create the course.');
    } finally { setSaving(false); }
  }

  async function togglePublish(c: Course) {
    await api.put(`/hs-catalog/courses/${c.id}`, { isPublished: !c.isPublished });
    load();
  }

  async function remove(c: Course) {
    if (!confirm(`Delete "${c.title}" and all its modules and lessons? This cannot be undone.`)) return;
    await api.delete(`/hs-catalog/courses/${c.id}`);
    load();
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[28px] font-bold text-[#1A1D23]">Home Schooling Catalog</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">The global course catalog sold to home-schooling families.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-2 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[40px] rounded-lg shrink-0 self-start sm:self-center">
          <Plus className="w-4 h-4" /> New course
        </button>
      </div>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-[13px] px-4 py-2.5 rounded-lg">{error}</div>}

      {loading ? (
        <div className="py-24 text-center text-[14px] text-[#6B7280]">Loading…</div>
      ) : courses.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-16 text-center">
          <BookOpen className="w-10 h-10 text-[#D1D5DB] mx-auto" strokeWidth={1.5} />
          <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No courses yet</h3>
          <p className="text-[14px] text-[#6B7280] mt-1">Create your first course to build the catalog.</p>
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
          <table className="w-full text-[13px]">
            <thead className="bg-[#F7F8FA] text-[#6B7280] text-left">
              <tr>
                <th className="px-4 py-3 font-medium">Course</th>
                <th className="px-4 py-3 font-medium">Grade</th>
                <th className="px-4 py-3 font-medium">Content</th>
                <th className="px-4 py-3 font-medium">Status</th>
                <th className="px-4 py-3 font-medium text-right">Actions</th>
              </tr>
            </thead>
            <tbody>
              {courses.map((c) => (
                <tr key={c.id} className="border-t border-[#E5E7EB]">
                  <td className="px-4 py-3">
                    <Link href={`/aipsa/homeschool/${c.id}`} className="font-medium text-[#1A1D23] hover:text-[#1D7A4A]">{c.title}</Link>
                    <div className="text-[12px] text-[#9CA3AF]">{c.subject}{c.board ? ` · ${c.board}` : ''}</div>
                  </td>
                  <td className="px-4 py-3 text-[#374151]">{c.gradeLevel}</td>
                  <td className="px-4 py-3 text-[#6B7280]">
                    <span className="inline-flex items-center gap-1 mr-3"><Layers className="w-3.5 h-3.5" /> {c._count.modules}</span>
                    <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {c._count.enrollments}</span>
                  </td>
                  <td className="px-4 py-3">
                    {c.isPublished
                      ? <span className="inline-flex text-[11px] font-semibold px-2 py-0.5 rounded bg-[#D6F0E4] text-[#0F6E56]">Published</span>
                      : <span className="inline-flex text-[11px] font-semibold px-2 py-0.5 rounded bg-[#F0F1F3] text-[#6B7280]">Draft</span>}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <button onClick={() => togglePublish(c)} title={c.isPublished ? 'Unpublish' : 'Publish'} className="p-2 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280]">
                        {c.isPublished ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                      </button>
                      <Link href={`/aipsa/homeschool/${c.id}`} className="text-[13px] font-medium text-[#1D7A4A] hover:underline px-2">Manage</Link>
                      <button onClick={() => remove(c)} title="Delete" className="p-2 rounded-lg hover:bg-[#FCEBEB] text-[#A32D2D]">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {showForm && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[480px] max-w-[92vw] p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[18px] font-semibold">New course</h3>
              <button onClick={() => setShowForm(false)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={createCourse} className="space-y-4 mt-4">
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Title</label>
                <input required value={form.title} onChange={(e) => setForm({ ...form, title: e.target.value })} placeholder="e.g. Mathematics — Grade 6" className="w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Subject</label>
                  <input required value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} placeholder="Mathematics" className="w-full" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Grade level</label>
                  <input required value={form.gradeLevel} onChange={(e) => setForm({ ...form, gradeLevel: e.target.value })} placeholder="Grade 6" className="w-full" />
                </div>
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Board <span className="text-[#9CA3AF]">(optional — e.g. NIOS, CBSE)</span></label>
                <input value={form.board} onChange={(e) => setForm({ ...form, board: e.target.value })} className="w-full" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Description</label>
                <textarea rows={3} value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} className="w-full" />
              </div>
              <label className="flex items-center gap-2 text-[14px] text-[#374151]">
                <input type="checkbox" checked={form.isPublished} onChange={(e) => setForm({ ...form, isPublished: e.target.checked })} className="w-4 h-4" />
                Publish immediately (visible to families)
              </label>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setShowForm(false)} className="bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[14px] font-medium px-4 h-[38px] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] rounded-lg disabled:opacity-50">
                  {saving ? 'Creating…' : 'Create course'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
