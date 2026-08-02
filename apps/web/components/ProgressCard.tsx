'use client';

import { Printer, Award, GraduationCap, Users, Eye } from 'lucide-react';
import { printElement } from '@/lib/print';
import ReportLetterhead from '@/components/ReportLetterhead';

const TERMS = ['TERM_1', 'TERM_2', 'ANNUAL'] as const;
const TERM_LABELS: Record<string, string> = { TERM_1: 'Term 1', TERM_2: 'Term 2', ANNUAL: 'Annual' };
const TRAIT_LABELS: Record<string, string> = { discipline: 'Discipline', punctuality: 'Punctuality', neatness: 'Neatness', teamwork: 'Teamwork' };

interface Marks { obtained: number | null; max: number; grade: string | null; isAbsent: boolean; }
interface SubjectRow { id: string; name: string; code: string | null; teacher: string | null; marks: Record<string, Marks | null>; }
interface CcaRow { id: string; name: string; grades: Record<string, string | null>; }
interface TermMeta {
  term: string; published: boolean; visible: boolean; publishedAt: string | null;
  conduct: Record<string, string> | null; achievements: string | null; remark: string | null;
}
export interface CardData {
  student: { id: string; name: string; admissionNumber: string; photoUrl: string | null; class: string | null; section: string | null; dateOfBirth: string | null };
  academicYear: string;
  conductTraits: string[];
  anyPublished: boolean;
  classTeacher: string | null;
  faculty: { classTeacher: string | null; subjects: { subject: string; teacher: string | null }[]; frozenAt: string | null };
  terms: TermMeta[];
  subjects: SubjectRow[];
  cca: CcaRow[];
  cumulative: { totalObtained: number; totalMax: number; percentage: number; grade: string; result: string } | null;
}

function gradeCell(m: Marks | null) {
  if (!m) return <span className="text-gray-300">—</span>;
  if (m.isAbsent) return <span className="text-amber-600 font-semibold">AB</span>;
  return <span className="font-semibold text-gray-800">{m.obtained}<span className="text-gray-400 font-normal">/{m.max}</span> {m.grade && <span className="text-[#1D7A4A]">({m.grade})</span>}</span>;
}

/**
 * `draftPreview` is for staff (admin / class teacher) looking at a student's card
 * before it goes out. The API already sends them every term, published or not, so
 * the only thing standing in the way is the "not published yet" wall families see —
 * this drops it and warns instead.
 */
