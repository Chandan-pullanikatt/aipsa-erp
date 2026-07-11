'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Loader2 } from 'lucide-react';
import ProgramsBrowse from '@/components/ProgramsBrowse';

// A parent registers on behalf of a chosen child — the selected child's id is
// passed to the shared browser so the registration is tagged to that student.
export default function ParentProgramsPage() {
  const [students, setStudents] = useState<any[]>([]);
  const [active, setActive] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    api.get('/sis/parent/students')
      .then(r => { setStudents(r.data); if (r.data[0]) setActive(r.data[0].id); })
      .finally(() => setLoading(false));
  }, []);

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      {loading ? (
        <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : students.length === 0 ? (
        <p className="text-sm text-[#9CA3AF] italic">No linked students.</p>
      ) : (
        <>
          {students.length > 1 && (
            <div className="flex gap-2 mb-5 flex-wrap">
              <span className="text-xs font-semibold text-[#6B7280] self-center mr-1">Registering for:</span>
              {students.map(s => (
                <button key={s.id} onClick={() => setActive(s.id)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold ${active === s.id ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>
                  {s.firstName} {s.lastName}
                </button>
              ))}
            </div>
          )}
          {/* remount on child change so the browser reflects the active child */}
          {active && <ProgramsBrowse key={active} studentId={active} />}
        </>
      )}
    </div>
  );
}
