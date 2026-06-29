'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, Plus, Pencil, Trash2, X, Eye, EyeOff, GripVertical, PlayCircle } from 'lucide-react';
import api from '@/lib/api';

interface Lesson {
  id: string; title: string; description: string | null; content: string | null;
  videoUrl: string | null; attachmentUrl: string | null; durationMin: number | null;
  sequence: number; isFreePreview: boolean;
}
interface Module { id: string; title: string; sequence: number; lessons: Lesson[] }
interface Course { id: string; title: string; subject: string; gradeLevel: string; isPublished: boolean; modules: Module[] }

const EMPTY_LESSON = { title: '', description: '', content: '', videoUrl: '', attachmentUrl: '', durationMin: '', sequence: 0, isFreePreview: false };
type LessonForm = typeof EMPTY_LESSON;

export default function CourseAdminPage() {
  const { courseId } = useParams<{ courseId: string }>();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Lesson editor modal state
  const [editor, setEditor] = useState<{ moduleId: string; lessonId: string | null; form: LessonForm } | null>(null);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get(`/hs-catalog/courses/${courseId}`);
      setCourse(data);
    } catch { setError('Failed to load the course.'); }
  }, [courseId]);

  useEffect(() => { load().finally(() => setLoading(false)); }, [load]);

  async function togglePublish() {
    if (!course) return;
    await api.put(`/hs-catalog/courses/${course.id}`, { isPublished: !course.isPublished });
    load();
  }

  // ── Modules ──
  async function addModule() {
    const title = prompt('Module title (e.g. "Fractions")');
    if (!title?.trim()) return;
    await api.post(`/hs-catalog/courses/${courseId}/modules`, { title: title.trim(), sequence: course?.modules.length ?? 0 });
    load();
  }
  async function renameModule(m: Module) {
    const title = prompt('Rename module', m.title);
    if (!title?.trim() || title === m.title) return;
    await api.put(`/hs-catalog/modules/${m.id}`, { title: title.trim() });
    load();
  }
  async function deleteModule(m: Module) {
    if (!confirm(`Delete module "${m.title}" and its ${m.lessons.length} lesson(s)?`)) return;
    await api.delete(`/hs-catalog/modules/${m.id}`);
    load();
  }

  // ── Lessons ──
  function openNewLesson(m: Module) {
    setEditor({ moduleId: m.id, lessonId: null, form: { ...EMPTY_LESSON, sequence: m.lessons.length } });
  }
  function openEditLesson(m: Module, l: Lesson) {
    setEditor({
      moduleId: m.id, lessonId: l.id,
      form: {
        title: l.title, description: l.description ?? '', content: l.content ?? '',
        videoUrl: l.videoUrl ?? '', attachmentUrl: l.attachmentUrl ?? '',
        durationMin: l.durationMin != null ? String(l.durationMin) : '',
        sequence: l.sequence, isFreePreview: l.isFreePreview,
      },
    });
  }
  async function saveLesson(e: React.FormEvent) {
    e.preventDefault();
    if (!editor) return;
    setSaving(true);
    setError('');
    const payload = {
      ...editor.form,
      durationMin: editor.form.durationMin === '' ? null : Number(editor.form.durationMin),
    };
    try {
      if (editor.lessonId) {
        await api.put(`/hs-catalog/lessons/${editor.lessonId}`, payload);
      } else {
        await api.post(`/hs-catalog/modules/${editor.moduleId}/lessons`, payload);
      }
      setEditor(null);
      await load();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save the lesson.');
    } finally { setSaving(false); }
  }
  async function deleteLesson(l: Lesson) {
    if (!confirm(`Delete lesson "${l.title}"?`)) return;
    await api.delete(`/hs-catalog/lessons/${l.id}`);
    load();
  }

  if (loading) return <div className="py-24 text-center text-[14px] text-[#6B7280]">Loading…</div>;
  if (!course) return <div className="py-24 text-center text-[14px] text-[#6B7280]">Course not found.</div>;

  return (
    <div className="space-y-6">
      <Link href="/aipsa/homeschool" className="inline-flex items-center gap-1.5 text-[14px] text-[#6B7280] hover:text-[#1A1D23]">
        <ArrowLeft className="w-4 h-4" /> Back to catalog
      </Link>

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-5 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[26px] font-bold text-[#1A1D23]">{course.title}</h1>
          <p className="text-[14px] text-[#6B7280] mt-1">{course.gradeLevel} · {course.subject}</p>
        </div>
        <button onClick={togglePublish} className={`inline-flex items-center gap-2 text-[14px] font-medium px-4 h-[40px] rounded-lg shrink-0 ${course.isPublished ? 'bg-[#D6F0E4] text-[#0F6E56]' : 'bg-[#1D7A4A] text-white hover:bg-[#0B4D2E]'}`}>
          {course.isPublished ? <><EyeOff className="w-4 h-4" /> Unpublish</> : <><Eye className="w-4 h-4" /> Publish</>}
        </button>
      </div>

      {error && <div className="bg-[#FCEBEB] text-[#A32D2D] text-[13px] px-4 py-2.5 rounded-lg">{error}</div>}

      <div className="flex justify-between items-center">
        <h2 className="font-display text-[16px] font-semibold text-[#1A1D23]">Modules & lessons</h2>
        <button onClick={addModule} className="inline-flex items-center gap-1.5 text-[14px] font-medium text-[#1D7A4A] hover:underline">
          <Plus className="w-4 h-4" /> Add module
        </button>
      </div>

      {course.modules.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-12 text-center text-[14px] text-[#6B7280]">
          No modules yet. Click “Add module” to start.
        </div>
      ) : (
        <div className="space-y-4">
          {course.modules.map((m, mi) => (
            <div key={m.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#F7F8FA] flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <GripVertical className="w-4 h-4 text-[#D1D5DB]" />
                  <h3 className="font-display text-[15px] font-semibold text-[#1A1D23]">Module {mi + 1}: {m.title}</h3>
                </div>
                <div className="flex items-center gap-1">
                  <button onClick={() => openNewLesson(m)} className="inline-flex items-center gap-1 text-[13px] font-medium text-[#1D7A4A] hover:underline px-2"><Plus className="w-3.5 h-3.5" /> Lesson</button>
                  <button onClick={() => renameModule(m)} className="p-2 rounded-lg hover:bg-white text-[#6B7280]"><Pencil className="w-4 h-4" /></button>
                  <button onClick={() => deleteModule(m)} className="p-2 rounded-lg hover:bg-[#FCEBEB] text-[#A32D2D]"><Trash2 className="w-4 h-4" /></button>
                </div>
              </div>
              {m.lessons.length === 0 ? (
                <p className="px-5 py-4 text-[13px] text-[#9CA3AF]">No lessons in this module yet.</p>
              ) : (
                <ul>
                  {m.lessons.map((l) => (
                    <li key={l.id} className="px-5 py-3 flex items-center justify-between border-t border-[#F0F1F3] first:border-t-0">
                      <div className="flex items-center gap-3 min-w-0">
                        <PlayCircle className="w-4 h-4 text-[#1D7A4A] shrink-0" />
                        <div className="min-w-0">
                          <p className="text-[14px] font-medium text-[#1A1D23] truncate">{l.title}</p>
                          <p className="text-[12px] text-[#9CA3AF]">
                            {l.durationMin ? `${l.durationMin} min` : 'No duration'}{l.videoUrl ? ' · video' : ''}
                          </p>
                        </div>
                        {l.isFreePreview && <span className="text-[11px] font-semibold text-[#1D7A4A] bg-[#D6F0E4] px-2 py-0.5 rounded shrink-0">Free</span>}
                      </div>
                      <div className="flex items-center gap-1 shrink-0">
                        <button onClick={() => openEditLesson(m, l)} className="p-2 rounded-lg hover:bg-[#F7F8FA] text-[#6B7280]"><Pencil className="w-4 h-4" /></button>
                        <button onClick={() => deleteLesson(l)} className="p-2 rounded-lg hover:bg-[#FCEBEB] text-[#A32D2D]"><Trash2 className="w-4 h-4" /></button>
                      </div>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          ))}
        </div>
      )}

      {/* Lesson editor */}
      {editor && (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl w-[560px] max-w-[94vw] my-8 p-6">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[18px] font-semibold">{editor.lessonId ? 'Edit lesson' : 'New lesson'}</h3>
              <button onClick={() => setEditor(null)}><X className="w-5 h-5 text-gray-400" /></button>
            </div>
            <form onSubmit={saveLesson} className="space-y-4 mt-4">
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Title</label>
                <input required value={editor.form.title} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, title: e.target.value } })} className="w-full" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Short description</label>
                <input value={editor.form.description} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, description: e.target.value } })} className="w-full" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">YouTube video URL <span className="text-[#9CA3AF]">(optional)</span></label>
                <input value={editor.form.videoUrl} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, videoUrl: e.target.value } })} placeholder="https://www.youtube.com/watch?v=…" className="w-full" />
              </div>
              <div>
                <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Lesson text / notes <span className="text-[#9CA3AF]">(optional)</span></label>
                <textarea rows={4} value={editor.form.content} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, content: e.target.value } })} className="w-full" />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Worksheet URL <span className="text-[#9CA3AF]">(optional)</span></label>
                  <input value={editor.form.attachmentUrl} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, attachmentUrl: e.target.value } })} className="w-full" />
                </div>
                <div>
                  <label className="text-[13px] font-medium text-[#374151] mb-1.5 block">Duration (min)</label>
                  <input type="number" min="0" value={editor.form.durationMin} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, durationMin: e.target.value } })} className="w-full" />
                </div>
              </div>
              <label className="flex items-center gap-2 text-[14px] text-[#374151]">
                <input type="checkbox" checked={editor.form.isFreePreview} onChange={(e) => setEditor({ ...editor, form: { ...editor.form, isFreePreview: e.target.checked } })} className="w-4 h-4" />
                Free preview (open without a subscription)
              </label>
              <div className="flex justify-end gap-3 pt-3 border-t border-[#E5E7EB]">
                <button type="button" onClick={() => setEditor(null)} className="bg-white border border-[#E5E7EB] hover:bg-[#F7F8FA] text-[14px] font-medium px-4 h-[38px] rounded-lg">Cancel</button>
                <button type="submit" disabled={saving} className="bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-4 h-[38px] rounded-lg disabled:opacity-50">
                  {saving ? 'Saving…' : 'Save lesson'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
