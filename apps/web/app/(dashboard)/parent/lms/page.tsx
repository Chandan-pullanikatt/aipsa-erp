'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getVideoEmbedUrl, isVideoUrl } from '@/lib/videoUtils';
import {
  GraduationCap,
  Search,
  AlertCircle,
  BookOpen,
  Loader2,
  CheckCircle2,
  FileText,
  ExternalLink,
  Circle,
  Lock,
  Play,
} from 'lucide-react';

interface ChildItem {
  id: string;
  firstName: string;
  lastName: string;
  admissionNumber: string;
  class: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
  class: { id: string; name: string } | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  _count: { lmsMaterials: number };
}

interface LmsMaterial {
  id: string;
  title: string;
  description: string | null;
  sequence: number;
  attachmentUrl: string | null;
  educationalLinks: { title: string; url: string }[] | null;
  isPremium: boolean;
  isFreePreview: boolean;
  locked: boolean;
  completed: boolean;
  createdAt: string;
}

const SUBJECT_THEMES = [
  { bg: 'bg-[#F0F5FF]', text: 'text-[#1E40AF]', border: 'border-[#BFDBFE]' },
  { bg: 'bg-[#FBF0FF]', text: 'text-[#6B21A8]', border: 'border-[#E9D5FF]' },
  { bg: 'bg-[#FFF8E6]', text: 'text-[#92400E]', border: 'border-[#FEEBAD]' },
  { bg: 'bg-[#ECFDF5]', text: 'text-[#065F46]', border: 'border-[#A7F3D0]' },
  { bg: 'bg-[#FFF5F5]', text: 'text-[#9B1C1C]', border: 'border-[#FEB2B2]' },
];

