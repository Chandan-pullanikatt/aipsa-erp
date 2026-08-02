'use client';

// Admin view of one student's holistic progress card, reached from the button next
// to "ID Card" on the student file. Same component the family sees, plus draft terms.

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import HolisticCardView from '@/components/HolisticCardView';

export default function StudentProgressCardPage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState('');

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      <div className="space-y-4 pb-6 border-b border-[#E5E7EB]">
        <Link href={id ? `/school/students/${id}` : '/school/students'} className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] hover:text-[#1A1D23] transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> Back to Student File
        </Link>
        <div>
          <h1 className="text-[26px] sm:text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Holistic Progress Card</h1>
          <p className="text-sm text-gray-500 mt-1 font-body">Scholastic marks, co-curricular grades, conduct and remarks for the academic year.</p>
        </div>
      </div>

      {id && <HolisticCardView key={id} studentId={id} />}
    </div>
  );
}