export default function ProgressCard({ card, variant = 'full', draftPreview = false }: { card: CardData; variant?: 'full' | 'cca'; draftPreview?: boolean }) {
  const termMeta = Object.fromEntries(card.terms.map(t => [t.term, t]));
  const ccaOnly = variant === 'cca';
  const unpublished = draftPreview ? card.terms.filter(t => !t.published).map(t => TERM_LABELS[t.term] || t.term) : [];

  // The holistic card is a multi-section record, not a one-sheet summary — it prints
  // at its natural A4 size and runs onto as many pages as it needs, repeating table
  // headers and never splitting a row. (Switch to `fit: 'page'` to cram it onto one.)
  function print() {
    printElement(document.getElementById('progress-card-print'), { fit: 'flow' });
  }

  if (!card.anyPublished && !draftPreview) {
    return (
      <div className="py-20 text-center border border-dashed border-gray-250 rounded-2xl bg-gray-50">
        <GraduationCap className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-gray-700 font-display">{ccaOnly ? 'CCA grades not published yet' : 'Progress card not published yet'}</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">
          {ccaOnly
            ? 'Your class teacher will publish co-curricular activity grades here once they are finalised.'
            : 'Your class teacher will publish the holistic progress card here once results are finalised.'}
        </p>
      </div>
    );
  }

  if (ccaOnly && card.cca.length === 0) {
    return (
      <div className="py-20 text-center border border-dashed border-gray-250 rounded-2xl bg-gray-50">
        <Award className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
        <p className="text-sm font-semibold text-gray-700 font-display">No co-curricular activities recorded</p>
        <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1">CCA grades will appear here once your class teacher records them.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unpublished.length > 0 && (
        <div className="no-print flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          <Eye className="w-4 h-4 shrink-0 mt-px" strokeWidth={1.75} />
          <p>
            <span className="font-bold">Staff preview.</span>{' '}
            {unpublished.length === card.terms.length
              ? 'No term has been published yet — the student and parent still see an empty card.'
              : `${unpublished.join(', ')} ${unpublished.length > 1 ? 'are' : 'is'} not published yet, so the family cannot see ${unpublished.length > 1 ? 'those terms' : 'that term'}.`}{' '}
            Publish from Progress Cards under the class teacher&apos;s portal.
          </p>
        </div>
      )}

      <div className="flex justify-end no-print">
        <button onClick={print} className="inline-flex items-center gap-1.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white px-4 py-2 rounded-lg text-sm font-semibold">
          <Printer className="w-4 h-4" /> {ccaOnly ? 'Print CCA Record' : 'Print Card'}
        </button>
      </div>

      <div id="progress-card-print" className="bg-white border border-gray-200 rounded-2xl shadow-sm overflow-hidden font-body">
        {/* Header */}
        <div className="bg-gradient-to-r from-[#1D7A4A] to-[#155D37] text-white px-6 py-5 flex items-center justify-between gap-4">
          <ReportLetterhead
            tone="dark"
            title={ccaOnly ? 'Co-Curricular Activities (CCA)' : 'Holistic Progress Card'}
            subtitle={`Academic Year ${card.academicYear}`}
          />
          {card.student.photoUrl
            ? <img src={card.student.photoUrl} alt="" className="w-16 h-16 rounded-xl object-cover border-2 border-white/40" />
            : <div className="w-16 h-16 rounded-xl bg-white/15 flex items-center justify-center"><GraduationCap className="w-8 h-8 text-white/80" /></div>}
        </div>

        {/* Student meta */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 px-6 py-4 border-b border-gray-150 text-sm">
          <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Name</p><p className="font-semibold text-gray-800">{card.student.name}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Adm. No</p><p className="font-semibold text-gray-800">{card.student.admissionNumber}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Class</p><p className="font-semibold text-gray-800">{card.student.class || '—'} {card.student.section ? `(${card.student.section})` : ''}</p></div>
          <div><p className="text-[10px] uppercase tracking-wider text-gray-400 font-semibold">Class Teacher</p><p className="font-semibold text-gray-800">{card.classTeacher || '—'}</p></div>
        </div>

        {/* Scholastic */}
        {!ccaOnly && (
        <Section title="Scholastic — Academic Performance" icon={<GraduationCap className="w-4 h-4" />}>
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="text-left px-4 py-2 font-semibold">Subject</th>
                {TERMS.map(t => <th key={t} className="px-3 py-2 font-semibold text-center">{TERM_LABELS[t]}{termMeta[t] && !termMeta[t].visible ? ' *' : ''}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {card.subjects.map(s => (
                <tr key={s.id}>
                  <td className="px-4 py-2 font-medium text-gray-700">{s.name}</td>
                  {TERMS.map(t => <td key={t} className="px-3 py-2 text-center">{gradeCell(s.marks[t])}</td>)}
                </tr>
              ))}
              {card.subjects.length === 0 && <tr><td colSpan={4} className="px-4 py-6 text-center text-gray-400">No subjects.</td></tr>}
            </tbody>
          </table>
        </Section>
        )}

        {/* Co-scholastic / CCA */}
        {card.cca.length > 0 && (
          <Section title="Co-Scholastic — Co-Curricular Activities (CCA)" icon={<Award className="w-4 h-4" />}>
            <table className="w-full text-sm border-collapse">
              <thead>
                <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                  <th className="text-left px-4 py-2 font-semibold">Activity</th>
                  {TERMS.map(t => <th key={t} className="px-3 py-2 font-semibold text-center">{TERM_LABELS[t]}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {card.cca.map(a => (
                  <tr key={a.id}>
                    <td className="px-4 py-2 font-medium text-gray-700">{a.name}</td>
                    {TERMS.map(t => <td key={t} className="px-3 py-2 text-center font-semibold text-[#1D7A4A]">{a.grades[t] || <span className="text-gray-300">—</span>}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
          </Section>
        )}

        {/* Conduct */}
        {!ccaOnly && (
        <Section title="Personal & Social Qualities (Conduct)">
          <table className="w-full text-sm border-collapse">
            <thead>
              <tr className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <th className="text-left px-4 py-2 font-semibold">Trait</th>
                {TERMS.map(t => <th key={t} className="px-3 py-2 font-semibold text-center">{TERM_LABELS[t]}</th>)}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {card.conductTraits.map(tr => (
                <tr key={tr}>
                  <td className="px-4 py-2 font-medium text-gray-700">{TRAIT_LABELS[tr] || tr}</td>
                  {TERMS.map(t => <td key={t} className="px-3 py-2 text-center font-semibold text-gray-700">{termMeta[t]?.conduct?.[tr] || <span className="text-gray-300">—</span>}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </Section>
        )}

        {/* Achievements + remarks per term */}
        {!ccaOnly && (
        <Section title="Achievements & Remarks">
          <div className="px-4 py-3 space-y-3">
            {TERMS.map(t => {
              const m = termMeta[t];
              if (!m || !m.visible || (!m.achievements && !m.remark)) return null;
              return (
                <div key={t} className="border border-gray-100 rounded-xl p-3 bg-gray-50/50">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#1D7A4A] mb-1">{TERM_LABELS[t]}</p>
                  {m.achievements && <p className="text-sm text-gray-700"><span className="font-semibold">Achievements:</span> {m.achievements}</p>}
                  {m.remark && <p className="text-sm text-gray-700 mt-0.5"><span className="font-semibold">Remark:</span> {m.remark}</p>}
                </div>
              );
            })}
          </div>
        </Section>
        )}

        {/* Result */}
        {!ccaOnly && card.cumulative && (
          <div className="px-6 py-4 bg-[#E5F6EE]/50 border-y border-[#1D7A4A]/10 flex flex-wrap items-center justify-between gap-3">
            <div className="text-sm">
              <span className="text-gray-500">Overall: </span>
              <span className="font-bold text-gray-800">{card.cumulative.totalObtained}/{card.cumulative.totalMax}</span>
              <span className="text-gray-400"> · {card.cumulative.percentage}% · Grade {card.cumulative.grade}</span>
            </div>
            <span className={`text-sm font-bold px-3 py-1 rounded-full ${card.cumulative.result === 'PROMOTED' ? 'bg-[#D6F0E4] text-[#0F6E56]' : 'bg-amber-50 text-amber-700'}`}>
              {card.cumulative.result}
            </span>
          </div>
        )}

        {/* Faculty */}
        {!ccaOnly && (
        <Section title="Faculty" icon={<Users className="w-4 h-4" />}>
          <div className="px-4 py-3 grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1 text-sm">
            <p className="text-gray-700"><span className="font-semibold">Class Teacher:</span> {card.faculty.classTeacher || '—'}</p>
            {card.faculty.subjects.map((s, i) => (
              <p key={i} className="text-gray-700"><span className="font-semibold">{s.subject}:</span> {s.teacher || '—'}</p>
            ))}
          </div>
        </Section>
        )}

        {/* Signatures */}
        {!ccaOnly && (
        <div className="px-6 py-8 grid grid-cols-2 sm:grid-cols-3 gap-6 text-center text-xs text-gray-400">
          <div><div className="border-t border-gray-300 pt-1 mt-8">Class Teacher</div></div>
          <div className="hidden sm:block"><div className="border-t border-gray-300 pt-1 mt-8">Principal</div></div>
          <div><div className="border-t border-gray-300 pt-1 mt-8">Parent / Guardian</div></div>
        </div>
        )}

        {!ccaOnly && <p className="px-6 pb-4 text-[10px] text-gray-400">* Term not yet published.</p>}
      </div>
    </div>
  );
}

function Section({ title, icon, children }: { title: string; icon?: React.ReactNode; children: React.ReactNode }) {
  return (
    <div className="border-b border-gray-150">
      <div className="px-4 py-2.5 bg-gray-50/70 flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600">
        {icon}{title}
      </div>
      {children}
    </div>
  );
}
