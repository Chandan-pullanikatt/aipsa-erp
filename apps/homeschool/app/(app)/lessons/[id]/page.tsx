'use client';

import { useEffect, useState } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, CheckCircle2, Circle, Lock, FileText } from 'lucide-react';
import api from '@/lib/api';
import { getActiveLearner } from '@/lib/learner';

interface Lesson {
  id: string; title: string; description: string | null; content: string | null;
  videoUrl: string | null; attachmentUrl: string | null; durationMin: number | null;
  isFreePreview: boolean; completed?: boolean; course: { id: string; title: string };
}

function toEmbed(url: string): string | null {
  try {
    const u = new URL(url);
    if (u.hostname.includes('youtu.be')) return `https://www.youtube.com/embed/${u.pathname.slice(1)}`;
    const v = u.searchParams.get('v');
    if (v) return `https://www.youtube.com/embed/${v}`;
    return url;
  } catch { return null; }
}

export default function LessonPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [lesson, setLesson] = useState<Lesson | null>(null);
  const [loading, setLoading] = useState(true);
  const [locked, setLocked] = useState(false);
  const [completed, setCompleted] = useState(false);
  const [learnerId, setLearnerId] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const lid = getActiveLearner();
    setLearnerId(lid);
    const q = lid ? `?learnerId=${lid}` : '';
    api.get(`/homeschool/lessons/${id}${q}`)
      .then((r) => { setLesson(r.data); setCompleted(!!r.data.completed); })
      .catch((err) => { if (err.response?.status === 402) setLocked(true); })
      .finally(() => setLoading(false));
  }, [id]);

  async function toggleComplete() {
    if (!learnerId) return;
    setSaving(true);
    try {
      const { data } = await api.post(`/homeschool/learners/${learnerId}/lessons/${id}/progress`);
      setCompleted(data.completed);
    } finally { setSaving(false); }
  }

  if (loading) return <div className="py-32 text-center text-[14px] text-[#6B7280]">Loading…</div>;

  if (locked) {
    return (
      <div className="max-w-lg mx-auto text-center py-20">
        <Lock className="w-12 h-12 text-[#D97706] mx-auto" strokeWidth={1.5} />
        <h1 className="font-display text-[22px] font-bold text-[#1A1D23] mt-4">This lesson is locked</h1>
        <p className="text-[14px] text-[#6B7280] mt-2">Subscribe to unlock the full catalog for all your children.</p>
        <Link href="/dashboard" className="inline-flex mt-6 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white text-[14px] font-medium px-6 h-[42px] items-center rounded-lg">
          Go to subscription
        </Link>
      </div>
    );
  }

  if (!lesson) return <div className="py-32 text-center text-[14px] text-[#6B7280]">Lesson not found.</div>;

  const embed = lesson.videoUrl ? toEmbed(lesson.videoUrl) : null;

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      <button onClick={() => router.back()} className="inline-flex items-center gap-1.5 text-[14px] text-[#6B7280] hover:text-[#1A1D23]">
        <ArrowLeft className="w-4 h-4" /> Back to {lesson.course.title}
      </button>

      <h1 className="font-display text-[26px] font-bold text-[#1A1D23]">{lesson.title}</h1>
      {lesson.description && <p className="text-[15px] text-[#6B7280]">{lesson.description}</p>}

      {embed && (
        <div className="aspect-video rounded-xl overflow-hidden border border-[#E5E7EB] bg-black">
          <iframe src={embed} className="w-full h-full" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" allowFullScreen />
        </div>
      )}

      {lesson.content && (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 text-[15px] leading-relaxed text-[#374151] whitespace-pre-wrap">
          {lesson.content}
        </div>
      )}

      {lesson.attachmentUrl && (
        <a href={lesson.attachmentUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-[14px] font-medium text-[#1D7A4A] hover:underline">
          <FileText className="w-4 h-4" /> Download worksheet
        </a>
      )}

      <div className="flex items-center justify-between border-t border-[#E5E7EB] pt-5">
        {learnerId ? (
          <button onClick={toggleComplete} disabled={saving}
            className={`inline-flex items-center gap-2 text-[14px] font-medium px-5 h-[42px] rounded-lg transition-colors disabled:opacity-50 ${completed ? 'bg-[#D6F0E4] text-[#0F6E56]' : 'bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white'}`}>
            {completed ? <><CheckCircle2 className="w-4 h-4" /> Completed</> : <><Circle className="w-4 h-4" /> Mark as complete</>}
          </button>
        ) : (
          <p className="text-[13px] text-[#854F0B] bg-[#FAEEDA] px-3 py-2 rounded-lg">
            Pick a child on the <Link href="/dashboard" className="font-semibold underline">dashboard</Link> to track progress.
          </p>
        )}
      </div>
    </div>
  );
}
