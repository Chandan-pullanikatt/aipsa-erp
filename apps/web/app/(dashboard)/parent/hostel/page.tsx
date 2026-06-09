'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Building2, Loader2 } from 'lucide-react';
import HostelView from '@/components/HostelView';

export default function ParentHostelPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [active, setActive] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sis/parent/students').then((r) => {
      setStudents(r.data);
      if (r.data[0]) setActive(r.data[0].id);
    }).finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-4xl mx-auto px-4 py-6">
      <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2 mb-6"><Building2 className="w-6 h-6 text-[#1D7A4A]" /> Hostel</h1>
      {loading ? (
        <p className="text-sm text-[#6B7280] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] italic">No linked students. Link your child from the dashboard first.</p>
      ) : (
        <>
          {students.length > 1 && (
            <div className="flex gap-2 mb-5">
              {students.map((s) => (
                <button key={s.id} onClick={() => setActive(s.id)} className={`px-4 py-2 rounded-lg text-sm font-semibold ${active === s.id ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>
                  {s.firstName} {s.lastName}
                </button>
              ))}
            </div>
          )}
          {active && <HostelView key={active} studentId={active} />}
        </>
      )}
    </div>
  );
}
