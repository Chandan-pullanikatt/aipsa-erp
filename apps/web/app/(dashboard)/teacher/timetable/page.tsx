'use client';

import { useEffect, useState } from 'react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { Calendar, Clock, AlertCircle } from 'lucide-react';

interface PeriodItem {
  id: string;
  dayOfWeek: 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY';
  periodNumber: number;
  startTime: string;
  endTime: string;
  isBreak: boolean;
  breakLabel: string | null;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
}

const DAYS = ['MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'] as const;

// Quick helper to generate a soft, harmonious color palette based on subject name hash
const getSubjectColor = (subjectName: string) => {
  let hash = 0;
  for (let i = 0; i < subjectName.length; i++) {
    hash = subjectName.charCodeAt(i) + ((hash << 5) - hash);
  }
  const colors = [
    { bg: 'bg-[#F0F5FF] border-[#D0E2FF] text-[#0043CE]', badge: 'bg-[#D0E2FF] text-[#0043CE]' },
    { bg: 'bg-[#E5F6EE] border-[#1D7A4A]/25 text-[#1D7A4A]', badge: 'bg-[#E5F6EE] text-[#1D7A4A]' },
    { bg: 'bg-[#FBF0FF] border-[#E8D0FF] text-[#6929C4]', badge: 'bg-[#E8D0FF] text-[#6929C4]' },
    { bg: 'bg-[#FFF8E6] border-[#FFE2A3] text-[#B25E00]', badge: 'bg-[#FFE2A3] text-[#B25E00]' },
    { bg: 'bg-[#FFF0F5] border-[#FFD0E0] text-[#9F1853]', badge: 'bg-[#FFD0E0] text-[#9F1853]' },
    { bg: 'bg-[#F5F3FF] border-[#DDD6FE] text-[#5B21B6]', badge: 'bg-[#DDD6FE] text-[#5B21B6]' },
    { bg: 'bg-[#E6FDFB] border-[#97F3EC] text-[#005D5D]', badge: 'bg-[#97F3EC] text-[#005D5D]' },
  ];
  const index = Math.abs(hash) % colors.length;
  return colors[index];
};

