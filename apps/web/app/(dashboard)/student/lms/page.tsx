'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
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
  Crown,
  Play,
} from 'lucide-react';

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

declare global {
  interface Window {
    Razorpay: any;
  }
}

function loadRazorpayScript(): Promise<boolean> {
  return new Promise((resolve) => {
    if (window.Razorpay) { resolve(true); return; }
    const script = document.createElement('script');
    script.src = 'https://checkout.razorpay.com/v1/checkout.js';
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });
}

export default function StudentLmsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [materials, setMaterials] = useState<LmsMaterial[]>([]);
  const [search, setSearch] = useState('');
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [togglingId, setTogglingId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isPremium, setIsPremium] = useState(false);
  const [initiatingPayment, setInitiatingPayment] = useState(false);

  useEffect(() => {
    async function loadSubjects() {
      try {
        const [subjectsRes, premiumRes] = await Promise.allSettled([
          api.get('/lms/subjects'),
          api.get('/lms/premium/status'),
        ]);
        if (subjectsRes.status === 'fulfilled') {
          setSubjects(subjectsRes.value.data);
          if (subjectsRes.value.data.length > 0) setSelectedSubject(subjectsRes.value.data[0]);
        } else {
          setError(subjectsRes.reason?.response?.data?.error || 'Failed to fetch subjects.');
        }
        if (premiumRes.status === 'fulfilled') {
          setIsPremium(premiumRes.value.data.isPremium);
        }
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  const loadMaterials = useCallback(async (subjectId: string) => {
    setLoadingMaterials(true);
    try {
      const { data } = await api.get(`/lms/subjects/${subjectId}/materials`);
      setMaterials(data);
    } catch (err) {
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
    } catch (err) {
      setError('Failed to update progress.');
    } finally {
      setTogglingId(null);
    }
  };

  const handleUpgrade = async () => {
    setInitiatingPayment(true);
    setError(null);
    try {
      const loaded = await loadRazorpayScript();
      if (!loaded) throw new Error('Failed to load payment gateway. Please try again.');

      const { data: order } = await api.post('/lms/premium/initiate');

      const rzp = new window.Razorpay({
        key: order.keyId,
        amount: order.amount,
        currency: order.currency,
        name: 'AIPSA Digital School',
        description: `Premium LMS — ${order.academicYear}`,
        order_id: order.orderId,
        handler: async (response: any) => {
          try {
            await api.post('/lms/premium/verify', {
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
            });
            setIsPremium(true);
            if (selectedSubject) loadMaterials(selectedSubject.id);
          } catch {
            setError('Payment received but verification failed. Please contact support.');
          }
        },
        prefill: { name: order.studentName },
        theme: { color: '#1D7A4A' },
        modal: {
          ondismiss: () => setInitiatingPayment(false),
        },
      });

      rzp.open();
    } catch (err: any) {
      setError(err.response?.data?.error || err.message || 'Could not initiate payment.');
      setInitiatingPayment(false);
    }
  };

  const filteredSubjects = subjects.filter(sub =>
    sub.name.toLowerCase().includes(search.toLowerCase()) ||
    (sub.code && sub.code.toLowerCase().includes(search.toLowerCase()))
  );

  const nonLockedMaterials = materials.filter(m => !m.locked);
  const completedCount = nonLockedMaterials.filter(m => m.completed).length;
  const progressPercent = nonLockedMaterials.length > 0 ? Math.round((completedCount / nonLockedMaterials.length) * 100) : 0;
  const premiumCount = materials.filter(m => m.isPremium).length;

  if (loadingSubjects) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <Loader2 className="animate-spin h-10 w-10 text-[#1D7A4A] mx-auto mb-4" strokeWidth={1.75} />
        Loading Student Study Hub...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
            Student Study Hub
          </h1>
          <p className="text-sm text-gray-500 font-body">Browse course material timelines, track your progress, and download resources.</p>
        </div>

        <div className="flex items-center gap-3">
          {isPremium ? (
            <span className="inline-flex items-center gap-1.5 bg-amber-50 text-amber-700 border border-amber-200 px-3 py-1.5 rounded-full text-xs font-bold font-display">
              <Crown className="w-3.5 h-3.5" strokeWidth={2} />
              Premium Active
            </span>
          ) : premiumCount > 0 ? (
            <button
              onClick={handleUpgrade}
              disabled={initiatingPayment}
              className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold font-display transition-all shadow-sm disabled:opacity-60 cursor-pointer"
            >
              {initiatingPayment ? (
                <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} />
              ) : (
                <Crown className="w-3.5 h-3.5" strokeWidth={2} />
              )}
              Upgrade to Premium
            </button>
          ) : null}

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
      </div>

      {error && (
        <div className="bg-rose-50 border border-rose-100 text-rose-700 text-xs px-4 py-3 rounded-lg flex items-center justify-between font-body">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" strokeWidth={1.75} />
            <span>{error}</span>
          </div>
          <button onClick={() => setError(null)} className="font-bold hover:text-rose-900">Close</button>
        </div>
      )}

      {/* Premium upgrade banner (shown when there are locked materials and student hasn't paid) */}
      {!isPremium && premiumCount > 0 && (
        <div className="bg-gradient-to-r from-amber-50 to-orange-50 border border-amber-200 rounded-xl p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div className="flex items-start gap-3">
            <Crown className="w-5 h-5 text-amber-600 shrink-0 mt-0.5" strokeWidth={1.75} />
            <div>
              <p className="text-sm font-bold text-amber-800 font-display">Premium Recorded Classes Available</p>
              <p className="text-xs text-amber-700/80 font-body mt-0.5">
                {premiumCount} premium video {premiumCount === 1 ? 'lesson' : 'lessons'} across your subjects. Pay once per academic year to unlock all recorded class videos.
              </p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            disabled={initiatingPayment}
            className="shrink-0 inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-4 py-2 rounded-lg text-xs font-bold font-display transition-all shadow-sm disabled:opacity-60 cursor-pointer"
          >
            {initiatingPayment ? <Loader2 className="w-3.5 h-3.5 animate-spin" strokeWidth={2} /> : <Crown className="w-3.5 h-3.5" strokeWidth={2} />}
            Unlock Premium Videos
          </button>
        </div>
      )}

      {subjects.length === 0 ? (
        <div className="py-24 text-center border border-[#E5E7EB] bg-white rounded-xl p-6 shadow-sm font-body">
          <BookOpen className="w-16 h-16 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-bold text-slate-800 text-lg font-display">No Active Enrolled Subjects</h3>
          <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed">
            Your class currently has no courses mapped in the LMS. Ask your teacher or admin to publish curriculum chapters.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Subject sidebar */}
          <div className="space-y-4">
            <h3 className="text-xs font-extrabold uppercase text-gray-400 tracking-wider px-1 font-display">My course schedules</h3>

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
                  <p className="text-xs text-gray-400 font-body">Track your progress by marking chapters as completed</p>
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
                  {progressPercent === 100 && (
                    <p className="text-xs text-[#1D7A4A] font-semibold font-body flex items-center gap-1">
                      <CheckCircle2 className="w-3.5 h-3.5" strokeWidth={2} />
                      You have completed all chapters in this subject!
                    </p>
                  )}
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
                  <p className="text-sm font-semibold text-gray-700 font-display">Syllabus Outlines Coming Soon</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed">
                    No course materials published by your mentor yet.
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
                              <div className="mt-2 flex items-center gap-2">
                                <button
                                  onClick={handleUpgrade}
                                  disabled={initiatingPayment}
                                  className="inline-flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white px-3 py-1.5 rounded-lg text-xs font-bold font-display transition-all shadow-sm disabled:opacity-60 cursor-pointer"
                                >
                                  {initiatingPayment ? (
                                    <Loader2 className="w-3 h-3 animate-spin" strokeWidth={2} />
                                  ) : (
                                    <Crown className="w-3 h-3" strokeWidth={2} />
                                  )}
                                  Unlock with Premium
                                </button>
                              </div>
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

                        {!mat.locked && (mat.attachmentUrl || (mat.educationalLinks && mat.educationalLinks.length > 0)) && (
                          <div className="bg-gray-50 border border-[#E5E7EB] rounded-lg p-3 mt-3 flex flex-wrap gap-4 text-xs w-full">
                            {mat.attachmentUrl && (
                              <div className="flex flex-col gap-1 w-full sm:w-auto">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider font-display">Attachment</span>
                                <a
                                  href={mat.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#1D7A4A] hover:text-[#155B37] hover:underline font-semibold inline-flex items-center gap-1.5"
                                >
                                  <FileText className="w-4 h-4" strokeWidth={1.75} />
                                  Download attachment
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
