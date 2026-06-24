'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import MyTeachers from '@/components/MyTeachers';

export default function StudentTeachersPage() {
  const [studentId, setStudentId] = useState<string | null>(null);

  useEffect(() => {
    api.get('/sis/student/profile').then(r => setStudentId(r.data.id)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">My Teachers</h1>
        <p className="text-sm text-gray-500 mt-1 font-body">Your class teacher and the teacher for each subject.</p>
      </div>
      <MyTeachers studentId={studentId} />
    </div>
  );
}
