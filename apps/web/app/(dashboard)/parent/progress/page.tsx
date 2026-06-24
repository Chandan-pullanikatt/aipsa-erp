'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import ProgressCard, { CardData } from '@/components/ProgressCard';

interface Child { id: string; firstName: string; lastName: string; }

export default function ParentProgressPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState('');
  const [card, setCard] = useState<CardData | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sis/parent/students').then(r => {
      setChildren(r.data);
      if (r.data[0]) setActiveId(r.data[0].id);
    }).catch(console.error);
  }, []);

  useEffect(() => {
    if (!activeId) return;
    setLoading(true); setError(''); setCard(null);
    api.get(`/progress/card/${activeId}`)
      .then(r => setCard(r.data))
      .catch((err: any) => setError(err.response?.data?.error || 'Could not load the progress card.'))
      .finally(() => setLoading(false));
  }, [activeId]);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Progress Card</h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Your child&apos;s holistic progress report across the academic year.</p>
      </div>

      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map(c => (
            <button key={c.id} onClick={() => setActiveId(c.id)}
              className={`px-4 py-2 rounded-xl text-sm font-semibold border transition-all ${activeId === c.id ? 'bg-[#1D7A4A] text-white border-[#1D7A4A]' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}>
              {c.firstName} {c.lastName}
            </button>
          ))}
        </div>
      )}

      {loading ? <p className="text-sm text-gray-400 py-10 font-body">Loading…</p>
        : error ? <p className="text-sm text-rose-600 py-10 font-body">{error}</p>
        : card ? <ProgressCard card={card} />
        : null}
    </div>
  );
}
