'use client';

import { useEffect, useState, useCallback } from 'react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import {
  FileText, Calendar, Trash2, ExternalLink, Plus, BookOpen,
  Clock, AlertCircle, CheckCircle2, Users, ChevronDown, ChevronUp,
  Send, Award, X, Loader2,
} from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface SubjectItem { id: string; name: string; }

interface HomeworkItem {
  id: string;
  title: string;
  description: string | null;
  dueDate: string | null;
  attachmentUrl: string | null;
  createdAt: string;
  class: { id: string; name: string };
  subject: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string };
}

interface Submission {
  id: string;
  note: string | null;
  attachmentUrl: string | null;
  submittedAt: string;
  grade: string | null;
  feedback: string | null;
  gradedAt: string | null;
  student: { id: string; firstName: string; lastName: string; admissionNumber: string };
  gradedBy: { firstName: string; lastName: string } | null;
}

export default function TeacherHomeworkPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);

  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Submissions panel state
  const [expandedHwId, setExpandedHwId] = useState<string | null>(null);
  const [submissions, setSubmissions] = useState<Record<string, Submission[]>>({});
  const [loadingSubsFor, setLoadingSubsFor] = useState<string | null>(null);

  // Grade modal state
  const [gradingSubmission, setGradingSubmission] = useState<Submission | null>(null);
  const [gradeValue, setGradeValue] = useState('');
  const [feedbackValue, setFeedbackValue] = useState('');
  const [savingGrade, setSavingGrade] = useState(false);

  useEffect(() => {
    setLoadingClasses(true);
    api.get('/homework/my-classes')
      .then((r) => setClasses(r.data))
      .catch((err) => setError(err.response?.data?.error || `Failed to load assigned classes. (${err.message})`))
      .finally(() => setLoadingClasses(false));
  }, []);

  useEffect(() => {
    if (!classId) { setSubjects([]); setSubjectId(''); return; }
    setLoadingSubjects(true);
    api.get('/exams/subjects', { params: { classId } })
      .then((r) => setSubjects(r.data))
      .catch(() => {})
      .finally(() => setLoadingSubjects(false));
  }, [classId]);

  const loadHomeworks = useCallback(() => {
    setLoadingList(true);
    api.get('/homework')
      .then((r) => setHomeworks(Array.isArray(r.data) ? r.data : (r.data.items ?? [])))
      .catch((err) => setError(err.response?.data?.error || `Failed to load homework assignments. (${err.message})`))
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => { loadHomeworks(); }, [loadHomeworks]);

  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title.trim()) { setError('Please select a class and fill in the title.'); return; }
    setError(null); setSuccess(null); setSubmitting(true);
    try {
      const u = getUser();
      if (!u) throw new Error('Not logged in');
      await api.post('/homework', {
        classId, subjectId: subjectId || undefined,
        title: title.trim(), description: description.trim() || undefined,
        dueDate: dueDate || undefined, attachmentUrl: attachmentUrl.trim() || undefined,
        teacherId: u.id,
      });
      setSuccess('Homework successfully posted!');
      setTitle(''); setDescription(''); setDueDate(''); setAttachmentUrl(''); setSubjectId('');
      loadHomeworks();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to post homework.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Delete this homework assignment?')) return;
    setDeletingId(id); setError(null);
    try {
      await api.delete(`/homework/${id}`);
      setSuccess('Homework deleted.');
      loadHomeworks();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete homework.');
    } finally {
      setDeletingId(null);
    }
  };

  const toggleSubmissions = async (hwId: string) => {
    if (expandedHwId === hwId) { setExpandedHwId(null); return; }
    setExpandedHwId(hwId);
    if (submissions[hwId]) return;
    setLoadingSubsFor(hwId);
    try {
      const { data } = await api.get(`/homework/${hwId}/submissions`);
      setSubmissions(prev => ({ ...prev, [hwId]: data }));
    } catch {
      setSubmissions(prev => ({ ...prev, [hwId]: [] }));
    } finally {
      setLoadingSubsFor(null);
    }
  };

  const handleSaveGrade = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!gradingSubmission) return;
    setSavingGrade(true);
    try {
      const hwId = gradingSubmission.id ? submissions[expandedHwId!]?.find(s => s.id === gradingSubmission.id) ? expandedHwId : null : null;
      await api.patch(`/homework/${expandedHwId}/submissions/${gradingSubmission.id}/grade`, {
        grade: gradeValue.trim() || undefined,
        feedback: feedbackValue.trim() || undefined,
      });
      setSubmissions(prev => ({
        ...prev,
        [expandedHwId!]: (prev[expandedHwId!] || []).map(s =>
          s.id === gradingSubmission.id
            ? { ...s, grade: gradeValue.trim() || null, feedback: feedbackValue.trim() || null, gradedAt: new Date().toISOString() }
            : s
        ),
      }));
      setGradingSubmission(null); setGradeValue(''); setFeedbackValue('');
      setSuccess('Grade saved successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save grade.');
    } finally {
      setSavingGrade(false);
    }
  };

  const formatDate = (d: string | null) => d
    ? new Date(d).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
    : '—';

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
          Homework Management
        </h1>
        <p className="text-sm text-gray-500 font-body">
          Assign homework, view student submissions, and grade them from one place.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-800 rounded-xl text-sm flex items-center justify-between font-body">
          <div className="flex items-center gap-2"><AlertCircle className="w-4 h-4 text-red-600 shrink-0" strokeWidth={1.75} /><span>{error}</span></div>
          <button onClick={() => setError(null)} className="text-red-900 font-bold text-lg p-1 cursor-pointer">×</button>
        </div>
      )}

      {success && (
        <div className="p-4 bg-[#E5F6EE] border border-[#1D7A4A]/20 text-[#1D7A4A] rounded-xl text-sm flex items-center justify-between font-body">
          <div className="flex items-center gap-2"><CheckCircle2 className="w-4 h-4 shrink-0" strokeWidth={1.75} /><span>{success}</span></div>
          <button onClick={() => setSuccess(null)} className="text-[#155B37] font-bold text-lg p-1 cursor-pointer">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Post form */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Plus className="w-4 h-4 text-[#1D7A4A]" strokeWidth={2} />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 font-display">Post New Homework</h2>
          </div>

          <form onSubmit={handlePost} className="space-y-4 font-body">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Class</label>
              <select value={classId} onChange={(e) => setClassId(e.target.value)} disabled={loadingClasses}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white disabled:opacity-50" required>
                <option value="">Select a class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Subject (Optional)</label>
              <select value={subjectId} onChange={(e) => setSubjectId(e.target.value)} disabled={loadingSubjects || !classId}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white disabled:opacity-50">
                <option value="">Select a subject</option>
                {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Title</label>
              <input type="text" placeholder="e.g. Chapter 4 Practice Exercises" value={title} onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]" required />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Instructions</label>
              <textarea rows={4} placeholder="Detail the instructions or questions..." value={description} onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] resize-none" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Due Date</label>
              <input type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]" />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Resource Link</label>
              <input type="url" placeholder="https://drive.google.com/..." value={attachmentUrl} onChange={(e) => setAttachmentUrl(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]" />
            </div>

            <button type="submit" disabled={submitting}
              className="w-full py-2.5 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-50 transition-colors shadow-sm font-display flex items-center justify-center gap-2 cursor-pointer">
              {submitting ? 'Posting...' : 'Post Homework'}
            </button>
          </form>
        </div>

        {/* Homework list */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 font-display">Your Posted Homework</h2>
              </div>
              <span className="text-xs bg-gray-50 border border-gray-200 text-gray-600 px-2.5 py-0.5 rounded-full font-semibold font-body">
                {homeworks.length} total
              </span>
            </div>

            {loadingList ? (
              <div className="py-20 text-center text-sm text-gray-400 font-body">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-3"></div>
                Loading assignments...
              </div>
            ) : homeworks.length === 0 ? (
              <div className="py-20 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                <FileText className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                <p className="text-sm font-medium text-gray-500 font-display">No homework posted yet.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {homeworks.map((hw) => (
                  <div key={hw.id} className="border border-gray-200/80 rounded-xl overflow-hidden font-body">
                    {/* Homework card header */}
                    <div className="p-5 bg-gray-50/60 hover:bg-gray-50 transition-all">
                      <div className="flex flex-wrap items-start justify-between gap-4 mb-2">
                        <div className="space-y-1">
                          <h3 className="font-semibold text-gray-900 text-base font-display">{hw.title}</h3>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className="px-2 py-0.5 bg-[#E5F6EE] text-[#1D7A4A] text-xs font-semibold rounded-md border border-[#1D7A4A]/10">
                              {hw.class.name}
                            </span>
                            {hw.subject && (
                              <span className="px-2 py-0.5 bg-purple-50 text-purple-700 text-xs font-semibold rounded-md border border-purple-100">
                                {hw.subject.name}
                              </span>
                            )}
                          </div>
                        </div>

                        {hw.dueDate && (
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-100 shrink-0">
                            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                            Due: {formatDate(hw.dueDate)}
                          </span>
                        )}
                      </div>

                      {hw.description && (
                        <p className="text-sm text-gray-600 mt-2 mb-3 whitespace-pre-wrap leading-relaxed line-clamp-2">{hw.description}</p>
                      )}

                      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-200/60 text-xs">
                        <span className="text-gray-400">
                          Posted {new Date(hw.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </span>

                        <div className="flex items-center gap-3">
                          {hw.attachmentUrl && (
                            <a href={hw.attachmentUrl} target="_blank" rel="noopener noreferrer"
                              className="text-[#1D7A4A] hover:text-[#155B37] font-semibold inline-flex items-center gap-1 transition-colors">
                              <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                              Reference
                            </a>
                          )}

                          <button
                            onClick={() => toggleSubmissions(hw.id)}
                            className="inline-flex items-center gap-1.5 text-xs font-bold text-gray-600 hover:text-[#1D7A4A] bg-white border border-gray-200 hover:border-[#1D7A4A]/30 px-3 py-1.5 rounded-lg transition-all cursor-pointer"
                          >
                            <Users className="w-3.5 h-3.5" strokeWidth={2} />
                            Submissions
                            {expandedHwId === hw.id
                              ? <ChevronUp className="w-3.5 h-3.5" strokeWidth={2} />
                              : <ChevronDown className="w-3.5 h-3.5" strokeWidth={2} />
                            }
                          </button>

                          <button onClick={() => handleDelete(hw.id)} disabled={deletingId === hw.id}
                            className="text-xs text-red-600 hover:text-red-800 font-semibold p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer">
                            <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                            {deletingId === hw.id ? 'Deleting...' : 'Delete'}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Submissions panel */}
                    {expandedHwId === hw.id && (
                      <div className="border-t border-gray-200 bg-white p-5">
                        <h4 className="text-xs font-bold uppercase tracking-wider text-gray-400 mb-4 font-display">
                          Student Submissions
                        </h4>

                        {loadingSubsFor === hw.id ? (
                          <div className="py-8 text-center text-xs text-gray-400 font-body">
                            <Loader2 className="animate-spin h-6 w-6 text-[#1D7A4A] mx-auto mb-2" strokeWidth={1.75} />
                            Loading submissions...
                          </div>
                        ) : !submissions[hw.id] || submissions[hw.id].length === 0 ? (
                          <div className="py-8 text-center text-xs text-gray-400 border border-dashed border-gray-200 rounded-lg font-body">
                            <Send className="w-8 h-8 text-gray-300 mx-auto mb-2" strokeWidth={1.5} />
                            No submissions received yet.
                          </div>
                        ) : (
                          <div className="space-y-3">
                            {submissions[hw.id].map((sub) => (
                              <div key={sub.id} className="border border-[#E5E7EB] rounded-lg p-4 bg-gray-50/30">
                                <div className="flex items-start justify-between gap-3 flex-wrap">
                                  <div>
                                    <p className="font-semibold text-sm text-[#1A1D23] font-display">
                                      {sub.student.firstName} {sub.student.lastName}
                                    </p>
                                    <p className="text-[10px] text-gray-400 mt-0.5 font-body">
                                      ADM: {sub.student.admissionNumber} • Submitted {formatDate(sub.submittedAt)}
                                    </p>
                                  </div>
                                  <div className="flex items-center gap-2">
                                    {sub.grade ? (
                                      <span className="text-[10px] font-bold bg-[#E5F6EE] text-[#1D7A4A] border border-[#1D7A4A]/10 px-2 py-0.5 rounded font-display uppercase">
                                        Grade: {sub.grade}
                                      </span>
                                    ) : null}
                                    <button
                                      onClick={() => { setGradingSubmission(sub); setGradeValue(sub.grade || ''); setFeedbackValue(sub.feedback || ''); }}
                                      className="text-[10px] font-bold text-white bg-[#1D7A4A] hover:bg-[#155B37] px-3 py-1 rounded-lg transition-colors cursor-pointer font-display"
                                    >
                                      {sub.grade ? 'Edit Grade' : 'Grade'}
                                    </button>
                                  </div>
                                </div>

                                {sub.note && (
                                  <div className="mt-3 text-xs text-gray-600 bg-white border border-[#E5E7EB] rounded p-3 leading-relaxed font-body whitespace-pre-wrap">
                                    {sub.note}
                                  </div>
                                )}

                                {sub.attachmentUrl && (
                                  <a href={sub.attachmentUrl} target="_blank" rel="noopener noreferrer"
                                    className="mt-2 text-[10px] text-[#1D7A4A] hover:underline font-semibold inline-flex items-center gap-1 font-body">
                                    <ExternalLink className="w-3 h-3" strokeWidth={2} />
                                    View submitted attachment
                                  </a>
                                )}

                                {sub.feedback && (
                                  <div className="mt-2 text-[10px] text-gray-500 italic font-body">
                                    Feedback: {sub.feedback}
                                  </div>
                                )}
                              </div>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Grade modal */}
      {gradingSubmission && (
        <div className="fixed inset-0 bg-black/45 backdrop-blur-sm z-50 flex items-center justify-center p-4 font-body">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xl max-w-md w-full overflow-hidden">
            <div className="bg-[#1A1D23] px-6 py-4 flex items-center justify-between text-white">
              <div>
                <h3 className="font-bold text-sm font-display">Grade Submission</h3>
                <p className="text-xs text-gray-400 mt-0.5">{gradingSubmission.student.firstName} {gradingSubmission.student.lastName}</p>
              </div>
              <button onClick={() => setGradingSubmission(null)} className="text-gray-400 hover:text-white cursor-pointer">
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSaveGrade} className="p-6 space-y-4">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-display">Grade</label>
                <input type="text" placeholder="e.g. A+, B, 8/10, Excellent"
                  value={gradeValue} onChange={(e) => setGradeValue(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]" />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5 font-display">Feedback (optional)</label>
                <textarea rows={3} placeholder="Write feedback for the student..."
                  value={feedbackValue} onChange={(e) => setFeedbackValue(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] resize-none" />
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <button type="button" onClick={() => setGradingSubmission(null)}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg cursor-pointer font-display">
                  Cancel
                </button>
                <button type="submit" disabled={savingGrade}
                  className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-semibold rounded-lg shadow-sm flex items-center gap-1.5 cursor-pointer disabled:opacity-50 font-display">
                  {savingGrade ? <><Loader2 className="w-3.5 h-3.5 animate-spin" />Saving...</> : <><Award className="w-3.5 h-3.5" strokeWidth={2} />Save Grade</>}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