export default function ParentLmsPage() {
  const [children, setChildren] = useState<ChildItem[]>([]);
  const [activeChild, setActiveChild] = useState<ChildItem | null>(null);
  const [loadingChildren, setLoadingChildren] = useState(true);

  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [materials, setMaterials] = useState<LmsMaterial[]>([]);
  const [search, setSearch] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(false);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Load the parent's linked children once.
  useEffect(() => {
    api.get('/sis/parent/students')
      .then((r) => {
        setChildren(r.data);
        if (r.data[0]) setActiveChild(r.data[0]);
      })
      .catch(() => setError('Failed to load linked children.'))
      .finally(() => setLoadingChildren(false));
  }, []);

  // Load subjects for the active child (LMS scopes by the child's class).
  useEffect(() => {
    if (!activeChild) return;
    setLoadingSubjects(true);
    setSelectedSubject(null);
    setMaterials([]);
    api.get('/lms/subjects', { params: { studentId: activeChild.id } })
      .then((r) => {
        setSubjects(r.data);
        setSelectedSubject(r.data[0] || null);
      })
      .catch((err) => setError(err.response?.data?.error || 'Failed to fetch subjects.'))
      .finally(() => setLoadingSubjects(false));
  }, [activeChild]);

  const loadMaterials = useCallback(async (subjectId: string) => {
    setLoadingMaterials(true);
    try {
      const { data } = await api.get(`/lms/subjects/${subjectId}/materials`);
      setMaterials(data);
    } catch {
      setError('Failed to load subject materials.');
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubject) loadMaterials(selectedSubject.id);
  }, [selectedSubject, loadMaterials]);

  const handleToggleProgress = async (materialId: string, locked: boolean) => {
    if (locked) return;
    setTogglingId(materialId);
    try {
      const { data } = await api.post(`/lms/materials/${materialId}/progress`);
      setMaterials(prev => prev.map(m => m.id === materialId ? { ...m, completed: data.completed } : m));
    } catch {
      setError('Failed to update progress.');
    } finally {
      setTogglingId(null);
    }
  };

  const filteredSubjects = subjects.filter(sub =>
    sub.name.toLowerCase().includes(search.toLowerCase()) ||
    (sub.code && sub.code.toLowerCase().includes(search.toLowerCase()))
  );

  const nonLockedMaterials = materials.filter(m => !m.locked);
  const completedCount = nonLockedMaterials.filter(m => m.completed).length;
  const progressPercent = nonLockedMaterials.length > 0 ? Math.round((completedCount / nonLockedMaterials.length) * 100) : 0;

  if (loadingChildren) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <Loader2 className="animate-spin h-10 w-10 text-[#1D7A4A] mx-auto mb-4" strokeWidth={1.75} />
        Loading Study Hub...
      </div>
    );
  }

  if (children.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center">
        <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
        <h3 className="font-bold text-slate-800 text-lg font-display">No Linked Children</h3>
        <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed font-body">
          Link your child from the dashboard to browse their learning materials here.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
            Study Hub
          </h1>
          <p className="text-sm text-gray-500 font-body">Browse your child's course materials, track progress, and open resources.</p>
        </div>

        <div className="w-full md:w-72 relative">
          <input
            type="text"
            placeholder="Search subjects..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg pl-9 pr-4 py-2 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] focus:border-transparent text-gray-700 bg-white font-body"
          />
          <Search className="w-4 h-4 text-gray-400 absolute left-3 top-2.5" strokeWidth={1.75} />
        </div>
      </div>

      {/* Child selector — only when the parent has more than one linked child. */}
      {children.length > 1 && (
        <div className="flex flex-wrap gap-2">
          {children.map((child) => {
            const isSelected = activeChild?.id === child.id;
            return (
              <button
                key={child.id}
                onClick={() => setActiveChild(child)}
                className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all font-display ${
                  isSelected
                    ? 'bg-[#1D7A4A] text-white shadow-sm'
                    : 'bg-white border border-[#E5E7EB] text-[#6B7280] hover:border-gray-300'
                }`}
              >
                {child.firstName} {child.lastName}
                {child.class?.name ? <span className="opacity-70"> · {child.class.name}</span> : null}
              </button>
            );
          })}
        </div>
      )}

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-lg flex items-center justify-between font-body">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:text-rose-900">Close</button>
        </div>
      )}

      {loadingSubjects ? (
        <div className="py-24 text-center text-sm text-gray-400 font-body">
          <Loader2 className="animate-spin h-8 w-8 text-[#1D7A4A] mx-auto mb-2" strokeWidth={1.75} />
          Loading subjects...
        </div>
      ) : subjects.length === 0 ? (
        <div className="py-24 text-center border border-[#E5E7EB] bg-white rounded-xl p-6 shadow-sm font-body">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-bold text-slate-800 text-lg font-display">No Active Subjects</h3>
          <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Your child's class currently has no courses mapped in the LMS. Ask the school to publish curriculum chapters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subject sidebar */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider px-1 font-display">Course schedules</h3>

            {filteredSubjects.length === 0 ? (
              <p className="text-xs text-gray-400 text-center py-6 font-body">No matching subjects found.</p>
            ) : (
              <div className="space-y-3">
                {filteredSubjects.map((sub, idx) => {
                  const isSelected = selectedSubject?.id === sub.id;
                  const theme = SUBJECT_THEMES[idx % SUBJECT_THEMES.length];

                  return (
                    <button
                      key={sub.id}
                      onClick={() => setSelectedSubject(sub)}
                      className={`w-full text-left rounded-xl border p-4 transition-all shadow-sm font-body ${
                        isSelected
                          ? 'bg-[#E5F6EE] border-[#1D7A4A] text-[#155B37] ring-2 ring-[#1D7A4A]/10'
                          : 'bg-white border-[#E5E7EB] hover:border-gray-300 text-slate-800'
                      }`}
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div className="space-y-1 flex-1">
                          <span className={`inline-block text-[10px] font-bold px-2 py-0.5 rounded ${
                            isSelected ? 'bg-[#1D7A4A] text-white' : `${theme.bg} ${theme.text} border ${theme.border}`
                          }`}>
                            {sub.code || 'NO-CODE'}
                          </span>
                          <h4 className="font-bold text-sm tracking-tight leading-snug font-display mt-1">{sub.name}</h4>
                          <p className={`text-[10px] mt-0.5 ${isSelected ? 'text-[#1D7A4A]/80' : 'text-gray-500'}`}>
                            Class {sub.class?.name || 'Assigned'}
                          </p>
                        </div>
                        {isSelected && <CheckCircle2 className="w-4 h-4 text-[#1D7A4A] shrink-0 mt-0.5" strokeWidth={1.75} />}
                      </div>

                      <div className={`mt-4 pt-3 border-t text-[10px] font-bold flex items-center justify-between ${
                        isSelected ? 'border-[#1D7A4A]/15 text-[#1D7A4A]' : 'border-gray-100 text-gray-400'
                      }`}>
                        <span>
                          {sub.teacher ? `${sub.teacher.firstName} ${sub.teacher.lastName}` : 'Guest Lecturer'}
                        </span>
                        <span className={`px-2 py-0.5 rounded text-[9px] ${
                          isSelected ? 'bg-[#1D7A4A]/10' : 'bg-gray-100 text-gray-500'
                        }`}>
                          {sub._count.lmsMaterials} Chapters
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Materials panel */}
          <div className="lg:col-span-2 space-y-6">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
              {/* Header + Progress */}
              <div className="flex items-center justify-between mb-2 pb-4 border-b border-gray-100">
                <div className="space-y-0.5">
                  <h3 className="font-display font-bold text-slate-800 text-lg leading-snug flex items-center gap-2">
                    <BookOpen className="w-5 h-5 text-[#1D7A4A]" strokeWidth={1.75} />
                    {selectedSubject?.name} Syllabus
                  </h3>
                  <p className="text-xs text-gray-400 font-body">Mark chapters as completed to track progress</p>
                </div>
                <span className="bg-[#E5F6EE] text-[#1D7A4A] px-3 py-1 border border-[#1D7A4A]/10 rounded-full font-bold text-xs font-display">
                  {materials.length} Chapters
                </span>
              </div>

              {/* Progress bar */}
              {nonLockedMaterials.length > 0 && (
                <div className="mb-6 space-y-2">
                  <div className="flex items-center justify-between text-xs font-display">
                    <span className="font-semibold text-gray-600">{completedCount} of {nonLockedMaterials.length} completed</span>
                    <span className={`font-bold ${progressPercent === 100 ? 'text-[#1D7A4A]' : 'text-gray-500'}`}>{progressPercent}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <div
                      className="bg-[#1D7A4A] h-2.5 rounded-full transition-all duration-500"
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>
                </div>
              )}

              {loadingMaterials ? (
                <div className="py-20 text-center text-sm text-gray-400 font-body">
                  <Loader2 className="animate-spin h-8 w-8 text-[#1D7A4A] mx-auto mb-2" strokeWidth={1.75} />
                  Loading syllabus...
                </div>
              ) : materials.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[#E5E7EB] rounded-xl font-body">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.75} />
                  <p className="text-sm font-semibold text-gray-700 font-display">Syllabus Coming Soon</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                    No course materials published for this subject yet.
                  </p>
                </div>
              ) : (
                <div className="space-y-4 relative before:absolute before:inset-y-1 before:left-3.5 before:w-0.5 before:bg-gray-100">
                  {materials.map((mat) => (
                    <div key={mat.id} className="relative pl-10 flex flex-col gap-3 font-body">
                      {/* Timeline dot */}
                      <div className={`absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full ring-4 shrink-0 transform -translate-x-1/2 transition-colors ${
                        mat.locked
                          ? 'bg-amber-400 ring-amber-50'
                          : mat.completed
                          ? 'bg-[#1D7A4A] ring-[#E5F6EE]'
                          : 'bg-gray-300 ring-gray-50'
                      }`} />

                      <div className={`border rounded-xl p-4 transition-all ${
                        mat.locked
                          ? 'bg-amber-50/40 border-amber-200/60'
                          : mat.completed
                          ? 'bg-[#F0FDF6] border-[#1D7A4A]/15'
                          : 'bg-white border-[#E5E7EB] hover:border-gray-300'
                      }`}>
                        <div className="flex items-start justify-between gap-3">
                          <div className="space-y-1.5 flex-1">
                            <div className="flex items-center gap-2 flex-wrap">
                              <span className="text-[10px] bg-slate-100 text-slate-600 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider font-display">
                                SEQ {mat.sequence}
                              </span>
                              <h4 className={`font-bold text-base leading-snug font-display ${
                                mat.locked
                                  ? 'text-amber-800'
                                  : mat.completed
                                  ? 'text-[#155B37] line-through decoration-[#1D7A4A]/40'
                                  : 'text-slate-800'
                              }`}>
                                {mat.title}
                              </h4>
                              {mat.locked && (
                                <span className="text-[10px] bg-amber-100 text-amber-700 border border-amber-200 px-2 py-0.5 rounded font-bold font-display flex items-center gap-1">
                                  <Lock className="w-2.5 h-2.5" strokeWidth={2.5} />
                                  Premium
                                </span>
                              )}
                              {mat.isFreePreview && !mat.locked && (
                                <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 px-2 py-0.5 rounded font-bold font-display flex items-center gap-1">
                                  <Play className="w-2.5 h-2.5" strokeWidth={2.5} />
                                  Free Preview
                                </span>
                              )}
                              {!mat.locked && mat.completed && (
                                <span className="text-[10px] bg-[#E5F6EE] text-[#1D7A4A] px-2 py-0.5 rounded font-bold border border-[#1D7A4A]/10 font-display">
                                  Completed
                                </span>
                              )}
                            </div>

                            {mat.description && (
                              <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                                {mat.description}
                              </p>
                            )}

                            {mat.locked && (
                              <p className="text-xs text-amber-700/80 mt-1">
                                This is premium recorded content. Ask the school for access details.
                              </p>
                            )}
                          </div>

                          {/* Completion toggle — hidden for locked materials */}
                          {!mat.locked && (
                            <button
                              onClick={() => handleToggleProgress(mat.id, mat.locked)}
                              disabled={togglingId === mat.id}
                              title={mat.completed ? 'Mark as incomplete' : 'Mark as completed'}
                              className={`shrink-0 w-8 h-8 rounded-full flex items-center justify-center transition-all border-2 cursor-pointer ${
                                mat.completed
                                  ? 'bg-[#1D7A4A] border-[#1D7A4A] text-white hover:bg-[#155B37]'
                                  : 'bg-white border-gray-300 text-gray-300 hover:border-[#1D7A4A] hover:text-[#1D7A4A]'
                              } disabled:opacity-50`}
                            >
                              {togglingId === mat.id ? (
                                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
                              ) : mat.completed ? (
                                <CheckCircle2 className="w-4 h-4" strokeWidth={2.5} />
                              ) : (
                                <Circle className="w-4 h-4" strokeWidth={2} />
                              )}
                            </button>
                          )}
                        </div>

                        {!mat.locked && mat.attachmentUrl && getVideoEmbedUrl(mat.attachmentUrl) && (
                          <div className="mt-3 w-full rounded-xl overflow-hidden border border-[#E5E7EB] bg-black shadow-sm">
                            <div className="relative w-full" style={{ paddingTop: '56.25%' }}>
                              <iframe
                                src={getVideoEmbedUrl(mat.attachmentUrl)!}
                                title={mat.title}
                                className="absolute inset-0 w-full h-full"
                                allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                                allowFullScreen
                              />
                            </div>
                          </div>
                        )}

                        {!mat.locked && (mat.attachmentUrl || (mat.educationalLinks && mat.educationalLinks.length > 0)) && (
                          <div className="bg-gray-50 border border-[#E5E7EB] rounded-lg p-3 mt-3 flex flex-wrap gap-4 text-xs w-full">
                            {mat.attachmentUrl && !isVideoUrl(mat.attachmentUrl) && (
                              <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider font-display">Attachment</span>
                                <a
                                  href={mat.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#1D7A4A] hover:text-[#155B37] hover:underline font-semibold inline-flex items-center gap-1.5"
                                >
                                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                                  Open attachment
                                </a>
                              </div>
                            )}

                            {mat.attachmentUrl && isVideoUrl(mat.attachmentUrl) && (
                              <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider font-display">Video</span>
                                <a
                                  href={mat.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#1D7A4A] hover:text-[#155B37] hover:underline font-semibold inline-flex items-center gap-1.5"
                                >
                                  <Play className="w-4 h-4" strokeWidth={1.75} />
                                  Open in YouTube
                                </a>
                              </div>
                            )}

                            {mat.educationalLinks && mat.educationalLinks.length > 0 && (
                              <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block font-display">Reference links</span>
                                <div className="flex flex-wrap gap-2">
                                  {mat.educationalLinks.map((link, lIdx) => (
                                    <a
                                      key={lIdx}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-white border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-gray-700 hover:text-[#1D7A4A] hover:border-[#1D7A4A]/25 hover:bg-[#E5F6EE]/30 font-medium transition-all shadow-sm flex items-center gap-1.5"
                                    >
                                      <ExternalLink className="w-3.5 h-3.5" strokeWidth={1.75} />
                                      {link.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
