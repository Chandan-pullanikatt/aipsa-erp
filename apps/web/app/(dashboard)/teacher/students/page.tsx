'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import {
  GraduationCap,
  ChevronDown,
  Plus,
  X,
  Flag,
  Star,
  MessageSquare,
  AlertTriangle,
  Activity,
} from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

interface StudentItem {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  section: { id: string; name: string } | null;
}

interface ActivityRecord {
  id: string;
  type: 'DISCIPLINARY' | 'ACHIEVEMENT' | 'REMARK';
  title: string;
  description: string | null;
  date: string;
  addedBy: { id: string; firstName: string; lastName: string };
}

const ACTIVITY_META: Record<string, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  DISCIPLINARY: { label: 'Disciplinary', bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FCA5A5]/30', Icon: Flag },
  ACHIEVEMENT:  { label: 'Achievement',  bg: 'bg-[#D6F0E4]', text: 'text-[#0F6E56]', border: 'border-[#26A96B]/15', Icon: Star },
  REMARK:       { label: 'Remark',       bg: 'bg-[#EEF2FF]', text: 'text-[#4338CA]', border: 'border-[#4338CA]/10', Icon: MessageSquare },
};

const EMPTY_FORM = { type: 'REMARK', title: '', description: '', date: new Date().toISOString().split('T')[0] };

