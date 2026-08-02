'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, X, Search, FileText, CheckCircle, Calendar, GraduationCap, ClipboardList, BookOpen } from 'lucide-react';
import HolisticCardView from '@/components/HolisticCardView';
import ReportLetterhead from '@/components/ReportLetterhead';

type Tab = 'subjects' | 'exams' | 'marks' | 'reports' | 'progress';

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; }
interface Assignment { id: string; isPrimary: boolean; teacher: Teacher | null; section: SectionItem | null; }
interface Subject { id: string; name: string; code: string | null; class: { id: string; name: string }; teacher: { id: string; firstName: string; lastName: string } | null; teachers: Assignment[]; }
// One row of the teacher roster editor. sectionId '' means "all sections".
interface RosterRow { teacherId: string; sectionId: string; isPrimary: boolean; }
interface Exam { id: string; name: string; classId: string; class: { name: string }; startDate: string; maxMarks: number; passingMarks: number; status: string; academicYear: string; term: string | null; _count: { results: number }; }

const TERM_LABELS: Record<string, string> = { TERM_1: 'Term 1', TERM_2: 'Term 2', ANNUAL: 'Annual' };
interface Teacher { id: string; firstName: string; lastName: string; }

const GRADE_COLORS: Record<string, string> = { 
  'A+': 'text-emerald-700 bg-emerald-50 border border-emerald-200/50', 
  A: 'text-green-700 bg-green-50 border border-green-200/50', 
  'B+': 'text-blue-700 bg-blue-50 border border-blue-200/50', 
  B: 'text-blue-600 bg-blue-50 border border-blue-200/50', 
  C: 'text-yellow-700 bg-yellow-50 border border-yellow-200/50', 
  D: 'text-orange-700 bg-orange-50 border border-orange-200/50', 
  F: 'text-red-700 bg-red-50 border border-red-200/50' 
};

const STATUS_STYLES: Record<string, string> = { 
  SCHEDULED: 'bg-[#FAEEDA] text-[#854F0B] border border-[#FAEEDA]', 
  ONGOING: 'bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF]', 
  COMPLETED: 'bg-[#D6F0E4] text-[#0F6E56] border border-[#D6F0E4]' 
};

