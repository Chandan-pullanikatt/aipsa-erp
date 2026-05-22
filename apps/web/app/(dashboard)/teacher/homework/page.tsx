'use client';

import { useEffect, useState, useCallback } from 'react';
import { getUser } from '@/lib/auth';
import api from '@/lib/api';
import { FileText, Calendar, Link as LinkIcon, Trash2, ExternalLink, Plus, BookOpen, Clock, AlertCircle, CheckCircle2 } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectItem {
  id: string;
  name: string;
}

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

export default function TeacherHomeworkPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [homeworks, setHomeworks] = useState<HomeworkItem[]>([]);
  
  // Form state
  const [classId, setClassId] = useState('');
  const [subjectId, setSubjectId] = useState('');
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [dueDate, setDueDate] = useState('');
  const [attachmentUrl, setAttachmentUrl] = useState('');

  // Status state
  const [loadingClasses, setLoadingClasses] = useState(false);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingList, setLoadingList] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  // Fetch teacher's classes
  useEffect(() => {
    setLoadingClasses(true);
    api.get('/homework/my-classes')
      .then((r) => {
        setClasses(r.data);
      })
      .catch((err) => {
        console.error('Failed to load classes', err);
        setError('Failed to load assigned classes.');
      })
      .finally(() => setLoadingClasses(false));
  }, []);

  // Fetch subjects when selected class changes
  useEffect(() => {
    if (!classId) {
      setSubjects([]);
      setSubjectId('');
      return;
    }
    setLoadingSubjects(true);
    api.get('/exams/subjects', { params: { classId } })
      .then((r) => {
        setSubjects(r.data);
      })
      .catch((err) => {
        console.error('Failed to load subjects', err);
      })
      .finally(() => setLoadingSubjects(false));
  }, [classId]);

  // Load homeworks
  const loadHomeworks = useCallback(() => {
    setLoadingList(true);
    api.get('/homework')
      .then((r) => {
        setHomeworks(r.data.items);
      })
      .catch((err) => {
        console.error('Failed to load homework', err);
        setError('Failed to load homework assignments.');
      })
      .finally(() => setLoadingList(false));
  }, []);

  useEffect(() => {
    loadHomeworks();
  }, [loadHomeworks]);

  // Handle post homework
  const handlePost = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!classId || !title.trim()) {
      setError('Please select a class and fill in the title.');
      return;
    }
    setError(null);
    setSuccess(null);
    setSubmitting(true);

    try {
      const u = getUser();
      if (!u) throw new Error('Not logged in');

      const payload = {
        classId,
        subjectId: subjectId || undefined,
        title: title.trim(),
        description: description.trim() || undefined,
        dueDate: dueDate || undefined,
        attachmentUrl: attachmentUrl.trim() || undefined,
        teacherId: u.id,
      };

      await api.post('/homework', payload);
      setSuccess('Homework successfully posted!');
      
      // Reset form fields
      setTitle('');
      setDescription('');
      setDueDate('');
      setAttachmentUrl('');
      setSubjectId('');

      // Reload assignments
      loadHomeworks();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to post homework. Please try again.');
    } finally {
      setSubmitting(false);
    }
  };

  // Handle delete homework
  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this homework?')) return;
    setDeletingId(id);
    setError(null);
    setSuccess(null);

    try {
      await api.delete(`/homework/${id}`);
      setSuccess('Homework assignment deleted.');
      loadHomeworks();
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to delete homework.');
    } finally {
      setDeletingId(null);
    }
  };

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-1">
        <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
          <BookOpen className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
          Homework Management
        </h1>
        <p className="text-sm text-gray-500 font-body">
          Assign homework tasks to your classes, specify due dates, and attach reference links.
        </p>
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
        <div className="p-4 bg-[#E5F6EE] border border-[#1D7A4A]/20 text-[#1D7A4A] rounded-xl text-sm flex items-center justify-between font-body animate-fade-in">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-[#1D7A4A] shrink-0" strokeWidth={1.75} />
            <span>{success}</span>
          </div>
          <button onClick={() => setSuccess(null)} className="text-[#155B37] font-bold hover:text-[#1D7A4A] text-lg line-none p-1">×</button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Form Card */}
        <div className="lg:col-span-1 bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)] h-fit space-y-4">
          <div className="flex items-center gap-2 border-b border-gray-100 pb-3">
            <Plus className="w-4 h-4 text-[#1D7A4A]" strokeWidth={2} />
            <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 font-display">
              Post New Homework
            </h2>
          </div>
          
          <form onSubmit={handlePost} className="space-y-4 font-body">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Class</label>
              <select
                value={classId}
                onChange={(e) => setClassId(e.target.value)}
                disabled={loadingClasses}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] disabled:opacity-50 transition-colors"
                required
              >
                <option value="">Select a class</option>
                {classes.map((c) => (
                  <option key={c.id} value={c.id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Subject (Optional)</label>
              <select
                value={subjectId}
                onChange={(e) => setSubjectId(e.target.value)}
                disabled={loadingSubjects || !classId}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] disabled:opacity-50 transition-colors"
              >
                <option value="">Select a subject</option>
                {subjects.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.name}
                  </option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Title</label>
              <input
                type="text"
                placeholder="e.g. Chapter 4 Practice Exercises"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
                required
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Instructions</label>
              <textarea
                rows={4}
                placeholder="Detail the instructions, reading material, or specific questions..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] resize-none"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Due Date</label>
              <input
                type="date"
                value={dueDate}
                onChange={(e) => setDueDate(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
              />
            </div>

            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2 font-display">Resource Link</label>
              <input
                type="url"
                placeholder="e.g. https://drive.google.com/.../file.pdf"
                value={attachmentUrl}
                onChange={(e) => setAttachmentUrl(e.target.value)}
                className="w-full border border-[#E5E7EB] rounded-lg px-3.5 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
              />
            </div>

            <button
              type="submit"
              disabled={submitting}
              className="w-full py-2.5 bg-[#1D7A4A] text-white rounded-lg text-sm font-semibold hover:bg-[#155B37] disabled:opacity-50 transition-colors shadow-sm font-display flex items-center justify-center gap-2 cursor-pointer"
            >
              {submitting ? 'Posting Homework...' : 'Post Homework'}
            </button>
          </form>
        </div>

        {/* Right Column: List Card */}
        <div className="lg:col-span-2 space-y-4">
          <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
            <div className="flex items-center justify-between mb-5 border-b border-gray-100 pb-3">
              <div className="flex items-center gap-2">
                <FileText className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                <h2 className="text-sm font-semibold uppercase tracking-wider text-gray-500 font-display">
                  Your Posted Homework
                </h2>
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
                <p className="text-xs text-gray-400 font-body mt-1">Use the form to assign your first homework task.</p>
              </div>
            ) : (
              <div className="space-y-4">
                {homeworks.map((hw) => (
                  <div key={hw.id} className="p-5 bg-gray-50/60 hover:bg-gray-50 border border-gray-200/80 rounded-xl transition-all relative group font-body">
                    <div className="flex flex-wrap items-start justify-between gap-4 mb-2 pr-6">
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
                        <div className="shrink-0">
                          <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-orange-50 text-orange-700 text-xs font-bold rounded-full border border-orange-100">
                            <Clock className="w-3.5 h-3.5" strokeWidth={2} />
                            Due: {new Date(hw.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                          </span>
                        </div>
                      )}
                    </div>

                    {hw.description && (
                      <p className="text-sm text-gray-600 mb-4 mt-3 whitespace-pre-wrap leading-relaxed">{hw.description}</p>
                    )}

                    <div className="flex items-center justify-between mt-4 pt-3.5 border-t border-gray-200/60 text-xs">
                      <div className="text-gray-400">
                        Posted {new Date(hw.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })}
                      </div>

                      <div className="flex items-center gap-4">
                        {hw.attachmentUrl && (
                          <a
                            href={hw.attachmentUrl}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="text-xs text-[#1D7A4A] hover:text-[#155B37] font-semibold inline-flex items-center gap-1 transition-colors"
                          >
                            <ExternalLink className="w-3.5 h-3.5" strokeWidth={2} />
                            View Reference
                          </a>
                        )}

                        <button
                          onClick={() => handleDelete(hw.id)}
                          disabled={deletingId === hw.id}
                          className="text-xs text-red-600 hover:text-red-800 font-semibold p-1 hover:bg-red-50 rounded transition-colors disabled:opacity-50 inline-flex items-center gap-1 cursor-pointer"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={2} />
                          {deletingId === hw.id ? 'Deleting...' : 'Delete'}
                        </button>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}