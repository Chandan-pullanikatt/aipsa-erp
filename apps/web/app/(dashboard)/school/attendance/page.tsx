'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { 
  Users, 
  UserCog, 
  BarChart3, 
  Clock, 
  CheckCircle, 
  X, 
  Search, 
  Plus 
} from 'lucide-react';

type Tab = 'mark' | 'teachers' | 'reports' | 'leave';

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; }
interface StudentRow { id: string; firstName: string; lastName: string; admissionNumber: string; }
interface AttendanceRecord { studentId: string; status: string; }
interface TeacherUser { id: string; firstName: string; lastName: string; email: string; }
interface LeaveItem {
  id: string; fromDate: string; toDate: string; reason: string; status: string;
  student: { firstName: string; lastName: string; admissionNumber: string } | null;
  user: { firstName: string; lastName: string; role: string } | null;
}

const STATUS_CYCLE: Record<string, string> = { PRESENT: 'ABSENT', ABSENT: 'LATE', LATE: 'PRESENT' };
const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-[#D6F0E4] text-[#0F6E56]',
  ABSENT: 'bg-[#FCEBEB] text-[#A32D2D]',
  LATE: 'bg-[#FAEEDA] text-[#854F0B]',
  HALF_DAY: 'bg-[#EEF2FF] text-[#4338CA]',
};
const LEAVE_STYLE: Record<string, string> = {
  PENDING: 'bg-[#FAEEDA] text-[#854F0B]',
  APPROVED: 'bg-[#D6F0E4] text-[#0F6E56]',
  REJECTED: 'bg-[#FCEBEB] text-[#A32D2D]',
};

function today() { return new Date().toISOString().split('T')[0]; }

