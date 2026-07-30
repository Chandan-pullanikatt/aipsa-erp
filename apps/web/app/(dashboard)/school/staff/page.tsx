'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { 
  Plus, 
  Pencil, 
  Trash2, 
  X, 
  Copy, 
  Lock, 
  Unlock, 
  Mail, 
  User, 
  BookOpen, 
  Search
} from 'lucide-react';
import TeachingGrid from '@/components/TeachingGrid';

interface StaffUser {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: 'SCHOOL_ADMIN' | 'TEACHER' | 'STUDENT' | 'PARENT';
  isActive: boolean;
  createdAt: string;
}

interface ClassItem {
  id: string;
  name: string;
}

interface SubjectAssignment {
  id: string;
  teacherId: string;
  isPrimary: boolean;
  section: { id: string; name: string } | null;
}

interface SubjectItem {
  id: string;
  name: string;
  code: string | null;
  classId: string;
  class: { id: string; name: string } | null;
  // The primary teacher. `teachers` holds everyone, including section-scoped rows.
  teacherId: string | null;
  teacher: { id: string; firstName: string; lastName: string } | null;
  teachers?: SubjectAssignment[];
  periodsPerWeek?: number;
}

export default function StaffPage() {
  // Navigation & Tabs
  const [activeTab, setActiveTab] = useState<'staff' | 'subjects'>('staff');

  // Directory Lists
  const [staff, setStaff] = useState<StaffUser[]>([]);
  const [subjects, setSubjects] = useState<SubjectItem[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [joinCode, setJoinCode] = useState('');

  // Search & Filters
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<string>('ALL');
  const [subjectSearch, setSubjectSearch] = useState('');
  const [subjectClassFilter, setSubjectClassFilter] = useState<string>('ALL');

  // Loading States
  const [loading, setLoading] = useState(true);
  const [actionLoadingId, setActionLoadingId] = useState<string | null>(null);

  // Invite Form States
  const [inviteForm, setInviteForm] = useState({ firstName: '', lastName: '', email: '', role: 'TEACHER' });
  const [inviting, setInviting] = useState(false);
  const [showInviteForm, setShowInviteForm] = useState(false);

  // Subject Form States
  const [showSubjectForm, setShowSubjectForm] = useState(false);
  const [editingSubject, setEditingSubject] = useState<SubjectItem | null>(null);
  const [subjectForm, setSubjectForm] = useState({ name: '', code: '', classId: '', teacherId: '', periodsPerWeek: '' });
  const [submittingSubject, setSubmittingSubject] = useState(false);

  // Teacher Subject Mapping Drawer / Modal
  const [selectedTeacher, setSelectedTeacher] = useState<StaffUser | null>(null);
  const [teacherSubjects, setTeacherSubjects] = useState<SubjectItem[]>([]);
  const [showTeachingGrid, setShowTeachingGrid] = useState(false);

  // Notification overlays
  const [success, setSuccess] = useState('');
  const [error, setError] = useState('');
  const [codeCopied, setCodeCopied] = useState(false);
  const [regenerating, setRegenerating] = useState(false);

  // Current logged in admin (to prevent self-lockout)
  const [currentUser, setCurrentUser] = useState<any>(null);

  // Fetch Directory Records
  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await api.get('/schools/users', { params: { limit: 100 } });
      // Filter only staff roles (SCHOOL_ADMIN and TEACHER)
      const staffList = data.users.filter(
        (u: StaffUser) => u.role === 'SCHOOL_ADMIN' || u.role === 'TEACHER'
      );
      setStaff(staffList);
    } catch {
      setError('Failed to fetch staff directory.');
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const { data } = await api.get('/exams/subjects');
      setSubjects(data);
    } catch {
      setError('Failed to fetch academic subjects.');
    }
  }, []);

  const fetchClasses = useCallback(async () => {
    try {
      const { data } = await api.get('/sis/classes');
      setClasses(data);
    } catch {
      setError('Failed to fetch class registry.');
    }
  }, []);

  const fetchJoinCode = useCallback(async () => {
    try {
      const { data } = await api.get('/schools/join-code');
      setJoinCode(data.joinCode);
    } catch {
      setError('Failed to fetch join code.');
    }
  }, []);

  // Initialize
  useEffect(() => {
    setLoading(true);
    // Find current user from localStorage
    if (typeof window !== 'undefined') {
      const stored = localStorage.getItem('school_erp_user');
      if (stored) {
        try {
          setCurrentUser(JSON.parse(stored));
        } catch { /* ignore */ }
      }
    }

    Promise.all([fetchStaff(), fetchSubjects(), fetchClasses(), fetchJoinCode()]).finally(() =>
      setLoading(false)
    );
  }, [fetchStaff, fetchSubjects, fetchClasses, fetchJoinCode]);

  // Load teacher assigned subjects for drawer. Counts subjects they own outright
  // and ones they co-teach or take for a single section.
  useEffect(() => {
    if (selectedTeacher) {
      const assigned = subjects.filter((sub) =>
        sub.teacherId === selectedTeacher.id ||
        (sub.teachers || []).some((a) => a.teacherId === selectedTeacher.id)
      );
      setTeacherSubjects(assigned);
    } else {
      setTeacherSubjects([]);
    }
  }, [selectedTeacher, subjects]);

  // Invite Staff Trigger
  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess('');
    setInviting(true);
    try {
      await api.post('/auth/invite', inviteForm);
      setSuccess(`Magic link invite successfully dispatched to ${inviteForm.email}`);
      setInviteForm({ firstName: '', lastName: '', email: '', role: 'TEACHER' });
      setShowInviteForm(false);
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to dispatch invitation.');
    } finally {
      setInviting(false);
    }
  }

  // Regenerate Join Code
  async function handleRegenerateJoinCode() {
    if (!confirm('Regenerate the school join code? Pre-existing code assets will expire immediately.')) return;
    setRegenerating(true);
    setError('');
    try {
      const { data } = await api.post('/schools/join-code/regenerate');
      setJoinCode(data.joinCode);
      setSuccess('Join code successfully regenerated.');
    } catch {
      setError('Failed to regenerate join code.');
    } finally {
      setRegenerating(false);
    }
  }

  function copyCode() {
    navigator.clipboard.writeText(joinCode);
    setCodeCopied(true);
    setTimeout(() => setCodeCopied(false), 2000);
  }

  // PATCH Staff Attributes (Role, status)
  async function handleUpdateStaffStatus(userId: string, newStatus: boolean) {
    if (currentUser && userId === currentUser.id) {
      setError('Operation aborted: You cannot deactivate your own administrative account.');
      return;
    }

    setActionLoadingId(userId);
    setError('');
    try {
      await api.patch(`/schools/users/${userId}`, { isActive: newStatus });
      setStaff((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, isActive: newStatus } : u))
      );
      setSuccess('Staff status updated successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update staff operational status.');
    } finally {
      setActionLoadingId(null);
    }
  }

  async function handleUpdateStaffRole(userId: string, newRole: 'SCHOOL_ADMIN' | 'TEACHER') {
    if (currentUser && userId === currentUser.id) {
      setError('Operation aborted: You cannot modify your own administrative role.');
      return;
    }

    setActionLoadingId(userId + '-role');
    setError('');
    try {
      await api.patch(`/schools/users/${userId}`, { role: newRole });
      setStaff((prev) =>
        prev.map((u) => (u.id === userId ? { ...u, role: newRole } : u))
      );
      setSuccess('Staff administrative role modified.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to change staff credentials role.');
    } finally {
      setActionLoadingId(null);
    }
  }

  // Subject Registry CRUD
  async function handleSubjectSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!subjectForm.classId || !subjectForm.name) return;

    setSubmittingSubject(true);
    setError('');
    try {
      const payload = {
        classId: subjectForm.classId,
        name: subjectForm.name.trim(),
        code: subjectForm.code ? subjectForm.code.trim() : null,
        teacherId: subjectForm.teacherId || null,
        periodsPerWeek: subjectForm.periodsPerWeek === '' ? 0 : parseInt(subjectForm.periodsPerWeek) || 0,
      };

      if (editingSubject) {
        const { data } = await api.put(`/exams/subjects/${editingSubject.id}`, payload);
        setSubjects((prev) => prev.map((s) => (s.id === editingSubject.id ? data : s)));
        setSuccess('Academic subject information updated.');
      } else {
        const { data } = await api.post('/exams/subjects', payload);
        setSubjects((prev) => [...prev, data]);
        setSuccess('New academic subject registered.');
      }

      setSubjectForm({ name: '', code: '', classId: '', teacherId: '', periodsPerWeek: '' });
      setEditingSubject(null);
      setShowSubjectForm(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to register subject record.');
    } finally {
      setSubmittingSubject(false);
    }
  }

  async function handleSubjectDelete(subjectId: string) {
    if (!confirm('Are you sure you want to delete this subject? Pre-existing marks sheet data will be orphaned.')) return;
    setError('');
    try {
      await api.delete(`/exams/subjects/${subjectId}`);
      setSubjects((prev) => prev.filter((s) => s.id !== subjectId));
      setSuccess('Subject removed successfully.');
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete academic subject.');
    }
  }


  // Direct Teacher Inline Mapping
  async function handleDirectMapSubject(subjectId: string, teacherId: string | null) {
    setError('');
    try {
      const { data } = await api.put(`/exams/subjects/${subjectId}`, { teacherId });
      setSubjects((prev) => prev.map((s) => (s.id === subjectId ? data : s)));
      setSuccess('Subject instructor mapping refreshed.');
    } catch {
      setError('Failed to update subject mapping.');
    }
  }

  // Filters logic
  const filteredStaff = staff.filter((u) => {
    const matchesSearch =
      `${u.firstName} ${u.lastName}`.toLowerCase().includes(staffSearch.toLowerCase()) ||
      u.email.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesRole = staffRoleFilter === 'ALL' || u.role === staffRoleFilter;
    return matchesSearch && matchesRole;
  });

  const filteredSubjects = subjects.filter((s) => {
    const matchesSearch =
      s.name.toLowerCase().includes(subjectSearch.toLowerCase()) ||
      (s.code && s.code.toLowerCase().includes(subjectSearch.toLowerCase()));
    const matchesClass = subjectClassFilter === 'ALL' || s.classId === subjectClassFilter;
    return matchesSearch && matchesClass;
  });

  const onboardingTeachers = staff.filter((u) => u.role === 'TEACHER');

  if (loading) {
    return (
      <div className="py-40 text-center text-sm text-[#6B7280]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#26A96B] mx-auto mb-4"></div>
        Loading Staff & Admin Upgrades...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Upper Banner */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#E5E7EB] mb-6">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Staff Governance & Syllabus Mapping</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1 max-w-2xl">
            Promote user roles, toggle account statuses, map syllabus subjects to teachers, and manage the core school registers.
          </p>
        </div>

        <div className="flex gap-2 shrink-0 self-start sm:self-center">
          <button
            onClick={() => {
              setInviteForm({ firstName: '', lastName: '', email: '', role: 'TEACHER' });
              setShowInviteForm(true);
            }}
            className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
          >
            <Mail className="mr-2 w-4 h-4" strokeWidth={1.75} />
            Invite Staff
          </button>

          <button
            onClick={() => {
              setEditingSubject(null);
              setSubjectForm({ name: '', code: '', classId: classes[0]?.id || '', teacherId: '', periodsPerWeek: '' });
              setShowSubjectForm(true);
            }}
            className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
          >
            <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} />
            Create Subject
          </button>
        </div>
      </div>

      {error && (
        <div className="bg-[#FCEBEB] text-[#A32D2D] text-[14px] px-4 py-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between">
          <span>{error}</span>
          <button onClick={() => setError('')} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}
      {success && (
        <div className="bg-[#D6F0E4] text-[#0F6E56] text-[14px] px-4 py-3 rounded-lg border border-[#E5E7EB] flex items-center justify-between">
          <span>{success}</span>
          <button onClick={() => setSuccess('')} className="font-bold hover:underline">Dismiss</button>
        </div>
      )}

      {/* Grid: Join Code Banner & Invite Modal */}
      <div className="grid grid-cols-1 md:grid-cols-12 gap-6">
        <div className="md:col-span-7 bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
          <h3 className="font-display text-[16px] font-semibold text-[#1A1D23]">
            Access Keys Setup
          </h3>
          <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
            Distribute this join code to parents and new instructors. New candidates can enter this key during onboarding at{' '}
            <span className="font-mono text-indigo-600 font-bold bg-[#EEF2FF] px-1.5 py-0.5 rounded">/join</span>. Note that Parents will also require their ward's unique Student Portal PIN.
          </p>

          <div className="flex flex-wrap items-center gap-3 bg-[#F7F8FA] p-4 border border-[#E5E7EB] rounded-lg">
            <span className="font-mono text-3xl font-bold text-[#1A1D23] tracking-widest">
              {joinCode || '...'}
            </span>
            <button
              onClick={copyCode}
              className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
            >
              <Copy className="mr-2 w-4 h-4" strokeWidth={1.75} />
              {codeCopied ? 'Copied' : 'Copy Code'}
            </button>
            <button
              onClick={handleRegenerateJoinCode}
              disabled={regenerating}
              className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#DC2626] hover:bg-[#FCEBEB] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-50"
            >
              <Lock className="mr-2 w-4 h-4" strokeWidth={1.75} />
              {regenerating ? 'Regenerating...' : 'Rotate Key'}
            </button>
          </div>
        </div>

        {/* Invite Form overlay */}
        {showInviteForm && (
          <div className="md:col-span-5 bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-4">
            <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-3">
              <h4 className="font-display text-[16px] font-semibold text-[#1A1D23]">
                Magic Link Invitations
              </h4>
              <button onClick={() => setShowInviteForm(false)} className="text-gray-400 hover:text-gray-600">
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleInvite} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">First Name</label>
                  <input
                    required
                    value={inviteForm.firstName}
                    onChange={(e) => setInviteForm({ ...inviteForm, firstName: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Last Name</label>
                  <input
                    required
                    value={inviteForm.lastName}
                    onChange={(e) => setInviteForm({ ...inviteForm, lastName: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Email Address</label>
                <input
                  type="email"
                  required
                  value={inviteForm.email}
                  onChange={(e) => setInviteForm({ ...inviteForm, email: e.target.value })}
                  className="w-full"
                />
              </div>

              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Inviting Role</label>
                <div className="flex gap-2">
                  {(['TEACHER', 'PARENT'] as const).map((r) => (
                    <button
                      key={r}
                      type="button"
                      onClick={() => setInviteForm({ ...inviteForm, role: r })}
                      className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] ${
                        inviteForm.role === r
                          ? 'bg-[#1D7A4A] text-white'
                          : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                      }`}
                    >
                      {r.toLowerCase()}
                    </button>
                  ))}
                </div>
              </div>

              <div className="flex gap-3 pt-2">
                <button
                  type="submit"
                  disabled={inviting}
                  className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-60"
                >
                  {inviting ? 'Sending...' : 'Send Magic Invite'}
                </button>
                <button
                  type="button"
                  onClick={() => setShowInviteForm(false)}
                  className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
                >
                  Cancel
                </button>
              </div>
            </form>
          </div>
        )}
      </div>

      {/* Main workspace navigation tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB]">
        <button
          onClick={() => setActiveTab('staff')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            activeTab === 'staff'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <User className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Staff Directory ({staff.length})
        </button>

        <button
          onClick={() => setActiveTab('subjects')}
          className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all ${
            activeTab === 'subjects'
              ? 'border-[#26A96B] text-[#1D7A4A]'
              : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
          }`}
        >
          <BookOpen className="mr-2 w-4 h-4" strokeWidth={1.75} />
          Academic Subjects Mapping ({subjects.length})
        </button>
      </div>

      {/* TAB 1: STAFF DIRECTORY WORKSPACE */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          {/* Filters Area */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border border-[#E5E7EB] rounded-xl">
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search staff by name or email..."
                value={staffSearch}
                onChange={(e) => setStaffSearch(e.target.value)}
                className="w-full pl-9"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-[12px]" strokeWidth={1.75} />
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setStaffRoleFilter('ALL')}
                className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] ${
                  staffRoleFilter === 'ALL'
                    ? 'bg-[#1D7A4A] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                }`}
              >
                All Roles
              </button>
              <button
                onClick={() => setStaffRoleFilter('TEACHER')}
                className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] ${
                  staffRoleFilter === 'TEACHER'
                    ? 'bg-[#1D7A4A] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                }`}
              >
                Instructors
              </button>
              <button
                onClick={() => setStaffRoleFilter('SCHOOL_ADMIN')}
                className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] ${
                  staffRoleFilter === 'SCHOOL_ADMIN'
                    ? 'bg-[#1D7A4A] text-white'
                    : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'
                }`}
              >
                Admins
              </button>
            </div>
          </div>

          {/* Directory Grid */}
          {filteredStaff.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
              <Search className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
              <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No Staff Matches</h3>
              <p className="font-body text-[14px] text-[#6B7280] mt-1">Try adapting your search filters or invite new staff members.</p>
              <button
                onClick={() => {
                  setInviteForm({ firstName: '', lastName: '', email: '', role: 'TEACHER' });
                  setShowInviteForm(true);
                }}
                className="mt-4 inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
              >
                <Mail className="mr-2 w-4 h-4" strokeWidth={1.75} />
                Invite Staff
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((u) => {
                const isCurrentUser = currentUser && u.id === currentUser.id;
                const initials = u.firstName[0] + u.lastName[0];

                return (
                  <div
                    key={u.id}
                    className="bg-white border border-[#E5E7EB] rounded-xl p-5 relative overflow-hidden group space-y-4"
                  >
                    {/* Circle initials avatar */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D6F0E4] border border-[#26A96B] flex items-center justify-center font-bold text-xs text-[#0F6E56] select-none uppercase shrink-0">
                        {initials}
                      </div>

                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-[14px] font-semibold text-[#1A1D23] truncate">
                          {u.firstName} {u.lastName}
                        </h4>
                        <p className="font-body text-[12px] text-[#6B7280] truncate">{u.email}</p>
                      </div>

                      {isCurrentUser && (
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA]">
                          Me
                        </span>
                      )}
                    </div>

                    {/* Operational Details Grid */}
                    <div className="grid grid-cols-2 gap-2 text-[12px] border-t border-[#E5E7EB] pt-3">
                      <div>
                        <span className="text-[#6B7280] block font-body text-[12px] font-medium uppercase tracking-wide">Access Role</span>
                        <div className="mt-1 flex items-center">
                          <select
                            value={u.role}
                            onChange={(e) => handleUpdateStaffRole(u.id, e.target.value as any)}
                            disabled={isCurrentUser || actionLoadingId === u.id + '-role'}
                            className="w-full"
                          >
                            <option value="TEACHER">Instructor</option>
                            <option value="SCHOOL_ADMIN">Admin</option>
                          </select>
                        </div>
                      </div>

                      <div>
                        <span className="text-[#6B7280] block font-body text-[12px] font-medium uppercase tracking-wide">Status</span>
                        <div className="mt-1 flex items-center gap-2">
                          <span
                            className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded ${
                              u.isActive
                                ? 'bg-[#D6F0E4] text-[#0F6E56]'
                                : 'bg-[#FAEEDA] text-[#854F0B]'
                            }`}
                          >
                            {u.isActive ? 'Active' : 'Inactive'}
                          </span>

                          <button
                            onClick={() => handleUpdateStaffStatus(u.id, !u.isActive)}
                            disabled={isCurrentUser || actionLoadingId === u.id}
                            className="inline-flex items-center justify-center w-8 h-8 rounded-md border border-[#E5E7EB] bg-white text-[#1A1D23] hover:bg-[#F7F8FA] disabled:opacity-50 shrink-0"
                            title={u.isActive ? 'Suspend account' : 'Reactivate account'}
                          >
                            {u.isActive ? (
                              <Lock className="w-4 h-4 text-[#DC2626]" strokeWidth={1.75} />
                            ) : (
                              <Unlock className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
                            )}
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* Footer Actions (teacher mappings details view) */}
                    <div className="border-t border-[#E5E7EB] pt-3 flex items-center justify-between">
                      <span className="font-body text-[12px] text-[#6B7280]">
                        Joined {new Date(u.createdAt).toLocaleDateString('en-IN')}
                      </span>

                      {u.role === 'TEACHER' && (
                        <button
                          onClick={() => setSelectedTeacher(u)}
                          className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-8 px-3 rounded-md font-medium transition-colors duration-150 text-[12px]"
                        >
                          Syllabus Assign
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: CLASS SUBJECTS MAPPING DIRECTORY */}
      {activeTab === 'subjects' && (
        <div className="space-y-6">
          {/* Subject Filter Panel */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border border-[#E5E7EB] rounded-xl">
            <div className="w-full sm:w-72 relative">
              <input
                type="text"
                placeholder="Search subject by name or code..."
                value={subjectSearch}
                onChange={(e) => setSubjectSearch(e.target.value)}
                className="w-full pl-9"
              />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-[12px]" strokeWidth={1.75} />
            </div>

            <div className="flex items-center gap-2">
              <span className="font-body text-[12px] font-medium uppercase tracking-wide text-gray-500">Class Filter:</span>
              <select
                value={subjectClassFilter}
                onChange={(e) => setSubjectClassFilter(e.target.value)}
                className="font-semibold text-[#1A1D23]"
              >
                <option value="ALL">All Classes</option>
                {classes.map((cls) => (
                  <option key={cls.id} value={cls.id}>
                    {cls.name}
                  </option>
                ))}
              </select>
            </div>
          </div>

          {/* Subjects Cards Matrix */}
          {filteredSubjects.length === 0 ? (
            <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
              <BookOpen className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
              <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">No Academic Subjects Registered</h3>
              <p className="font-body text-[14px] text-[#6B7280] mt-1">Select "+ Create Subject" to establish curriculum mappings.</p>
              <button
                onClick={() => {
                  setEditingSubject(null);
                  setSubjectForm({ name: '', code: '', classId: classes[0]?.id || '', teacherId: '', periodsPerWeek: '' });
                  setShowSubjectForm(true);
                }}
                className="mt-4 inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
              >
                <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} />
                Create Subject
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredSubjects.map((sub) => {
                const assignedTeacher = sub.teacher;

                return (
                  <div
                    key={sub.id}
                    className="bg-white border border-[#E5E7EB] rounded-xl p-5 flex flex-col justify-between relative group space-y-4"
                  >
                    <div className="space-y-2">
                      <div className="flex items-start justify-between gap-3">
                        <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA]">
                          {sub.class?.name || 'Class'}
                        </span>
                        {sub.code && (
                          <span className="text-[10px] font-bold text-[#6B7280] bg-[#F7F8FA] px-2 py-0.5 border border-[#E5E7EB] rounded">
                            {sub.code}
                          </span>
                        )}
                      </div>

                      <h4 className="font-display text-[16px] font-semibold text-[#1A1D23] leading-snug">
                        {sub.name}
                      </h4>
                    </div>

                    {/* Mapped Instructor Direct Dropdown Selector */}
                    <div className="bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg p-3 space-y-1 text-xs">
                      <span className="font-body text-[12px] font-medium uppercase tracking-wide text-gray-500 block">
                        Assigned Instructor
                      </span>
                      <select
                        value={sub.teacherId || ''}
                        onChange={(e) => handleDirectMapSubject(sub.id, e.target.value || null)}
                        className="w-full"
                      >
                        <option value="">-- No Teacher Assigned --</option>
                        {onboardingTeachers.map((teach) => (
                          <option key={teach.id} value={teach.id}>
                            {teach.firstName} {teach.lastName}
                          </option>
                        ))}
                      </select>
                    </div>

                    {/* Subject Actions Panel */}
                    <div className="border-t border-[#E5E7EB] pt-3 flex items-center justify-between">
                      {assignedTeacher ? (
                        <span className="inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded bg-[#D6F0E4] text-[#0F6E56]">
                          Assigned
                        </span>
                      ) : (
                        <span className="inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded bg-[#FAEEDA] text-[#854F0B]">
                          Unassigned
                        </span>
                      )}

                      <div className="flex gap-1 shrink-0 opacity-80 sm:opacity-0 group-hover:opacity-100 transition-opacity">
                        <button
                          onClick={() => {
                            setEditingSubject(sub);
                            setSubjectForm({
                              name: sub.name,
                              code: sub.code || '',
                              classId: sub.classId,
                              teacherId: sub.teacherId || '',
                              periodsPerWeek: sub.periodsPerWeek != null ? String(sub.periodsPerWeek) : '',
                            });
                            setShowSubjectForm(true);
                          }}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1A1D23] transition-colors"
                          title="Edit subject"
                        >
                          <Pencil className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                        <button
                          onClick={() => handleSubjectDelete(sub.id)}
                          className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#FCEBEB] text-[#6B7280] hover:text-[#DC2626] transition-colors"
                          title="Delete subject"
                        >
                          <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: SUBJECT CREATION & EDITING FORM */}
      {showSubjectForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[560px] max-w-[90vw] p-6 shadow-xl flex flex-col">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[20px] font-semibold text-[#1A1D23]">
                {editingSubject ? 'Edit Subject Entry' : 'Register Academic Subject'}
              </h3>
              <button
                onClick={() => {
                  setShowSubjectForm(false);
                  setEditingSubject(null);
                }}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" strokeWidth={1.75} />
              </button>
            </div>

            <form onSubmit={handleSubjectSubmit} className="space-y-4 mt-4">
              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Class Association</label>
                <select
                  required
                  value={subjectForm.classId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, classId: e.target.value })}
                  className="w-full"
                  disabled={!!editingSubject}
                >
                  <option value="">-- Choose Class --</option>
                  {classes.map((cls) => (
                    <option key={cls.id} value={cls.id}>
                      {cls.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-3 gap-4">
                <div className="col-span-2">
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Subject Name</label>
                  <input
                    type="text"
                    required
                    placeholder="e.g. Pure Mathematics"
                    value={subjectForm.name}
                    onChange={(e) => setSubjectForm({ ...subjectForm, name: e.target.value })}
                    className="w-full"
                  />
                </div>
                <div>
                  <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Subject Code</label>
                  <input
                    type="text"
                    placeholder="MATH-101"
                    value={subjectForm.code}
                    onChange={(e) => setSubjectForm({ ...subjectForm, code: e.target.value })}
                    className="w-full"
                  />
                </div>
              </div>

              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Assigned Instructor</label>
                <select
                  value={subjectForm.teacherId}
                  onChange={(e) => setSubjectForm({ ...subjectForm, teacherId: e.target.value })}
                  className="w-full"
                >
                  <option value="">-- No Teacher Assigned --</option>
                  {onboardingTeachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.firstName} {t.lastName}
                    </option>
                  ))}
                </select>
              </div>

              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Periods / Week</label>
                <input
                  type="number"
                  min={0}
                  max={40}
                  placeholder="0"
                  value={subjectForm.periodsPerWeek}
                  onChange={(e) => setSubjectForm({ ...subjectForm, periodsPerWeek: e.target.value })}
                  className="w-full"
                />
                <p className="text-[11px] text-[#6B7280] mt-1">How many lessons this subject needs per week. Used by timetable auto-generation.</p>
              </div>

              <div className="flex justify-end gap-3 pt-5 border-t border-[#E5E7EB] mt-6">
                <button
                  type="button"
                  onClick={() => {
                    setShowSubjectForm(false);
                    setEditingSubject(null);
                  }}
                  className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={submittingSubject}
                  className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px] disabled:opacity-50"
                >
                  {submittingSubject ? 'Saving...' : editingSubject ? 'Save Changes' : 'Register Subject'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* DRAWER: SELECTED TEACHER SUBJECT MAPPINGS MANAGER */}
      {selectedTeacher && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex justify-end">
          <div className="bg-white max-w-md w-full h-full p-6 shadow-xl flex flex-col justify-between overflow-y-auto animate-slideLeft">
            <div className="space-y-6">
              {/* Drawer Header */}
              <div className="flex items-center justify-between border-b border-[#E5E7EB] pb-4">
                <div>
                  <span className="inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA]">
                    Instructor Workspace
                  </span>
                  <h3 className="font-display text-[20px] font-semibold text-[#1A1D23] mt-2">
                    {selectedTeacher.firstName} {selectedTeacher.lastName}
                  </h3>
                  <p className="font-body text-[12px] text-[#6B7280] mt-0.5">{selectedTeacher.email}</p>
                </div>
                <button
                  onClick={() => setSelectedTeacher(null)}
                  className="text-gray-400 hover:text-slate-700"
                >
                  <X className="w-6 h-6" strokeWidth={1.75} />
                </button>
              </div>

              {/* Bulk mapper: subjects are per class, so a teacher covering several
                  grades is edited from one grid rather than one class at a time. */}
              <div className="bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg p-4 space-y-3">
                <h4 className="font-display text-[14px] font-semibold text-[#1A1D23]">
                  Teaching Assignments
                </h4>
                <p className="font-body text-[12px] text-[#6B7280] leading-relaxed">
                  Tick every subject this instructor takes across all classes and sections in one grid.
                </p>

                <button
                  onClick={() => setShowTeachingGrid(true)}
                  className="w-full inline-flex items-center justify-center gap-1.5 bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]"
                >
                  <BookOpen className="w-4 h-4" strokeWidth={1.75} />
                  Assign Subjects Across Classes
                </button>
              </div>

              {/* Assigned Subjects Lists */}
              <div className="space-y-3">
                <h4 className="font-body text-[12px] font-medium uppercase tracking-wide text-gray-500">
                  Assigned Syllabus Chapters ({teacherSubjects.length})
                </h4>

                {teacherSubjects.length === 0 ? (
                  <div className="py-8 text-center border border-[#E5E7EB] bg-[#F7F8FA] rounded-lg text-[14px] text-[#6B7280] leading-relaxed">
                    No academic courses assigned to this instructor. Use the grid above to map courses.
                  </div>
                ) : (
                  <div className="space-y-2">
                    {teacherSubjects.map((sub) => {
                      const mine = (sub.teachers || []).filter((a) => a.teacherId === selectedTeacher.id);
                      const sections = mine.filter((a) => a.section).map((a) => a.section!.name);
                      const isPrimary = sub.teacherId === selectedTeacher.id;
                      return (
                        <div
                          key={sub.id}
                          className="border border-[#E5E7EB] bg-white rounded-lg p-3 flex items-center justify-between gap-3 text-xs"
                        >
                          <div>
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-[#EEF2FF] text-[#4338CA]">
                                {sub.class?.name || 'Class'}
                              </span>
                              <span className="font-semibold text-[#1A1D23] text-sm">{sub.name}</span>
                              {isPrimary && (
                                <span className="inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded bg-[#D6F0E4] text-[#0F6E56]">
                                  Primary
                                </span>
                              )}
                            </div>
                            <p className="text-[12px] text-[#6B7280] mt-0.5">
                              {sections.length > 0 ? `Section ${sections.join(', ')}` : 'All sections'}
                              {sub.code ? ` · ${sub.code}` : ''}
                            </p>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>

            <button
              onClick={() => setSelectedTeacher(null)}
              className="w-full mt-6 inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] rounded-lg font-medium transition-colors duration-150 text-[14px]"
            >
              Close Panel
            </button>
          </div>
        </div>
      )}

      {selectedTeacher && showTeachingGrid && (
        <TeachingGrid
          teacherId={selectedTeacher.id}
          onClose={() => setShowTeachingGrid(false)}
          onSaved={() => { fetchSubjects(); setSuccess('Teaching assignments saved.'); }}
        />
      )}
    </div>
  );
}