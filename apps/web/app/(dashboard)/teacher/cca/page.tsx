'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Award, Save, CheckCircle } from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface Area { id: string; name: string; }
interface Student { id: string; firstName: string; lastName: string; admissionNumber: string; }

const TERMS = [['TERM_1', 'Term 1'], ['TERM_2', 'Term 2'], ['ANNUAL', 'Annual']] as const;
const GRADES = ['A', 'B', 'C'];

export default function TeacherCcaPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('TERM_1');
  const [areas, setAreas] = useState<Area[]>([]);
  const [students, setStudents] = useState<Student[]>([]);
  // grid[studentId][areaId] = grade
  const [grid, setGrid] = useState<Record<string, Record<string, string>>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    api.get('/sis/classes').then(r => { setClasses(r.data); if (r.data[0]) setClassId(r.data[0].id); }).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    if (!classId || !term) return;
    setLoading(true); setSaved(false);
    try {
      const { data } = await api.get('/progress/cca/entry', { params: { classId, term } });
      setAreas(data.areas);
      setStudents(data.students);
      // invert grid[areaId][studentId] -> grid[studentId][areaId]
      const g: Record<string, Record<string, string>> = {};
      data.students.forEach((s: Student) => { g[s.id] = {}; });
      Object.entries(data.grid as Record<string, Record<string, string>>).forEach(([areaId, byStudent]) => {
        Object.entries(byStudent).forEach(([sid, grade]) => { (g[sid] ||= {})[areaId] = grade; });
      });
      setGrid(g);
    } finally { setLoading(false); }
  }, [classId, term]);

  useEffect(() => { load(); }, [load]);

  function setGrade(studentId: string, areaId: string, grade: string) {
    setGrid(prev => ({ ...prev, [studentId]: { ...prev[studentId], [areaId]: grade } }));
    setSaved(false);
  }

  async function save() {
    setSaving(true);
    try {
      const records: { ccaAreaId: string; studentId: string; grade: string }[] = [];
      students.forEach(s => areas.forEach(a => {
        records.push({ ccaAreaId: a.id, studentId: s.id, grade: grid[s.id]?.[a.id] || '' });
      }));
      await api.post('/progress/cca/entry', { term, records });
      setSaved(true);
    } finally { setSaving(false); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight flex items-center gap-2">
          <Award className="w-7 h-7 text-[#1D7A4A]" strokeWidth={2} /> CCA Grading
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Grade students (A / B / C) in the co-curricular activities assigned to you.</p>
      </div>

      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20">
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Term</label>
          <select value={term} onChange={e => setTerm(e.target.value)}
            className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20">
            {TERMS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
          </select>
        </div>
        <button onClick={save} disabled={saving || areas.length === 0}
          className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155D37] disabled:opacity-50 text-white h-[38px] px-4 rounded-lg font-semibold text-[13px] transition-colors">
          {saved ? <CheckCircle className="w-4 h-4" /> : <Save className="w-4 h-4" />} {saved ? 'Saved' : saving ? 'Saving…' : 'Save Grades'}
        </button>
      </div>

      {loading ? (
        <p className="text-gray-400 text-sm py-10 font-body">Loading…</p>
      ) : areas.length === 0 ? (
        <div className="py-16 text-center border border-dashed border-gray-250 rounded-2xl bg-gray-50">
          <p className="text-sm font-semibold text-gray-700 font-display">No CCA activities assigned to you for this class</p>
          <p className="text-xs text-gray-400 mt-1">Ask your admin to assign you a co-curricular activity under Co-Curricular settings.</p>
        </div>
      ) : (
        <div className="border border-gray-200 rounded-2xl overflow-x-auto shadow-sm bg-white">
          <table className="w-full min-w-[640px] text-left border-collapse text-sm">
            <thead>
              <tr className="bg-gray-50/50 border-b border-gray-150 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                <th className="px-5 py-3 sticky left-0 bg-gray-50">Student</th>
                {areas.map(a => <th key={a.id} className="px-4 py-3 text-center">{a.name}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {students.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-5 py-2.5 font-medium text-gray-700 sticky left-0 bg-white">
                    {s.firstName} {s.lastName}
                    <span className="block text-[11px] text-gray-400">{s.admissionNumber}</span>
                  </td>
                  {areas.map(a => (
                    <td key={a.id} className="px-4 py-2.5 text-center">
                      <select value={grid[s.id]?.[a.id] || ''} onChange={e => setGrade(s.id, a.id, e.target.value)}
                        className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20">
                        <option value="">—</option>
                        {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                      </select>
                    </td>
                  ))}
                </tr>
              ))}
              {students.length === 0 && <tr><td colSpan={areas.length + 1} className="px-5 py-10 text-center text-gray-400">No active students in this class.</td></tr>}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