export default function ExamsPage() {
  const [tab, setTab] = useState<Tab>('subjects');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYear, setAcademicYear] = useState('');

  useEffect(() => {
    api.get('/sis/classes').then(r => setClasses(r.data)).catch(console.error);
    api.get('/schools/users', { params: { role: 'TEACHER', limit: 100 } }).then(r => setTeachers(r.data.users)).catch(console.error);
    api.get('/exams/academic-year').then(r => setAcademicYear(r.data.academicYear)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Examinations</h1>
          {academicYear && <p className="text-sm text-gray-500 mt-1 font-body">Academic Term: <span className="font-semibold text-gray-700">{academicYear}</span></p>}
        </div>
      </div>

      <div className="flex gap-1 bg-[#F3F4F6] p-1.5 rounded-xl w-fit border border-[#E5E7EB]">
        {([['subjects','Subjects'],['exams','Exams'],['marks','Marks Entry'],['reports','Report Cards'],['progress','Progress Card']] as [Tab,string][]).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-gray-500 hover:text-gray-950'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'subjects' && <SubjectsTab classes={classes} teachers={teachers} />}
      {tab === 'exams' && <ExamsTab classes={classes} academicYear={academicYear} />}
      {tab === 'marks' && <MarksEntryTab classes={classes} academicYear={academicYear} />}
      {tab === 'reports' && <ReportCardsTab classes={classes} academicYear={academicYear} />}
      {tab === 'progress' && <HolisticCardTab classes={classes} academicYear={academicYear} />}
    </div>
  );
}

// ─── Subjects Tab ─────────────────────────────────────────────────────────────

// Teacher roster editor: one row per teacher, each optionally pinned to a section.
// Shared by the "map new subject" form and the inline edit panel.
function RosterEditor({ roster, setRoster, teachers, sections, scopeNote }: {
  roster: RosterRow[];
  setRoster: (rows: RosterRow[]) => void;
  teachers: Teacher[];
  sections: SectionItem[];
  scopeNote?: string;
}) {
  function update(idx: number, patch: Partial<RosterRow>) {
    setRoster(roster.map((r, i) => (i === idx ? { ...r, ...patch } : r)));
  }

  // Exactly one primary: it becomes the subject's single owning teacher for the
  // timetable generator and report cards.
  function setPrimary(idx: number) {
    setRoster(roster.map((r, i) => ({ ...r, isPrimary: i === idx })));
  }

  function remove(idx: number) {
    const next = roster.filter((_, i) => i !== idx);
    if (next.length > 0 && !next.some(r => r.isPrimary)) next[0].isPrimary = true;
    setRoster(next);
  }

  return (
    <div className="space-y-2">
      <div className="flex items-baseline justify-between">
        <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 font-body">Teachers</label>
        {sections.length === 0 && (
          <span className="text-[11px] text-gray-400 font-body">
            {scopeNote || 'No sections in this class — teachers apply class-wide.'}
          </span>
        )}
      </div>

      {roster.length === 0 && (
        <p className="text-xs text-gray-400 font-body py-2">No teacher assigned yet.</p>
      )}

      <div className="space-y-2">
        {roster.map((row, idx) => {
          // Same teacher may appear twice only if pinned to different sections.
          const taken = roster.some((r, i) => i !== idx && r.teacherId === row.teacherId && r.sectionId === row.sectionId);
          return (
            <div key={idx} className="flex flex-wrap items-center gap-2">
              <select
                value={row.teacherId}
                onChange={e => update(idx, { teacherId: e.target.value })}
                className={`flex-1 min-w-[170px] border rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 bg-white transition-all font-body ${taken ? 'border-red-300' : 'border-[#E5E7EB]'}`}
              >
                <option value="">Select teacher</option>
                {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
              </select>

              <select
                value={row.sectionId}
                onChange={e => update(idx, { sectionId: e.target.value })}
                disabled={sections.length === 0}
                className="w-[150px] border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 bg-white transition-all font-body disabled:bg-gray-50 disabled:text-gray-400"
              >
                <option value="">All sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>

              <label className="flex items-center gap-1.5 text-xs text-gray-600 font-body px-1 cursor-pointer" title="The primary teacher owns this subject in the timetable and on report cards">
                <input
                  type="radio"
                  checked={row.isPrimary}
                  onChange={() => setPrimary(idx)}
                  className="accent-[#1D7A4A]"
                />
                Primary
              </label>

              <button
                type="button"
                onClick={() => remove(idx)}
                className="p-2 text-gray-400 hover:text-red-650 hover:bg-gray-100 rounded-lg transition-colors"
                title="Remove teacher"
              >
                <X className="w-3.5 h-3.5" strokeWidth={1.75} />
              </button>
            </div>
          );
        })}
      </div>

      <button
        type="button"
        onClick={() => setRoster([...roster, { teacherId: '', sectionId: '', isPrimary: roster.length === 0 }])}
        className="inline-flex items-center gap-1.5 text-xs font-semibold text-[#1D7A4A] hover:text-[#155D37] transition-colors"
      >
        <Plus className="w-3.5 h-3.5" strokeWidth={2} /> Add teacher
      </button>
    </div>
  );
}

function rosterFromSubject(s: Subject): RosterRow[] {
  if (s.teachers && s.teachers.length > 0) {
    return s.teachers
      .filter(a => a.teacher)
      .map(a => ({ teacherId: a.teacher!.id, sectionId: a.section?.id || '', isPrimary: a.isPrimary }));
  }
  // Subject created before multi-teacher support.
  return s.teacher ? [{ teacherId: s.teacher.id, sectionId: '', isPrimary: true }] : [];
}

// Drops incomplete rows and strips the '' sentinel the selects use for "all sections".
function rosterToPayload(roster: RosterRow[]) {
  return roster
    .filter(r => r.teacherId)
    .map(r => ({ teacherId: r.teacherId, sectionId: r.sectionId || null, isPrimary: r.isPrimary }));
}

function SubjectsTab({ classes, teachers }: { classes: ClassItem[]; teachers: Teacher[] }) {
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [classFilter, setClassFilter] = useState('');
  const [form, setForm] = useState({ name: '', code: '' });
  // The same subject is usually created for several classes at once.
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [formRoster, setFormRoster] = useState<RosterRow[]>([]);
  const [notice, setNotice] = useState('');
  const [editId, setEditId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState({ name: '', code: '' });
  const [editRoster, setEditRoster] = useState<RosterRow[]>([]);
  const [sectionsByClass, setSectionsByClass] = useState<Record<string, SectionItem[]>>({});
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const params: any = {};
    if (classFilter) params.classId = classFilter;
    const { data } = await api.get('/exams/subjects', { params });
    setSubjects(data);
  }, [classFilter]);

  useEffect(() => { load(); }, [load]);

  // Sections are needed to pin a teacher to 6-A rather than all of Class 6.
  const loadSections = useCallback(async (classId: string) => {
    if (!classId || sectionsByClass[classId]) return;
    try {
      const { data } = await api.get(`/sis/classes/${classId}/sections`);
      setSectionsByClass(prev => ({ ...prev, [classId]: data }));
    } catch {
      setSectionsByClass(prev => ({ ...prev, [classId]: [] }));
    }
  }, [sectionsByClass]);

  // Sections can only be picked when the subject targets exactly one class,
  // since a section belongs to one class. Changing the selection clears them.
  function toggleClass(classId: string) {
    const next = formClassIds.includes(classId)
      ? formClassIds.filter(id => id !== classId)
      : [...formClassIds, classId];
    setFormClassIds(next);
    setFormRoster(rows => rows.map(r => ({ ...r, sectionId: '' })));
    if (next.length === 1) loadSections(next[0]);
  }

  function toggleAllClasses() {
    setFormRoster(rows => rows.map(r => ({ ...r, sectionId: '' })));
    setFormClassIds(formClassIds.length === classes.length ? [] : classes.map(c => c.id));
  }

  function startEdit(s: Subject) {
    setEditId(s.id);
    setEditForm({ name: s.name, code: s.code || '' });
    setEditRoster(rosterFromSubject(s));
    loadSections(s.class.id);
  }

  async function handleAdd(e: React.FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if (formClassIds.length === 0) { setError('Select at least one class.'); return; }
    try {
      const { data } = await api.post('/exams/subjects/bulk', {
        ...form,
        classIds: formClassIds,
        teachers: rosterToPayload(formRoster),
      });
      setForm({ name: '', code: '' });
      setFormClassIds([]);
      setFormRoster([]);
      const parts = [`Created for ${data.created.length} class${data.created.length === 1 ? '' : 'es'}.`];
      if (data.skipped.length > 0) parts.push(`Already existed in ${data.skipped.join(', ')} — skipped.`);
      setNotice(parts.join(' '));
      load();
    }
    catch (err: any) { setError(err.response?.data?.error || 'Error adding subject.'); }
  }

  async function handleUpdate(id: string) {
    setError('');
    try {
      await api.put(`/exams/subjects/${id}`, { ...editForm, teachers: rosterToPayload(editRoster) });
      setEditId(null);
      load();
    }
    catch (err: any) { setError(err.response?.data?.error || 'Error updating.'); }
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this subject?')) return;
    try { await api.delete(`/exams/subjects/${id}`); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Cannot delete.'); }
  }

  const grouped = subjects.reduce((acc, s) => {
    const key = s.class.name;
    if (!acc[key]) acc[key] = [];
    acc[key].push(s);
    return acc;
  }, {} as Record<string, Subject[]>);

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      {notice && (
        <div className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="p-1 hover:bg-[#0F6E56]/10 rounded transition-colors">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-body">Map New Subject</p>
        <form onSubmit={handleAdd} className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="col-span-1 sm:col-span-2 order-first">
            <div className="flex items-baseline justify-between mb-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 font-body">
                Classes * <span className="text-gray-400 normal-case font-normal tracking-normal">({formClassIds.length} selected)</span>
              </label>
              {classes.length > 0 && (
                <button type="button" onClick={toggleAllClasses}
                  className="text-xs font-semibold text-[#1D7A4A] hover:text-[#155D37] transition-colors">
                  {formClassIds.length === classes.length ? 'Clear all' : 'Select all'}
                </button>
              )}
            </div>
            <div className="flex flex-wrap gap-2">
              {classes.map(c => {
                const on = formClassIds.includes(c.id);
                return (
                  <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                    className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all font-body ${
                      on ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                    }`}>
                    {c.name}
                  </button>
                );
              })}
            </div>
            <p className="text-[11px] text-gray-400 mt-1.5 font-body">
              One subject row is created per class. Classes that already have this subject are skipped.
            </p>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Subject Name *</label>
            <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Code (optional)</label>
            <input value={form.code} onChange={e => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH"
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
          </div>
          <div className="col-span-1 sm:col-span-2 pt-3 border-t border-[#E5E7EB]">
            <RosterEditor
              roster={formRoster}
              setRoster={setFormRoster}
              teachers={teachers}
              sections={formClassIds.length === 1 ? (sectionsByClass[formClassIds[0]] || []) : []}
              scopeNote={
                formClassIds.length > 1
                  ? 'Teachers apply to every selected class. Pin them to a section afterwards by editing one subject.'
                  : undefined
              }
            />
          </div>
          <div className="col-span-1 sm:col-span-2 pt-2 border-t border-[#E5E7EB]">
            <button type="submit" className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all">
              Map Subject
            </button>
          </div>
        </form>
      </div>

      <div className="flex flex-wrap gap-2 border-b border-[#E5E7EB] pb-3">
        <button onClick={() => setClassFilter('')} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${!classFilter ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>All Classes</button>
        {classes.map(c => (
          <button key={c.id} onClick={() => setClassFilter(c.id)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${classFilter === c.id ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>{c.name}</button>
        ))}
      </div>

      <div className="space-y-4">
        {Object.entries(grouped).map(([className, subs]) => (
          <div key={className} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <p className="text-sm font-bold text-gray-800 font-display">{className} <span className="text-gray-400 font-normal text-xs font-body">({subs.length} subjects)</span></p>
            </div>
            <div className="divide-y divide-[#E5E7EB]">
              {subs.map(s => (
                <div key={s.id} className="px-4 py-3.5 flex items-start justify-between gap-4 hover:bg-gray-50/50 transition-colors">
                  {editId === s.id ? (
                    <form className="flex-1 space-y-3" onSubmit={e => { e.preventDefault(); handleUpdate(s.id); }}>
                      <div className="flex flex-wrap gap-2 items-center">
                        <input value={editForm.name} onChange={e => setEditForm({ ...editForm, name: e.target.value })} className="flex-1 min-w-[150px] border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 font-body" placeholder="Subject name" required />
                        <input value={editForm.code} onChange={e => setEditForm({ ...editForm, code: e.target.value })} className="w-24 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 font-body" placeholder="Code" />
                      </div>
                      <RosterEditor
                        roster={editRoster}
                        setRoster={setEditRoster}
                        teachers={teachers}
                        sections={sectionsByClass[s.class.id] || []}
                      />
                      <div className="flex gap-2 pt-1">
                        <button type="submit" className="px-3 py-1.5 bg-[#1D7A4A] text-white rounded-lg text-xs font-semibold transition-all">Save</button>
                        <button type="button" onClick={() => setEditId(null)} className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold text-gray-600 hover:bg-white transition-all">Cancel</button>
                      </div>
                    </form>
                  ) : (
                    <>
                      <div className="flex-1 space-y-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="font-semibold text-sm text-gray-800 font-display">{s.name}</span>
                          {s.code && <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-mono font-bold uppercase">{s.code}</span>}
                        </div>
                        <div className="flex items-center gap-1.5 flex-wrap">
                          {s.teachers.filter(a => a.teacher).map(a => (
                            <span key={a.id} className={`text-[11px] px-2 py-0.5 rounded-full font-body border ${a.isPrimary ? 'bg-[#D6F0E4] border-[#26A96B]/20 text-[#0F6E56] font-semibold' : 'bg-gray-50 border-gray-200 text-gray-600'}`}>
                              {a.teacher!.firstName} {a.teacher!.lastName}
                              {a.section && <span className="text-gray-400"> · Sec {a.section.name}</span>}
                            </span>
                          ))}
                          {s.teachers.filter(a => a.teacher).length === 0 && (
                            <span className="text-xs text-gray-400 font-body">No teacher assigned</span>
                          )}
                        </div>
                      </div>
                      <div className="flex gap-1 shrink-0">
                        <button onClick={() => startEdit(s)} className="p-1.5 text-gray-400 hover:text-[#1D7A4A] hover:bg-gray-100 rounded transition-colors" title="Edit Subject">
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                        <button onClick={() => handleDelete(s.id)} className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-gray-100 rounded transition-colors" title="Delete Subject">
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                        </button>
                      </div>
                    </>
                  )}
                </div>
              ))}
            </div>
          </div>
        ))}
        {subjects.length === 0 && <p className="text-center text-gray-400 text-sm py-10 font-body">No subjects yet. Map your first subject above.</p>}
      </div>
    </div>
  );
}

// ─── Exams Tab ────────────────────────────────────────────────────────────────

function ExamsTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', term: '', startDate: '', endDate: '', maxMarks: '100', passingMarks: '35' });
  // The same exam term is usually scheduled for several classes at once.
  const [formClassIds, setFormClassIds] = useState<string[]>([]);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const load = useCallback(async () => {
    const { data } = await api.get('/exams/exams');
    setExams(data);
  }, []);

  useEffect(() => { load(); }, [load]);

  function toggleClass(classId: string) {
    setFormClassIds(prev => prev.includes(classId) ? prev.filter(id => id !== classId) : [...prev, classId]);
  }

  function toggleAllClasses() {
    setFormClassIds(prev => prev.length === classes.length ? [] : classes.map(c => c.id));
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault(); setError(''); setNotice('');
    if (formClassIds.length === 0) { setError('Select at least one class.'); return; }
    try {
      const { data } = await api.post('/exams/exams/bulk', { ...form, classIds: formClassIds });
      setShowForm(false);
      setForm({ name: '', term: '', startDate: '', endDate: '', maxMarks: '100', passingMarks: '35' });
      setFormClassIds([]);
      const parts = [`Created for ${data.created.length} class${data.created.length === 1 ? '' : 'es'}.`];
      if (data.skipped.length > 0) parts.push(`${data.skipped.join(', ')} already had this term — skipped.`);
      setNotice(parts.join(' '));
      load();
    }
    catch (err: any) { setError(err.response?.data?.error || 'Error creating exam.'); }
  }

  async function updateStatus(id: string, status: string) {
    await api.put(`/exams/exams/${id}`, { status });
    load();
  }

  async function handleDelete(id: string) {
    if (!confirm('Delete this exam and all its results?')) return;
    try { await api.delete(`/exams/exams/${id}`); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error.'); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {notice && (
        <div className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{notice}</span>
          <button onClick={() => setNotice('')} className="p-1 hover:bg-[#0F6E56]/10 rounded transition-colors"><X className="w-4 h-4" /></button>
        </div>
      )}

      <div className="flex justify-end">
        <button onClick={() => setShowForm(true)} className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white h-[38px] px-4 rounded-lg font-semibold transition-colors duration-150 text-[13px]">
          <Plus className="w-4 h-4" strokeWidth={2} />
          <span>Create Exam Term</span>
        </button>
      </div>

      {showForm && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <div className="flex items-center justify-between pb-3 border-b border-[#E5E7EB]">
            <h3 className="text-base font-semibold text-gray-800 font-display">New Examination Term</h3>
            <button onClick={() => setShowForm(false)} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"><X className="w-4 h-4" /></button>
          </div>
          <form onSubmit={handleCreate} className="space-y-4 font-body">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Exam Name *</label>
                <input required value={form.name} onChange={e => setForm({ ...form, name: e.target.value })} placeholder="e.g. First Term Exam"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
              <div className="col-span-1 sm:col-span-2">
                <div className="flex items-baseline justify-between mb-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500">
                    Classes * <span className="text-gray-400 normal-case font-normal tracking-normal">({formClassIds.length} selected)</span>
                  </label>
                  {classes.length > 0 && (
                    <button type="button" onClick={toggleAllClasses}
                      className="text-xs font-semibold text-[#1D7A4A] hover:text-[#155D37] transition-colors">
                      {formClassIds.length === classes.length ? 'Clear all' : 'Select all'}
                    </button>
                  )}
                </div>
                <div className="flex flex-wrap gap-2">
                  {classes.map(c => {
                    const on = formClassIds.includes(c.id);
                    return (
                      <button key={c.id} type="button" onClick={() => toggleClass(c.id)}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold border transition-all ${
                          on ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                        }`}>
                        {c.name}
                      </button>
                    );
                  })}
                </div>
                <p className="text-[11px] text-gray-400 mt-1.5">
                  One exam is created per selected class. Classes that already have this progress card term are skipped.
                </p>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Progress Card Term</label>
                <select value={form.term} onChange={e => setForm({ ...form, term: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all">
                  <option value="">None — class test (hidden from progress card)</option>
                  <option value="TERM_1">Term 1</option>
                  <option value="TERM_2">Term 2</option>
                  <option value="ANNUAL">Annual</option>
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Start Date *</label>
                <input type="date" required value={form.startDate} onChange={e => setForm({ ...form, startDate: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">End Date</label>
                <input type="date" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Max Marks per Subject</label>
                <input type="number" value={form.maxMarks} onChange={e => setForm({ ...form, maxMarks: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1">Passing Marks</label>
                <input type="number" value={form.passingMarks} onChange={e => setForm({ ...form, passingMarks: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-[#E5E7EB]">
              <button type="submit" className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all">Create Exam</button>
              <button type="button" onClick={() => setShowForm(false)} className="px-5 py-2 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </form>
        </div>
      )}

      <div className="space-y-3">
        {exams.map(exam => (
          <div key={exam.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm hover:border-gray-300 transition-all">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
              <div className="space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <p className="font-semibold text-[#1A1D23] font-display text-base">{exam.name}</p>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${STATUS_STYLES[exam.status] || 'bg-gray-100 text-gray-600'}`}>{exam.status}</span>
                  {exam.term && <span className="text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase bg-[#E5F6EE] text-[#1D7A4A] border border-[#1D7A4A]/15">{TERM_LABELS[exam.term] || exam.term} · Progress Card</span>}
                </div>
                <p className="text-xs text-gray-500 font-body">
                  Class {exam.class.name} · Starts {new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · Max Score: <span className="font-semibold text-gray-700">{exam.maxMarks}</span> · Pass Score: <span className="font-semibold text-gray-700">{exam.passingMarks}</span>
                </p>
                <p className="text-xs text-gray-400 font-body">{exam._count.results} result records entered</p>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                {exam.status === 'SCHEDULED' && <button onClick={() => updateStatus(exam.id, 'ONGOING')} className="text-xs font-semibold px-3 py-1.5 bg-[#EEF2FF] text-[#4338CA] border border-[#EEF2FF] rounded-lg hover:bg-[#EEF2FF]/80 transition-all">Start Exam</button>}
                {exam.status === 'ONGOING' && <button onClick={() => updateStatus(exam.id, 'COMPLETED')} className="text-xs font-semibold px-3 py-1.5 bg-[#D6F0E4] text-[#0F6E56] border border-[#26A96B]/20 rounded-lg hover:bg-[#D6F0E4]/80 transition-all">Complete Term</button>}
                <button onClick={() => handleDelete(exam.id)} className="p-1.5 text-gray-400 hover:text-red-650 hover:bg-gray-100 rounded-lg transition-colors" title="Delete Exam"><Trash2 className="w-4 h-4" strokeWidth={1.75} /></button>
              </div>
            </div>
          </div>
        ))}
        {exams.length === 0 && <p className="text-center text-gray-400 text-sm py-10 font-body">No examinations scheduled yet.</p>}
      </div>
    </div>
  );
}

// ─── Marks Entry Tab ──────────────────────────────────────────────────────────

function MarksEntryTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [exams, setExams] = useState<Exam[]>([]);
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [selectedExam, setSelectedExam] = useState('');
  const [selectedSubject, setSelectedSubject] = useState('');
  const [entries, setEntries] = useState<any[]>([]);
  const [marks, setMarks] = useState<Record<string, { marks: string; absent: boolean; remarks: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [examInfo, setExamInfo] = useState<any>(null);

  useEffect(() => {
    api.get('/exams/exams').then(r => setExams(r.data)).catch(console.error);
  }, []);

  async function loadSubjectsForExam(examId: string) {
    const exam = exams.find(e => e.id === examId);
    if (!exam) return;
    setExamInfo(exam);
    const { data } = await api.get('/exams/subjects', { params: { classId: exam.classId } });
    setSubjects(data);
    setSelectedSubject('');
    setEntries([]);
  }

  async function loadMarksEntry() {
    if (!selectedExam || !selectedSubject) return;
    setLoading(true);
    try {
      const { data } = await api.get(`/exams/exams/${selectedExam}/marks/${selectedSubject}`);
      setEntries(data.entries);
      const m: typeof marks = {};
      data.entries.forEach(({ student, result }: any) => {
        m[student.id] = {
          marks: result?.marksObtained !== null && result?.marksObtained !== undefined ? String(result.marksObtained) : '',
          absent: result?.isAbsent || false,
          remarks: result?.remarks || '',
        };
      });
      setMarks(m);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (selectedExam && selectedSubject) loadMarksEntry(); }, [selectedExam, selectedSubject]);

  function calcGrade(m: string, maxMarks: number): string {
    const n = parseFloat(m);
    if (isNaN(n)) return '';
    const pct = (n / maxMarks) * 100;
    if (pct >= 90) return 'A+'; if (pct >= 80) return 'A'; if (pct >= 70) return 'B+';
    if (pct >= 60) return 'B'; if (pct >= 50) return 'C'; if (pct >= 40) return 'D'; return 'F';
  }

  async function handleSave() {
    setSaving(true);
    try {
      const records = entries.map(({ student }) => ({
        studentId: student.id,
        marksObtained: marks[student.id]?.absent ? null : (marks[student.id]?.marks || null),
        isAbsent: marks[student.id]?.absent || false,
        remarks: marks[student.id]?.remarks || null,
      }));
      await api.post(`/exams/exams/${selectedExam}/marks/${selectedSubject}`, { records });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Exam Term</label>
            <select value={selectedExam} onChange={e => { setSelectedExam(e.target.value); loadSubjectsForExam(e.target.value); }}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
              <option value="">Select exam</option>
              {exams.map(e => <option key={e.id} value={e.id}>{e.name} ({e.class.name})</option>)}
            </select>
          </div>
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Subject</label>
            <select value={selectedSubject} onChange={e => setSelectedSubject(e.target.value)} disabled={!selectedExam || subjects.length === 0}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body disabled:bg-gray-50">
              <option value="">Select subject</option>
              {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
            </select>
          </div>
        </div>
      </div>

      {loading && <div className="py-10 text-center text-gray-400 font-body text-sm">Loading exam roster...</div>}

      {entries.length > 0 && examInfo && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
            <div className="px-4 py-3 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
              <p className="text-xs font-semibold text-gray-500 font-body">
                {entries.length} students rostered · Max Marks: <span className="font-bold text-gray-700">{examInfo.maxMarks}</span> · Pass: <span className="font-bold text-gray-700">{examInfo.passingMarks}</span>
              </p>
              <button onClick={() => { const m = { ...marks }; entries.forEach(({ student }) => { m[student.id] = { ...m[student.id], absent: true, marks: '' }; }); setMarks(m); }} className="text-xs font-semibold px-2 py-1 bg-red-50 text-red-600 rounded border border-red-200 hover:bg-red-100 transition-colors">
                Mark All Absent
              </button>
            </div>
            <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">#</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Student</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body text-center">Absent</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body text-center">Marks / {examInfo.maxMarks}</th>
                  <th className="px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body text-center">Grade</th>
                  <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Remarks</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {entries.map(({ student }, i) => {
                  const m = marks[student.id] || { marks: '', absent: false, remarks: '' };
                  const grade = !m.absent && m.marks ? calcGrade(m.marks, examInfo.maxMarks) : '';
                  return (
                    <tr key={student.id} className={`${m.absent ? 'bg-red-50/20' : 'hover:bg-gray-50/50'} transition-all`}>
                      <td className="px-4 py-3 text-gray-400 text-xs font-mono">{i + 1}</td>
                      <td className="px-4 py-3">
                        <p className="font-semibold text-[#1A1D23] font-display">{student.firstName} {student.lastName}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{student.admissionNumber}</p>
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="checkbox" checked={m.absent} onChange={e => setMarks(prev => ({ ...prev, [student.id]: { ...m, absent: e.target.checked, marks: e.target.checked ? '' : m.marks } }))} className="rounded border-gray-300 text-[#1D7A4A] focus:ring-[#1D7A4A]/20" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        <input type="number" min="0" max={examInfo.maxMarks} step="0.5" disabled={m.absent} value={m.marks}
                          onChange={e => setMarks(prev => ({ ...prev, [student.id]: { ...m, marks: e.target.value } }))}
                          className="w-20 border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] disabled:bg-gray-150 font-mono" />
                      </td>
                      <td className="px-4 py-3 text-center">
                        {grade && <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${GRADE_COLORS[grade] || ''}`}>{grade}</span>}
                        {m.absent && <span className="text-[11px] font-bold px-2 py-0.5 bg-red-100 text-red-700 rounded border border-red-200">ABSENT</span>}
                      </td>
                      <td className="px-4 py-3">
                        <input value={m.remarks} onChange={e => setMarks(prev => ({ ...prev, [student.id]: { ...m, remarks: e.target.value } }))}
                          placeholder="Optional notes" className="w-full border border-transparent hover:border-[#E5E7EB] focus:border-[#1D7A4A] rounded-lg px-2 py-1.5 text-xs focus:outline-none bg-transparent hover:bg-white focus:bg-white transition-all font-body" />
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
          </div>
          <div className="flex items-center gap-3 pt-2">
            <button onClick={handleSave} disabled={saving} className="px-6 py-2.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all shadow-xs disabled:opacity-60">
              {saving ? 'Saving Records...' : 'Save Marks Grid'}
            </button>
            {saved && <span className="text-[#0F6E56] font-semibold text-sm flex items-center gap-1">✓ Marks successfully committed.</span>}
          </div>
        </div>
      )}

      {selectedExam && selectedSubject && !loading && entries.length === 0 && (
        <p className="text-center text-gray-400 text-sm py-10 font-body">No active students registered inside this exam's academic class.</p>
      )}
    </div>
  );
}

// ─── Report Cards Tab ─────────────────────────────────────────────────────────

// Class → student chooser shared by the two report tabs (exam report card and
// holistic progress card), which differ only in what they render once a student
// is picked.
function StudentPicker({ classes, ctaLabel, onSelect }: { classes: ClassItem[]; ctaLabel: string; onSelect: (student: any) => void }) {
  const [classId, setClassId] = useState('');
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<any[]>([]);

  useEffect(() => {
    if (!classId) { setStudents([]); return; }
    api.get('/sis/students', { params: { classId, status: 'ACTIVE', limit: 200 } })
      .then(r => setStudents(r.data.students)).catch(console.error);
  }, [classId]);

  const filtered = students.filter(s =>
    !search || `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(search.toLowerCase())
  );

  return (
        <div className="space-y-4">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row gap-4">
            <div className="w-full sm:w-64">
              <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Filter by Class</label>
              <select value={classId} onChange={e => { setClassId(e.target.value); setSearch(''); }}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                <option value="">Select class</option>
                {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            {classId && (
              <div className="flex-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body font-semibold">Search Student</label>
                <div className="relative">
                  <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search by student name or registration number..."
                    className="w-full pl-9 border border-[#E5E7EB] rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body bg-white" />
                  <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" />
                </div>
              </div>
            )}
          </div>
          
          {filtered.length > 0 && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto shadow-sm">
              <table className="w-full min-w-[720px] text-sm">
                <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                  <tr>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Student Name</th>
                    <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Admission No.</th>
                    <th className="px-4 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB]">
                  {filtered.map(s => (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-4 py-3.5 font-semibold text-gray-900 font-display">{s.firstName} {s.lastName}</td>
                      <td className="px-4 py-3.5 font-mono text-xs text-gray-500 font-semibold">{s.admissionNumber}</td>
                      <td className="px-4 py-3.5 text-right"><button onClick={() => onSelect(s)} className="text-xs font-bold text-[#1D7A4A] hover:underline font-body">{ctaLabel}</button></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
  );
}

function ReportCardsTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [selected, setSelected] = useState<any>(null);
  const [reportCard, setReportCard] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  async function loadReportCard(student: any) {
    setSelected(student); setLoading(true);
    try {
      const { data } = await api.get(`/exams/report-card/${student.id}`, { params: { academicYear } });
      setReportCard(data);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {!selected ? (
        <StudentPicker classes={classes} ctaLabel="Inspect Report Card →" onSelect={loadReportCard} />
      ) : (
        <div className="space-y-4">
          <button onClick={() => { setSelected(null); setReportCard(null); }} className="text-sm font-semibold text-[#1A1D23] hover:text-[#1D7A4A] flex items-center gap-1.5 transition-colors font-body">
            <span>← Return to Student List</span>
          </button>

          {loading && <div className="py-12 text-center text-gray-400 font-body text-sm">Generating academic report card...</div>}

          {reportCard && (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
              {/* Header */}
              <div className="bg-[#1A1D23] text-white px-6 py-6 text-center space-y-3">
                <ReportLetterhead align="center" tone="dark" title="Official Report Card" />
                {/* Deliberately a <p>, not a heading: globals.css pins every h1–h3 to the
                    dark body colour with an !important size, which on this band renders
                    the student's name invisible. */}
                <p className="text-2xl font-bold font-display tracking-tight text-white pt-3 border-t border-white/10">{reportCard.student.firstName} {reportCard.student.lastName}</p>
                <div className="flex justify-center items-center gap-2 text-xs text-gray-400 font-body flex-wrap">
                  <span>Class {reportCard.student.class?.name || '—'}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                  <span className="font-mono">{reportCard.student.admissionNumber}</span>
                  <span className="w-1.5 h-1.5 rounded-full bg-gray-600" />
                  <span>Term: {reportCard.academicYear}</span>
                </div>
              </div>

              {reportCard.examSummaries.length === 0 && (
                <p className="text-center text-gray-400 text-sm py-12 font-body">No completed examinations recorded for {reportCard.academicYear}.</p>
              )}

              {reportCard.examSummaries.map((es: any) => (
                <div key={es.exam.id} className="border-t border-[#E5E7EB]">
                  <div className="px-6 py-3.5 bg-[#F8FAFC] border-b border-[#E5E7EB] flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                    <p className="font-bold text-gray-800 text-sm font-display">{es.exam.name}</p>
                    <div className="flex items-center gap-3 font-body">
                      <span className="text-xs text-gray-500 font-medium">Aggregate: <span className="font-bold text-gray-700">{es.totalMarks}</span> / {es.maxPossible}</span>
                      <span className="w-1.5 h-1.5 rounded-full bg-gray-300" />
                      <span className="text-xs font-bold text-gray-800 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">{es.percentage}%</span>
                      {es.overallGrade && <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${GRADE_COLORS[es.overallGrade] || ''}`}>GRADE {es.overallGrade}</span>}
                    </div>
                  </div>
                  <div className="overflow-x-auto">
                  <table className="w-full min-w-[560px] text-sm">
                    <thead className="border-b border-[#E5E7EB] bg-gray-55">
                      <tr>
                        <th className="text-left px-6 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">Subject</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">Score</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">Max</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">%</th>
                        <th className="text-center px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">Grade</th>
                        <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-400 uppercase tracking-wider font-body">Remarks</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-[#E5E7EB]">
                      {es.results.map((r: any) => {
                        const pct = r.isAbsent || r.marksObtained === null ? null : Math.round((r.marksObtained / es.exam.maxMarks) * 100);
                        return (
                          <tr key={r.id} className={r.isAbsent ? 'bg-red-50/15' : 'hover:bg-gray-50/20'}>
                            <td className="px-6 py-3 font-semibold text-gray-800 font-display">{r.subject.name}</td>
                            <td className="px-4 py-3 text-center font-mono text-sm font-semibold">{r.isAbsent ? <span className="text-red-600 bg-red-50 border border-red-200 px-2 py-0.5 rounded text-xs font-bold uppercase">Absent</span> : (r.marksObtained ?? '—')}</td>
                            <td className="px-4 py-3 text-center text-gray-400 font-mono">{es.exam.maxMarks}</td>
                            <td className="px-4 py-3 text-center text-gray-600 font-mono">{pct !== null ? `${pct}%` : '—'}</td>
                            <td className="px-4 py-3 text-center">
                              {r.grade && <span className={`text-[11px] font-bold px-2 py-0.5 rounded ${GRADE_COLORS[r.grade] || ''}`}>{r.grade}</span>}
                            </td>
                            <td className="px-4 py-3 text-gray-500 font-body text-xs">{r.remarks || '—'}</td>
                          </tr>
                        );
                      })}
                      {es.results.length === 0 && <tr><td colSpan={6} className="px-6 py-4 text-center text-gray-400 text-xs font-body">No exam results recorded for this segment.</td></tr>}
                    </tbody>
                  </table>
                  </div>
                </div>
              ))}

              <div className="px-6 py-4 bg-[#F8FAFC] border-t border-[#E5E7EB]">
                <p className="text-[11px] text-gray-400 text-center font-body">
                  Grade scale threshold details: A+ (≥90%) · A (≥80%) · B+ (≥70%) · B (≥60%) · C (≥50%) · D (≥40%) · F (&lt;40%)
                </p>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Holistic Progress Card Tab ───────────────────────────────────────────────

// The year-long card families see in their portal (scholastic + CCA + conduct +
// remarks), rendered here from the same component so staff review exactly what is
// published — including terms still in draft, which the portals hide.
function HolisticCardTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [selected, setSelected] = useState<any>(null);

  return (
    <div className="max-w-4xl space-y-6">
      {!selected ? (
        <StudentPicker classes={classes} ctaLabel="View Progress Card →" onSelect={setSelected} />
      ) : (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <button onClick={() => setSelected(null)} className="text-sm font-semibold text-[#1A1D23] hover:text-[#1D7A4A] flex items-center gap-1.5 transition-colors font-body">
              <span>← Return to Student List</span>
            </button>
            <p className="text-xs text-gray-500 font-body">
              <span className="font-semibold text-gray-700 font-display">{selected.firstName} {selected.lastName}</span>
              <span className="text-gray-300 mx-1.5">·</span>
              <span className="font-mono">{selected.admissionNumber}</span>
            </p>
          </div>
          <HolisticCardView key={`${selected.id}:${academicYear}`} studentId={selected.id} academicYear={academicYear || undefined} />
        </div>
      )}
    </div>
  );
}
