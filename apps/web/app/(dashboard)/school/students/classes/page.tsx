'use client';

import { useEffect, useRef, useState } from 'react';
import api from '@/lib/api';
import {
  GraduationCap,
  Plus,
  Edit2,
  Trash2,
  ChevronDown,
  ChevronUp,
  Layers,
  Users,
  Check,
  X,
  Activity,
  RefreshCw,
  Copy,
  Link2,
  UserCheck,
  AlertTriangle,
  Loader2,
} from 'lucide-react';

interface Teacher {
  id: string;
  firstName: string;
  lastName: string;
}

interface ClassItem {
  id: string;
  name: string;
  joinCode: string | null;
  inchargeTeacher: Teacher | null;
  _count: { sections: number; students: number };
}

interface Section {
  id: string;
  name: string;
  inchargeTeacher: Teacher | null;
  _count: { students: number };
}

interface DeleteImpact {
  target: { id: string; name: string; type: 'class' | 'section'; className: string };
  counts: Record<string, number>;
}

interface DeleteTarget {
  type: 'class' | 'section';
  id: string;
  name: string;
  /** Which class list to refresh afterwards. Only set for sections. */
  classId?: string;
}

// Rendered in this order, so the irreversible things sit at the top where they
// are read rather than at the bottom where they are scrolled past. `danger`
// marks the rows that are money or permanent academic record.
const IMPACT_ROWS: { key: string; one: string; many: string; danger?: boolean }[] = [
  { key: 'students', one: 'student record', many: 'student records', danger: true },
  { key: 'portalLogins', one: 'portal login', many: 'portal logins', danger: true },
  { key: 'feePayments', one: 'fee payment', many: 'fee payments', danger: true },
  { key: 'examResults', one: 'recorded mark', many: 'recorded marks', danger: true },
  { key: 'progressCards', one: 'progress card', many: 'progress cards', danger: true },
  { key: 'purchases', one: 'store purchase', many: 'store purchases', danger: true },
  { key: 'registrations', one: 'programme registration', many: 'programme registrations', danger: true },
  { key: 'guardians', one: 'guardian contact', many: 'guardian contacts' },
  { key: 'attendance', one: 'attendance record', many: 'attendance records' },
  { key: 'leaves', one: 'leave request', many: 'leave requests' },
  { key: 'sections', one: 'section', many: 'sections' },
  { key: 'exams', one: 'exam', many: 'exams' },
  { key: 'homeworks', one: 'homework', many: 'homeworks' },
  { key: 'homeworkSubmissions', one: 'homework submission', many: 'homework submissions' },
  { key: 'feeStructures', one: 'fee structure', many: 'fee structures' },
  { key: 'subjects', one: 'subject', many: 'subjects' },
  { key: 'lmsMaterials', one: 'LMS material', many: 'LMS materials' },
  { key: 'ccaAreas', one: 'CCA area', many: 'CCA areas' },
  { key: 'ccaGrades', one: 'CCA grade', many: 'CCA grades' },
  { key: 'timetablePeriods', one: 'timetable period', many: 'timetable periods' },
  { key: 'subjectTeacherAssignments', one: 'teacher assignment', many: 'teacher assignments' },
  { key: 'events', one: 'school event', many: 'school events' },
  { key: 'bookIssues', one: 'library issue', many: 'library issues' },
  { key: 'joinRequests', one: 'join request', many: 'join requests' },
];

