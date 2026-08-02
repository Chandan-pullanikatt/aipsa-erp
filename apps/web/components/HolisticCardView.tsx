'use client';

// Loads one student's holistic progress card and renders it. Shared by the two
// staff-side entry points — the Progress Card tab under Examinations and the
// student detail page — so both show families exactly what the portals show.
//
// `GET /progress/card/:studentId` returns unpublished terms to staff and hides them
// from students/parents, so `draftPreview` here is a display concern only.

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ProgressCard, { type CardData } from '@/components/ProgressCard';

export default function HolisticCardView({
  studentId,
  academicYear,
  draftPreview = true,
}: {
  studentId: string;
  academicYear?: string;
  draftPreview?: boolean;
}) {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  // Callers key this component on the student, so a different student mounts a
  // fresh copy rather than re-running with stale state on screen.
  useEffect(() => {
    let stale = false;
    api.get(`/progress/card/${studentId}`, { params: academicYear ? { academicYear } : {} })
      .then(({ data }) => { if (!stale) setCard(data); })
      .catch((err) => { if (!stale) setError(err.response?.data?.error || 'Could not load the progress card.'); })
      .finally(() => { if (!stale) setLoading(false); });
    return () => { stale = true; };
  }, [studentId, academicYear]);

  if (loading) return <p className="py-12 text-center text-sm text-gray-400 font-body">Loading progress card…</p>;
  if (error) return <p className="py-12 text-center text-sm text-rose-600 font-body">{error}</p>;
  if (!card) return null;
  return <ProgressCard card={card} draftPreview={draftPreview} />;
}
