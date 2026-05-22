'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { ClipboardList, CheckCircle, AlertCircle, Save, Check } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

interface ExamItem {
  id: string;
  name: string;
  maxMarks: number;
  passingMarks: number;
}

interface SubjectItem {
  id: string;
  name: string;
}

interface StudentEntry {
  student: {
    id: string;
    firstName: string;
    lastName: string;
    admissionNumber: string;
  };
  result: {
    id?: string;
    marksObtained: number | null;
    isAbsent: boolean;
    remarks: string | null;
  } | null;
}

interface RowState {
  studentId: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  marksObtained: string; // Keep as string for input control
  isAbsent: boolean;
  remarks: string;
}

export default function TeacherMarksPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [exams, setExams] = useState<ExamItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);

  // Selection states
  const [classId, setClassId] = useState('');
  const [examId, setExamId] = useState('');
  const [subjectId, setSubjectId] = useState('');

  // Selected details
  const [selectedExam, setSelectedExam] = useState<ExamItem | null>(null);

  // Student list & inputs
  const [rows, setRows] = useState<RowState[]>([]);

  // Loading & status states
  const [loadingFilters, setLoadingFilters] = useState(false);
  const [loadingStudents, setLoadingStudents] = useState(false);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Initial load: fetch classes
  useEffect(() => {
    setLoadingFilters(true);
    api.get('/homework/my-classes')
      .then((r) => setClasses(r.data))
      .catch((err) => {
        console.error(err);
        setError('Failed to load classes. Please verify your profile.');
      })
      .finally(() => setLoadingFilters(false));
  }, []);

  // When class changes, fetch exams and subjects for this class
  useEffect(() => {
    if (!classId) {
      setExams([]);
      setSubjects([]);
      setExamId('');
      setSubjectId('');
      setRows([]);
      setSelectedExam(null);
      return;
    }

    setLoadingFilters(true);
    Promise.all([
      api.get('/exams/exams', { params: { classId } }),
      api.get('/exams/subjects', { params: { classId } }),
    ])
      .then(([examsRes, subjectsRes]) => {
        setExams(examsRes.data);
        setSubjects(subjectsRes.data);
        // Reset selections
        setExamId('');
        setSubjectId('');
        setRows([]);
        setSelectedExam(null);
      })
      .catch((err) => {
        console.error(err);
        setError('Failed to fetch class examinations or subjects.');
      })
      .finally(() => setLoadingFilters(false));
  }, [classId]);

  // Track the active exam object for maximum marks limits
  useEffect(() => {
    const exam = exams.find((e) => e.id === examId) || null;
    setSelectedExam(exam);
  }, [examId, exams]);

  // Load student worksheet
  const loadWorksheet = async () => {
    if (!classId || !examId || !subjectId) {
      setError('Please select Class, Exam, and Subject.');
      return;
    }

    setLoadingStudents(true);
    setError(null);
    setSuccess(false);

    try {
      const res = await api.get(`/exams/exams/${examId}/marks/${subjectId}`);
      const entries: StudentEntry[] = res.data.entries;

      // Transform entries into spreadsheet rows
      const initialRows: RowState[] = entries.map((entry) => ({
        studentId: entry.student.id,
        firstName: entry.student.firstName,
        lastName: entry.student.lastName,
        admissionNumber: entry.student.admissionNumber,
        marksObtained: entry.result?.marksObtained !== null && entry.result?.marksObtained !== undefined 
          ? String(entry.result.marksObtained) 
          : '',
        isAbsent: entry.result?.isAbsent || false,
        remarks: entry.result?.remarks || '',
      }));

      setRows(initialRows);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to load class list for marks entry.');
    } finally {
      setLoadingStudents(false);
    }
  };

  // Automatically trigger worksheet load when filters change and are fully selected
  useEffect(() => {
    if (classId && examId && subjectId) {
      loadWorksheet();
    } else {
      setRows([]);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [classId, examId, subjectId]);

  // Update cell values locally
  const handleCellChange = (index: number, field: keyof RowState, value: any) => {
    setRows((prev) => {
      const updated = [...prev];
      if (field === 'isAbsent') {
        updated[index] = {
          ...updated[index],
          isAbsent: value,
          // Clear marks if marked absent
          marksObtained: value ? '' : updated[index].marksObtained,
        };
      } else {
        updated[index] = {
          ...updated[index],
          [field]: value,
        };
      }
      return updated;
    });
  };

  // Perform bulk save
  const handleSave = async () => {
    if (!examId || !subjectId) return;
    setError(null);
    setSuccess(false);

    // Validate scores
    const max = selectedExam?.maxMarks || 100;
    for (const r of rows) {
      if (!r.isAbsent && r.marksObtained !== '') {
        const val = parseFloat(r.marksObtained);
        if (isNaN(val) || val < 0 || val > max) {
          setError(`Invalid marks for ${r.firstName} ${r.lastName}. Marks must be between 0 and ${max}.`);
          return;
        }
      }
    }

    setSaving(true);

    try {
      const records = rows.map((r) => ({
        studentId: r.studentId,
        marksObtained: r.isAbsent || r.marksObtained === '' ? null : parseFloat(r.marksObtained),
        isAbsent: r.isAbsent,
        remarks: r.remarks.trim() || null,
      }));

      await api.post(`/exams/exams/${examId}/marks/${subjectId}`, { records });
      setSuccess(true);
      setTimeout(() => setSuccess(false), 5000);
      loadWorksheet(); // reload to confirm saved states
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to save marks. Please check your data.');
    } finally {
      setSaving(false);
    }
  };

  // Helper: All Present
  const setAllPresent = () => {
    setRows((prev) => prev.map((r) => ({ ...r, isAbsent: false })));
  };

  // Helper: Clear scores
  const clearAllScores = () => {
    if (window.confirm('Clear all entered scores?')) {
      setRows((prev) => prev.map((r) => ({ ...r, marksObtained: '', isAbsent: false })));
    }
  };

  return (
    <div className="max-w-5xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
            <ClipboardList className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
            Marks Entry Worksheet
          </h1>
          <p className="text-sm text-gray-500 font-body">Input subject grades and scores for school examinations. Choose Class, Exam, and Subject to start.</p>
        </div>
      </div>

      {/* Filter Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 font-display">Class</label>
            <select
              value={classId}
              onChange={(e) => setClassId(e.target.value)}
              disabled={loadingFilters}
              className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all bg-white text-[#1A1D23] font-body disabled:opacity-50 cursor-pointer"
            >
              <option value="">Select Class</option>
              {classes.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 font-display">Exam</label>
            <select
              value={examId}
              onChange={(e) => setExamId(e.target.value)}
              disabled={loadingFilters || !classId}
              className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all bg-white text-[#1A1D23] font-body disabled:opacity-50 cursor-pointer"
            >
              <option value="">Select Exam</option>
              {exams.map((e) => (
                <option key={e.id} value={e.id}>
                  {e.name}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-400 uppercase tracking-wider mb-1.5 font-display">Subject</label>
            <select
              value={subjectId}
              onChange={(e) => setSubjectId(e.target.value)}
              disabled={loadingFilters || !classId}
              className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all bg-white text-[#1A1D23] font-body disabled:opacity-50 cursor-pointer"
            >
              <option value="">Select Subject</option>
              {subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center justify-between font-body animate-fade-in">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="text-red-900 font-bold hover:text-red-700 text-lg line-none p-1">×</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-green-50 border border-green-200 text-green-800 rounded-xl text-sm flex items-center justify-between font-body animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle className="w-4 h-4 text-green-600 shrink-0" strokeWidth={1.75} />
            <span>Marks successfully uploaded and grades calculated!</span>
          </div>
          <button onClick={() => setSuccess(false)} className="text-green-900 font-bold hover:text-green-700 text-lg line-none p-1">×</button>
        </div>
      )}

      {/* Spreadsheet / Table */}
      {classId && examId && subjectId ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-[0_1px_3px_rgba(0,0,0,0.02)] overflow-hidden font-body">
          <div className="px-6 py-4 bg-gray-50/50 border-b border-[#E5E7EB] flex flex-wrap items-center justify-between gap-4">
            <div className="flex flex-wrap items-center gap-4">
              <span className="text-sm font-semibold text-gray-800 font-display">
                Class List — {rows.length} Students
              </span>
              {selectedExam && (
                <span className="px-3 py-1 bg-[#E5F6EE] text-[#1D7A4A] text-xs font-semibold rounded-full border border-[#1D7A4A]/10 font-body">
                  Exam Max Marks: {selectedExam.maxMarks} (Passing: {selectedExam.passingMarks})
                </span>
              )}
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={setAllPresent}
                className="text-xs px-3 py-1.5 bg-white border border-[#E5E7EB] hover:bg-gray-50 text-gray-700 font-semibold rounded-lg transition-all font-display cursor-pointer"
              >
                Mark All Present
              </button>
              <button
                type="button"
                onClick={clearAllScores}
                className="text-xs px-3 py-1.5 bg-red-50 hover:bg-red-100/70 text-red-700 font-semibold rounded-lg transition-all font-display cursor-pointer"
              >
                Clear All
              </button>
            </div>
          </div>

          {loadingStudents ? (
            <div className="py-24 text-center text-sm text-gray-400 font-body">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-3"></div>
              Loading worksheet rows...
            </div>
          ) : rows.length === 0 ? (
            <div className="py-20 text-center text-sm text-gray-400 font-body">
              No active students found in this class.
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-left text-sm whitespace-nowrap">
                <thead className="bg-gray-50 text-gray-400 uppercase text-[10px] tracking-wider border-b border-[#E5E7EB] font-display">
                  <tr>
                    <th className="px-6 py-3.5 font-semibold text-center w-12">#</th>
                    <th className="px-6 py-3.5 font-semibold">Adm No.</th>
                    <th className="px-6 py-3.5 font-semibold">Student Name</th>
                    <th className="px-6 py-3.5 font-semibold text-center w-36">Absent</th>
                    <th className="px-6 py-3.5 font-semibold w-48 text-right">Marks Obtained</th>
                    <th className="px-6 py-3.5 font-semibold">Remarks / Comments</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E5E7EB] bg-white font-body">
                  {rows.map((r, i) => (
                    <tr
                      key={r.studentId}
                      className={`hover:bg-gray-50/50 transition-colors h-12 ${
                        r.isAbsent ? 'bg-red-50/30' : ''
                      }`}
                    >
                      <td className="px-6 py-3 text-center text-gray-400 font-mono text-xs">
                        {i + 1}
                      </td>
                      <td className="px-6 py-3 font-mono text-xs text-gray-500">
                        {r.admissionNumber}
                      </td>
                      <td className="px-6 py-3 font-semibold text-gray-800 font-display">
                        {r.firstName} {r.lastName}
                      </td>
                      <td className="px-6 py-3 text-center">
                        <label className="inline-flex items-center justify-center cursor-pointer">
                          <input
                            type="checkbox"
                            checked={r.isAbsent}
                            onChange={(e) => handleCellChange(i, 'isAbsent', e.target.checked)}
                            className="w-4.5 h-4.5 rounded border-gray-300 text-[#1D7A4A] focus:ring-[#1D7A4A]/20 cursor-pointer"
                          />
                        </label>
                      </td>
                      <td className="px-6 py-3">
                        <div className="relative">
                          <input
                            type="number"
                            min="0"
                            max={selectedExam?.maxMarks || 100}
                            step="0.5"
                            placeholder="Score"
                            disabled={r.isAbsent}
                            value={r.marksObtained}
                            onChange={(e) => handleCellChange(i, 'marksObtained', e.target.value)}
                            className={`w-full border rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] disabled:opacity-50 font-semibold text-right ${
                              r.isAbsent 
                                ? 'bg-gray-100 border-gray-250 text-gray-300' 
                                : 'bg-white border-[#E5E7EB] text-gray-800'
                            }`}
                          />
                          {selectedExam && !r.isAbsent && (
                            <span className="absolute left-2.5 top-2 text-[10px] text-gray-400 font-normal uppercase tracking-wider font-display">
                              / {selectedExam.maxMarks}
                            </span>
                          )}
                        </div>
                      </td>
                      <td className="px-6 py-3 pr-6">
                        <input
                          type="text"
                          placeholder="e.g. Excellent progress"
                          value={r.remarks}
                          onChange={(e) => handleCellChange(i, 'remarks', e.target.value)}
                          className="w-full border border-[#E5E7EB] rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-gray-700"
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* Table Save Actions */}
          {rows.length > 0 && (
            <div className="px-6 py-4 bg-gray-50 border-t border-[#E5E7EB] flex items-center justify-end gap-3 font-display">
              <button
                type="button"
                onClick={handleSave}
                disabled={saving || loadingStudents}
                className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-sm font-semibold disabled:opacity-50 transition-all shadow-sm flex items-center gap-2 cursor-pointer"
              >
                <Save className="w-4 h-4" strokeWidth={2} />
                {saving ? 'Saving Scores...' : 'Save Worksheet'}
              </button>
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white border border-[#E5E7EB] rounded-xl py-24 text-center shadow-[0_1px_3px_rgba(0,0,0,0.02)] p-6">
          <ClipboardList className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
          <p className="text-gray-400 text-sm font-medium font-body max-w-sm mx-auto">
            Select Class, Exam, and Subject filters to render student marks entry worksheet.
          </p>
        </div>
      )}
    </div>
  );
}