export default function ClassesPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [sections, setSections] = useState<Record<string, Section[]>>({});
  const [expandedClass, setExpandedClass] = useState<string | null>(null);
  const [newClassName, setNewClassName] = useState('');
  const [newSectionName, setNewSectionName] = useState('');
  const [addingSectionFor, setAddingSectionFor] = useState<string | null>(null);
  const [editingClass, setEditingClass] = useState<{ id: string; name: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [savingInchargeFor, setSavingInchargeFor] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [formError, setFormError] = useState('');
  const [successMsg, setSuccessMsg] = useState('');
  const [generatingCodeFor, setGeneratingCodeFor] = useState<string | null>(null);
  const [copiedCode, setCopiedCode] = useState<string | null>(null);
  const [savingSectionInchargeFor, setSavingSectionInchargeFor] = useState<string | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<DeleteTarget | null>(null);
  const [impact, setImpact] = useState<DeleteImpact | null>(null);
  const [impactError, setImpactError] = useState('');
  const [confirmName, setConfirmName] = useState('');
  const [deleting, setDeleting] = useState(false);
  // Counts the dialog openings so a slow impact response cannot land in a
  // dialog opened after it — the admin would then be confirming one class's
  // name against another class's numbers.
  const impactRequest = useRef(0);

  async function fetchClasses() {
    try {
      const { data } = await api.get('/sis/classes');
      setClasses(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load classes.');
    } finally {
      setLoading(false);
    }
  }

  async function fetchTeachers() {
    try {
      const { data } = await api.get('/schools/users', { params: { role: 'TEACHER', limit: 200 } });
      setTeachers(data.users ?? []);
    } catch { /* non-critical, fail silently */ }
  }

  useEffect(() => {
    fetchClasses().catch(console.error);
    fetchTeachers();
  }, []);

  async function handleSetIncharge(classId: string, teacherId: string) {
    setSavingInchargeFor(classId);
    try {
      const { data } = await api.patch(`/sis/classes/${classId}`, { inchargeTeacherId: teacherId || null });
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, inchargeTeacher: data.inchargeTeacher } : c));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update class incharge.');
    } finally {
      setSavingInchargeFor(null);
    }
  }

  async function handleSetSectionIncharge(sectionId: string, classId: string, teacherId: string) {
    setSavingSectionInchargeFor(sectionId);
    try {
      const { data } = await api.patch(`/sis/sections/${sectionId}`, { inchargeTeacherId: teacherId || null });
      setSections(prev => ({
        ...prev,
        [classId]: (prev[classId] ?? []).map(s => s.id === sectionId ? { ...s, inchargeTeacher: data.inchargeTeacher } : s),
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update section class teacher.');
    } finally {
      setSavingSectionInchargeFor(null);
    }
  }

  async function fetchSections(classId: string) {
    const { data } = await api.get(`/sis/classes/${classId}/sections`);
    setSections((prev) => ({ ...prev, [classId]: data }));
  }

  async function handleToggleClass(classId: string) {
    if (expandedClass === classId) {
      setExpandedClass(null);
    } else {
      setExpandedClass(classId);
      if (!sections[classId]) await fetchSections(classId);
    }
  }

  async function handleAddClass(e: React.FormEvent) {
    e.preventDefault();
    setFormError('');
    setSuccessMsg('');
    if (!newClassName.trim()) {
      setFormError('Please enter a class name.');
      return;
    }
    setSubmitting(true);
    try {
      await api.post('/sis/classes', { name: newClassName.trim() });
      setNewClassName('');
      setSuccessMsg(`Class added successfully.`);
      setTimeout(() => setSuccessMsg(''), 3000);
      await fetchClasses();
    } catch (err: any) {
      setFormError(err.response?.data?.error || `Failed to create class. (${err.message})`);
    } finally {
      setSubmitting(false);
    }
  }

  async function handleUpdateClass(e: React.FormEvent) {
    e.preventDefault();
    if (!editingClass) return;
    try {
      await api.put(`/sis/classes/${editingClass.id}`, { name: editingClass.name });
      setEditingClass(null);
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update class.');
    }
  }

  // Deleting a class or section now takes its students and their records with
  // it, so the flow is: ask the server what would go, show it, and only accept
  // the delete once the admin has typed the name back.
  async function openDelete(target: DeleteTarget) {
    const request = ++impactRequest.current;
    setDeleteTarget(target);
    setImpact(null);
    setImpactError('');
    setConfirmName('');
    const path = target.type === 'class'
      ? `/sis/classes/${target.id}/delete-impact`
      : `/sis/sections/${target.id}/delete-impact`;
    try {
      const { data } = await api.get(path);
      if (impactRequest.current === request) setImpact(data);
    } catch (err: any) {
      if (impactRequest.current === request) {
        setImpactError(err.response?.data?.error || 'Could not work out what this delete would remove.');
      }
    }
  }

  function closeDelete() {
    impactRequest.current++;
    setDeleteTarget(null);
    setImpact(null);
    setImpactError('');
    setConfirmName('');
  }

  async function handleConfirmDelete() {
    if (!deleteTarget) return;
    setDeleting(true);
    try {
      const path = deleteTarget.type === 'class'
        ? `/sis/classes/${deleteTarget.id}`
        : `/sis/sections/${deleteTarget.id}`;
      const { data } = await api.delete(path);
      closeDelete();
      if (deleteTarget.type === 'section' && deleteTarget.classId) {
        await fetchSections(deleteTarget.classId);
      }
      await fetchClasses();
      setSuccessMsg(data?.message || 'Deleted.');
      setTimeout(() => setSuccessMsg(''), 4000);
    } catch (err: any) {
      setImpactError(err.response?.data?.error || `Delete failed. (${err.message})`);
    } finally {
      setDeleting(false);
    }
  }

  async function handleAddSection(e: React.FormEvent, classId: string) {
    e.preventDefault();
    if (!newSectionName.trim()) return;
    try {
      await api.post(`/sis/classes/${classId}/sections`, { name: newSectionName.trim() });
      setNewSectionName('');
      setAddingSectionFor(null);
      fetchSections(classId);
      fetchClasses();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to create section.');
    }
  }

  async function handleGenerateJoinCode(classId: string) {
    setGeneratingCodeFor(classId);
    try {
      const { data } = await api.post(`/sis/classes/${classId}/join-code`);
      setClasses(prev => prev.map(c => c.id === classId ? { ...c, joinCode: data.joinCode } : c));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to generate join code.');
    } finally { setGeneratingCodeFor(null); }
  }

  function handleCopyCode(code: string) {
    navigator.clipboard.writeText(code);
    setCopiedCode(code);
    setTimeout(() => setCopiedCode(null), 2000);
  }


  return (
    <div className="max-w-2xl space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Classes & Sections</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Configure administrative classes, academic grade levels, and corresponding classroom sections.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-sm rounded-lg px-4 py-3 flex justify-between items-center shadow-sm">
          <span className="font-semibold">{error}</span>
          <button onClick={() => setError('')} className="text-[#DC2626] hover:text-[#991B1B] font-bold">
            <X className="w-4 h-4" strokeWidth={2.5} />
          </button>
        </div>
      )}

      {/* Add class Form */}
      <div className="space-y-2">
        <form onSubmit={handleAddClass} className={`flex gap-2.5 bg-[#F9FAFB] p-3 border rounded-xl shadow-sm ${formError ? 'border-[#FCA5A5]' : 'border-[#E5E7EB]'}`}>
          <input
            type="text"
            autoFocus
            value={newClassName}
            onChange={(e) => { setNewClassName(e.target.value); setFormError(''); }}
            placeholder="New class name (e.g. Class 1)"
            className={`flex-1 border rounded-lg px-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 transition-all ${formError ? 'border-[#FCA5A5] focus:ring-red-200 focus:border-red-400' : 'border-[#E5E7EB] focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]'}`}
          />
          <button type="submit" disabled={submitting} className="cursor-pointer px-4 py-2 bg-[#1D7A4A] hover:bg-[#155B37] disabled:opacity-60 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1.5 shadow-sm">
            <Plus className="w-4 h-4" strokeWidth={2.25} />
            {submitting ? 'Adding...' : 'Add Class'}
          </button>
        </form>
        {formError && (
          <p className="text-xs text-[#DC2626] font-semibold px-1">{formError}</p>
        )}
        {successMsg && (
          <p className="text-xs text-[#1D7A4A] font-semibold px-1">{successMsg}</p>
        )}
      </div>

      {loading ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] px-4 py-3 rounded-lg border border-[#26A96B]/10 animate-pulse w-fit">
          <Activity className="w-4 h-4 animate-spin text-[#1D7A4A]" />
          <span>Synchronizing Classroom Hierarchies...</span>
        </div>
      ) : (
        <div className="space-y-3">
          {classes.map((cls) => (
            <div key={cls.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm hover:border-[#1D7A4A]/20 transition-all">
              <div className="flex items-center px-4 py-3.5 gap-3">
                <button onClick={() => handleToggleClass(cls.id)} className="flex-1 flex items-center gap-3.5 text-left group">
                  <div className="w-8 h-8 rounded-lg bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center font-bold text-xs border border-[#26A96B]/15">
                    {cls.name.match(/\d+/) ? cls.name.match(/\d+/)?.[0] : cls.name[0]}
                  </div>
                  <div>
                    <span className="font-bold text-[#1A1D23] text-sm block group-hover:text-[#1D7A4A] transition-colors">{cls.name}</span>
                    <span className="text-xs text-[#6B7280] font-medium mt-0.5 inline-flex items-center gap-2">
                      <span className="inline-flex items-center gap-0.5"><Layers className="w-3.5 h-3.5" strokeWidth={1.75} />{cls._count.sections} Section{cls._count.sections !== 1 ? 's' : ''}</span>
                      <span>•</span>
                      <span className="inline-flex items-center gap-0.5"><Users className="w-3.5 h-3.5" strokeWidth={1.75} />{cls._count.students} Student{cls._count.students !== 1 ? 's' : ''}</span>
                      {cls.inchargeTeacher && (
                        <>
                          <span>•</span>
                          <span className="inline-flex items-center gap-0.5 text-[#1D7A4A] font-semibold">
                            <UserCheck className="w-3.5 h-3.5" strokeWidth={1.75} />
                            {cls.inchargeTeacher.firstName} {cls.inchargeTeacher.lastName}
                          </span>
                        </>
                      )}
                    </span>
                  </div>
                  <span className="ml-auto text-[#9CA3AF] hover:text-[#1A1D23] transition-colors">
                    {expandedClass === cls.id ? (
                      <ChevronUp className="w-4 h-4 text-[#6B7280]" strokeWidth={2.25} />
                    ) : (
                      <ChevronDown className="w-4 h-4 text-[#6B7280]" strokeWidth={2.25} />
                    )}
                  </span>
                </button>
                <div className="flex items-center border-l border-[#E5E7EB] pl-3 gap-1">
                  <button onClick={() => setEditingClass({ id: cls.id, name: cls.name })} className="cursor-pointer p-1.5 rounded-md hover:bg-[#F3F4F6] text-[#4B5563] hover:text-[#1D7A4A] transition-all">
                    <Edit2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                  <button onClick={() => openDelete({ type: 'class', id: cls.id, name: cls.name })} className="cursor-pointer p-1.5 rounded-md hover:bg-[#FEF2F2] text-[#DC2626] hover:text-[#B91C1C] transition-all">
                    <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              </div>

              {editingClass?.id === cls.id && (
                <form onSubmit={handleUpdateClass} className="px-4 pb-3.5 flex gap-2 border-t border-[#F3F4F6] pt-3 bg-[#F9FAFB]/50">
                  <input
                    type="text"
                    value={editingClass.name}
                    onChange={(e) => setEditingClass({ ...editingClass, name: e.target.value })}
                    className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all"
                  />
                  <button type="submit" className="cursor-pointer px-3.5 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm">Save</button>
                  <button type="button" onClick={() => setEditingClass(null)} className="cursor-pointer px-3.5 py-1.5 border border-[#E5E7EB] hover:bg-white bg-gray-50 rounded-lg text-xs font-semibold text-[#4B5563] transition-all">Cancel</button>
                </form>
              )}

              {expandedClass === cls.id && (
                <div className="border-t border-[#F3F4F6] px-4 py-4 bg-[#F9FAFB]/60 space-y-4">

                  {/* Class Incharge Assignment — only for classes with no sections.
                      Once a class has sections, each section gets its own class
                      teacher below instead of one for the whole grade. */}
                  {cls._count.sections === 0 && (
                    <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-2">
                        <UserCheck className="w-3.5 h-3.5 text-[#1D7A4A]" strokeWidth={1.75} />
                        <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Class Teacher</span>
                      </div>
                      <div className="flex items-center gap-2">
                        <select
                          value={cls.inchargeTeacher?.id ?? ''}
                          onChange={(e) => handleSetIncharge(cls.id, e.target.value)}
                          disabled={savingInchargeFor === cls.id}
                          className="flex-1 text-sm border border-[#E5E7EB] rounded-lg bg-white text-[#1A1D23] disabled:opacity-60"
                        >
                          <option value="">— No class teacher assigned —</option>
                          {teachers.map((t) => (
                            <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                          ))}
                        </select>
                        {savingInchargeFor === cls.id && (
                          <span className="text-xs text-[#1D7A4A] font-semibold animate-pulse">Saving...</span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 mt-1.5">
                        The class teacher is responsible for this class's overall administration.
                      </p>
                    </div>
                  )}

                  {/* Class Join Code */}
                  <div className="bg-white border border-[#E5E7EB] rounded-lg p-3">
                    <div className="flex items-center gap-2 mb-2">
                      <Link2 className="w-3.5 h-3.5 text-[#1D7A4A]" strokeWidth={1.75} />
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Student Self-Registration Code</span>
                    </div>
                    {cls.joinCode ? (
                      <div className="flex items-center gap-2">
                        <code className="flex-1 font-mono text-sm font-bold text-[#1A1D23] bg-gray-50 border border-gray-200 rounded px-3 py-1.5 tracking-widest">
                          {cls.joinCode}
                        </code>
                        <button
                          onClick={() => handleCopyCode(cls.joinCode!)}
                          className="cursor-pointer flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1.5 bg-white hover:bg-gray-50 transition-colors"
                        >
                          {copiedCode === cls.joinCode ? <Check className="w-3.5 h-3.5 text-green-600" /> : <Copy className="w-3.5 h-3.5" />}
                          {copiedCode === cls.joinCode ? 'Copied!' : 'Copy'}
                        </button>
                        <button
                          onClick={() => handleGenerateJoinCode(cls.id)}
                          disabled={generatingCodeFor === cls.id}
                          className="flex items-center gap-1 text-xs text-gray-500 hover:text-gray-700 border border-gray-200 rounded px-2 py-1.5 bg-white hover:bg-gray-50 transition-colors disabled:opacity-50"
                          title="Regenerate code (old code will stop working)"
                        >
                          <RefreshCw className={`w-3.5 h-3.5 ${generatingCodeFor === cls.id ? 'animate-spin' : ''}`} />
                          Regenerate
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => handleGenerateJoinCode(cls.id)}
                        disabled={generatingCodeFor === cls.id}
                        className="flex items-center gap-1.5 text-xs font-semibold text-[#1D7A4A] hover:text-[#155B37] border border-[#26A96B]/30 rounded-lg px-3 py-1.5 bg-[#E5F6EE] hover:bg-[#D0EEE0] transition-colors disabled:opacity-50"
                      >
                        <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                        {generatingCodeFor === cls.id ? 'Generating...' : 'Generate Join Code'}
                      </button>
                    )}
                    <p className="text-[10px] text-gray-400 mt-1.5">
                      Share this code with students. They go to <strong>/student-join</strong> to register.
                    </p>
                  </div>

                  <div className="space-y-2">
                    {(sections[cls.id] ?? []).map((sec) => (
                      <div key={sec.id} className="bg-white border border-[#E5E7EB] p-2.5 rounded-lg shadow-sm space-y-2">
                        <div className="flex items-center justify-between text-sm">
                          <span className="text-[#4B5563] font-semibold text-xs inline-flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-[#1D7A4A]"></span>
                            Section {sec.name}
                            <span className="text-[#9CA3AF] font-medium">({sec._count.students} students)</span>
                          </span>
                          <button onClick={() => openDelete({ type: 'section', id: sec.id, name: sec.name, classId: cls.id })} className="cursor-pointer p-1 rounded-md hover:bg-[#FEF2F2] text-[#DC2626] hover:text-[#B91C1C] transition-all">
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          </button>
                        </div>
                        <div className="flex items-center gap-2 pl-3 border-l-2 border-[#F3F4F6]">
                          <UserCheck className="w-3 h-3 text-[#9CA3AF] shrink-0" strokeWidth={1.75} />
                          <select
                            value={sec.inchargeTeacher?.id ?? ''}
                            onChange={(e) => handleSetSectionIncharge(sec.id, cls.id, e.target.value)}
                            disabled={savingSectionInchargeFor === sec.id}
                            className="flex-1 text-xs border border-[#E5E7EB] rounded-md px-1.5 py-1 bg-white text-[#1A1D23] disabled:opacity-60"
                          >
                            <option value="">— No class teacher assigned —</option>
                            {teachers.map((t) => (
                              <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>
                            ))}
                          </select>
                          {savingSectionInchargeFor === sec.id && (
                            <span className="text-[10px] text-[#1D7A4A] font-semibold animate-pulse">Saving...</span>
                          )}
                        </div>
                      </div>
                    ))}
                    {(sections[cls.id] ?? []).length === 0 && (
                      <p className="text-xs text-[#9CA3AF] font-semibold italic">No sections created yet for this class grade.</p>
                    )}
                  </div>

                  {addingSectionFor === cls.id ? (
                    <form onSubmit={(e) => handleAddSection(e, cls.id)} className="flex gap-2.5 pt-1">
                      <input
                        type="text"
                        value={newSectionName}
                        onChange={(e) => setNewSectionName(e.target.value)}
                        placeholder="Section name (e.g. A)"
                        className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all"
                        autoFocus
                      />
                      <button type="submit" className="cursor-pointer px-3.5 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm">Add</button>
                      <button type="button" onClick={() => setAddingSectionFor(null)} className="cursor-pointer px-3.5 py-1.5 border border-[#E5E7EB] hover:bg-white bg-gray-50 rounded-lg text-xs font-semibold text-[#4B5563] transition-all">Cancel</button>
                    </form>
                  ) : (
                    <button onClick={() => { setAddingSectionFor(cls.id); setNewSectionName(''); }} className="inline-flex items-center gap-1 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] transition-all">
                      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Add Section
                    </button>
                  )}
                </div>
              )}
            </div>
          ))}
          {classes.length === 0 && (
            <div className="text-center py-12 px-4 bg-white rounded-xl border border-[#E5E7EB] shadow-sm">
              <GraduationCap className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3 animate-pulse" strokeWidth={1.25} />
              <h3 className="text-sm font-bold text-[#1A1D23] mb-1">No Academic Classes</h3>
              <p className="text-xs text-[#6B7280]">Add your institution's grade levels and administrative sections to begin enrolling students.</p>
            </div>
          )}
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
          <div className="bg-white rounded-xl shadow-xl border border-[#E5E7EB] w-full max-w-lg max-h-[90vh] flex flex-col">
            <div className="flex items-start gap-3 px-5 pt-5 pb-4 border-b border-[#F3F4F6]">
              <div className="w-9 h-9 rounded-lg bg-[#FEF2F2] text-[#DC2626] flex items-center justify-center shrink-0 border border-[#FCA5A5]/50">
                <AlertTriangle className="w-4.5 h-4.5" strokeWidth={2} />
              </div>
              <div>
                <h2 className="font-bold text-[#1A1D23] text-base leading-snug">
                  Delete {deleteTarget.type === 'class' ? 'class' : 'section'}{' '}
                  {deleteTarget.type === 'section' && impact ? `${impact.target.className} — ` : ''}
                  {deleteTarget.name}?
                </h2>
                <p className="text-xs text-[#6B7280] mt-1">
                  This permanently removes the students in it, along with everything listed below.
                  It cannot be undone.
                </p>
              </div>
            </div>

            <div className="px-5 py-4 overflow-y-auto flex-1">
              {impactError && (
                <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-xs font-semibold rounded-lg px-3 py-2.5 mb-3">
                  {impactError}
                </div>
              )}

              {!impact && !impactError && (
                <div className="flex items-center gap-2 text-sm font-semibold text-[#6B7280] py-6 justify-center">
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Checking what this would remove...
                </div>
              )}

              {impact && (() => {
                const rows = IMPACT_ROWS.filter((r) => (impact.counts[r.key] ?? 0) > 0);
                if (rows.length === 0) {
                  return (
                    <p className="text-sm text-[#6B7280] py-2">
                      Nothing is attached to this {deleteTarget.type} — it will just be removed.
                    </p>
                  );
                }
                return (
                  <>
                    <p className="text-[11px] font-bold uppercase tracking-wide text-[#6B7280] mb-2">
                      Will be permanently deleted
                    </p>
                    <ul className="space-y-1 mb-4">
                      {rows.map((r) => {
                        const n = impact.counts[r.key];
                        return (
                          <li
                            key={r.key}
                            className={`flex items-baseline justify-between gap-3 text-sm px-3 py-1.5 rounded-md ${r.danger ? 'bg-[#FEF2F2] text-[#991B1B]' : 'bg-[#F9FAFB] text-[#4B5563]'}`}
                          >
                            <span className={r.danger ? 'font-semibold' : 'font-medium'}>
                              {n === 1 ? r.one : r.many}
                            </span>
                            <span className="font-bold tabular-nums">{n}</span>
                          </li>
                        );
                      })}
                    </ul>
                  </>
                );
              })()}

              {impact && (
                <div>
                  <label className="block text-xs font-semibold text-[#4B5563] mb-1.5">
                    Type <span className="font-mono font-bold text-[#1A1D23]">{impact.target.name}</span> to confirm
                  </label>
                  <input
                    type="text"
                    value={confirmName}
                    onChange={(e) => setConfirmName(e.target.value)}
                    autoFocus
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#DC2626]/20 focus:border-[#DC2626] transition-all"
                  />
                </div>
              )}
            </div>

            <div className="flex justify-end gap-2 px-5 py-3.5 border-t border-[#F3F4F6] bg-[#F9FAFB]/60 rounded-b-xl">
              <button
                type="button"
                onClick={closeDelete}
                disabled={deleting}
                className="cursor-pointer px-4 py-2 border border-[#E5E7EB] hover:bg-white bg-white rounded-lg text-sm font-semibold text-[#4B5563] transition-all disabled:opacity-60"
              >
                Cancel
              </button>
              <button
                type="button"
                onClick={handleConfirmDelete}
                disabled={deleting || !impact || confirmName.trim() !== impact.target.name}
                className="cursor-pointer px-4 py-2 bg-[#DC2626] hover:bg-[#B91C1C] disabled:opacity-50 disabled:cursor-not-allowed text-white rounded-lg text-sm font-bold transition-all inline-flex items-center gap-1.5 shadow-sm"
              >
                {deleting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Trash2 className="w-4 h-4" strokeWidth={2.25} />}
                {deleting ? 'Deleting...' : `Delete ${deleteTarget.type}`}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