export default function TeacherTimetablePage() {
  const [periods, setPeriods] = useState<PeriodItem[]>([]);
  const [academicYear, setAcademicYear] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const u = getUser();
    if (!u) {
      setError('User details not found. Please log in.');
      setLoading(false);
      return;
    }

    setLoading(true);
    // Fetch academic year and teacher schedule
    Promise.all([
      api.get('/timetable/academic-year').catch(() => null),
      api.get('/timetable/teacher', { params: { teacherId: u.id } }),
    ])
      .then(([yearRes, scheduleRes]) => {
        if (yearRes) setAcademicYear(yearRes.data.academicYear);
        setPeriods(scheduleRes.data);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to retrieve your timetable schedule.');
      })
      .finally(() => setLoading(false));
  }, []);

  // Compute maximum period number assigned (default to 8 if less)
  const maxPeriod = Math.max(8, ...periods.map((p) => p.periodNumber));

  // Auto-fill time range display for rows
  const getPeriodTimes = (periodNum: number) => {
    const match = periods.find((p) => p.periodNumber === periodNum);
    if (match) return `${match.startTime} - ${match.endTime}`;
    // Fallback labels
    const standardTimes: Record<number, string> = {
      1: '08:30 - 09:15',
      2: '09:15 - 10:00',
      3: '10:00 - 10:45',
      4: '11:00 - 11:45',
      5: '11:45 - 12:30',
      6: '13:30 - 14:15',
      7: '14:15 - 15:00',
      8: '15:00 - 15:45',
    };
    return standardTimes[periodNum] || '';
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
            <Calendar className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
            My Schedule Board
          </h1>
          <p className="text-sm text-gray-500 font-body">Your personalized weekly timetable grid across all teaching subjects and classes.</p>
        </div>
        {academicYear && (
          <span className="px-4 py-1.5 bg-[#E5F6EE] border border-[#1D7A4A]/10 text-[#1D7A4A] text-xs font-semibold rounded-full shadow-sm font-body">
            Academic Year: {academicYear}
          </span>
        )}
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center gap-2 font-body animate-fade-in">
          <AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {loading ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-32 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)] font-body">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-3"></div>
          <p className="text-gray-400 text-sm font-medium">Building timetable matrix...</p>
        </div>
      ) : periods.length === 0 ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-24 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6 font-body">
          <Calendar className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <h3 className="font-semibold text-gray-800 text-lg font-display mb-1">No Periods Scheduled</h3>
          <p className="text-gray-400 text-xs max-w-sm mx-auto leading-relaxed">
            You do not have any teaching periods assigned in the active timetable. Contact your school administrator to allocate your subjects or periods.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden font-body">
          <div className="overflow-x-auto">
            <table className="w-full table-fixed min-w-[900px] border-collapse">
              <thead>
                <tr className="bg-gray-50 border-b border-[#E5E7EB]">
                  <th className="w-32 px-4 py-4 text-center text-[10px] font-bold text-gray-400 uppercase tracking-wider border-r border-[#E5E7EB] font-display">
                    Period / Time
                  </th>
                  {DAYS.map((day) => (
                    <th
                      key={day}
                      className="px-4 py-4 text-center text-xs font-bold text-gray-700 uppercase tracking-wider font-display"
                    >
                      {day[0] + day.slice(1).toLowerCase()}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB] bg-white">
                {Array.from({ length: maxPeriod }).map((_, index) => {
                  const periodNum = index + 1;
                  const times = getPeriodTimes(periodNum);

                  return (
                    <tr key={periodNum} className="hover:bg-gray-50/30 transition-colors">
                      {/* Period Header Column */}
                      <td className="px-3 py-4 border-r border-[#E5E7EB] text-center bg-gray-50/50">
                        <p className="text-xs font-bold text-[#1D7A4A] font-display">Period {periodNum}</p>
                        <p className="text-[10px] text-gray-400 mt-1 font-semibold">{times}</p>
                      </td>

                      {/* Day Columns */}
                      {DAYS.map((day) => {
                        // Find matching period item
                        const period = periods.find(
                          (p) => p.dayOfWeek === day && p.periodNumber === periodNum
                        );

                        if (!period) {
                          return (
                            <td
                              key={day}
                              className="p-2 border-r border-[#E5E7EB] last:border-r-0"
                            >
                              <div className="h-full min-h-[70px] flex items-center justify-center border border-dashed border-gray-200/80 rounded-lg bg-gray-50/20 select-none">
                                <span className="text-[10px] font-semibold text-gray-300 uppercase tracking-wider font-display">
                                  Free
                                </span>
                              </div>
                            </td>
                          );
                        }

                        // Get class-subject styling
                        const isBreak = period.isBreak;
                        const colors = !isBreak && period.subject 
                          ? getSubjectColor(period.subject.name)
                          : { bg: 'bg-[#FFF8E6] border-[#FFE2A3] text-[#B25E00]', badge: 'bg-[#FFE2A3] text-[#B25E00]' };

                        return (
                          <td
                            key={day}
                            className="p-2 border-r border-[#E5E7EB] last:border-r-0"
                          >
                            {isBreak ? (
                              <div className="h-full min-h-[70px] flex flex-col items-center justify-center p-3 rounded-lg border border-[#FFE2A3] bg-[#FFF8E6] text-center">
                                <span className="text-xs font-bold text-[#B25E00] uppercase tracking-wider font-display">
                                  {period.breakLabel || 'Break'}
                                </span>
                                <span className="text-[9px] text-[#B25E00]/70 mt-0.5 font-semibold">
                                  {period.startTime} - {period.endTime}
                                </span>
                              </div>
                            ) : (
                              <div
                                className={`h-full min-h-[70px] flex flex-col justify-between p-3 rounded-lg border transition-all hover:shadow-[0_4px_12px_rgba(0,0,0,0.05)] cursor-default ${colors.bg}`}
                              >
                                <div>
                                  <div className="flex items-center justify-between gap-1 mb-1">
                                    <span className="text-xs font-bold tracking-tight truncate max-w-[80%] font-display">
                                      {period.class.name}
                                    </span>
                                    <span className={`text-[9px] font-bold px-1.5 py-0.5 rounded ${colors.badge} font-display`}>
                                      P{period.periodNumber}
                                    </span>
                                  </div>
                                  <p className="text-xs font-semibold leading-snug line-clamp-2">
                                    {period.subject?.name || 'Assigned Subject'}
                                  </p>
                                </div>
                              </div>
                            )}
                          </td>
                        );
                      })}
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}