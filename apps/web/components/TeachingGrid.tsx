'use client';

import { useCallback, useEffect, useState } from 'react';
import api from '@/lib/api';
import { X, Check, AlertCircle } from 'lucide-react';

interface SectionRef { id: string; name: string; }
interface OtherTeacher { name: string; section: string | null; isPrimary: boolean; }
interface GridSubject {
  id: string;
  name: string;
  code: string | null;
  assignments: { sectionId: string | null; isPrimary: boolean }[];
  otherTeachers: OtherTeacher[];
}
interface GridClass { id: string; name: string; sections: SectionRef[]; subjects: GridSubject[]; }
interface GridData {
  teacher: { id: string; firstName: string; lastName: string; email: string };
  classes: GridClass[];
}

// Scopes a teacher covers for one subject. ALL and specific sections are mutually
// exclusive: ALL already means every section.
const ALL = '__all__';
type Selection = Record<string, string[]>;

export default function TeachingGrid({ teacherId, onClose, onSaved }: {
  teacherId: string;
  onClose: () => void;
  onSaved?: () => void;
}) {
  const [data, setData] = useState<GridData | null>(null);
  const [selection, setSelection] = useState<Selection>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data: grid } = await api.get(`/exams/teachers/${teacherId}/teaching-grid`);
      setData(grid);
      const initial: Selection = {};
      grid.classes.forEach((c: GridClass) => c.subjects.forEach((s: GridSubject) => {
        if (s.assignments.length > 0) {
          initial[s.id] = s.assignments.map(a => a.sectionId ?? ALL);
        }
      }));
      setSelection(initial);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not load teaching assignments.');
    } finally {
      setLoading(false);
    }
  }, [teacherId]);

  useEffect(() => { load(); }, [load]);

  function toggleSubject(subjectId: string) {
    setSelection(prev => {
      const next = { ...prev };
      if (next[subjectId]) delete next[subjectId];
      else next[subjectId] = [ALL];
      return next;
    });
  }

  function toggleScope(subjectId: string, scope: string) {
    setSelection(prev => {
      const current = prev[subjectId] || [];
      let next: string[];
      if (scope === ALL) {
        next = current.includes(ALL) ? [] : [ALL];
      } else {
        next = current.includes(scope)
          ? current.filter(s => s !== scope)
          : [...current.filter(s => s !== ALL), scope];
      }
      const out = { ...prev };
      // Clearing every scope means they no longer teach the subject.
      if (next.length === 0) delete out[subjectId];
      else out[subjectId] = next;
      return out;
    });
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      const assignments = Object.entries(selection).flatMap(([subjectId, scopes]) =>
        scopes.map(scope => ({ subjectId, sectionId: scope === ALL ? null : scope }))
      );
      await api.put(`/exams/teachers/${teacherId}/subjects`, { assignments });
      onSaved?.();
      onClose();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Could not save teaching assignments.');
    } finally {
      setSaving(false);
    }
  }

  const totalSelected = Object.values(selection).reduce((n, scopes) => n + scopes.length, 0);

  return (
    <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl w-full max-w-4xl max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="px-6 py-4 border-b border-[#E5E7EB] flex items-start justify-between gap-4">
          <div>
            <span className="inline-flex items-center text-[10px] font-bold uppercase tracking-widest px-2.5 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA] font-body">
              Teaching Assignments
            </span>
            <h3 className="font-display text-[20px] font-semibold text-[#1A1D23] mt-2">
              {data ? `${data.teacher.firstName} ${data.teacher.lastName}` : 'Loading…'}
            </h3>
            <p className="font-body text-[12px] text-[#6B7280] mt-0.5">
              Tick every subject this teacher takes, across all classes. Save once.
            </p>
          </div>
          <button onClick={onClose} className="text-gray-400 hover:text-slate-700 p-1 rounded-lg hover:bg-gray-100 transition-colors">
            <X className="w-5 h-5" strokeWidth={1.75} />
          </button>
        </div>

        {error && (
          <div className="mx-6 mt-4 bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
            <span>{error}</span>
            <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded"><X className="w-4 h-4" /></button>
          </div>
        )}

        {/* Grid */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {loading ? (
            <p className="py-20 text-center text-sm text-gray-400 font-body animate-pulse">Loading classes and subjects…</p>
          ) : !data || data.classes.length === 0 ? (
            <div className="py-20 text-center flex flex-col items-center">
              <AlertCircle className="w-10 h-10 text-gray-300 mb-3" strokeWidth={1.5} />
              <p className="text-sm font-semibold text-gray-700 font-display">No classes yet</p>
              <p className="text-xs text-gray-400 mt-1 font-body">Register classes and subjects before assigning teachers.</p>
            </div>
          ) : (
            <div className="space-y-4">
              {data.classes.map(cls => (
                <div key={cls.id} className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
                    <p className="text-sm font-bold text-gray-800 font-display">{cls.name}</p>
                    <span className="text-[10px] text-gray-400 font-body">
                      {cls.sections.length > 0
                        ? `${cls.sections.length} section${cls.sections.length > 1 ? 's' : ''}`
                        : 'No sections'}
                    </span>
                  </div>

                  {cls.subjects.length === 0 ? (
                    <p className="px-4 py-4 text-xs text-gray-400 font-body">No subjects mapped to this class.</p>
                  ) : (
                    <div className="divide-y divide-[#E5E7EB]">
                      {cls.subjects.map(sub => {
                        const scopes = selection[sub.id] || [];
                        const checked = scopes.length > 0;
                        return (
                          <div key={sub.id} className="px-4 py-3">
                            <div className="flex items-start gap-3">
                              <button
                                type="button"
                                onClick={() => toggleSubject(sub.id)}
                                aria-pressed={checked}
                                className={`w-[18px] h-[18px] mt-0.5 rounded border flex items-center justify-center shrink-0 transition-all ${
                                  checked ? 'bg-[#1D7A4A] border-[#1D7A4A] text-white' : 'bg-white border-gray-300 hover:border-[#1D7A4A]'
                                }`}
                              >
                                {checked && <Check className="w-3 h-3" strokeWidth={3} />}
                              </button>

                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="text-sm font-semibold text-gray-800 font-display">{sub.name}</span>
                                  {sub.code && (
                                    <span className="text-[10px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 font-mono font-bold uppercase">
                                      {sub.code}
                                    </span>
                                  )}
                                </div>

                                {sub.otherTeachers.length > 0 && (
                                  <p className="text-[11px] text-gray-400 mt-0.5 font-body">
                                    Also taught by {sub.otherTeachers.map(t => t.section ? `${t.name} (Sec ${t.section})` : t.name).join(', ')}
                                  </p>
                                )}

                                {/* Section scoping only matters once the subject is ticked. */}
                                {checked && cls.sections.length > 0 && (
                                  <div className="flex items-center gap-1.5 flex-wrap mt-2">
                                    {[{ id: ALL, name: 'All sections' }, ...cls.sections].map(sec => {
                                      const on = scopes.includes(sec.id);
                                      return (
                                        <button
                                          key={sec.id}
                                          type="button"
                                          onClick={() => toggleScope(sub.id, sec.id)}
                                          className={`text-[11px] px-2.5 py-1 rounded-full border font-body transition-all ${
                                            on
                                              ? 'bg-[#D6F0E4] border-[#26A96B]/30 text-[#0F6E56] font-semibold'
                                              : 'bg-white border-[#E5E7EB] text-gray-500 hover:border-gray-300'
                                          }`}
                                        >
                                          {sec.id === ALL ? sec.name : `Sec ${sec.name}`}
                                        </button>
                                      );
                                    })}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#E5E7EB] flex items-center justify-between gap-4 bg-white">
          <p className="text-xs text-gray-500 font-body">
            {totalSelected} assignment{totalSelected === 1 ? '' : 's'} selected
          </p>
          <div className="flex gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all"
            >
              Cancel
            </button>
            <button
              onClick={handleSave}
              disabled={saving || loading}
              className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white text-xs font-semibold rounded-lg transition-all shadow-xs disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save Assignments'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
