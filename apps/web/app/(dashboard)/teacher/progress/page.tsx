'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { BarChart3, Save, Lock, Unlock, CheckCircle } from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface Student { id: string; firstName: string; lastName: string; admissionNumber: string; }
interface ProgressRow {
  conduct: Record<string, string> | null;
  achievements: string | null;
  remark: string | null;
  status: string;
}
interface Entry { student: Student; progress: ProgressRow | null; }

const TERMS = [['TERM_1', 'Term 1'], ['TERM_2', 'Term 2'], ['ANNUAL', 'Annual']] as const;
const GRADES = ['A', 'B', 'C'];
const TRAIT_LABELS: Record<string, string> = { discipline: 'Discipline', punctuality: 'Punctuality', neatness: 'Neatness', teamwork: 'Teamwork' };

type Draft = { conduct: Record<string, string>; achievements: string; remark: string; status: string };

export default function TeacherProgressPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [term, setTerm] = useState('TERM_1');
  const [traits, setTraits] = useState<string[]>([]);
  const [entries, setEntries] = useState<Entry[]>([]);
  const [drafts, setDrafts] = useState<Record<string, Draft>>({});
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [busy, setBusy] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sis/classes').then(r => { setClasses(r.data); if (r.data[0]) setClassId(r.data[0].id); }).catch(console.error);
  }, []);

  const load = useCallback(async () => {
    if (!classId || !term) return;
    setLoading(true); setError('');
    try {
      const { data } = await api.get('/progress/entry', { params: { classId, term } });
      setTraits(data.conductTraits);
      setEntries(data.students);
      const d: Record<string, Draft> = {};
      data.students.forEach((e: Entry) => {
        d[e.student.id] = {
          conduct: (e.progress?.conduct as Record<string, string>) || {},
          achievements: e.progress?.achievements || '',
          remark: e.progress?.remark || '',
          status: e.progress?.status || 'DRAFT',
        };
      });
      setDrafts(d);
    } catch (err: any) {
      setError(err.response?.data?.error || 'You may not be the class teacher for this class.');
      setEntries([]);
    } finally { setLoading(false); }
  }, [classId, term]);

  useEffect(() => { load(); }, [load]);

  function patch(sid: string, p: Partial<Draft>) {
    setDrafts(prev => ({ ...prev, [sid]: { ...prev[sid], ...p } }));
  }
  function setTrait(sid: string, trait: string, grade: string) {
    setDrafts(prev => ({ ...prev, [sid]: { ...prev[sid], conduct: { ...prev[sid].conduct, [trait]: grade } } }));
  }

  async function save(sid: string) {
    setBusy(sid); setError('');
    try {
      const d = drafts[sid];
      await api.post('/progress/entry', { studentId: sid, term, conduct: d.conduct, achievements: d.achievements, remark: d.remark });
    } catch (err: any) { setError(err.response?.data?.error || 'Error saving.'); }
    finally { setBusy(null); }
  }

  async function publish(sid: string) {
    setBusy(sid); setError('');
    try {
      await api.post('/progress/entry', { studentId: sid, term, conduct: drafts[sid].conduct, achievements: drafts[sid].achievements, remark: drafts[sid].remark });
      await api.post('/progress/publish', { studentId: sid, term });
      patch(sid, { status: 'PUBLISHED' });
    } catch (err: any) { setError(err.response?.data?.error || 'Error publishing.'); }
    finally { setBusy(null); }
  }

  async function unpublish(sid: string) {
    setBusy(sid); setError('');
    try { await api.post('/progress/unpublish', { studentId: sid, term }); patch(sid, { status: 'DRAFT' }); }
    catch (err: any) { setError(err.response?.data?.error || 'Error.'); }
    finally { setBusy(null); }
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-[#1D7A4A]" strokeWidth={2} /> Progress Cards
        </h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Fill conduct, achievements and remarks for your class, then publish each student&apos;s term card. Parents and students see a term only once you publish it.</p>
      </div>

      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 max-w-3xl font-body font-medium">{error}</div>
      )}

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
      </div>

      {loading ? <p className="text-gray-400 text-sm py-10 font-body">Loading…</p> : (
        <div className="space-y-4 max-w-4xl">
          {entries.map(({ student }) => {
            const d = drafts[student.id]; if (!d) return null;
            const published = d.status === 'PUBLISHED';
            return (
              <div key={student.id} className={`bg-white border rounded-2xl p-5 shadow-sm space-y-4 ${published ? 'border-[#1D7A4A]/30' : 'border-[#E5E7EB]'}`}>
                <div className="flex items-center justify-between gap-3 flex-wrap">
                  <div>
                    <p className="font-semibold text-[#1A1D23] font-display">{student.firstName} {student.lastName}</p>
                    <p className="text-xs text-gray-400">{student.admissionNumber}</p>
                  </div>
                  <span className={`text-[10px] font-bold px-2.5 py-0.5 rounded-full uppercase ${published ? 'bg-[#D6F0E4] text-[#0F6E56]' : 'bg-gray-100 text-gray-500'}`}>
                    {published ? 'Published' : 'Draft'}
                  </span>
                </div>

                <div>
                  <p className="text-xs font-semibold uppercase tracking-wider text-gray-500 mb-2 font-body">Conduct</p>
                  <div className="flex flex-wrap gap-4">
                    {traits.map(t => (
                      <div key={t} className="flex items-center gap-2">
                        <span className="text-sm text-gray-600">{TRAIT_LABELS[t] || t}</span>
                        <select disabled={published} value={d.conduct[t] || ''} onChange={e => setTrait(student.id, t, e.target.value)}
                          className="border border-[#E5E7EB] rounded-lg px-2 py-1 text-sm bg-white disabled:bg-gray-50">
                          <option value="">—</option>
                          {GRADES.map(g => <option key={g} value={g}>{g}</option>)}
                        </select>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Achievements (this term)</label>
                    <textarea disabled={published} value={d.achievements} onChange={e => patch(student.id, { achievements: e.target.value })} rows={2}
                      placeholder="e.g. Won inter-house quiz; District-level 100m"
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20" />
                  </div>
                  <div>
                    <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Class Teacher&apos;s Remark</label>
                    <textarea disabled={published} value={d.remark} onChange={e => patch(student.id, { remark: e.target.value })} rows={2}
                      placeholder="Overall remark for the term"
                      className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm disabled:bg-gray-50 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20" />
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {!published ? (
                    <>
                      <button onClick={() => save(student.id)} disabled={busy === student.id}
                        className="inline-flex items-center gap-1.5 border border-[#E5E7EB] hover:bg-gray-50 text-gray-700 px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        <Save className="w-4 h-4" /> Save Draft
                      </button>
                      <button onClick={() => publish(student.id)} disabled={busy === student.id}
                        className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                        <Lock className="w-4 h-4" /> Publish Card
                      </button>
                    </>
                  ) : (
                    <button onClick={() => unpublish(student.id)} disabled={busy === student.id}
                      className="inline-flex items-center gap-1.5 border border-[#1D7A4A]/30 text-[#1D7A4A] hover:bg-[#E5F6EE] px-4 py-2 rounded-lg text-sm font-semibold disabled:opacity-50">
                      <Unlock className="w-4 h-4" /> Unpublish to Edit
                    </button>
                  )}
                </div>
              </div>
            );
          })}
          {entries.length === 0 && !error && <p className="text-center text-gray-400 text-sm py-10 font-body">No active students in this class.</p>}
        </div>
      )}
    </div>
  );
}
