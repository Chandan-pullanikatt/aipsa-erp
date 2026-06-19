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
  Activity
} from 'lucide-react';

type Tab = 'class' | 'teacher';

interface ClassItem { id: string; name: string; }
interface Subject { id: string; name: string; code: string | null; }
interface Teacher { id: string; firstName: string; lastName: string; }

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
        {([['class', 'Class Timetable'], ['teacher', 'Teacher Schedule']] as [Tab, string][]).map(([t, l]) => (
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
    </div>
  );
}

// ─── Class Timetable Tab ──────────────────────────────────────────────────────

function ClassTimetableTab({ classes, teachers, academicYear }: { classes: ClassItem[]; teachers: Teacher[]; academicYear: string }) {
  const [classId, setClassId] = useState('');
  const [subjects, setSubjects] = useState<Subject[]>([]);
  const [periodConfig, setPeriodConfig] = useState<PeriodConfig[]>(DEFAULT_PERIODS);
  const [grid, setGrid] = useState<Record<string, CellData>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [conflicts, setConflicts] = useState<any[]>([]);
  const [editingConfig, setEditingConfig] = useState(false);

  useEffect(() => {
    if (!classId) return;
    api.get('/exams/subjects', { params: { classId } }).then(r => setSubjects(r.data)).catch(console.error);
    loadTimetable();
  }, [classId]);

  async function loadTimetable() {
    if (!classId) return;
    try {
      const { data } = await api.get('/timetable', { params: { classId, academicYear } });
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
      await api.post('/timetable/bulk', { classId, academicYear, periods });
      const conflictRes = await api.get('/timetable/conflicts', { params: { classId, academicYear } });
      setConflicts(conflictRes.data);
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  async function handleClear() {
    if (!confirm('Clear the entire timetable for this class?')) return;
    await api.delete('/timetable/class', { params: { classId, academicYear } });
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
                            <div className="relative flex items-center">
                              <BookOpen className="absolute left-2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                              <select value={cell.subjectId} onChange={e => setCell(day, pc.number, { subjectId: e.target.value })}
                                className="w-full pl-7 pr-1.5 py-1 text-xs border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] focus:border-[#1D7A4A] bg-white font-semibold text-[#1A1D23] transition-all cursor-pointer">
                                <option value="">— Subject —</option>
                                {subjects.map(s => <option key={s.id} value={s.id}>{s.name}</option>)}
                              </select>
                            </div>
                            <div className="relative flex items-center">
                              <User className="absolute left-2 w-3.5 h-3.5 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                              <select value={cell.teacherId} onChange={e => setCell(day, pc.number, { teacherId: e.target.value })}
                                className="w-full pl-7 pr-1.5 py-1 text-xs border border-[#E5E7EB] rounded-md focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] focus:border-[#1D7A4A] bg-white text-[#6B7280] font-medium hover:text-[#1A1D23] transition-all cursor-pointer">
                                <option value="">— Teacher —</option>
                                {teachers.map(t => <option key={t.id} value={t.id}>{t.firstName} {t.lastName}</option>)}
                              </select>
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
