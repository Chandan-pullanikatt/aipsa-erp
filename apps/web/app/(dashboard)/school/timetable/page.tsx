'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  Calendar,
  Save,
  Trash2,
  Settings,
  Plus,
  Clock,
  Check,
  AlertTriangle,
  BookOpen,
  User,
  Activity,
  Sparkles,
  X,
  RefreshCw,
  ChevronDown
} from 'lucide-react';

type Tab = 'class' | 'teacher' | 'generate';

interface ClassItem { id: string; name: string; }
interface SubjectTeacherRow { teacherId: string; sectionId: string | null; isPrimary: boolean; }
interface Subject { id: string; name: string; code: string | null; teacherId?: string | null; teachers?: SubjectTeacherRow[]; }
interface Teacher { id: string; firstName: string; lastName: string; }
interface SectionItem { id: string; name: string; }

// Mirrors the backend's teachersForSection: a section-specific SubjectTeacher row
// wins over the class-wide (sectionId null) ones for that section; falls back to
// the subject's legacy single teacherId when there are no rows at all. Used only
// to decide dropdown ordering, not as a source of truth.
function assignedTeacherIds(subject: Subject, sectionId: string): string[] {
  const rows = subject.teachers || [];
  const scoped = sectionId ? rows.filter(r => r.sectionId === sectionId) : [];
  const picked = scoped.length > 0 ? scoped : rows.filter(r => !r.sectionId);
  if (picked.length > 0) return picked.map(r => r.teacherId);
  return subject.teacherId ? [subject.teacherId] : [];
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;
const DAY_SHORT: Record<string, string> = { MONDAY: 'Mon', TUESDAY: 'Tue', WEDNESDAY: 'Wed', THURSDAY: 'Thu', FRIDAY: 'Fri', SATURDAY: 'Sat' };

const DEFAULT_PERIODS = [
  { number: 1, startTime: '09:00', endTime: '09:45' },
  { number: 2, startTime: '09:45', endTime: '10:30' },
  { number: 3, startTime: '10:30', endTime: '10:45', isBreak: true, label: 'Short Break' },
  { number: 4, startTime: '10:45', endTime: '11:30' },
  { number: 5, startTime: '11:30', endTime: '12:15' },
  { number: 6, startTime: '12:15', endTime: '13:00', isBreak: true, label: 'Lunch Break' },
  { number: 7, startTime: '13:00', endTime: '13:45' },
  { number: 8, startTime: '13:45', endTime: '14:30' },
];

interface PeriodConfig { number: number; startTime: string; endTime: string; isBreak?: boolean; label?: string; }
interface CellData { subjectId: string; teacherId: string; isBreak: boolean; breakLabel: string; }

export default function TimetablePage() {
  const [tab, setTab] = useState<Tab>('class');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [teachers, setTeachers] = useState<Teacher[]>([]);
  const [academicYear, setAcademicYear] = useState('');

  useEffect(() => {
    api.get('/sis/classes').then(r => setClasses(r.data)).catch(console.error);
    api.get('/schools/users', { params: { role: 'TEACHER', limit: 100 } }).then(r => setTeachers(r.data.users)).catch(console.error);
    api.get('/timetable/academic-year').then(r => setAcademicYear(r.data.academicYear)).catch(console.error);
  }, []);

  return (
    <div className="max-w-7xl mx-auto space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Academic Timetable</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Construct and coordinate weekly class schedules, period intervals, and teacher assignments.
          </p>
        </div>
        {academicYear && (
          <div className="flex items-center gap-2 px-3 py-1.5 bg-[#F3F4F6] border border-[#E5E7EB] rounded-xl text-xs font-semibold text-[#4B5563] w-fit h-fit self-start sm:self-center">
            <span className="w-1.5 h-1.5 rounded-full bg-[#1D7A4A] animate-pulse"></span>
            <span>Academic Session: {academicYear}</span>
          </div>
        )}
      </div>

      {/* Tab Switcher */}
      <div className="flex gap-1.5 bg-[#F3F4F6] p-1.5 rounded-xl border border-[#E5E7EB] w-fit">
        {([['class', 'Class Timetable'], ['teacher', 'Teacher Schedule'], ['generate', 'Auto-generate']] as [Tab, string][]).map(([t, l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg font-display text-[14px] font-semibold transition-all ${
              tab === t 
                ? 'bg-white text-[#1D7A4A] shadow-sm border border-[#E5E7EB]' 
                : 'text-[#6B7280] hover:text-[#1A1D23]'
            }`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'class' && <ClassTimetableTab classes={classes} teachers={teachers} academicYear={academicYear} />}
      {tab === 'teacher' && <TeacherScheduleTab teachers={teachers} academicYear={academicYear} />}
      {tab === 'generate' && <AutoGenerateTab classes={classes} teachers={teachers} academicYear={academicYear} />}
    </div>
  );
}

// ─── Class Timetable Tab ──────────────────────────────────────────────────────

function ClassTimetableTab({ classes, teachers, academicYear }: { classes: ClassItem[]; teachers: Teacher[]; academicYear: string }) {
  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig[]>(DEFAULT_PERIODS);
  const [grid, setGrid] = useState<Record<string, CellData>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [editingConfig, setEditingConfig] = useState(false);

  useEffect(() => {
    if (!classId) { setSections([]); setSectionId(''); return; }
    api.get(`/sis/classes/${classId}/sections`).then(r => {
      setSections(r.data);
      setSectionId(r.data.length > 0 ? r.data[0].id : '');
    }).catch(console.error);
  }, [classId]);

  useEffect(() => {
    if (!classId) return;
    if (sections.length > 0 && !sectionId) return; // waiting for a section to be picked
    api.get('/exams/subjects', { params: { classId } }).then(r => setSubjects(r.data)).catch(console.error);
    loadTimetable();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, sectionId]);

  async function loadTimetable() {
    if (!classId) return;
    try {
      const { data } = await api.get('/timetable', { params: { classId, sectionId: sectionId || undefined, academicYear } });
      const newGrid: Record<string, CellData> = {};
      const seenPeriods = new Set<number>();

      data.periods.forEach((p: any) => {
        const key = `${p.dayOfWeek}-${p.periodNumber}`;
        newGrid[key] = { subjectId: p.subjectId || '', teacherId: p.teacherId || '', isBreak: p.isBreak, breakLabel: p.breakLabel || '' };
        seenPeriods.add(p.periodNumber);
      });

      if (data.periods.length > 0) {
        const configMap: Record<number, PeriodConfig> = {};
        data.periods.forEach((p: any) => {
          if (!configMap[p.periodNumber]) {
            configMap[p.periodNumber] = { number: p.periodNumber, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak, label: p.breakLabel || undefined };
          }
        });
        const sorted = Object.values(configMap).sort((a, b) => a.number - b.number);
        if (sorted.length > 0) setPeriodConfig(sorted);
      }

      setGrid(newGrid);
      setLoaded(true);
    } catch { setLoaded(true); }
  }

  function getCell(day: string, period: number): CellData {
    return grid[`${day}-${period}`] || { subjectId: '', teacherId: '', isBreak: false, breakLabel: '' };
  }

  function setCell(day: string, period: number, data: Partial<CellData>) {
    const key = `${day}-${period}`;
    setGrid(prev => ({ ...prev, [key]: { ...getCell(day, period), ...data } }));
  }

  async function handleSave() {
    if (!classId) return;
    setSaving(true);
    try {
      const periods: any[] = [];
      periodConfig.forEach(pc => {
        DAYS.forEach(day => {
          const cell = getCell(day, pc.number);
          periods.push({
            dayOfWeek: day,
            periodNumber: pc.number,
            startTime: pc.startTime,
            endTime: pc.endTime,
            subjectId: cell.subjectId || null,
            teacherId: cell.teacherId || null,
            isBreak: pc.isBreak || cell.isBreak || false,
            breakLabel: pc.label || cell.breakLabel || null,
          });
        });
      });
      await api.post('/timetable/bulk', { classId, sectionId: sectionId || undefined, academicYear, periods });
      const conflictRes = await api.get('/timetable/conflicts', { params: { classId, sectionId: sectionId || undefined, academicYear } });
      setConflicts(conflictRes.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  async function handleClear() {
    if (!confirm('Clear the entire timetable for this class?')) return;
    await api.delete('/timetable/class', { params: { classId, sectionId: sectionId || undefined, academicYear } });
    setGrid({});
    setConflicts([]);
  }

  function addPeriod() {
    const last = periodConfig[periodConfig.length - 1];
    const newNum = last ? last.number + 1 : 1;
    setPeriodConfig(prev => [...prev, { number: newNum, startTime: '15:00', endTime: '15:45' }]);
  }

  function removePeriod(num: number) {
    setPeriodConfig(prev => prev.filter(p => p.number !== num));
    const newGrid = { ...grid };
    DAYS.forEach(day => { delete newGrid[`${day}-${num}`]; });
    setGrid(newGrid);
  }

  const subjectById = Object.fromEntries(subjects.map(s => [s.id, s]));
  const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));

  return (
    <div className="space-y-6">
      {/* Configuration Action Bar */}
      <div className="flex flex-wrap gap-4 items-end bg-[#F9FAFB] p-4 border border-[#E5E7EB] rounded-xl shadow-sm">
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5">Class Selection</label>
          <select value={classId} onChange={e => { setClassId(e.target.value); setLoaded(false); setGrid({}); }}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
            <option value="">Select class</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        {classId && sections.length > 0 && (
          <div className="min-w-[160px]">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5">Section</label>
            <select value={sectionId} onChange={e => { setSectionId(e.target.value); setLoaded(false); setGrid({}); }}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
              {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
            </select>
          </div>
        )}

        {classId && (
          <div className="flex flex-wrap items-center gap-3 ml-auto">
            <button onClick={() => setEditingConfig(e => !e)} 
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-[#4B5563] bg-white hover:bg-[#F9FAFB] hover:text-[#1A1D23] transition-all">
              <Settings className="w-4 h-4 text-[#6B7280]" strokeWidth={1.75} />
              {editingConfig ? 'Hide Config' : 'Configure Periods'}
            </button>
            
            <button onClick={handleSave} disabled={saving}
              className="inline-flex items-center gap-2 px-4 py-2 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-60 transition-all shadow-sm">
              <Save className="w-4 h-4" strokeWidth={1.75} />
              {saving ? 'Saving...' : 'Save Timetable'}
            </button>
            
            {saved && (
              <span className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#0F6E56] bg-[#D6F0E4] px-2.5 py-2 rounded-lg border border-[#D6F0E4]/30 animate-pulse">
                <Check className="w-4 h-4 text-[#0F6E56]" strokeWidth={2} /> Saved
              </span>
            )}
            
            <button onClick={handleClear} 
              className="inline-flex items-center gap-2 px-3.5 py-2 border border-[#FCA5A5] text-[#DC2626] rounded-lg text-sm font-semibold bg-white hover:bg-[#FEF2F2] transition-all">
              <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              Clear Grid
            </button>
          </div>
        )}
      </div>

      {/* Conflicts Bar */}
      {conflicts.length > 0 && (
        <div className="bg-[#FEF3C7] border border-[#F59E0B]/30 rounded-xl px-4 py-3 flex gap-3 items-start shadow-sm">
          <AlertTriangle className="w-5 h-5 text-[#D97706] shrink-0 mt-0.5" strokeWidth={1.75} />
          <div>
            <p className="text-sm font-bold text-[#92400E]">{conflicts.length} double-booking conflict{conflicts.length > 1 ? 's' : ''} detected</p>
            <div className="mt-1 space-y-0.5">
              {conflicts.map((c, i) => (
                <p key={i} className="text-xs font-semibold text-[#B45309]">
                  Teacher double-booked on {DAY_SHORT[c.period?.dayOfWeek]} — Period {c.period?.periodNumber} ({c.period?.startTime} - {c.period?.endTime})
                </p>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Period Config Panel */}
      {editingConfig && classId && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm">
          <div className="flex items-center gap-2 border-b border-[#E5E7EB] pb-3 mb-4">
            <Clock className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-sm font-bold text-[#1A1D23] uppercase tracking-wider">Period Intervals Setup</h3>
          </div>
          <div className="space-y-3">
            {periodConfig.map((pc, i) => (
              <div key={pc.number} className="flex flex-wrap items-center gap-3 bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
                <span className="text-xs font-bold text-[#4B5563] w-20">Period {pc.number}</span>
                <div className="flex items-center gap-2">
                  <input type="time" value={pc.startTime} onChange={e => setPeriodConfig(prev => prev.map(p => p.number === pc.number ? { ...p, startTime: e.target.value } : p))}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                  <span className="text-[#6B7280] text-xs font-semibold">to</span>
                  <input type="time" value={pc.endTime} onChange={e => setPeriodConfig(prev => prev.map(p => p.number === pc.number ? { ...p, endTime: e.target.value } : p))}
                    className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                </div>
                
                <label className="flex items-center gap-2 text-xs font-semibold text-[#4B5563] cursor-pointer">
                  <input type="checkbox" checked={!!pc.isBreak} onChange={e => setPeriodConfig(prev => prev.map(p => p.number === pc.number ? { ...p, isBreak: e.target.checked } : p))} 
                    className="rounded border-[#E5E7EB] text-[#1D7A4A] focus:ring-[#1D7A4A]/20" />
                  Is Break / Recess
                </label>
                
                {pc.isBreak && (
                  <input value={pc.label || ''} onChange={e => setPeriodConfig(prev => prev.map(p => p.number === pc.number ? { ...p, label: e.target.value } : p))}
                    placeholder="Recess label" className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-xs w-40 bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                )}
                
                <button onClick={() => removePeriod(pc.number)} 
                  className="ml-auto text-xs font-bold text-[#DC2626] hover:text-[#B91C1C] hover:bg-[#FEF2F2] px-2 py-1 rounded transition-all">
                  Remove
                </button>
              </div>
            ))}
          </div>
          <button onClick={addPeriod} 
            className="mt-4 inline-flex items-center gap-1 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] transition-all">
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add Session Period
          </button>
        </div>
      )}

      {/* Timetable Grid */}
      {classId && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[800px] text-sm border-collapse">
              <thead>
                <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                  <th className="px-4 py-3.5 text-left text-xs font-bold text-[#4B5563] uppercase tracking-wider w-36 border-r border-[#E5E7EB]">Period</th>
                  {DAYS.map(day => (
                    <th key={day} className="px-3 py-3.5 text-center text-xs font-bold text-[#4B5563] uppercase tracking-wider border-r border-[#E5E7EB] last:border-0">{DAY_SHORT[day]}</th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {periodConfig.map(pc => (
                  <tr key={pc.number} className={pc.isBreak ? 'bg-[#FFFBEB]/40' : 'hover:bg-[#F9FAFB]/30 transition-colors'}>
                    <td className="px-4 py-3 border-r border-[#E5E7EB] bg-[#F9FAFB]/20">
                      <p className="text-xs font-bold text-[#1A1D23]">{pc.isBreak ? (pc.label || 'Break') : `Period ${pc.number}`}</p>
                      <p className="text-[10px] text-[#6B7280] font-semibold mt-0.5">{pc.startTime} – {pc.endTime}</p>
                    </td>
                    {DAYS.map(day => {
                      const cell = getCell(day, pc.number);
                      if (pc.isBreak) {
                        return (
                          <td key={day} className="px-3 py-3 text-center border-r border-[#E5E7EB] last:border-0">
                            <span className="inline-flex items-center gap-1 text-[11px] text-[#D97706] font-bold uppercase tracking-wider bg-[#FEF3C7] px-2.5 py-1 rounded-md border border-[#F59E0B]/20">
                              <Clock className="w-3 h-3 text-[#D97706]" strokeWidth={2} />
                              {pc.label || 'Break'}
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={day} className="p-2 border-r border-[#E5E7EB] last:border-0 min-w-[160px]">
                          <div className="space-y-1.5">
                            <div className="flex items-center gap-1.5 px-2 border border-[#E5E7EB] rounded-md bg-white transition-all focus-within:ring-1 focus-within:ring-[#1D7A4A] focus-within:border-[#1D7A4A]">
                              <BookOpen className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                              <select value={cell.subjectId} onChange={e => setCell(day, pc.number, { subjectId: e.target.value })}
                                className="flex-1 min-w-0 py-1 text-xs bg-transparent focus:outline-none font-semibold text-[#1A1D23] cursor-pointer appearance-none truncate">
                                <option value="">Subject</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                            </div>
                            <div className="flex items-center gap-1.5 px-2 border border-[#E5E7EB] rounded-md bg-white transition-all focus-within:ring-1 focus-within:ring-[#1D7A4A] focus-within:border-[#1D7A4A]">
                              <User className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                              <select value={cell.teacherId} onChange={e => setCell(day, pc.number, { teacherId: e.target.value })}
                                className="flex-1 min-w-0 py-1 text-xs bg-transparent focus:outline-none text-[#6B7280] font-medium hover:text-[#1A1D23] cursor-pointer appearance-none truncate">
                                <option value="">Teacher</option>
                                {(() => {
                                  const subj = subjectById[cell.subjectId];
                                  const assignedIds = subj ? new Set(assignedTeacherIds(subj, sectionId)) : new Set<string>();
                                  const assigned = teachers.filter(t => assignedIds.has(t.id));
                                  const others = teachers.filter(t => !assignedIds.has(t.id));
                                  if (assigned.length === 0) return teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>);
                                  return (
                                    <>
                                      <optgroup label="Assigned to this subject">
                                        {assigned.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                                      </optgroup>
                                      <optgroup label="Others">
                                        {others.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                                      </optgroup>
                                    </>
                                  );
                                })()}
                              </select>
                              <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                            </div>
                          </div>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {periodConfig.length === 0 && (
            <div className="text-center py-12 px-4 bg-white rounded-b-xl border-t border-[#E5E7EB]">
              <Calendar className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3" strokeWidth={1.25} />
              <h3 className="text-sm font-bold text-[#1A1D23] mb-1">No Academic Periods Set</h3>
              <p className="text-xs text-[#6B7280] mb-4">You have cleared all active timetable sequences for this class.</p>
              <button onClick={() => { setPeriodConfig(DEFAULT_PERIODS); setEditingConfig(true); }} 
                className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-sm font-semibold transition-all">
                <Plus className="w-4 h-4" strokeWidth={2} /> Use Default Period Grid
              </button>
            </div>
          )}
        </div>
      )}

      {!classId && (
        <div className="text-center py-20 bg-white border border-[#E5E7EB] rounded-xl shadow-sm my-6">
          <Calendar className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3 animate-pulse" strokeWidth={1.25} />
          <h3 className="text-sm font-bold text-[#1A1D23] mb-1">Class Schedule Matrix</h3>
          <p className="text-xs text-[#6B7280]">Select an administrative class from the selection bar above to configure or view its timetable.</p>
        </div>
      )}
    </div>
  );
}

// ─── Teacher Schedule Tab ─────────────────────────────────────────────────────

function TeacherScheduleTab({ teachers, academicYear }: { teachers: Teacher[]; academicYear: string }) {
  const [teacherId, setTeacherId] = useState('');
  const [schedule, setSchedule] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  async function loadSchedule(id: string) {
    if (!id) { setSchedule([]); return; }
    setLoading(true);
    try {
      const { data } = await api.get('/timetable/teacher', { params: { teacherId: id, academicYear } });
      setSchedule(data);
    } finally { setLoading(false); }
  }

  useEffect(() => { if (teacherId) loadSchedule(teacherId); }, [teacherId]);

  const grid: Record<string, Record<number, any>> = {};
  DAYS.forEach(d => { grid[d] = {}; });
  schedule.forEach(p => {
    if (!grid[p.dayOfWeek]) grid[p.dayOfWeek] = {};
    grid[p.dayOfWeek][p.periodNumber] = p;
  });

  const periodNumbers = [...new Set(schedule.map(p => p.periodNumber))].sort((a, b) => a - b);
  const periodTimes: Record<number, { start: string; end: string }> = {};
  schedule.forEach(p => { periodTimes[p.periodNumber] = { start: p.startTime, end: p.endTime }; });

  const teacher = teachers.find(t => t.id === teacherId);
  const totalPeriods = schedule.filter(p => !p.isBreak).length;

  return (
    <div className="space-y-6">
      {/* Filter Selection Panel */}
      <div className="flex gap-4 items-end bg-[#F9FAFB] p-4 border border-[#E5E7EB] rounded-xl shadow-sm">
        <div className="min-w-[200px]">
          <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1.5">Teacher Workload</label>
          <select value={teacherId} onChange={e => setTeacherId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
            <option value="">Select teacher</option>
            {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
          </select>
        </div>
      </div>

      {loading && (
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] px-4 py-3 rounded-lg border border-[#26A96B]/10 animate-pulse w-fit">
          <Activity className="w-4 h-4 animate-spin text-[#1D7A4A]" />
          <span>Synchronizing Teacher Schedule Matrix...</span>
        </div>
      )}

      {teacher && !loading && (
        <div className="space-y-6">
          {/* Teacher Summary Banner */}
          <div className="flex items-center justify-between bg-white border border-[#E5E7EB] p-4 rounded-xl shadow-sm">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center font-bold text-sm border border-[#26A96B]/20">
                {teacher.firstName[0]}{teacher.lastName[0]}
              </div>
              <div>
                <p className="text-sm font-bold text-[#1A1D23]">{teacher.firstName} {teacher.lastName}</p>
                <p className="text-xs text-[#6B7280]">Academic Faculty Member</p>
              </div>
            </div>
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-[#EEF2FF] text-[#4338CA] text-xs font-bold rounded-lg border border-[#EEF2FF]/30">
              <BookOpen className="w-3.5 h-3.5" strokeWidth={2} />
              {totalPeriods} Assigned Periods / Week
            </span>
          </div>

          {periodNumbers.length === 0 ? (
            <div className="text-center py-20 bg-white border border-[#E5E7EB] rounded-xl shadow-sm my-6">
              <Calendar className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3 animate-pulse" strokeWidth={1.25} />
              <h3 className="text-sm font-bold text-[#1A1D23] mb-1">Schedule is Empty</h3>
              <p className="text-xs text-[#6B7280]">There are no timetable periods mapped to this teacher across any class syllabus currently.</p>
            </div>
          ) : (
            <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm">
              <div className="overflow-x-auto">
                <table className="w-full min-w-[800px] text-sm border-collapse">
                  <thead>
                    <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
                      <th className="px-4 py-3.5 text-left text-xs font-bold text-[#4B5563] uppercase tracking-wider w-36 border-r border-[#E5E7EB]">Period</th>
                      {DAYS.map(day => (
                        <th key={day} className="px-3 py-3.5 text-center text-xs font-bold text-[#4B5563] uppercase tracking-wider border-r border-[#E5E7EB] last:border-0">{DAY_SHORT[day]}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E5E7EB]">
                    {periodNumbers.map(pn => (
                      <tr key={pn} className="hover:bg-[#F9FAFB]/30 transition-colors">
                        <td className="px-4 py-3 border-r border-[#E5E7EB] bg-[#F9FAFB]/10">
                          <p className="text-xs font-bold text-[#1A1D23]">Period {pn}</p>
                          <p className="text-[10px] text-[#6B7280] font-semibold mt-0.5">{periodTimes[pn]?.start} – {periodTimes[pn]?.end}</p>
                        </td>
                        {DAYS.map(day => {
                          const slot = grid[day]?.[pn];
                          return (
                            <td key={day} className="px-3 py-3 text-center border-r border-[#E5E7EB] last:border-0 min-w-[140px]">
                              {slot ? (
                                <div className="p-2 rounded-lg bg-[#E5F6EE]/45 border border-[#26A96B]/15">
                                  <p className="text-xs font-bold text-[#1D7A4A] truncate">{slot.subject?.name || '—'}</p>
                                  <p className="text-[10px] font-bold text-[#0F6E56] mt-0.5">{slot.class?.name}</p>
                                </div>
                              ) : (
                                <span className="text-xs text-[#9CA3AF] font-semibold">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </div>
      )}

      {!teacherId && (
        <div className="text-center py-20 bg-white border border-[#E5E7EB] rounded-xl shadow-sm my-6">
          <Calendar className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3" strokeWidth={1.25} />
          <h3 className="text-sm font-bold text-[#1A1D23] mb-1">Instructor Workload Grid</h3>
          <p className="text-xs text-[#6B7280]">Select a faculty member from the workload selector above to inspect their weekly workload allocation.</p>
        </div>
      )}
    </div>
  );
}

// ─── Auto-generate Tab ────────────────────────────────────────────────────────

interface Slot { periodNumber: number; startTime: string; endTime: string; isBreak?: boolean; breakLabel?: string; }
interface Availability { id: string; teacherId: string; dayOfWeek: string; periodNumber: number | null; reason: string | null; teacher?: { firstName: string; lastName: string }; }
interface GenReport { feasible: boolean; totalDemands: number; placed: number; unplacedCount: number; unplaced: string[]; warnings: string[]; seed: number; }
interface Draft { classId: string; sectionId: string | null; className: string; sectionName: string | null; label: string; periods: any[]; }

function draftUnitKey(d: { classId: string; sectionId: string | null }) { return `${d.classId}|${d.sectionId || ''}`; }

// Compact read-only grid shared by the current-vs-generated comparison. Caller
// supplies how to name the subject/teacher for a cell since the two sources
// (saved periods vs. generated draft periods) shape that data differently.
function MiniGrid({ days, periodNumbers, byCell, nameOf, teacherOf }: {
  days: readonly string[]; periodNumbers: number[]; byCell: Record<string, any>;
  nameOf: (p: any) => string | null | undefined; teacherOf: (p: any) => string | null | undefined;
}) {
  return (
    <table className="w-full min-w-[600px] text-sm border-collapse">
      <thead>
        <tr className="bg-[#F9FAFB] border-b border-[#E5E7EB]">
          <th className="px-3 py-2 text-left text-[10px] font-bold text-[#4B5563] uppercase tracking-wider w-24 border-r border-[#E5E7EB]">Period</th>
          {days.map(day => <th key={day} className="px-2 py-2 text-center text-[10px] font-bold text-[#4B5563] uppercase tracking-wider border-r border-[#E5E7EB] last:border-0">{DAY_SHORT[day]}</th>)}
        </tr>
      </thead>
      <tbody className="divide-y divide-[#E5E7EB]">
        {periodNumbers.map(pn => {
          const sample = byCell[`${days[0]}-${pn}`];
          const isBreak = sample?.isBreak;
          return (
            <tr key={pn} className={isBreak ? 'bg-[#FFFBEB]/40' : ''}>
              <td className="px-3 py-2 border-r border-[#E5E7EB] bg-[#F9FAFB]/20">
                <p className="text-[11px] font-bold text-[#1A1D23]">{isBreak ? (sample?.breakLabel || 'Break') : `Period ${pn}`}</p>
              </td>
              {days.map(day => {
                const cell = byCell[`${day}-${pn}`];
                if (cell?.isBreak) return <td key={day} className="px-2 py-2 text-center border-r border-[#E5E7EB] last:border-0"><span className="text-[9px] text-[#D97706] font-bold uppercase">{cell.breakLabel || 'Break'}</span></td>;
                const name = nameOf(cell);
                const teacher = teacherOf(cell);
                return (
                  <td key={day} className="px-1.5 py-2 text-center border-r border-[#E5E7EB] last:border-0 min-w-[100px]">
                    {name ? (
                      <div className="p-1 rounded-md bg-[#E5F6EE]/50 border border-[#26A96B]/15">
                        <p className="text-[11px] font-bold text-[#1D7A4A] truncate">{name}</p>
                        {teacher && <p className="text-[9px] font-semibold text-[#0F6E56] truncate">{teacher}</p>}
                      </div>
                    ) : <span className="text-xs text-[#D1D5DB]">—</span>}
                  </td>
                );
              })}
            </tr>
          );
        })}
      </tbody>
    </table>
  );
}

function AutoGenerateTab({ classes, teachers, academicYear }: { classes: ClassItem[]; teachers: Teacher[]; academicYear: string }) {
  const [config, setConfig] = useState<{ workingDays: string[]; slots: Slot[]; maxPeriodsPerDayPerTeacher: number }>({ workingDays: [...DAYS], slots: DEFAULT_PERIODS.map(p => ({ periodNumber: p.number, startTime: p.startTime, endTime: p.endTime, isBreak: p.isBreak, breakLabel: p.label })), maxPeriodsPerDayPerTeacher: 6 });
  const [subjectById, setSubjectById] = useState<Record<string, Subject>>({});
  const [availability, setAvailability] = useState<Availability[]>([]);
  const [availForm, setAvailForm] = useState({ teacherId: '', dayOfWeek: 'MONDAY', periodNumber: '', reason: '' });

  const [showConfig, setShowConfig] = useState(false);
  const [showAvail, setShowAvail] = useState(false);
  const [savingConfig, setSavingConfig] = useState(false);
  const [configSaved, setConfigSaved] = useState(false);

  const [result, setResult] = useState<{ drafts: Draft[]; report: GenReport } | null>(null);
  const [generating, setGenerating] = useState(false);
  const [applying, setApplying] = useState(false);
  const [applied, setApplied] = useState(false);
  const [previewUnitKey, setPreviewUnitKey] = useState('');
  const [error, setError] = useState('');

  // Per-unit choice between the freshly generated draft and whatever is already
  // saved. Defaults to "current" — generating never overwrites anything until
  // the admin explicitly opts a unit into the generated version.
  const [decisions, setDecisions] = useState<Record<string, 'current' | 'generated'>>({});
  const [currentByUnit, setCurrentByUnit] = useState<Record<string, any[]>>({});
  const [loadingCurrent, setLoadingCurrent] = useState(false);

  const teacherById = Object.fromEntries(teachers.map(t => [t.id, t]));

  useEffect(() => {
    api.get('/timetable/config', { params: { academicYear } }).then(r => {
      setConfig({
        workingDays: r.data.workingDays?.length ? r.data.workingDays : [...DAYS],
        slots: r.data.slots?.length ? r.data.slots : config.slots,
        maxPeriodsPerDayPerTeacher: r.data.maxPeriodsPerDayPerTeacher ?? 6,
      });
    }).catch(() => {});
    api.get('/exams/subjects').then(r => setSubjectById(Object.fromEntries(r.data.map((s: Subject) => [s.id, s])))).catch(() => {});
    api.get('/timetable/availability', { params: { academicYear } }).then(r => setAvailability(r.data)).catch(() => {});
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [academicYear]);

  async function saveConfig() {
    setSavingConfig(true);
    setError('');
    try {
      await api.put('/timetable/config', { academicYear, ...config });
      setConfigSaved(true);
      setTimeout(() => setConfigSaved(false), 2500);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to save bell schedule.');
    } finally { setSavingConfig(false); }
  }

  function addSlot() {
    const last = config.slots[config.slots.length - 1];
    setConfig(c => ({ ...c, slots: [...c.slots, { periodNumber: (last?.periodNumber || 0) + 1, startTime: '15:00', endTime: '15:45' }] }));
  }
  function removeSlot(pn: number) {
    setConfig(c => ({ ...c, slots: c.slots.filter(s => s.periodNumber !== pn) }));
  }
  function toggleDay(day: string) {
    setConfig(c => ({ ...c, workingDays: c.workingDays.includes(day) ? c.workingDays.filter(d => d !== day) : [...DAYS].filter(d => c.workingDays.includes(d) || d === day) }));
  }

  async function addAvailability() {
    if (!availForm.teacherId) return;
    setError('');
    try {
      await api.post('/timetable/availability', {
        academicYear,
        teacherId: availForm.teacherId,
        dayOfWeek: availForm.dayOfWeek,
        periodNumber: availForm.periodNumber === '' ? null : parseInt(availForm.periodNumber),
        reason: availForm.reason || null,
      });
      const r = await api.get('/timetable/availability', { params: { academicYear } });
      setAvailability(r.data);
      setAvailForm({ teacherId: '', dayOfWeek: 'MONDAY', periodNumber: '', reason: '' });
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to add availability block.');
    }
  }
  async function removeAvailability(id: string) {
    await api.delete(`/timetable/availability/${id}`).catch(() => {});
    setAvailability(prev => prev.filter(a => a.id !== id));
  }

  async function generate() {
    setGenerating(true);
    setError('');
    setApplied(false);
    try {
      const { data } = await api.post('/timetable/generate', { academicYear });
      setResult(data);
      setDecisions({});
      setCurrentByUnit({});
      setPreviewUnitKey(data.drafts[0] ? draftUnitKey(data.drafts[0]) : '');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to generate timetable.');
    } finally { setGenerating(false); }
  }

  function decisionFor(key: string) { return decisions[key] || 'current'; }

  async function loadCurrentFor(draft: Draft) {
    const key = draftUnitKey(draft);
    if (currentByUnit[key]) return;
    setLoadingCurrent(true);
    try {
      const { data } = await api.get('/timetable', { params: { classId: draft.classId, sectionId: draft.sectionId || undefined, academicYear } });
      setCurrentByUnit(prev => ({ ...prev, [key]: data.periods }));
    } catch {
      setCurrentByUnit(prev => ({ ...prev, [key]: [] }));
    } finally { setLoadingCurrent(false); }
  }

  async function apply() {
    if (!result) return;
    const toApply = result.drafts.filter(d => decisionFor(draftUnitKey(d)) === 'generated');
    if (toApply.length === 0) {
      setError('Mark at least one section as "Use generated" before applying — nothing is written otherwise.');
      return;
    }
    if (!confirm(`Apply the generated timetable to ${toApply.length} section${toApply.length > 1 ? 's' : ''}? Sections left on "Keep current" are untouched.`)) return;
    setApplying(true);
    setError('');
    try {
      await api.post('/timetable/generate/apply', { academicYear, drafts: toApply });
      setApplied(true);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to apply timetable.');
    } finally { setApplying(false); }
  }

  const preview = result?.drafts.find(d => draftUnitKey(d) === previewUnitKey);
  const previewPeriodNumbers = preview ? [...new Set(preview.periods.map((p: any) => p.periodNumber))].sort((a, b) => a - b) : [];
  const previewByCell: Record<string, any> = {};
  preview?.periods.forEach((p: any) => { previewByCell[`${p.dayOfWeek}-${p.periodNumber}`] = p; });
  const currentPeriods = currentByUnit[previewUnitKey] || [];
  const currentByCell: Record<string, any> = {};
  currentPeriods.forEach((p: any) => { currentByCell[`${p.dayOfWeek}-${p.periodNumber}`] = p; });
  const previewWorkingDays = DAYS.filter(d => config.workingDays.includes(d));

  useEffect(() => {
    if (preview) loadCurrentFor(preview);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [previewUnitKey]);

  const unitStats = (result?.drafts || []).map(d => {
    const nonBreak = d.periods.filter((p: any) => !p.isBreak);
    return { key: draftUnitKey(d), label: d.label, filled: nonBreak.filter((p: any) => p.subjectId).length, total: nonBreak.length };
  });

  return (
    <div className="space-y-6">
      <div className="bg-gradient-to-r from-[#E5F6EE] to-white border border-[#26A96B]/20 rounded-xl p-5 flex flex-wrap items-center justify-between gap-4 shadow-sm">
        <div className="flex items-start gap-3">
          <div className="w-10 h-10 rounded-lg bg-[#1D7A4A] flex items-center justify-center shrink-0">
            <Sparkles className="w-5 h-5 text-white" strokeWidth={2} />
          </div>
          <div>
            <h3 className="text-sm font-bold text-[#1A1D23]">Automatic Timetable Generation</h3>
            <p className="text-xs text-[#6B7280] mt-0.5 max-w-xl">
              Builds a conflict-free weekly schedule for every class from each subject&apos;s periods/week, teacher assignments, the bell schedule, and availability. Review the draft, then apply.
            </p>
          </div>
        </div>
        <button onClick={generate} disabled={generating}
          className="inline-flex items-center gap-2 px-5 py-2.5 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-60 transition-all shadow-sm">
          {generating ? <Activity className="w-4 h-4 animate-spin" /> : <Sparkles className="w-4 h-4" strokeWidth={2} />}
          {generating ? 'Generating…' : 'Generate Draft'}
        </button>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] rounded-xl px-4 py-3 flex items-center justify-between">
          <span className="text-sm font-semibold text-[#B91C1C]">{error}</span>
          <button onClick={() => setError('')} className="text-[#B91C1C]"><X className="w-4 h-4" /></button>
        </div>
      )}

      {/* Setup: bell schedule + availability (collapsibles) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Bell schedule */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
          <button onClick={() => setShowConfig(s => !s)} className="w-full flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-2 text-sm font-bold text-[#1A1D23]"><Clock className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} /> Bell Schedule</span>
            <span className="text-xs font-semibold text-[#6B7280]">{config.slots.length} slots · {config.workingDays.length} days</span>
          </button>
          {showConfig && (
            <div className="px-5 pb-5 space-y-4 border-t border-[#E5E7EB] pt-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-2">Working Days</label>
                <div className="flex flex-wrap gap-1.5">
                  {DAYS.map(day => (
                    <button key={day} onClick={() => toggleDay(day)}
                      className={`px-2.5 py-1 rounded-md text-xs font-semibold border transition-all ${config.workingDays.includes(day) ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white text-[#6B7280] border-[#E5E7EB] hover:bg-[#F9FAFB]'}`}>
                      {DAY_SHORT[day]}
                    </button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {config.slots.map((s) => (
                  <div key={s.periodNumber} className="flex flex-wrap items-center gap-2 bg-[#F9FAFB] p-2 rounded-lg border border-[#E5E7EB]">
                    <span className="text-xs font-bold text-[#4B5563] w-16">P{s.periodNumber}</span>
                    <input type="time" value={s.startTime} onChange={e => setConfig(c => ({ ...c, slots: c.slots.map(x => x.periodNumber === s.periodNumber ? { ...x, startTime: e.target.value } : x) }))} className="border border-[#E5E7EB] rounded px-1.5 py-1 text-xs" />
                    <input type="time" value={s.endTime} onChange={e => setConfig(c => ({ ...c, slots: c.slots.map(x => x.periodNumber === s.periodNumber ? { ...x, endTime: e.target.value } : x) }))} className="border border-[#E5E7EB] rounded px-1.5 py-1 text-xs" />
                    <label className="flex items-center gap-1 text-xs font-semibold text-[#4B5563]">
                      <input type="checkbox" checked={!!s.isBreak} onChange={e => setConfig(c => ({ ...c, slots: c.slots.map(x => x.periodNumber === s.periodNumber ? { ...x, isBreak: e.target.checked } : x) }))} /> Break
                    </label>
                    {s.isBreak && <input value={s.breakLabel || ''} onChange={e => setConfig(c => ({ ...c, slots: c.slots.map(x => x.periodNumber === s.periodNumber ? { ...x, breakLabel: e.target.value } : x) }))} placeholder="Label" className="border border-[#E5E7EB] rounded px-1.5 py-1 text-xs w-24" />}
                    <button onClick={() => removeSlot(s.periodNumber)} className="ml-auto text-xs font-bold text-[#DC2626] hover:bg-[#FEF2F2] px-1.5 py-1 rounded">Remove</button>
                  </div>
                ))}
                <button onClick={addSlot} className="inline-flex items-center gap-1 text-xs font-bold text-[#1D7A4A]"><Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add slot</button>
              </div>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-[#4B5563]">Max periods/day per teacher</label>
                <input type="number" min={1} max={12} value={config.maxPeriodsPerDayPerTeacher} onChange={e => setConfig(c => ({ ...c, maxPeriodsPerDayPerTeacher: parseInt(e.target.value) || 6 }))} className="border border-[#E5E7EB] rounded px-2 py-1 text-xs w-16" />
              </div>
              <div className="flex items-center gap-2">
                <button onClick={saveConfig} disabled={savingConfig} className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D7A4A] text-white rounded-lg text-xs font-semibold hover:bg-[#155B37] disabled:opacity-60">
                  <Save className="w-3.5 h-3.5" /> {savingConfig ? 'Saving…' : 'Save Schedule'}
                </button>
                {configSaved && <span className="text-xs font-semibold text-[#0F6E56]">Saved</span>}
              </div>
            </div>
          )}
        </div>

        {/* Availability */}
        <div className="bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
          <button onClick={() => setShowAvail(s => !s)} className="w-full flex items-center justify-between px-5 py-4">
            <span className="flex items-center gap-2 text-sm font-bold text-[#1A1D23]"><User className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} /> Teacher Availability</span>
            <span className="text-xs font-semibold text-[#6B7280]">{availability.length} block{availability.length === 1 ? '' : 's'}</span>
          </button>
          {showAvail && (
            <div className="px-5 pb-5 space-y-3 border-t border-[#E5E7EB] pt-4">
              <p className="text-xs text-[#6B7280]">Teachers are available everywhere by default. Add a block to mark a teacher off for a slot (leave period empty for the whole day).</p>
              <div className="flex flex-wrap items-end gap-2">
                <select value={availForm.teacherId} onChange={e => setAvailForm(f => ({ ...f, teacherId: e.target.value }))} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs min-w-[140px]">
                  <option value="">Teacher…</option>
                  {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                </select>
                <select value={availForm.dayOfWeek} onChange={e => setAvailForm(f => ({ ...f, dayOfWeek: e.target.value }))} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs">
                  {DAYS.map(d => <option key={d} value={d}>{DAY_SHORT[d]}</option>)}
                </select>
                <input type="number" min={1} max={12} placeholder="Period (all)" value={availForm.periodNumber} onChange={e => setAvailForm(f => ({ ...f, periodNumber: e.target.value }))} className="border border-[#E5E7EB] rounded-lg px-2 py-1.5 text-xs w-24" />
                <button onClick={addAvailability} disabled={!availForm.teacherId} className="inline-flex items-center gap-1 px-3 py-1.5 bg-[#1D7A4A] text-white rounded-lg text-xs font-semibold disabled:opacity-50"><Plus className="w-3.5 h-3.5" /> Block</button>
              </div>
              <div className="space-y-1.5 max-h-48 overflow-y-auto">
                {availability.length === 0 ? <p className="text-xs text-[#9CA3AF]">No blocks.</p> : availability.map(a => (
                  <div key={a.id} className="flex items-center justify-between bg-[#F9FAFB] border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-xs">
                    <span className="font-semibold text-[#1A1D23]">
                      {a.teacher ? `${a.teacher.firstName} ${a.teacher.lastName}` : (teacherById[a.teacherId] ? `${teacherById[a.teacherId].firstName} ${teacherById[a.teacherId].lastName}` : 'Teacher')}
                      <span className="text-[#6B7280] font-medium"> · {DAY_SHORT[a.dayOfWeek]}{a.periodNumber ? ` · P${a.periodNumber}` : ' · all day'}</span>
                    </span>
                    <button onClick={() => removeAvailability(a.id)} className="text-[#DC2626] hover:bg-[#FEF2F2] rounded p-1"><Trash2 className="w-3.5 h-3.5" /></button>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Report */}
      {result && (
        <div className={`rounded-xl border p-5 shadow-sm ${result.report.feasible ? 'bg-[#F0FDF4] border-[#26A96B]/30' : 'bg-[#FFFBEB] border-[#F59E0B]/30'}`}>
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex items-center gap-2">
              {result.report.feasible
                ? <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#0F6E56]"><Check className="w-4 h-4" strokeWidth={2.5} /> Complete schedule generated</span>
                : <span className="inline-flex items-center gap-1.5 text-sm font-bold text-[#92400E]"><AlertTriangle className="w-4 h-4" strokeWidth={2} /> Generated with {result.report.unplacedCount} unplaced period(s)</span>}
              <span className="text-xs font-semibold text-[#6B7280]">{result.report.placed}/{result.report.totalDemands} periods placed</span>
            </div>
            <div className="flex items-center gap-2">
              <button onClick={generate} disabled={generating} className="inline-flex items-center gap-1.5 px-3 py-2 border border-[#E5E7EB] bg-white rounded-lg text-xs font-semibold text-[#4B5563] hover:bg-[#F9FAFB] disabled:opacity-60">
                <RefreshCw className={`w-3.5 h-3.5 ${generating ? 'animate-spin' : ''}`} /> Regenerate
              </button>
              <button onClick={apply} disabled={applying || applied} className="inline-flex items-center gap-1.5 px-4 py-2 bg-[#1D7A4A] text-white rounded-lg text-xs font-semibold hover:bg-[#155B37] disabled:opacity-60">
                <Save className="w-3.5 h-3.5" /> {applied ? 'Applied ✓' : applying ? 'Applying…' : 'Apply accepted sections'}
              </button>
            </div>
          </div>

          {(result.report.warnings.length > 0 || result.report.unplaced.length > 0) && (
            <div className="mt-3 pt-3 border-t border-[#E5E7EB]/60 space-y-1">
              {result.report.warnings.map((w, i) => <p key={`w${i}`} className="text-xs font-semibold text-[#B45309]">⚠ {w}</p>)}
              {result.report.unplaced.map((u, i) => <p key={`u${i}`} className="text-xs font-semibold text-[#B91C1C]">✗ {u}</p>)}
            </div>
          )}
          {applied && <p className="mt-3 text-xs font-semibold text-[#0F6E56]">Timetable applied for the accepted sections. View it under the Class Timetable tab.</p>}
        </div>
      )}

      {/* Per-section review: nothing is written until a section is explicitly
          switched to "Use generated" and Apply is pressed. */}
      {result && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <span className="text-xs font-bold text-[#4B5563] uppercase tracking-wider">Review by section</span>
          </div>
          <div className="divide-y divide-[#E5E7EB] max-h-80 overflow-y-auto">
            {unitStats.map(u => (
              <div key={u.key} className={`flex items-center gap-3 px-5 py-2.5 ${previewUnitKey === u.key ? 'bg-[#E5F6EE]/40' : ''}`}>
                <button onClick={() => setPreviewUnitKey(u.key)} className="flex-1 text-left text-sm font-semibold text-[#1A1D23] hover:text-[#1D7A4A] truncate">
                  {u.label}
                </button>
                <span className="text-[11px] font-semibold text-[#6B7280] shrink-0">{u.filled}/{u.total} slots filled</span>
                <div className="flex gap-1 shrink-0 bg-[#F3F4F6] p-0.5 rounded-lg">
                  <button
                    onClick={() => setDecisions(prev => ({ ...prev, [u.key]: 'current' }))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${decisionFor(u.key) === 'current' ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-[#6B7280]'}`}>
                    Keep current
                  </button>
                  <button
                    onClick={() => setDecisions(prev => ({ ...prev, [u.key]: 'generated' }))}
                    className={`px-2.5 py-1 rounded-md text-[11px] font-semibold transition-all ${decisionFor(u.key) === 'generated' ? 'bg-[#1D7A4A] text-white shadow-sm' : 'text-[#6B7280]'}`}>
                    Use generated
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Side-by-side preview for the selected section */}
      {result && preview && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-sm overflow-hidden">
          <div className="flex items-center justify-between gap-3 px-5 py-3 border-b border-[#E5E7EB] bg-[#F9FAFB]">
            <span className="text-sm font-bold text-[#1A1D23]">{preview.label}</span>
            <span className="text-[11px] font-semibold text-[#6B7280]">
              {decisionFor(previewUnitKey) === 'generated' ? 'Will apply the generated grid below' : 'Will keep the current grid below'}
            </span>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 divide-y lg:divide-y-0 lg:divide-x divide-[#E5E7EB]">
            <div>
              <p className="px-5 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Current (saved)</p>
              <div className="overflow-x-auto p-3">
                {loadingCurrent ? (
                  <p className="text-xs text-[#9CA3AF] py-6 text-center">Loading…</p>
                ) : currentPeriods.length === 0 ? (
                  <p className="text-xs text-[#9CA3AF] py-6 text-center">Nothing saved yet for this section.</p>
                ) : (
                  <MiniGrid days={previewWorkingDays} periodNumbers={previewPeriodNumbers} byCell={currentByCell}
                    nameOf={(p) => p?.subject?.name} teacherOf={(p) => p?.teacher ? `${p.teacher.firstName} ${p.teacher.lastName}` : null} />
                )}
              </div>
            </div>
            <div>
              <p className="px-5 pt-3 text-[11px] font-bold uppercase tracking-wider text-[#6B7280]">Generated (draft)</p>
              <div className="overflow-x-auto p-3">
                <MiniGrid days={previewWorkingDays} periodNumbers={previewPeriodNumbers} byCell={previewByCell}
                  nameOf={(p) => p?.subjectId ? subjectById[p.subjectId]?.name : null}
                  teacherOf={(p) => p?.teacherId && teacherById[p.teacherId] ? `${teacherById[p.teacherId].firstName} ${teacherById[p.teacherId].lastName}` : null} />
              </div>
            </div>
          </div>
        </div>
      )}

      {!result && !generating && (
        <div className="text-center py-16 bg-white border border-[#E5E7EB] rounded-xl shadow-sm">
          <Sparkles className="mx-auto h-12 w-12 text-[#9CA3AF] mb-3" strokeWidth={1.25} />
          <h3 className="text-sm font-bold text-[#1A1D23] mb-1">No draft yet</h3>
          <p className="text-xs text-[#6B7280] max-w-md mx-auto">Set each subject&apos;s periods/week (in Staff → Subjects), review the bell schedule and availability above, then click <span className="font-semibold">Generate Draft</span>.</p>
        </div>
      )}
    </div>
  );
}
