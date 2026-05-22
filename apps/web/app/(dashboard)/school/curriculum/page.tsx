'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, X, Search, FileText, Link as LinkIcon, BookOpen, AlertCircle } from 'lucide-react';

interface ClassItem {
  id: string;
  name: string;
  _count?: {
    sections: number;
    students: number;
  };
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
  createdAt: string;
}

export default function AdminCurriculumPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [selectedClass, setSelectedClass] = useState<ClassItem | null>(null);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [selectedSubject, setSelectedSubject] = useState<SubjectItem | null>(null);
  const [materials, setMaterials] = useState<LmsMaterial[]>([]);

  // Search & Filters
  const [classSearch, setClassSearch] = useState('');
  const [subjectSearch, setSubjectSearch] = useState('');

  // Loading States
  const [loadingClasses, setLoadingClasses] = useState(true);
  const [loadingSubjects, setLoadingSubjects] = useState(false);
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

  // Link Temp Inputs
  const [tempLinkTitle, setTempLinkTitle] = useState('');
  const [tempLinkLabel, setTempLinkLabel] = useState('');

  const [error, setError] = useState<string | null>(null);

  // Load Classes
  useEffect(() => {
    async function loadClasses() {
      try {
        const { data } = await api.get('/sis/classes');
        setClasses(data);
        if (data.length > 0) {
          setSelectedClass(data[0]);
        }
      } catch (err: any) {
        console.error(err);
        setError('Failed to fetch class lists.');
      } finally {
        setLoadingClasses(false);
      }
    }
    loadClasses();
  }, []);

  // Load Subjects when selected class changes
  const loadSubjects = useCallback(async (classId: string) => {
    setLoadingSubjects(true);
    try {
      const { data } = await api.get('/lms/subjects', { params: { classId } });
      setSubjects(data);
      if (data.length > 0) {
        setSelectedSubject(data[0]);
      } else {
        setSelectedSubject(null);
        setMaterials([]);
      }
    } catch (err) {
      console.error(err);
      setError('Failed to load subjects for the chosen class.');
    } finally {
      setLoadingSubjects(false);
    }
  }, []);

  useEffect(() => {
    if (selectedClass) {
      loadSubjects(selectedClass.id);
    }
  }, [selectedClass, loadSubjects]);

  // Load Materials when selected subject changes
  const loadMaterials = useCallback(async (subjectId: string) => {
    setLoadingMaterials(true);
    try {
      const { data } = await api.get(`/lms/subjects/${subjectId}/materials`);
      setMaterials(data);
    } catch (err) {
      console.error(err);
      setError('Failed to load syllabus timeline.');
    } finally {
      setLoadingMaterials(false);
    }
  }, []);

  useEffect(() => {
    if (selectedSubject) {
      loadMaterials(selectedSubject.id);
    } else {
      setMaterials([]);
    }
  }, [selectedSubject, loadMaterials]);

  const handleOpenCreateModal = () => {
    setEditingMaterial(null);
    setTitle('');
    setDescription('');
    setSequence(String(materials.length * 10)); // Auto-suggest sequence in increments of 10
    setAttachmentUrl('');
    setEducationalLinks([]);
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
      };

      if (editingMaterial) {
        await api.put(`/lms/materials/${editingMaterial.id}`, payload);
      } else {
        await api.post('/lms/materials', payload);
      }

      setModalOpen(false);
      loadMaterials(selectedSubject.id);

      // Refresh subjects list details counts
      if (selectedClass) {
        const { data } = await api.get('/lms/subjects', { params: { classId: selectedClass.id } });
        setSubjects(data);
        const updated = data.find((s: SubjectItem) => s.id === selectedSubject.id);
        if (updated) setSelectedSubject(updated);
      }
    } catch (err: any) {
      console.error(err);
      setError(err.response?.data?.error || 'Failed to register syllabus chapter.');
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
        if (selectedClass) {
          const { data } = await api.get('/lms/subjects', { params: { classId: selectedClass.id } });
          setSubjects(data);
          const updated = data.find((s: SubjectItem) => s.id === selectedSubject.id);
          if (updated) setSelectedSubject(updated);
        }
      }
    } catch (err) {
      console.error(err);
      setError('Failed to delete course material.');
    }
  };

  // Filters
  const filteredClasses = classes.filter((cls) =>
    cls.name.toLowerCase().includes(classSearch.toLowerCase())
  );

  const filteredSubjects = subjects.filter((sub) =>
    sub.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
    (sub.code && sub.code.toLowerCase().includes(subjectSearch.toLowerCase()))
  );

  if (loadingClasses) {
    return (
      <div className="py-40 text-center text-sm text-gray-400 font-body">
        <p className="animate-pulse">Loading curriculum governance...</p>
      </div>
    );
  }

  return (
    <div className="max-w-7xl space-y-6">
      {/* Header Banner */}
      <div className="bg-white border border-[#E5E7EB] rounded-2xl p-6 md:p-8 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div>
          <span className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-[10px] font-bold uppercase tracking-widest px-3 py-1 rounded-full font-body">
            Curriculum Governance
          </span>
          <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight mt-3">Syllabus & Course Manager</h1>
          <p className="text-sm text-gray-500 mt-1 max-w-2xl font-body">
            Audit, register, and organize syllabus structures, learning guides, reference materials, and external video resources across all academic classes.
          </p>
        </div>

        {selectedSubject && (
          <button
            onClick={handleOpenCreateModal}
            className="inline-flex items-center justify-center gap-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white h-[38px] px-4 rounded-lg font-semibold transition-colors duration-155 text-[13px] tracking-wide self-start md:self-center shrink-0"
          >
            <Plus className="w-4.5 h-4.5" strokeWidth={2.25} />
            <span>Add Lesson Entry</span>
          </button>
        )}
      </div>

      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{error}</span>
          <button onClick={() => setError(null)} className="p-1 hover:bg-[#854F0B]/10 rounded"><X className="w-4 h-4" /></button>
        </div>
      )}

      {classes.length === 0 ? (
        <div className="py-24 text-center border border-[#E5E7EB] bg-white rounded-2xl p-6 shadow-sm flex flex-col items-center">
          <BookOpen className="w-16 h-16 text-gray-300 mb-4" strokeWidth={1.5} />
          <h3 className="font-semibold text-slate-800 text-lg font-display">No Classes Found</h3>
          <p className="text-xs text-gray-400 mt-2 max-w-sm mx-auto leading-relaxed font-body">
            Please register classes in the School Information System (SIS) before creating a syllabus.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          {/* Column 1: Classes Selector */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider font-body">
                  Academic Classes
                </h3>
                <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200">
                  {classes.length} Total
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter classes..."
                  value={classSearch}
                  onChange={(e) => setClassSearch(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] text-gray-700 bg-white transition-all font-body"
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" strokeWidth={1.75} />
              </div>

              <div className="space-y-1 max-h-[350px] overflow-y-auto pr-1">
                {filteredClasses.length === 0 ? (
                  <p className="text-xs text-gray-400 text-center py-4 font-body">No matching classes.</p>
                ) : (
                  filteredClasses.map((cls) => {
                    const isSelected = selectedClass?.id === cls.id;
                    return (
                      <button
                        key={cls.id}
                        onClick={() => {
                          setSelectedClass(cls);
                          setSelectedSubject(null);
                        }}
                        className={`w-full text-left px-3.5 py-2.5 rounded-lg border transition-all text-xs flex items-center justify-between font-body ${
                          isSelected
                            ? 'bg-[#EEF2FF] border-[#4338CA]/20 text-[#4338CA] font-bold'
                            : 'bg-white border-transparent text-gray-700 hover:bg-gray-50'
                        }`}
                      >
                        <span className="truncate pr-2">{cls.name}</span>
                        {cls._count && (
                          <span className={`text-[9px] font-semibold px-1.5 py-0.5 rounded-md ${
                            isSelected ? 'bg-[#4338CA]/10 text-[#4338CA]' : 'bg-gray-100 text-gray-400 border border-gray-200'
                          }`}>
                            {cls._count.students} Students
                          </span>
                        )}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>

          {/* Column 2: Subjects List */}
          <div className="lg:col-span-3 space-y-4">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-4.5 shadow-sm space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-xs font-bold uppercase text-gray-400 tracking-wider font-body">
                  Subjects ({selectedClass?.name || 'Class'})
                </h3>
                <span className="bg-gray-100 text-gray-600 text-[10px] font-bold px-2 py-0.5 rounded border border-gray-200">
                  {subjects.length} Total
                </span>
              </div>

              <div className="relative">
                <input
                  type="text"
                  placeholder="Filter subjects..."
                  value={subjectSearch}
                  onChange={(e) => setSubjectSearch(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg pl-8 pr-3 py-1.5 text-xs focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] text-gray-700 bg-white transition-all font-body"
                  disabled={!selectedClass}
                />
                <Search className="w-3.5 h-3.5 text-gray-400 absolute left-2.5 top-2.5" strokeWidth={1.75} />
              </div>

              {loadingSubjects ? (
                <div className="py-12 text-center text-xs text-gray-400 font-body">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-[#1D7A4A] mx-auto mb-2"></div>
                  Loading subjects...
                </div>
              ) : !selectedClass ? (
                <p className="text-xs text-gray-400 text-center py-6 font-body">Select a class first.</p>
              ) : subjects.length === 0 ? (
                <div className="py-8 text-center text-xs text-gray-400 font-body flex flex-col items-center">
                  <AlertCircle className="w-8 h-8 text-gray-300 mb-2" strokeWidth={1.5} />
                  <p className="font-semibold text-gray-500">No subjects mapped</p>
                  <p className="text-[10px] mt-1 max-w-[180px] mx-auto">Map subjects to this class inside SIS to build curriculum.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-[350px] overflow-y-auto pr-1">
                  {filteredSubjects.length === 0 ? (
                    <p className="text-xs text-gray-400 text-center py-4 font-body">No matching subjects.</p>
                  ) : (
                    filteredSubjects.map((sub) => {
                      const isSelected = selectedSubject?.id === sub.id;

                      return (
                        <button
                          key={sub.id}
                          onClick={() => setSelectedSubject(sub)}
                          className={`w-full text-left rounded-xl border p-3.5 transition-all text-xs flex flex-col justify-between shadow-sm ${
                            isSelected
                              ? `bg-[#1D7A4A] border-transparent text-white ring-2 ring-[#1D7A4A]/20`
                              : 'bg-white border-[#E5E7EB] hover:border-gray-300 text-slate-800'
                          }`}
                        >
                          <div>
                            <h4 className="font-bold text-sm tracking-tight leading-snug font-display">{sub.name}</h4>
                            <p className={`text-[10px] mt-0.5 font-semibold ${isSelected ? 'text-green-100' : 'text-gray-400 font-mono'}`}>
                              {sub.code || 'NO CODE'}
                            </p>
                          </div>

                          <div className={`mt-4 pt-2.5 border-t text-[10px] font-bold flex items-center justify-between font-body ${
                            isSelected ? 'border-white/10 text-white/90' : 'border-gray-100 text-gray-500'
                          }`}>
                            <span className="truncate max-w-[100px]">
                              {sub.teacher ? `${sub.teacher.firstName} ${sub.teacher.lastName.substring(0, 1)}.` : 'No Instructor'}
                            </span>
                            <span className={`px-2 py-0.5 rounded-full text-[9px] font-bold ${
                              isSelected ? 'bg-white/20' : 'bg-gray-100 border border-gray-200 text-gray-600'
                            }`}>
                              {sub._count.lmsMaterials} Chapters
                            </span>
                          </div>
                        </button>
                      );
                    })
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Column 3: Syllabus Timeline Inspector */}
          <div className="lg:col-span-6 space-y-6">
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-6 shadow-sm">
              <div className="flex items-center justify-between mb-6 pb-4 border-b border-[#E5E7EB]">
                <div>
                  <h3 className="font-bold text-slate-900 text-lg leading-snug font-display">
                    {selectedSubject ? `${selectedSubject.name} Curriculum` : 'Syllabus Timeline'}
                  </h3>
                  <p className="text-xs text-gray-500 mt-0.5 font-body">
                    {selectedSubject
                      ? `Assigned Instructor: ${selectedSubject.teacher ? `${selectedSubject.teacher.firstName} ${selectedSubject.teacher.lastName}` : 'Unassigned'}`
                      : 'Select a class and subject to inspect syllabus'}
                  </p>
                </div>
                {selectedSubject && (
                  <span className="bg-[#EEF2FF] border border-[#4338CA]/20 text-[#4338CA] px-3 py-1 rounded-full font-semibold text-xs font-body">
                    {materials.length} Chapters Active
                  </span>
                )}
              </div>

              {loadingMaterials ? (
                <div className="py-24 text-center text-sm text-gray-400 font-body">
                  <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-[#1D7A4A] mx-auto mb-2"></div>
                  Loading syllabus timeline...
                </div>
              ) : !selectedSubject ? (
                <div className="py-20 text-center border border-dashed border-[#E5E7EB] bg-gray-50/30 rounded-xl flex flex-col items-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-700 font-display">Audit Desk</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed font-body">
                    Select an active subject from the left directories to inspect scheduled syllabus items, references, and download materials.
                  </p>
                </div>
              ) : materials.length === 0 ? (
                <div className="py-16 text-center border border-dashed border-[#E5E7EB] bg-gray-50/30 rounded-xl flex flex-col items-center">
                  <BookOpen className="w-12 h-12 text-gray-300 mb-3" strokeWidth={1.5} />
                  <p className="text-sm font-semibold text-gray-700 font-display">Curriculum Blank</p>
                  <p className="text-xs text-gray-400 max-w-xs mx-auto mt-1 leading-relaxed font-body">
                    No course material outlines or study assets have been published by the instructor for this subject.
                  </p>
                  <button
                    onClick={handleOpenCreateModal}
                    className="mt-4 inline-flex items-center gap-1.5 px-4 py-2 bg-white border border-[#E5E7EB] text-gray-700 hover:bg-gray-50 text-xs font-bold rounded-lg transition-all shadow-xs"
                  >
                    <Plus className="w-3.5 h-3.5 text-[#1D7A4A]" strokeWidth={2} />
                    <span>Register Lesson Chapter</span>
                  </button>
                </div>
              ) : (
                <div className="space-y-6 relative before:absolute before:inset-y-1 before:left-3.5 before:w-0.5 before:bg-[#E5E7EB]">
                  {materials.map((mat) => (
                    <div key={mat.id} className="relative pl-10 flex flex-col sm:flex-row items-start justify-between gap-4 group">
                      {/* Timeline Dot */}
                      <div className="absolute left-2.5 top-1.5 w-2.5 h-2.5 rounded-full bg-[#1D7A4A] ring-4 ring-[#D6F0E4] shrink-0 transform -translate-x-1/2"></div>

                      <div className="space-y-2 flex-1 w-full">
                        <div className="flex items-center gap-2 flex-wrap">
                          <span className="text-[10px] bg-gray-100 text-gray-600 border border-gray-200 font-extrabold px-2 py-0.5 rounded-md uppercase tracking-wider font-mono">
                            SEQ {mat.sequence}
                          </span>
                          <h4 className="font-semibold text-slate-800 text-base leading-snug font-display">{mat.title}</h4>
                        </div>

                        {mat.description && (
                          <p className="text-xs text-gray-500 whitespace-pre-wrap leading-relaxed font-body">
                            {mat.description}
                          </p>
                        )}

                        {(mat.attachmentUrl || (mat.educationalLinks && mat.educationalLinks.length > 0)) && (
                          <div className="bg-gray-50 border border-[#E5E7EB] rounded-xl p-4 mt-3 flex flex-wrap gap-4 text-xs w-full">
                            {mat.attachmentUrl && (
                              <div className="flex flex-col gap-1">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider font-body">Attachments</span>
                                <a
                                  href={mat.attachmentUrl}
                                  target="_blank"
                                  rel="noopener noreferrer"
                                  className="text-[#1D7A4A] hover:text-[#155D37] hover:underline font-semibold inline-flex items-center gap-1.5 font-body"
                                >
                                  <FileText className="w-3.5 h-3.5" strokeWidth={1.75} />
                                  <span>View Syllabus Attachment</span>
                                </a>
                              </div>
                            )}

                            {mat.educationalLinks && mat.educationalLinks.length > 0 && (
                              <div className="flex flex-col gap-1.5 w-full sm:w-auto">
                                <span className="font-bold text-[10px] text-gray-400 uppercase tracking-wider block font-body">Educational reference assets</span>
                                <div className="flex flex-wrap gap-2">
                                  {mat.educationalLinks.map((link, lIdx) => (
                                    <a
                                      key={lIdx}
                                      href={link.url}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="bg-white border border-[#E5E7EB] px-3 py-1 rounded-lg text-gray-700 hover:text-[#1D7A4A] hover:border-[#1D7A4A] hover:bg-[#D6F0E4]/10 font-semibold transition-all shadow-xs flex items-center gap-1 font-body text-[11px]"
                                    >
                                      <LinkIcon className="w-3 h-3 text-gray-400" />
                                      <span>{link.title}</span>
                                    </a>
                                  ))}
                                </div>
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {/* Hover Admin Controls */}
                      <div className="flex items-center gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity self-start mt-1">
                        <button
                          onClick={() => handleOpenEditModal(mat)}
                          className="p-1.5 hover:bg-gray-150 border border-[#E5E7EB] text-gray-600 rounded-lg transition-all text-xs font-semibold flex items-center gap-1"
                          title="Edit syllabus chapter"
                        >
                          <Pencil className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                          <span>Edit</span>
                        </button>
                        <button
                          onClick={() => handleDelete(mat.id)}
                          className="p-1.5 hover:bg-gray-150 border border-[#E5E7EB] text-red-650 rounded-lg transition-all text-xs font-semibold flex items-center gap-1"
                          title="Delete syllabus entry"
                        >
                          <Trash2 className="w-3.5 h-3.5 text-gray-400" strokeWidth={1.75} />
                          <span>Delete</span>
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

      {/* Register/Edit Syllabus Chapter Modal */}
      {modalOpen && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white rounded-2xl border border-[#E5E7EB] shadow-2xl overflow-hidden max-w-xl w-full my-8">
            <div className="bg-white px-6 py-4 flex items-center justify-between border-b border-[#E5E7EB]">
              <h3 className="font-semibold text-gray-800 text-base font-display">
                {editingMaterial ? 'Modify Curriculum Chapter' : 'Register Syllabus Entry'}
              </h3>
              <button
                onClick={() => setModalOpen(false)}
                className="text-gray-400 hover:text-gray-600 p-1 rounded-lg hover:bg-gray-100 transition-all outline-none"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-4 text-xs font-body">
              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2 space-y-1.5">
                  <label className="font-semibold text-gray-500 uppercase tracking-wide">Lesson/Chapter Title</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Chapter 1: Foundations of Algebra"
                    value={title}
                    onChange={(e) => setTitle(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all text-gray-700"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="font-semibold text-gray-500 uppercase tracking-wide">Sequence Order</label>
                  <input
                    type="number"
                    required
                    placeholder="0"
                    value={sequence}
                    onChange={(e) => setSequence(e.target.value)}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all text-gray-700"
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-500 uppercase tracking-wide">Chapter Description & Details</label>
                <textarea
                  rows={4}
                  placeholder="Summarize course scope, key milestones, assessment rules, or text references..."
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all text-gray-700 resize-none"
                />
              </div>

              <div className="space-y-1.5">
                <label className="font-semibold text-gray-500 uppercase tracking-wide">PDF syllabus attachment URL</label>
                <input
                  type="url"
                  placeholder="https://drive.google.com/file/d/..."
                  value={attachmentUrl}
                  onChange={(e) => setAttachmentUrl(e.target.value)}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all text-gray-700"
                />
              </div>

              <div className="border-t border-[#E5E7EB] pt-4 space-y-3">
                <label className="font-bold text-gray-400 uppercase tracking-wider block">Educational web resources</label>

                {educationalLinks.length > 0 && (
                  <div className="flex flex-wrap gap-2 mb-2">
                    {educationalLinks.map((link, idx) => (
                      <span
                        key={idx}
                        className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] px-3 py-1 rounded-full font-semibold flex items-center gap-1.5"
                      >
                        <span>{link.title}</span>
                        <button
                          type="button"
                          onClick={() => handleRemoveLink(idx)}
                          className="font-bold hover:text-red-650 text-xs shrink-0"
                        >
                          <X className="w-3 h-3" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3 bg-gray-50 border border-[#E5E7EB] p-3 rounded-xl">
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-500 uppercase tracking-[0.03em] text-[10px]">Resource Label</label>
                    <input
                      type="text"
                      placeholder="e.g. Khan Academy Video"
                      value={tempLinkLabel}
                      onChange={(e) => setTempLinkLabel(e.target.value)}
                      className="w-full border border-[#E5E7EB] bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] text-xs text-gray-700"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="font-semibold text-gray-500 uppercase tracking-[0.03em] text-[10px]">Resource Link</label>
                    <div className="flex gap-2">
                      <input
                        type="url"
                        placeholder="https://..."
                        value={tempLinkTitle}
                        onChange={(e) => setTempLinkTitle(e.target.value)}
                        className="w-full border border-[#E5E7EB] bg-white rounded-lg px-3 py-1.5 focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] text-xs text-gray-700"
                      />
                      <button
                        type="button"
                        onClick={handleAddLink}
                        className="px-3 bg-gray-800 hover:bg-gray-900 text-white rounded-lg font-bold hover:shadow-xs text-sm transition-all"
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
                  className="px-4 py-2 border border-[#E5E7EB] hover:bg-gray-50 text-xs font-semibold text-gray-700 rounded-lg transition-all"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submitting}
                  className="px-5 py-2.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white text-xs font-semibold rounded-lg transition-all shadow-xs disabled:opacity-50"
                >
                  {submitting ? 'Submitting...' : editingMaterial ? 'Save Updates' : 'Register Entry'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
