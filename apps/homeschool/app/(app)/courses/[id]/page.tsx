'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Lock, PlayCircle, Eye } from 'lucide-react';
import api from '@/lib/api';
import { getActiveLearner } from '@/lib/learner';

interface Lesson { id: string; title: string; description: string | null; durationMin: number | null; isFreePreview: boolean; unlocked: boolean; completed: boolean }
interface Module { id: string; title: string; lessons: Lesson[] }
interface Course { id: string; title: string; description: string | null; subject: string; gradeLevel: string; hasAccess: boolean; modules: Module[] }

export default function CoursePage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [course, setCourse] = useState<Course | null>(null);
  const [loading, setLoading] = useState(true);
  const [noLearner, setNoLearner] = useState(false);

  useEffect(() => {
    const learnerId = getActiveLearner();
    if (!learnerId) setNoLearner(true);
    const q = learnerId ? `?learnerId=${learnerId}` : '';
    api.get(`/homeschool/courses/${id}${q}`)
      .then((r) => setCourse(r.data))
      .finally(() => setLoading(false));
  }, [id]);

  if (loading) return <div className="py-32 text-center text-[14px] text-[#6B7280]">Loading…</div>;
  if (!course) return <div className="py-32 text-center text-[14px] text-[#6B7280]">Course not found.</div>;

  return (
    <div className="space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[14px] text-[#6B7280] hover:text-[#1A1D23]">
        <ArrowLeft className="w-4 h-4" /> Back
      </button>

      <div>
        <span className="text-[11px] font-semibold uppercase tracking-wide text-[#1D7A4A] bg-[#D6F0E4] px-2 py-0.5 rounded">{course.gradeLevel} · {course.subject}</span>
        <h1 className="font-display text-[28px] font-bold text-[#1A1D23] mt-2">{course.title}</h1>
        {course.description && <p className="text-[15px] text-[#6B7280] mt-2 max-w-2xl">{course.description}</p>}
      </div>

      {noLearner && (
        <div className="bg-[#FAEEDA] text-[#854F0B] text-[13px] px-4 py-2.5 rounded-lg">
          Pick a child on the <Link href="/dashboard" className="font-semibold underline">dashboard</Link> first to track their progress.
        </div>
      )}
      {!course.hasAccess && (
        <div className="bg-white border border-[#E5E7EB] rounded-lg px-4 py-3 text-[13px] text-[#374151]">
          🔒 Free preview lessons are open. <Link href="/dashboard" className="text-[#1D7A4A] font-semibold underline">Subscribe</Link> to unlock everything.
        </div>
      )}

      <div className="space-y-5">
        {course.modules.map((m, mi) => (
          <div key={m.id} className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
            <div className="px-5 py-3 border-b border-[#E5E7EB] bg-[#F7F8FA]">
              <h2 className="font-display text-[15px] font-semibold text-[#1A1D23]">Module {mi + 1}: {m.title}</h2>
            </div>
            <ul>
              {m.lessons.map((l) => {
                const inner = (
                  <div className="px-5 py-3.5 flex items-center justify-between border-t border-[#F0F1F3] first:border-t-0">
                    <div className="flex items-center gap-3">
                      {l.completed ? <CheckCircle2 className="w-5 h-5 text-[#26A96B]" />
                        : l.unlocked ? <PlayCircle className="w-5 h-5 text-[#1D7A4A]" />
                        : <Lock className="w-5 h-5 text-[#9CA3AF]" />}
                      <div>
                        <p className={`text-[14px] font-medium ${l.unlocked ? 'text-[#1A1D23]' : 'text-[#9CA3AF]'}`}>{l.title}</p>
                        {l.durationMin && <p className="text-[12px] text-[#9CA3AF]">{l.durationMin} min</p>}
                      </div>
                    </div>
                    {l.isFreePreview && !course.hasAccess && (
                      <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-[#1D7A4A] bg-[#D6F0E4] px-2 py-0.5 rounded"><Eye className="w-3 h-3" /> Free</span>
                    )}
                  </div>
                );
                return (
                  <li key={l.id}>
                    {l.unlocked
                      ? <Link href={`/lessons/${l.id}`} className="block hover:bg-[#F7F8FA] transition-colors">{inner}</Link>
                      : <div className="cursor-not-allowed">{inner}</div>}
                  </li>
                );
              })}
            </ul>
          </div>
        ))}
      </div>
    </div>
  );
}
