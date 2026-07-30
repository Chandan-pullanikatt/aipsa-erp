'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Users, UserCog, BookOpen } from 'lucide-react';

interface TeacherRef { id: string; name: string; }
// `teachers` holds every teacher for this subject in the student's own section;
// `teacher` is the first of them, kept for older API responses.
interface SubjectTeacher { id: string; name: string; code: string | null; teacher: TeacherRef | null; teachers?: TeacherRef[]; }
interface Data {
  student: { id: string; name: string; class: string | null; section: string | null };
  classTeacher: TeacherRef | null;
  subjects: SubjectTeacher[];
}

function initials(name: string) {
  return name.split(' ').map(p => p[0]).slice(0, 2).join('').toUpperCase();
}

export default function MyTeachers({ studentId }: { studentId: string | null }) {
  const [data, setData] = useState<Data | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!studentId) return;
    setLoading(true);
    api.get(`/progress/teachers/${studentId}`).then(r => setData(r.data)).catch(console.error).finally(() => setLoading(false));
  }, [studentId]);

  if (!studentId || loading) return <p className="text-sm text-gray-400 py-10 text-center font-body">Loading teachers…</p>;
  if (!data) return <p className="text-sm text-gray-400 py-10 text-center font-body">Could not load teachers.</p>;

  return (
    <div className="space-y-6 font-body">
      {/* Class teacher */}
      <div className="bg-gradient-to-tr from-[#E5F6EE]/40 to-[#E5F6EE]/80 border border-[#1D7A4A]/15 rounded-2xl p-5 flex items-center gap-4">
        <div className="w-12 h-12 rounded-xl bg-[#1D7A4A] text-white flex items-center justify-center font-bold font-display">
          {data.classTeacher ? initials(data.classTeacher.name) : <UserCog className="w-6 h-6" />}
        </div>
        <div>
          <p className="text-[10px] font-bold text-[#1D7A4A] uppercase tracking-wider font-display">Class Teacher</p>
          <p className="text-lg font-bold text-gray-800 font-display">{data.classTeacher?.name || 'Not assigned'}</p>
          <p className="text-xs text-gray-500">{data.student.class || ''} {data.student.section ? `(${data.student.section})` : ''}</p>
        </div>
      </div>

      {/* Subject teachers */}
      <div>
        <h3 className="text-sm font-bold text-gray-700 mb-3 flex items-center gap-2 font-display">
          <Users className="w-4 h-4 text-[#1D7A4A]" /> Subject Teachers
        </h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {data.subjects.map(s => {
            const staff = s.teachers && s.teachers.length > 0 ? s.teachers : s.teacher ? [s.teacher] : [];
            return (
              <div key={s.id} className="bg-white border border-gray-200 rounded-2xl p-4 shadow-sm flex items-center gap-3">
                <div className="w-10 h-10 rounded-lg bg-gray-100 text-gray-500 flex items-center justify-center shrink-0">
                  {staff.length > 0 ? <span className="font-bold text-sm text-gray-700">{initials(staff[0].name)}</span> : <BookOpen className="w-5 h-5" />}
                </div>
                <div className="min-w-0">
                  <p className="font-semibold text-gray-800 truncate">{s.name}</p>
                  <p className="text-xs text-gray-500 truncate" title={staff.map(t => t.name).join(', ')}>
                    {staff.length > 0 ? staff.map(t => t.name).join(', ') : 'No teacher assigned'}
                  </p>
                </div>
              </div>
            );
          })}
          {data.subjects.length === 0 && <p className="text-sm text-gray-400 col-span-full py-6 text-center">No subjects mapped yet.</p>}
        </div>
      </div>
    </div>
  );
}
