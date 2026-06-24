'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ProgressCard, { CardData } from '@/components/ProgressCard';

export default function StudentProgressPage() {
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  useEffect(() => {
    (async () => {
      try {
        const { data: profile } = await api.get('/sis/student/profile');
        const { data } = await api.get(`/progress/card/${profile.id}`);
        setCard(data);
      } catch (err: any) {
        setError(err.response?.data?.error || 'Could not load your progress card.');
      } finally { setLoading(false); }
    })();
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Progress Card</h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Your holistic progress report across the academic year.</p>
      </div>
      {loading ? <p className="text-sm text-gray-400 py-10 font-body">Loading…</p>
        : error ? <p className="text-sm text-rose-600 py-10 font-body">{error}</p>
        : card ? <ProgressCard card={card} />
        : null}
    </div>
  );
}
