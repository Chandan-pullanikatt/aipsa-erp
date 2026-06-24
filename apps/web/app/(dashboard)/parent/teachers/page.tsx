'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import MyTeachers from '@/components/MyTeachers';

interface Child { id: string; firstName: string; lastName: string; }

export default function ParentTeachersPage() {
  const [children, setChildren] = useState<Child[]>([]);
  const [activeId, setActiveId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sis/parent/students').then(r => {
      setChildren(r.data);
      if (r.data[0]) setActiveId(r.data[0].id);
    }).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">My Teachers</h1>
        <p className="text-sm text-gray-500 mt-1 font-body">The class teacher and subject teachers for your child.</p>
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

      <MyTeachers studentId={activeId} />
    </div>
  );
}