export default function TeacherStudentsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClassId, setSelectedClassId] = useState('');
  const [students, setStudents] = useState<StudentItem[]>([]);
  const [loadingStudents, setLoadingStudents] = useState(false);
  // Map of studentId → activities
  const [activitiesMap, setActivitiesMap] = useState<Record<string, ActivityRecord[]>>({});
  // Which student has the "add" form open
  const [addingFor, setAddingFor] = useState<string | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sis/classes').then((r) => {
      setClasses(r.data);
      if (r.data.length > 0) setSelectedClassId(r.data[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!selectedClassId) return;
    setLoadingStudents(true);
    setStudents([]);
    setActivitiesMap({});
    setAddingFor(null);
    api.get('/sis/students', { params: { classId: selectedClassId, limit: 200 } })
      .then(async (r) => {
        const list: StudentItem[] = r.data.students;
        setStudents(list);
        // Parallel-fetch activities for all students
        const entries = await Promise.all(
          list.map((s) =>
            api.get(`/sis/students/${s.id}/activities`)
              .then((ar) => [s.id, ar.data] as [string, ActivityRecord[]])
              .catch(() => [s.id, []] as [string, ActivityRecord[]])
          )
        );
        setActivitiesMap(Object.fromEntries(entries));
      })
      .catch(console.error)
      .finally(() => setLoadingStudents(false));
  }, [selectedClassId]);

  async function handleSaveActivity(studentId: string) {
    if (!form.title.trim() || !form.date) return;
    setSaving(true);
    setError('');
    try {
      const { data } = await api.post(`/sis/students/${studentId}/activities`, form);
      setActivitiesMap((prev) => ({
        ...prev,
        [studentId]: [data, ...(prev[studentId] ?? [])],
      }));
      setAddingFor(null);
      setForm({ ...EMPTY_FORM });
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save activity.');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeleteActivity(studentId: string, activityId: string) {
    if (!confirm('Delete this activity record?')) return;
    try {
      await api.delete(`/sis/activities/${activityId}`);
      setActivitiesMap((prev) => ({
        ...prev,
        [studentId]: (prev[studentId] ?? []).filter((a) => a.id !== activityId),
      }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete.');
    }
  }

  function openAddFor(studentId: string) {
    setAddingFor(studentId);
    setForm({ ...EMPTY_FORM });
    setError('');
  }

  const selectedClass = classes.find((c) => c.id === selectedClassId);

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">My Students</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            View students and record disciplinary notes, achievements, and remarks.
          </p>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-sm rounded-lg px-4 py-3 flex gap-2 items-center">
          <AlertTriangle className="w-5 h-5 shrink-0" strokeWidth={1.75} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Class Selector */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 shadow-sm">
        <label className="block text-xs font-bold uppercase tracking-wider text-[#6B7280] mb-2">Select Class</label>
        <div className="relative">
          <select
            value={selectedClassId}
            onChange={(e) => setSelectedClassId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg py-2.5 pl-3.5 pr-10 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] appearance-none"
          >
            {classes.map((c) => (
              <option key={c.id} value={c.id}>{c.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
        </div>
      </div>

      {/* Student List */}
      {loadingStudents ? (
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] px-4 py-3 rounded-lg border border-[#26A96B]/10 animate-pulse w-fit">
          <Activity className="w-4 h-4 animate-spin" />
          <span>Loading students…</span>
        </div>
      ) : students.length === 0 && selectedClassId ? (
        <div className="bg-white rounded-xl border border-dashed border-[#E5E7EB] p-8 text-center shadow-sm">
          <GraduationCap className="w-8 h-8 text-[#D1D5DB] mx-auto mb-2" strokeWidth={1.5} />
          <p className="text-sm font-semibold text-[#6B7280]">No students in {selectedClass?.name ?? 'this class'} yet.</p>
        </div>
      ) : (
        <div className="space-y-3">
          {students.map((student) => {
            const studentActivities = activitiesMap[student.id] ?? [];
            const isAdding = addingFor === student.id;

            return (
              <div key={student.id} className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
                {/* Student header row */}
                <div className="flex items-center justify-between px-4 py-3.5 border-b border-[#F3F4F6]">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-full bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center font-bold text-sm border border-[#26A96B]/15 shrink-0">
                      {student.firstName[0]}{student.lastName[0]}
                    </div>
                    <div>
                      <p className="font-semibold text-sm text-[#1A1D23]">
                        {student.firstName} {student.lastName}
                      </p>
                      <p className="text-[11px] text-[#9CA3AF] font-semibold">
                        {student.admissionNumber}
                        {student.section ? ` · ${student.section.name}` : ''}
                      </p>
                    </div>
                  </div>
                  {!isAdding && (
                    <button
                      onClick={() => openAddFor(student.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm shrink-0"
                    >
                      <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
                      Add Activity
                    </button>
                  )}
                </div>

                {/* Add Activity inline form */}
                {isAdding && (
                  <div className="px-4 py-4 border-b border-[#F3F4F6] bg-[#F9FAFB] space-y-3">
                    <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">New Activity for {student.firstName}</p>
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Type</label>
                        <select
                          value={form.type}
                          onChange={(e) => setForm({ ...form, type: e.target.value })}
                          className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                        >
                          <option value="REMARK">Remark</option>
                          <option value="ACHIEVEMENT">Achievement</option>
                          <option value="DISCIPLINARY">Disciplinary</option>
                        </select>
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Date</label>
                        <input
                          type="date"
                          value={form.date}
                          onChange={(e) => setForm({ ...form, date: e.target.value })}
                          className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                        />
                      </div>
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Title</label>
                      <input
                        type="text"
                        value={form.title}
                        onChange={(e) => setForm({ ...form, title: e.target.value })}
                        placeholder="Brief title for this activity"
                        className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
                        Description <span className="normal-case font-medium text-[#9CA3AF]">(optional)</span>
                      </label>
                      <textarea
                        value={form.description}
                        onChange={(e) => setForm({ ...form, description: e.target.value })}
                        placeholder="Additional details…"
                        rows={2}
                        className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] resize-none"
                      />
                    </div>
                    <div className="flex gap-2 justify-end">
                      <button
                        onClick={() => { setAddingFor(null); setError(''); }}
                        className="px-3.5 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#4B5563] hover:bg-white transition-all"
                      >
                        Cancel
                      </button>
                      <button
                        disabled={saving || !form.title.trim() || !form.date}
                        onClick={() => handleSaveActivity(student.id)}
                        className="px-3.5 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-60"
                      >
                        {saving ? 'Saving…' : 'Save Activity'}
                      </button>
                    </div>
                  </div>
                )}

                {/* Activity records for this student */}
                {studentActivities.length > 0 && (
                  <div className="divide-y divide-[#F9FAFB]">
                    {studentActivities.map((act) => {
                      const meta = ACTIVITY_META[act.type];
                      const Icon = meta.Icon;
                      return (
                        <div key={act.id} className="flex items-start gap-3 px-4 py-3 hover:bg-[#F9FAFB] transition-colors">
                          <div className={`w-7 h-7 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border mt-0.5`}>
                            <Icon className={`w-3.5 h-3.5 ${meta.text}`} strokeWidth={1.75} />
                          </div>
                          <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded border ${meta.bg} ${meta.text} ${meta.border}`}>
                                {meta.label}
                              </span>
                              <p className="text-xs font-semibold text-[#1A1D23]">{act.title}</p>
                            </div>
                            {act.description && (
                              <p className="text-[11px] text-[#4B5563] mt-0.5 leading-relaxed">{act.description}</p>
                            )}
                            <p className="text-[10px] text-[#9CA3AF] font-semibold mt-1">
                              {new Date(act.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                              {' · '}{act.addedBy.firstName} {act.addedBy.lastName}
                            </p>
                          </div>
                          <button
                            onClick={() => handleDeleteActivity(student.id, act.id)}
                            className="p-1 rounded text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors shrink-0"
                            title="Delete"
                          >
                            <X className="w-3.5 h-3.5" strokeWidth={2} />
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}

                {studentActivities.length === 0 && !isAdding && (
                  <p className="text-[11px] text-[#9CA3AF] font-semibold italic px-4 py-3">No activities recorded.</p>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
