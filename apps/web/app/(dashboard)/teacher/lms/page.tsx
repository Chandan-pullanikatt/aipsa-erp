'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { BookOpen, Plus, FileText, Link as LinkIcon, Pencil, Trash2, AlertCircle, CheckCircle2, X, GraduationCap, ChevronRight, Paperclip, ExternalLink } from 'lucide-react';

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
  class: { id: string; name: string } | null;
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
  createdAt: string;
}

export default function TeacherLmsPage() {
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [materials, setMaterials] = useState<LmsMaterial[]>([]);

  // Loading States
  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingMaterials, setLoadingMaterials] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  // Form States
  const [modalOpen, setModalOpen] = useState(false);
  const [editingMaterial, setEditingMaterial] = useState<LmsMaterial | null>(null);
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [sequence, setSequence] = useState('0');
  const [attachmentUrl, setAttachmentUrl] = useState('');
  const [educationalLinks, setEducationalLinks] = useState<{ title: string; url: string }[]>([]);
  const [isPremium, setIsPremium] = useState(false);
  const [isFreePreview, setIsFreePreview] = useState(false);

  // Temp Inputs
  const [tempLinkTitle, setTempLinkTitle] = useState('');
  const [tempLinkLabel, setTempLinkLabel] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Fetch subjects
  useEffect(() => {
    async function loadSubjects() {
      try {
        const { data } = await api.get('/lms/subjects');
        setSubjects(data);
        if (data.length > 0) {
          setSelectedSubject(data[0]);
        }
      } catch (err: any) {
        console.error(err);
        setError('Failed to fetch subjects taught.');
      } finally {
        setLoadingSubjects(false);
      }
    }
    loadSubjects();
  }, []);

  // Fetch materials for selected subject
  const loadMaterials = useCallback(async (subjectId: string) => {
    setLoadingMaterials(true);
    try {
      const { data } = await api.get(`/lms/subjects/${subjectId}/materials`);
      setMaterials(data);
    } catch (err) {
      console.error(err);
      setError('Failed to fetch course materials.');
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadMaterials(selectedSubject.id);
    }
  }, [selectedSubject, loadMaterials]);

  const handleOpenCreateModal = () => {
    setEditingMaterial(null);
    setTitle('');
    setDescription('');
    setSequence(String(materials.length * 10)); // Auto-suggest sequence by 10s
    setAttachmentUrl('');
    setEducationalLinks([]);
    setIsPremium(false);
    setIsFreePreview(false);
    setTempLinkTitle('');
    setTempLinkLabel('');
    setModalOpen(true);
  };

  const handleOpenEditModal = (mat: LmsMaterial) => {
    setEditingMaterial(mat);
    setTitle(mat.title);
    setDescription(mat.description || '');
    setSequence(String(mat.sequence));
    setAttachmentUrl(mat.attachmentUrl || '');
    setEducationalLinks(mat.educationalLinks || []);
    setIsPremium(mat.isPremium);
    setIsFreePreview(mat.isFreePreview);
    setTempLinkTitle('');
    setTempLinkLabel('');
    setModalOpen(true);
  };

  const handleAddLink = () => {
    if (!tempLinkTitle || !tempLinkLabel) return;
    setEducationalLinks([...educationalLinks, { title: tempLinkLabel, url: tempLinkTitle }]);
    setTempLinkTitle('');
    setTempLinkLabel('');
  };

  const handleRemoveLink = (idx: number) => {
    setEducationalLinks(educationalLinks.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSubject) return;

    setSubmitting(true);
    try {
      const payload = {
        subjectId: selectedSubject.id,
        title,
        description: description || null,
        sequence: parseInt(sequence) || 0,
        attachmentUrl: attachmentUrl || null,
        educationalLinks: educationalLinks.length > 0 ? educationalLinks : null,
        isPremium,
        isFreePreview: isPremium ? isFreePreview : false,
      };

      if (editingMaterial) {
        await api.put(`/lms/materials/${editingMaterial.id}`, payload);
      } else {
        await api.post('/lms/materials', payload);
      }

      setModalOpen(false);
      loadMaterials(selectedSubject.id);

      // Refresh subjects list counts
      const { data } = await api.get('/lms/subjects');
      setSubjects(data);
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to submit curriculum update.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!window.confirm('Are you sure you want to delete this syllabus outline chapter?')) return;

    try {
      await api.delete(`/lms/materials/${id}`);
      if (selectedSubject) {
        loadMaterials(selectedSubject.id);
        const { data } = await api.get('/lms/subjects');
        setSubjects(data);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete course material.');
    }
  };

  if (loadingSubjects) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#1D7A4A] mx-auto mb-4"></div>
        Loading Course Curriculum Builder...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-gray-100 pb-6">
        <div className="space-y-1">
          <h1 className="font-display text-[32px] font-bold text-[#1A1D23] leading-tight flex items-center gap-3">
            <GraduationCap className="w-8 h-8 text-[#1D7A4A]" strokeWidth={1.75} />
            Course Curriculum Builder
          </h1>
          <p className="text-sm text-gray-500 font-body">Design timelines, share syllabus, attachments, and external links for your students.</p>
        </div>

        {selectedSubject && (
          <button
            onClick={handleOpenCreateModal}
            className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-sm font-semibold transition-all shadow-sm font-display flex items-center gap-1.5 cursor-pointer"
          >
            <Plus className="w-4 h-4" strokeWidth={2.5} />
            Add Lesson Entry
          </button>
        )}
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

      {subjects.length === 0 ? (
        <div className="py-20 text-center bg-white border border-[#E5E7EB] rounded-xl max-w-lg mx-auto p-8 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
          <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-4" strokeWidth={1.5} />
          <h3 className="font-semibold text-gray-800 text-lg font-display">No Subjects Assigned</h3>
          <p className="text-xs text-gray-400 mt-2 leading-relaxed font-body">
            You are currently not registered as a mentor or instructor for any active academic subjects. Ask your School Administrator to map subjects to your account.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6">
          <div className="lg:col-span-1 space-y-3">
            <h3 className="text-xs font-semibold uppercase text-gray-400 tracking-wider px-1 font-display">My assigned subjects</h3>            <div className="space-y-2">
              {subjects.map((sub) => {
                const isSelected = selectedSubject?.id === sub.id;
                return (
                  <button
                    key={sub.id}
                    onClick={() => setSelectedSubject(sub)}
                    className={`w-full text-left p-4 rounded-xl border transition-all flex flex-col justify-between hover:shadow-sm font-body cursor-pointer ${
                      isSelected
                        ? 'bg-[#E5F6EE] border-[#1D7A4A]/20 text-[#1D7A4A]'
                        : 'bg-white border-[#E5E7EB] text-[#1A1D23] hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <h4 className="font-semibold text-sm tracking-tight leading-snug font-display">{sub.name}</h4>
                      <p className={`text-[10px] mt-1 font-bold ${isSelected ? 'text-[#1D7A4A]/70' : 'text-gray-400'}`}>
                        {sub.code || 'NO-CODE'} • Class {sub.class?.name || 'Unassigned'}
                      </p>
                    </div>
                    <div className="mt-4 flex items-center justify-between w-full border-t border-[#1D7A4A]/10 pt-2 text-[10px] font-bold">
                      <span className={isSelected ? 'text-[#1D7A4A]' : 'text-gray-400'}>
                        {sub._count.lmsMaterials} Lesson Plans
                      </span>
                      <ChevronRight className="w-3 h-3 opacity-60" strokeWidth={2.5} />
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="lg:col-span-3 space-y-6">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-[0_1px_3px_rgba(0,0,0,0.02)]">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-gray-100">
                <div>
                  <h3 className="font-semibold text-gray-800 text-lg leading-snug font-display">{selectedSubject?.name} Syllabus</h3>
                  <p className="text-xs text-gray-400 mt-1 font-body">Syllabus timeline & sequential materials</p>
                </div>
                <span className="bg-[#E5F6EE] text-[#1D7A4A] px-3 py-1 border border-[#1D7A4A]/10 rounded-full font-semibold text-xs font-body">
                  {materials.length} Chapters Published
                </span>
              </div>

              {loadingMaterials ? (
                <div className="py-20 text-center text-sm text-gray-400 font-body">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-2"></div>
                  Loading syllabus...
                </div>
              ) : materials.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-gray-200 rounded-xl bg-gray-50/50">
                  <BookOpen className="w-12 h-12 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-750 font-display">Empty Curriculum Outline</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed font-body">
                    No course material has been published for this subject. Click "Add Lesson Entry" to get started!
                  </p>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-y-1 before:left-3.5 before:w-0.5 before:bg-gray-150/80">
                  {materials.map((mat) => (
                    <div key={mat.id} className="relative pl-10 flex flex-col sm:flex-row items-start justify-between gap-4 group font-body">
                      <div className="absolute left-2.5 top-2.5 w-2 h-2 rounded-full bg-[#1D7A4A] ring-4 ring-[#E5F6EE] shrink-0 transform -translate-x-1/2"></div>
 
                      <div className="space-y-2 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] bg-slate-100 text-slate-600 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                            SEQ {mat.sequence}
                          </span>
                          <h4 className="font-semibold text-gray-800 text-base leading-snug font-display">{mat.title}</h4>
                          {mat.isPremium && (
                            <span className="text-[10px] bg-amber-50 text-amber-700 border border-amber-200 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Premium
                            </span>
                          )}
                          {mat.isFreePreview && (
                            <span className="text-[10px] bg-blue-50 text-blue-700 border border-blue-200 font-bold px-2 py-0.5 rounded uppercase tracking-wider">
                              Free Preview
                            </span>
                          )}
                        </div>

                        {mat.description && (
                          <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed">
                            {mat.description}
                          </p>
                        )}

                        {(mat.attachmentUrl || (mat.educationalLinks && mat.educationalLinks.length > 0)) && (
                          <div className="bg-gray-50 border border-gray-100 rounded-xl p-4 mt-3 flex flex-wrap gap-6 text-xs">
                            {mat.attachmentUrl && (
                              <div className="flex flex-col gap-1">
                                <span className="font-semibold text-[10px] text-gray-400 uppercase tracking-wider block">Attachments</span>
                                <a
                                  href={mat.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#1D7A4A] hover:text-[#155B37] font-semibold inline-flex items-center gap-1 transition-colors"
                                >
                                  <Paperclip className="w-3.5 h-3.5" strokeWidth={2} />
                                  Syllabus attachment
                                </a>
                              </div>
                            )}

                            {mat.educationalLinks && mat.educationalLinks.length > 0 && (
                              <div className="flex flex-col gap-1.5">
                                <span className="font-semibold text-[10px] text-gray-400 uppercase tracking-wider block">Reference URL Assets</span>
                                <div className="flex flex-wrap gap-2.5">
                                  {mat.educationalLinks.map((link, lIdx) => (
                                    <a
                                      key={lIdx}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-white border border-[#E5E7EB] px-3 py-1.5 rounded-lg text-gray-700 hover:text-[#1D7A4A] hover:border-[#1D7A4A]/20 hover:bg-[#E5F6EE]/30 font-medium transition-all shadow-sm flex items-center gap-1"
                                    >
                                      <ExternalLink className="w-3 h-3 text-[#1D7A4A]" strokeWidth={2.5} />
                                      {link.title}
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1">
                        <button
                          onClick={() => handleOpenEditModal(mat)}
                          className="px-2.5 py-1.5 bg-slate-50 hover:bg-slate-100 border border-slate-200 hover:border-slate-300 text-slate-600 rounded-lg transition-all shadow-sm text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Edit lesson plan"
                        >
                          <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Edit
                        </button>
                        <button
                          onClick={() => handleDelete(mat.id)}
                          className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 border border-red-200 hover:border-red-300 text-red-700 rounded-lg transition-all shadow-sm text-xs font-semibold flex items-center gap-1 cursor-pointer"
                          title="Delete lesson"
                        >
                          <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                          Delete
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 overflow-y-auto animate-fade-in">
          <div className="bg-white rounded-xl border border-[#E5E7EB] shadow-2xl overflow-hidden max-w-xl w-full my-8 animate-slide-up">
            <div className="bg-gray-50 px-6 py-4 flex items-center justify-between text-gray-800 border-b border-[#E5E7EB]">
              <h3 className="font-semibold text-sm tracking-wider uppercase font-display flex items-center gap-2">
                <BookOpen className="w-4 h-4 text-[#1D7A4A]" strokeWidth={2} />
                {editingMaterial ? 'Modify Curriculum Chapter' : 'Register Curriculum Chapter'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 text-xl leading-none font-semibold outline-none cursor-pointer"
              >
                <X className="w-5 h-5" strokeWidth={2} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-body">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="font-semibold text-gray-500 uppercase tracking-wider font-display">Lesson/Chapter Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chapter 1: Introduction to Mechanics"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-500 uppercase tracking-wider font-display">Order sequence</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-500 uppercase tracking-wider font-display">Syllabus outline / details</label>
                <textarea
                  rows={4}
                  placeholder="Outline key lessons, reading chapters, or exam details..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23] resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-500 uppercase tracking-wider font-display">Syllabus Attachment URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white text-[#1A1D23]"
                />
              </div>

              <div className="border border-amber-100 bg-amber-50/60 rounded-xl p-4 space-y-3">
                <p className="text-[10px] font-bold text-amber-700 uppercase tracking-wider font-display">Premium Video Settings</p>
                <label className="flex items-center gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isPremium}
                    onChange={(e) => { setIsPremium(e.target.checked); if (!e.target.checked) setIsFreePreview(false); }}
                    className="w-4 h-4 accent-amber-600"
                  />
                  <span className="text-xs font-semibold text-gray-700 font-body">Mark as Premium (students must pay to see links)</span>
                </label>
                {isPremium && (
                  <label className="flex items-center gap-3 cursor-pointer ml-6">
                    <input
                      type="checkbox"
                      checked={isFreePreview}
                      onChange={(e) => setIsFreePreview(e.target.checked)}
                      className="w-4 h-4 accent-blue-600"
                    />
                    <span className="text-xs font-semibold text-gray-700 font-body">Also show as Free Preview (visible to non-paying students)</span>
                  </label>
                )}
              </div>

              <div className="border-t border-gray-100 pt-4 space-y-3">
                <label className="font-semibold text-gray-400 uppercase tracking-wider block font-display">Educational Web Resources</label>

                {educationalLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {educationalLinks.map((link, idx) => (
                      <span
                        key={idx}
                        className="bg-[#E5F6EE] border border-[#1D7A4A]/20 text-[#1D7A4A] px-3 py-1 rounded-full font-semibold flex items-center gap-1.5"
                      >
                        {link.title} ({link.url.substring(0, 15)}...)
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="font-bold hover:text-[#155B37] text-xs shrink-0 cursor-pointer"
                        >
                          ×
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-gray-100 p-3 rounded-xl">
                  <div className="space-y-1">
                    <label className="font-bold text-gray-400 uppercase tracking-[0.03em] text-[10px] font-display">Resource Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Khan Academy Video"
                      value={tempLinkLabel}
                      onChange={(e) => setTempLinkLabel(e.target.value)}
                      className="w-full border border-[#E5E7EB] bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] text-xs text-gray-700 font-body"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-bold text-gray-400 uppercase tracking-[0.03em] text-[10px] font-display">Resource Link</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={tempLinkTitle}
                        onChange={(e) => setTempLinkTitle(e.target.value)}
                        className="w-full border border-[#E5E7EB] bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] text-xs text-gray-700 font-body"
                      />
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold hover:shadow-sm transition-colors cursor-pointer"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              </div>

              <div className="flex justify-end gap-3 border-t border-[#E5E7EB] pt-4 mt-6">
                <button
                  type="button"
                  onClick={() => setModalOpen(false)}
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all cursor-pointer font-display"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-xs font-semibold rounded-lg transition-all shadow-sm disabled:opacity-50 cursor-pointer font-display"
                >
                  {submitting ? 'Submitting...' : editingMaterial ? 'Save updates' : 'Register chapter'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
