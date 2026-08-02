'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import { printElement } from '@/lib/print';
import { StudentIdCard, type IdCardStudent, type IdCardSchool } from '@/components/StudentIdCard';
import { ArrowLeft, Printer, IdCard, Loader2 } from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; }

export default function IdCardsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [school, setSchool] = useState<IdCardSchool>({});
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [students, setStudents] = useState<IdCardStudent[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [singleMode, setSingleMode] = useState(false);

  // Load classes + school profile once.
  useEffect(() => {
    api.get('/sis/classes').then((r) => setClasses(r.data)).catch(() => {});
    api.get('/schools/profile').then((r) => setSchool(r.data || {})).catch(() => {});
  }, []);

  // Support deep-link from a student page: /id-cards?studentId=xxx shows one card.
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const sid = params.get('studentId');
    if (!sid) return;
    setSingleMode(true);
    setLoading(true);
    api.get(`/sis/students/${sid}`)
      .then((r) => setStudents([r.data]))
      .catch(() => setError('Could not load that student.'))
      .finally(() => setLoading(false));
  }, []);

  // Sections belong to a class, so the list refreshes whenever the class changes.
  useEffect(() => {
    if (!classId) { setSections([]); return; }
    let stale = false;
    api.get(`/sis/classes/${classId}/sections`)
      .then((r) => { if (!stale) setSections(r.data || []); })
      .catch(() => {});
    return () => { stale = true; };
  }, [classId]);

  async function loadStudents(cls: string, sec: string) {
    setStudents([]);
    setError('');
    if (!cls) return;
    setLoading(true);
    try {
      const params: Record<string, string | number> = { classId: cls, limit: 500, status: 'ACTIVE' };
      if (sec) params.sectionId = sec;
      const { data } = await api.get('/sis/students', { params });
      const list: IdCardStudent[] = data.students || data || [];
      if (!list.length) setError(sec ? 'No active students in this section.' : 'No active students in this class.');
      setStudents(list);
    } catch {
      setError('Could not load students.');
    } finally {
      setLoading(false);
    }
  }

  function onClassChange(id: string) {
    setClassId(id);
    setSectionId('');
    loadStudents(id, '');
  }

  function onSectionChange(id: string) {
    setSectionId(id);
    loadStudents(classId, id);
  }

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      {/* Cards must print true-to-size, so no shrink-to-fit here — just keep a
          front/back pair from being split across a page boundary. */}
      <style>{`
        @media print {
          #print-root .idcard-pair { break-inside: avoid; page-break-inside: avoid; margin-bottom: 6mm; }
        }
      `}</style>

      {/* toolbar (not printed) */}
      <div className="no-print">
        <Link href="/school/students" className="inline-flex items-center gap-1.5 text-sm font-semibold text-[#6B7280] hover:text-[#1A1D23] mb-4">
          <ArrowLeft className="w-4 h-4" /> Back to Students
        </Link>

        <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2">
              <IdCard className="w-6 h-6 text-[#1D7A4A]" /> Student ID Cards
            </h1>
            <p className="text-sm text-[#6B7280] font-medium mt-1">
              {singleMode ? 'Preview and print this student’s card.' : 'Pick a class — and optionally a section — to generate printable ID cards.'}
            </p>
          </div>

          <div className="flex items-end gap-3">
            {!singleMode && (
              <>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Class</label>
                  <select
                    value={classId}
                    onChange={(e) => onClassChange(e.target.value)}
                    className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium bg-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/30"
                  >
                    <option value="">Select a class…</option>
                    {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280] mb-1">Section</label>
                  <select
                    value={sectionId}
                    onChange={(e) => onSectionChange(e.target.value)}
                    disabled={!classId || sections.length === 0}
                    title={!classId ? 'Select a class first' : undefined}
                    className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-medium bg-white min-w-[180px] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/30 disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <option value="">All Sections</option>
                    {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                  </select>
                </div>
              </>
            )}
            <button
              onClick={() => printElement(document.getElementById('id-card-print-area'), { fit: 'flow' })}
              disabled={!students.length}
              className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold hover:bg-[#166038] disabled:opacity-40 disabled:cursor-not-allowed"
            >
              <Printer className="w-4 h-4" /> Print {students.length > 1 ? `(${students.length})` : ''}
            </button>
          </div>
        </div>

        {error && <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 mb-4">{error}</p>}
        {loading && (
          <p className="text-sm font-semibold text-[#6B7280] flex items-center gap-2 py-8 justify-center">
            <Loader2 className="w-4 h-4 animate-spin" /> Loading…
          </p>
        )}
        {!loading && !students.length && !error && (
          <p className="text-sm text-[#9CA3AF] font-semibold italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">
            {singleMode ? 'Loading student…' : 'Select a class above to see ID cards.'}
          </p>
        )}
      </div>

      {/* printable area */}
      <div id="id-card-print-area" className="flex flex-col gap-6 items-center sm:items-start">
        {students.map((s) => (
          <StudentIdCard key={s.admissionNumber} student={s} school={school} />
        ))}
      </div>
    </div>
  );
}