export default function AttendancePage() {
  const [tab, setTab] = useState<Tab>('mark');
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [teachers, setTeachers] = useState<TeacherUser[]>([]);

  useEffect(() => {
    api.get('/sis/classes').then(r => setClasses(r.data)).catch(console.error);
    api.get('/schools/users', { params: { role: 'TEACHER', limit: 100 } }).then(r => setTeachers(r.data.users)).catch(console.error);
  }, []);

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#E5E7EB] mb-6">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Attendance Management</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Track daily student and instructor logs, authorize leave declarations, and download administrative outlines.
          </p>
        </div>
      </div>

      {/* Navigation Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB]">
        <button
          onClick={() => setTab('mark')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            tab === 'mark'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <Users className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Mark Students
        </button>

        <button
          onClick={() => setTab('teachers')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            tab === 'teachers'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <UserCog className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Mark Instructors
        </button>

        <button
          onClick={() => setTab('reports')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            tab === 'reports'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <BarChart3 className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Attendance Reports
        </button>

        <button
          onClick={() => setTab('leave')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            tab === 'leave'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <Clock className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Leave Requests
        </button>
      </div>

      <div className="mt-6">
        {tab === 'mark' && <MarkStudents classes={classes} sections={sections} setSections={setSections} />}
        {tab === 'teachers' && <MarkTeachers teachers={teachers} />}
        {tab === 'reports' && <AttendanceReports classes={classes} />}
        {tab === 'leave' && <LeaveManagement />}
      </div>
    </div>
  );
}

// ─── Mark Students Tab ───────────────────────────────────────────────────────

function MarkStudents({ classes, sections, setSections }: { classes: ClassItem[]; sections: SectionItem[]; setSections: any }) {
  const [date, setDate] = useState(today());
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    if (classId) {
      api.get(`/sis/classes/${classId}/sections`).then(r => setSections(r.data)).catch(console.error);
      setSectionId('');
    }
  }, [classId, setSections]);

  async function loadAttendance() {
    if (!classId || !date) return;
    setLoading(true); setLoaded(false);
    try {
      const params: any = { classId, date };
      if (sectionId) params.sectionId = sectionId;

      const [studentRes, existingRes] = await Promise.all([
        api.get('/sis/students', { params: { classId, ...(sectionId && { sectionId }), status: 'ACTIVE', limit: 200 } }),
        api.get('/attendance/students', { params }),
      ]);

      const s: StudentRow[] = studentRes.data.students;
      setStudents(s);

      const initial: Record<string, string> = {};
      s.forEach(st => { initial[st.id] = 'PRESENT'; });
      existingRes.data.forEach((r: AttendanceRecord) => { initial[r.studentId] = r.status; });
      setStatuses(initial);
      setLoaded(true);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    if (!classId || !date || students.length === 0) return;
    setSaving(true);
    try {
      const records = students.map(s => ({ studentId: s.id, status: statuses[s.id] || 'PRESENT' }));
      await api.post('/attendance/students/mark', { date, classId, sectionId: sectionId || undefined, records });
      setSaved(true);
      setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  function toggleStatus(studentId: string) {
    setStatuses(prev => ({ ...prev, [studentId]: STATUS_CYCLE[prev[studentId]] || 'PRESENT' }));
  }

  function markAll(status: string) {
    const all: Record<string, string> = {};
    students.forEach(s => { all[s.id] = status; });
    setStatuses(all);
  }

  const counts = students.reduce((acc, s) => {
    const st = statuses[s.id] || 'PRESENT';
    acc[st] = (acc[st] || 0) + 1;
    return acc;
  }, {} as Record<string, number>);

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)} className="w-full">
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {sections.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Section</label>
              <select value={sectionId} onChange={e => setSectionId(e.target.value)} className="w-full">
                <option value="">All sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            </div>
          )}
          <button 
            onClick={loadAttendance} 
            disabled={!classId || loading}
            className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-6 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-50 shrink-0"
          >
            {loading ? 'Loading...' : 'Load'}
          </button>
        </div>
      </div>

      {loaded && students.length > 0 && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex flex-wrap gap-2 text-xs">
              {Object.entries(counts).map(([s, n]) => (
                <span 
                  key={s} 
                  className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded border border-transparent ${STATUS_STYLE[s]}`}
                >
                  {s[0]+s.slice(1).toLowerCase()}: {n}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => markAll('PRESENT')} 
                className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#0F6E56] hover:bg-[#D6F0E4] h-[32px] px-3 rounded-md font-semibold text-xs transition-colors"
              >
                All Present
              </button>
              <button 
                onClick={() => markAll('ABSENT')} 
                className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#A32D2D] hover:bg-[#FCEBEB] h-[32px] px-3 rounded-md font-semibold text-xs transition-colors"
              >
                All Absent
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] w-12">#</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Adm. No.</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] text-center w-32">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {students.map((s, i) => {
                  const status = statuses[s.id] || 'PRESENT';
                  return (
                    <tr key={s.id} className="hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3 text-gray-400 text-xs">{i + 1}</td>
                      <td className="px-4 py-3 font-semibold text-[#1A1D23]">{s.firstName} {s.lastName}</td>
                      <td className="px-4 py-3 text-gray-400 font-mono text-xs">{s.admissionNumber}</td>
                      <td className="px-4 py-3 text-center">
                        <button 
                          onClick={() => toggleStatus(s.id)}
                          className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded cursor-pointer select-none transition-colors ${STATUS_STYLE[status]}`}
                        >
                          {status === 'HALF_DAY' ? 'Half' : status[0]+status.slice(1).toLowerCase()}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-6 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
            {saved && (
              <span className="inline-flex items-center text-sm font-medium text-[#0F6E56]">
                <CheckCircle className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                Attendance saved successfully
              </span>
            )}
          </div>
        </div>
      )}

      {loaded && students.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
          <Users className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
          <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No Active Students</h3>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">There are no active students matching this query.</p>
        </div>
      )}
    </div>
  );
}

// ─── Mark Teachers Tab ───────────────────────────────────────────────────────

function MarkTeachers({ teachers }: { teachers: TeacherUser[] }) {
  const [date, setDate] = useState(today());
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  async function loadTeacherAttendance() {
    const { data } = await api.get('/attendance/teachers', { params: { date } });
    const s: Record<string, string> = {};
    teachers.forEach(t => { s[t.id] = 'PRESENT'; });
    data.forEach((r: any) => { if (r.userId) s[r.userId] = r.status; });
    setStatuses(s);
    setLoaded(true);
  }

  async function handleSave() {
    setSaving(true);
    try {
      await Promise.all(
        teachers.map(t => api.post('/attendance/teachers/mark', { userId: t.id, date, status: statuses[t.id] || 'PRESENT' }))
      );
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex gap-4 items-end">
          <div className="flex-1">
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date</label>
            <input type="date" value={date} onChange={e => setDate(e.target.value)} className="w-full" />
          </div>
          <button 
            onClick={loadTeacherAttendance} 
            disabled={teachers.length === 0}
            className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-6 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-50 shrink-0"
          >
            Load
          </button>
        </div>
      </div>

      {teachers.length === 0 && (
        <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
          <UserCog className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
          <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No Instructors Found</h3>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">Please invite teachers through Staff Management directory first.</p>
        </div>
      )}

      {loaded && teachers.length > 0 && (
        <div className="space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Teacher</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Email</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] text-center w-48">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {teachers.map(t => {
                  const status = statuses[t.id] || 'PRESENT';
                  return (
                    <tr key={t.id} className="hover:bg-[#F9FAFB]">
                      <td className="px-4 py-3 font-semibold text-[#1A1D23]">{t.firstName} {t.lastName}</td>
                      <td className="px-4 py-3 text-[#6B7280] text-xs">{t.email}</td>
                      <td className="px-4 py-3 text-center">
                        <select 
                          value={status}
                          onChange={e => setStatuses(p => ({ ...p, [t.id]: e.target.value }))}
                          className="font-medium text-xs rounded border border-[#E5E7EB] focus:outline-none"
                        >
                          {['PRESENT','ABSENT','LATE','HALF_DAY'].map(s => (
                            <option key={s} value={s}>{s[0]+s.slice(1).toLowerCase()}</option>
                          ))}
                        </select>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-3 pt-2">
            <button 
              onClick={handleSave} 
              disabled={saving}
              className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-6 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save'}
            </button>
            {saved && (
              <span className="inline-flex items-center text-sm font-medium text-[#0F6E56]">
                <CheckCircle className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
                Instructor logs recorded
              </span>
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Reports Tab ─────────────────────────────────────────────────────────────

function AttendanceReports({ classes }: { classes: ClassItem[] }) {
  const [classId, setClassId] = useState('');
  const [studentSearch, setStudentSearch] = useState('');
  const [selectedStudent, setSelectedStudent] = useState<{ id: string; name: string } | null>(null);
  const [fromDate, setFromDate] = useState(() => { const d = new Date(); d.setDate(1); return d.toISOString().split('T')[0]; });
  const [toDate, setToDate] = useState(today());
  const [report, setReport] = useState<any>(null);
  const [students, setStudents] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (classId) {
      api.get('/sis/students', { params: { classId, status: 'ACTIVE', limit: 200 } })
        .then(r => setStudents(r.data.students)).catch(console.error);
    }
  }, [classId]);

  const filtered = students.filter(s =>
    studentSearch ? `${s.firstName} ${s.lastName} ${s.admissionNumber}`.toLowerCase().includes(studentSearch.toLowerCase()) : true
  );

  async function loadReport() {
    if (!selectedStudent) return;
    setLoading(true);
    try {
      const { data } = await api.get('/attendance/students/report', {
        params: { studentId: selectedStudent.id, fromDate, toDate }
      });
      setReport(data);
    } finally { setLoading(false); }
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-4">
        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Class</label>
            <select 
              value={classId} 
              onChange={e => { setClassId(e.target.value); setSelectedStudent(null); setReport(null); }}
              className="w-full"
            >
              <option value="">Select class</option>
              {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {classId && (
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1.5">Search Student</label>
              <input 
                value={studentSearch} 
                onChange={e => setStudentSearch(e.target.value)} 
                placeholder="Name or adm. no."
                className="w-full" 
              />
            </div>
          )}
        </div>

        {classId && filtered.length > 0 && !selectedStudent && (
          <div className="border border-[#E5E7EB] rounded-lg max-h-40 overflow-y-auto divide-y divide-[#F3F4F6] bg-white">
            {filtered.slice(0, 20).map(s => (
              <button 
                key={s.id} 
                onClick={() => setSelectedStudent({ id: s.id, name: `${s.firstName} ${s.lastName}` })}
                className="w-full text-left px-3 py-2 text-sm hover:bg-[#F7F8FA] text-[#1A1D23]"
              >
                {s.firstName} {s.lastName} <span className="text-gray-400 text-xs ml-1">({s.admissionNumber})</span>
              </button>
            ))}
          </div>
        )}

        {selectedStudent && (
          <div className="flex flex-wrap items-center gap-3 border-t border-[#E5E7EB] pt-4">
            <span className="inline-flex items-center text-[14px] font-semibold px-3 py-1 rounded bg-[#EEF2FF] text-[#4338CA]">
              {selectedStudent.name}
            </span>
            <button onClick={() => { setSelectedStudent(null); setReport(null); }} className="text-gray-400 hover:text-gray-600 font-bold text-sm">×</button>
            
            <div className="ml-auto flex gap-2 items-center flex-wrap">
              <input type="date" value={fromDate} onChange={e => setFromDate(e.target.value)} className="w-36 focus:outline-none" />
              <span className="text-gray-400 text-xs">to</span>
              <input type="date" value={toDate} onChange={e => setToDate(e.target.value)} className="w-36 focus:outline-none" />
              <button 
                onClick={loadReport} 
                disabled={loading} 
                className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-50"
              >
                {loading ? '...' : 'View'}
              </button>
            </div>
          </div>
        )}
      </div>

      {report && (
        <div className="space-y-6">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#EEF2FF] flex items-center justify-center text-[#4338CA]">
                <Clock className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="font-display text-[28px] font-bold text-[#1A1D23] mt-3">{report.summary.total}</p>
              <p className="font-body text-[13px] text-[#6B7280] mt-1">Total Days</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#D6F0E4] flex items-center justify-center text-[#0F6E56]">
                <CheckCircle className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="font-display text-[28px] font-bold text-[#1A1D23] mt-3">{report.summary.present}</p>
              <p className="font-body text-[13px] text-[#6B7280] mt-1">Present</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#FCEBEB] flex items-center justify-center text-[#A32D2D]">
                <X className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="font-display text-[28px] font-bold text-[#1A1D23] mt-3">{report.summary.absent}</p>
              <p className="font-body text-[13px] text-[#6B7280] mt-1">Absent</p>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <div className="w-[36px] h-[36px] rounded-lg bg-[#FAEEDA] flex items-center justify-center text-[#854F0B]">
                <BarChart3 className="w-5 h-5" strokeWidth={1.75} />
              </div>
              <p className="font-display text-[28px] font-bold text-[#1A1D23] mt-3">{report.summary.percentage}%</p>
              <p className="font-body text-[13px] text-[#6B7280] mt-1">Attendance Rate</p>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-[#F7F8FA] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Date</th>
                  <th className="px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280] text-center w-32">Status</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold uppercase tracking-wide text-[#6B7280]">Note</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#F3F4F6]">
                {report.records.map((r: any) => (
                  <tr key={r.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 text-gray-700">{new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}</td>
                    <td className="px-4 py-3 text-center">
                      <span className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded ${STATUS_STYLE[r.status]}`}>{r.status[0]+r.status.slice(1).toLowerCase()}</span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs">{r.note || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
            {report.records.length === 0 && <p className="text-center text-gray-400 py-8 text-sm bg-white">No records in this period.</p>}
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Leave Tab ───────────────────────────────────────────────────────────────

function LeaveManagement() {
  const [leaves, setLeaves] = useState<LeaveItem[]>([]);
  const [filter, setFilter] = useState('PENDING');
  const [loading, setLoading] = useState(true);
  const [reviewNote, setReviewNote] = useState<Record<string, string>>({});

  const fetchLeaves = useCallback(async () => {
    setLoading(true);
    try {
      const params: any = { limit: 50 };
      if (filter) params.status = filter;
      const { data } = await api.get('/attendance/leave', { params });
      setLeaves(data.leaves);
    } finally { setLoading(false); }
  }, [filter]);

  useEffect(() => { fetchLeaves(); }, [fetchLeaves]);

  async function handleReview(id: string, status: 'APPROVED' | 'REJECTED') {
    await api.patch(`/attendance/leave/${id}/review`, { status, reviewNote: reviewNote[id] || '' });
    fetchLeaves();
  }

  return (
    <div className="max-w-3xl space-y-6">
      <div className="flex gap-2">
        {[
          ['PENDING', 'Pending'],
          ['APPROVED', 'Approved'],
          ['REJECTED', 'Rejected'],
          ['', 'All Statuses']
        ].map(([val, label]) => (
          <button 
            key={val} 
            onClick={() => setFilter(val)}
            className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] ${
              filter === val 
                ? 'bg-[#1D7A4A] text-white' 
                : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="py-20 text-center text-sm text-[#6B7280]">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#26A96B] mx-auto mb-4"></div>
          Loading Leave Requests...
        </div>
      ) : (
        <div className="space-y-4">
          {leaves.map(leave => {
            const name = leave.student
              ? `${leave.student.firstName} ${leave.student.lastName} (${leave.student.admissionNumber})`
              : leave.user ? `${leave.user.firstName} ${leave.user.lastName} · ${leave.user.role}` : '—';
            return (
              <div key={leave.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-3">
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 space-y-1">
                    <div className="flex items-center gap-2">
                      <span className="font-semibold text-sm text-gray-800">{name}</span>
                      <span className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded ${LEAVE_STYLE[leave.status]}`}>{leave.status}</span>
                    </div>
                    <p className="text-xs text-gray-400">
                      {new Date(leave.fromDate).toLocaleDateString('en-IN')} → {new Date(leave.toDate).toLocaleDateString('en-IN')}
                    </p>
                    <p className="text-sm text-gray-600 pt-1">{leave.reason}</p>
                  </div>
                  {leave.status === 'PENDING' && (
                    <div className="flex flex-col gap-2 shrink-0">
                      <input 
                        value={reviewNote[leave.id] || ''} 
                        onChange={e => setReviewNote(p => ({ ...p, [leave.id]: e.target.value }))}
                        placeholder="Note (optional)" 
                        className="w-40 focus:outline-none" 
                      />
                      <div className="flex gap-2">
                        <button 
                          onClick={() => handleReview(leave.id, 'APPROVED')} 
                          className="inline-flex items-center justify-center bg-[#D6F0E4] hover:bg-[#26A96B]/25 text-[#0F6E56] h-[32px] px-3 rounded-md font-medium text-[12px] transition-colors"
                        >
                          Approve
                        </button>
                        <button 
                          onClick={() => handleReview(leave.id, 'REJECTED')} 
                          className="inline-flex items-center justify-center bg-[#FCEBEB] hover:bg-[#DC2626]/25 text-[#A32D2D] h-[32px] px-3 rounded-md font-medium text-[12px] transition-colors"
                        >
                          Reject
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
          {leaves.length === 0 && (
            <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
              <Clock className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
              <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No Leave Requests</h3>
              <p className="font-body text-[14px] text-[#6B7280] mt-1">There are no leave requests registered under this filter.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}