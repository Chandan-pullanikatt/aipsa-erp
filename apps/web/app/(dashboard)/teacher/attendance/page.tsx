'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { ClipboardList, Calendar, Users, CheckCircle, AlertCircle, Clock } from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; }
interface StudentRow { id: string; firstName: string; lastName: string; admissionNumber: string; }

const STATUS_CYCLE: Record<string, string> = { PRESENT: 'ABSENT', ABSENT: 'LATE', LATE: 'PRESENT' };
const STATUS_STYLE: Record<string, string> = {
  PRESENT: 'bg-[#E5F6EE] text-[#1D7A4A] border-[#1D7A4A]/20',
  ABSENT: 'bg-red-50 text-red-700 border-red-200',
  LATE: 'bg-amber-50 text-amber-700 border-amber-200',
};

function today() { return new Date().toISOString().split('T')[0]; }

export default function TeacherAttendancePage() {
  const [myClasses, setMyClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [sectionId, setSectionId] = useState('');
  const [date, setDate] = useState(today());
  const [students, setStudents] = useState<StudentRow[]>([]);
  const [statuses, setStatuses] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);
  const [userId, setUserId] = useState('');

  useEffect(() => {
    const u = getUser();
    if (u) {
      setUserId(u.id);
      api.get('/homework/my-classes').then(r => setMyClasses(r.data)).catch(console.error);
    }
  }, []);

  useEffect(() => {
    setSectionId('');
    if (classId) {
      api.get(`/sis/classes/${classId}/sections`).then(r => setSections(r.data)).catch(console.error);
    } else {
      setSections([]);
    }
  }, [classId]);

  async function loadAttendance() {
    if (!classId || !date) return;
    setLoading(true); setLoaded(false);
    try {
      const [studRes, attRes] = await Promise.all([
        api.get('/sis/students', { params: { classId, ...(sectionId && { sectionId }), status: 'ACTIVE', limit: 200 } }),
        api.get('/attendance/students', { params: { classId, ...(sectionId && { sectionId }), date } }),
      ]);
      const s: StudentRow[] = studRes.data.students;
      setStudents(s);
      const init: Record<string, string> = {};
      s.forEach(st => { init[st.id] = 'PRESENT'; });
      attRes.data.forEach((r: any) => { init[r.studentId] = r.status; });
      setStatuses(init);
      setLoaded(true);
    } finally { setLoading(false); }
  }

  async function handleSave() {
    setSaving(true);
    try {
      const records = students.map(s => ({ studentId: s.id, status: statuses[s.id] || 'PRESENT' }));
      await api.post('/attendance/students/mark', { date, classId, sectionId: sectionId || undefined, records });
      setSaved(true); setTimeout(() => setSaved(false), 3000);
    } finally { setSaving(false); }
  }

  const counts = students.reduce((a, s) => { const st = statuses[s.id] || 'PRESENT'; a[st] = (a[st] || 0) + 1; return a; }, {} as Record<string, number>);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
          <ClipboardList className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
          Mark Attendance
        </h1>
        <p className="text-sm text-gray-500 font-body">Record and manage daily classroom attendance isolation.</p>
      </div>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="flex flex-wrap gap-4 items-end">
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Date</label>
            <div className="relative">
              <input type="date" value={date} onChange={e => setDate(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg pl-3 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] font-body" />
            </div>
          </div>
          <div className="flex-1 min-w-[200px]">
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Class</label>
            <select value={classId} onChange={e => setClassId(e.target.value)}
              className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] font-body">
              <option value="">Select class</option>
              {myClasses.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </div>
          {sections.length > 0 && (
            <div className="flex-1 min-w-[200px]">
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Section</label>
              <select value={sectionId} onChange={e => setSectionId(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] font-body">
                <option value="">All sections</option>
                {sections.map(s => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            </div>
          )}
          <button onClick={loadAttendance} disabled={!classId || loading}
            className="px-5 py-2 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-50 transition-colors font-display min-w-[100px] h-[38px] flex items-center justify-center">
            {loading ? 'Loading...' : 'Load Roster'}
          </button>
        </div>
        {myClasses.length === 0 && (
          <div className="mt-4 flex items-center gap-2 p-3 bg-amber-50 rounded-lg border border-amber-200/50 text-amber-800 text-xs font-body">
            <AlertCircle className="w-4 h-4 shrink-0" strokeWidth={1.75} />
            <span>No classes assigned yet. Classes appear here once subjects or timetable periods are assigned to you.</span>
          </div>
        )}
      </div>

      {loaded && students.length > 0 && (
        <div className="space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex gap-2">
              {Object.entries(counts).map(([s, n]) => (
                <span key={s} className={`px-3 py-1 rounded-full text-xs font-semibold border ${STATUS_STYLE[s]} font-body`}>
                  {s[0]+s.slice(1).toLowerCase()}: {n}
                </span>
              ))}
            </div>
            <div className="flex gap-2">
              <button 
                onClick={() => { const a: Record<string,string> = {}; students.forEach(s => a[s.id] = 'PRESENT'); setStatuses(a); }} 
                className="text-xs px-3 py-1.5 bg-[#E5F6EE] text-[#1D7A4A] font-semibold rounded-lg hover:bg-[#E5F6EE]/80 border border-[#1D7A4A]/10 transition-colors font-display"
              >
                All Present
              </button>
              <button 
                onClick={() => { const a: Record<string,string> = {}; students.forEach(s => a[s.id] = 'ABSENT'); setStatuses(a); }} 
                className="text-xs px-3 py-1.5 bg-red-50 text-red-700 font-semibold rounded-lg hover:bg-red-100 border border-red-200/50 transition-colors font-display"
              >
                All Absent
              </button>
            </div>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <table className="w-full min-w-[640px] text-sm">
              <thead className="bg-gray-50 border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-display w-16">#</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-display">Student</th>
                  <th className="px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider text-center font-display w-64">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s, i) => {
                  const status = statuses[s.id] || 'PRESENT';
                  return (
                    <tr key={s.id} className="hover:bg-gray-50/50 transition-colors">
                      <td className="px-5 py-3.5 text-gray-400 font-mono text-xs">{i+1}</td>
                      <td className="px-5 py-3.5">
                        <p className="font-semibold text-gray-800 font-display">{s.firstName} {s.lastName}</p>
                        <p className="text-xs text-gray-400 font-mono mt-0.5">{s.admissionNumber}</p>
                      </td>
                      <td className="px-5 py-3.5 text-center">
                        <button 
                          onClick={() => setStatuses(p => ({ ...p, [s.id]: STATUS_CYCLE[p[s.id]] || 'PRESENT' }))}
                          className={`px-4 py-1.5 rounded-full text-xs font-bold border transition-colors cursor-pointer select-none font-body ${STATUS_STYLE[status]}`}
                        >
                          {status[0]+status.slice(1).toLowerCase()}
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>

          <div className="flex items-center gap-4">
            <button onClick={handleSave} disabled={saving}
              className="px-6 py-2.5 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-60 transition-colors font-display">
              {saving ? 'Saving...' : 'Save Attendance'}
            </button>
            {saved && (
              <span className="text-[#1D7A4A] text-sm font-semibold font-body flex items-center gap-1">
                <CheckCircle className="w-4 h-4" strokeWidth={2} />
                Attendance saved successfully
              </span>
            )}
          </div>
        </div>
      )}
      {loaded && students.length === 0 && (
        <div className="py-12 text-center bg-white rounded-xl border border-[#E5E7EB]">
          <Users className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-sm font-medium text-gray-500 font-display">No active students found in this class.</p>
        </div>
      )}
    </div>
  );
}

