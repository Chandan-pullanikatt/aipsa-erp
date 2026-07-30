'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import Stepper from '@/components/Stepper';
import Link from 'next/link';
import {
  Plus, Pencil, Trash2, X, Search, Briefcase, Users, CalendarCheck,
  Building2, Check, KeyRound, Copy, Upload,
} from 'lucide-react';

type EmploymentType = 'FULL_TIME' | 'PART_TIME' | 'CONTRACT';
type StaffRole = 'SCHOOL_ADMIN' | 'TEACHER' | 'STAFF';
type LeaveStatus = 'PENDING' | 'APPROVED' | 'REJECTED';
type AttStatus = 'PRESENT' | 'ABSENT' | 'LATE' | 'HALF_DAY';

interface Department {
  id: string;
  name: string;
  headId: string | null;
  head: { id: string; firstName: string; lastName: string } | null;
  _count?: { staff: number };
}

interface StaffProfile {
  employeeId: string | null;
  designation: string | null;
  joiningDate: string | null;
  employmentType: EmploymentType;
  emergencyContact: string | null;
  departmentId: string | null;
  department: { id: string; name: string } | null;
}

interface StaffMember {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  role: StaffRole;
  isActive: boolean;
  createdAt: string;
  staffProfile: StaffProfile | null;
}

interface LeaveRecord {
  id: string;
  fromDate: string;
  toDate: string;
  reason: string;
  status: LeaveStatus;
  reviewNote: string | null;
  createdAt: string;
  user: { id: string; firstName: string; lastName: string; role: string } | null;
}

interface AttendanceRecord {
  id: string;
  userId: string | null;
  status: AttStatus;
}

const EMPLOYMENT_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  CONTRACT: 'Contract',
};

const ROLE_LABELS: Record<StaffRole, string> = {
  SCHOOL_ADMIN: 'Admin',
  TEACHER: 'Teacher',
  STAFF: 'Staff',
};

const ATT_OPTIONS: { value: AttStatus; label: string; cls: string }[] = [
  { value: 'PRESENT', label: 'Present', cls: 'bg-[#D6F0E4] text-[#0F6E56]' },
  { value: 'ABSENT', label: 'Absent', cls: 'bg-[#FCEBEB] text-[#A32D2D]' },
  { value: 'LATE', label: 'Late', cls: 'bg-[#FAEEDA] text-[#854F0B]' },
  { value: 'HALF_DAY', label: 'Half-day', cls: 'bg-[#EEF2FF] text-[#4338CA]' },
];

const emptyForm = {
  firstName: '', lastName: '', email: '', phone: '', role: 'STAFF' as StaffRole,
  employeeId: '', departmentId: '', designation: '', joiningDate: '',
  employmentType: 'FULL_TIME' as EmploymentType, emergencyContact: '',
};

function todayISO() {
  return new Date().toISOString().slice(0, 10);
}

export default function HrPage() {
  const [activeTab, setActiveTab] = useState<'staff' | 'departments' | 'leave' | 'attendance'>('staff');

  const [staff, setStaff] = useState<StaffMember[]>([]);
  const [departments, setDepartments] = useState<Department[]>([]);
  const [leaves, setLeaves] = useState<LeaveRecord[]>([]);

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // Staff filters
  const [staffSearch, setStaffSearch] = useState('');
  const [staffRoleFilter, setStaffRoleFilter] = useState<'ALL' | StaffRole>('ALL');
  const [staffDeptFilter, setStaffDeptFilter] = useState<string>('ALL');

  // Staff create / edit
  const [showStaffForm, setShowStaffForm] = useState(false);
  const [editingStaff, setEditingStaff] = useState<StaffMember | null>(null);
  const [form, setForm] = useState(emptyForm);
  const [submitting, setSubmitting] = useState(false);
  // New-staff creation is a 2-step wizard (Account → Employment). Editing shows
  // only the employment record, so it stays single-view.
  const [staffStep, setStaffStep] = useState(0);
  const [tempPassword, setTempPassword] = useState<{ email: string; password: string } | null>(null);

  // Department form
  const [deptForm, setDeptForm] = useState<{ id: string | null; name: string; headId: string }>({ id: null, name: '', headId: '' });
  const [showDeptForm, setShowDeptForm] = useState(false);
  const [submittingDept, setSubmittingDept] = useState(false);

  // Leave
  const [leaveFilter, setLeaveFilter] = useState<'PENDING' | 'ALL'>('PENDING');
  const [actionId, setActionId] = useState<string | null>(null);

  // Attendance
  const [attDate, setAttDate] = useState(todayISO());
  const [attendance, setAttendance] = useState<Record<string, AttStatus>>({});
  const [attSaving, setAttSaving] = useState<string | null>(null);

  // ─── Fetchers ──────────────────────────────────────────────────────────────

  const fetchStaff = useCallback(async () => {
    try {
      const { data } = await api.get('/hr/staff');
      setStaff(data);
    } catch { setError('Failed to load staff records.'); }
  }, []);

  const fetchDepartments = useCallback(async () => {
    try {
      const { data } = await api.get('/hr/departments');
      setDepartments(data);
    } catch { setError('Failed to load departments.'); }
  }, []);

  const fetchLeaves = useCallback(async () => {
    try {
      const params = leaveFilter === 'PENDING' ? { status: 'PENDING', limit: 100 } : { limit: 100 };
      const { data } = await api.get('/attendance/leave', { params });
      // HR only cares about staff/teacher leaves, not student leaves.
      setLeaves((data.leaves || []).filter((l: LeaveRecord) => l.user));
    } catch { setError('Failed to load leave requests.'); }
  }, [leaveFilter]);

  const fetchAttendance = useCallback(async (date: string) => {
    try {
      const { data } = await api.get('/attendance/teachers', { params: { date } });
      const map: Record<string, AttStatus> = {};
      (data as AttendanceRecord[]).forEach((r) => { if (r.userId) map[r.userId] = r.status; });
      setAttendance(map);
    } catch { setError('Failed to load attendance.'); }
  }, []);

  useEffect(() => {
    setLoading(true);
    Promise.all([fetchStaff(), fetchDepartments()]).finally(() => setLoading(false));
  }, [fetchStaff, fetchDepartments]);

  useEffect(() => { if (activeTab === 'leave') fetchLeaves(); }, [activeTab, fetchLeaves]);
  useEffect(() => { if (activeTab === 'attendance') fetchAttendance(attDate); }, [activeTab, attDate, fetchAttendance]);

  function flashSuccess(msg: string) {
    setSuccess(msg);
    setTimeout(() => setSuccess(''), 4000);
  }

  // ─── Staff handlers ──────────────────────────────────────────────────────────

  function openCreate() {
    setEditingStaff(null);
    setForm(emptyForm);
    setTempPassword(null);
    setStaffStep(0);
    setShowStaffForm(true);
  }

  function openEdit(member: StaffMember) {
    setEditingStaff(member);
    const p = member.staffProfile;
    setForm({
      firstName: member.firstName, lastName: member.lastName, email: member.email,
      phone: member.phone || '', role: member.role === 'SCHOOL_ADMIN' ? 'STAFF' : member.role,
      employeeId: p?.employeeId || '', departmentId: p?.departmentId || '',
      designation: p?.designation || '', joiningDate: p?.joiningDate ? p.joiningDate.slice(0, 10) : '',
      employmentType: p?.employmentType || 'FULL_TIME', emergencyContact: p?.emergencyContact || '',
    });
    setShowStaffForm(true);
  }

  async function handleStaffSubmit(e: React.FormEvent) {
    e.preventDefault();
    // On the first step of new-staff creation, validate the account fields and
    // advance to the employment step rather than submitting.
    if (!editingStaff && staffStep === 0) {
      if (!form.firstName.trim() || !form.lastName.trim() || !form.email.trim()) {
        setError('First name, last name and email are required.');
        return;
      }
      setError('');
      setStaffStep(1);
      return;
    }
    setSubmitting(true);
    setError('');
    const profile = {
      employeeId: form.employeeId || null,
      departmentId: form.departmentId || null,
      designation: form.designation || null,
      joiningDate: form.joiningDate || null,
      employmentType: form.employmentType,
      emergencyContact: form.emergencyContact || null,
    };
    try {
      if (editingStaff) {
        await api.put(`/hr/staff/${editingStaff.id}/profile`, profile);
        flashSuccess('Employment record updated.');
        setShowStaffForm(false);
      } else {
        const { data } = await api.post('/hr/staff', {
          firstName: form.firstName, lastName: form.lastName, email: form.email,
          phone: form.phone || null, role: form.role, profile,
        });
        setTempPassword({ email: data.email, password: data.tempPassword });
        flashSuccess('Staff member created.');
        setShowStaffForm(false);
      }
      await fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to save staff record.');
    } finally {
      setSubmitting(false);
    }
  }

  // ─── Department handlers ──────────────────────────────────────────────────────

  async function handleDeptSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!deptForm.name.trim()) return;
    setSubmittingDept(true);
    setError('');
    try {
      const payload = { name: deptForm.name.trim(), headId: deptForm.headId || null };
      if (deptForm.id) await api.put(`/hr/departments/${deptForm.id}`, payload);
      else await api.post('/hr/departments', payload);
      setShowDeptForm(false);
      setDeptForm({ id: null, name: '', headId: '' });
      flashSuccess(deptForm.id ? 'Department updated.' : 'Department created.');
      fetchDepartments();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save department.');
    } finally {
      setSubmittingDept(false);
    }
  }

  async function handleDeptDelete(id: string) {
    if (!confirm('Delete this department? Staff in it will be left without a department.')) return;
    setError('');
    try {
      await api.delete(`/hr/departments/${id}`);
      flashSuccess('Department deleted.');
      fetchDepartments();
      fetchStaff();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to delete department.');
    }
  }

  // ─── Leave handlers ──────────────────────────────────────────────────────────

  async function reviewLeave(id: string, status: 'APPROVED' | 'REJECTED') {
    setActionId(id);
    setError('');
    try {
      await api.patch(`/attendance/leave/${id}/review`, { status });
      flashSuccess(`Leave ${status.toLowerCase()}.`);
      fetchLeaves();
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update leave.');
    } finally {
      setActionId(null);
    }
  }

  // ─── Attendance handlers ──────────────────────────────────────────────────────

  async function markAttendance(userId: string, status: AttStatus) {
    setAttSaving(userId);
    setError('');
    try {
      await api.post('/attendance/teachers/mark', { userId, date: attDate, status });
      setAttendance((prev) => ({ ...prev, [userId]: status }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to mark attendance.');
    } finally {
      setAttSaving(null);
    }
  }

  // ─── Derived ──────────────────────────────────────────────────────────────────

  const filteredStaff = staff.filter((m) => {
    const matchesSearch =
      `${m.firstName} ${m.lastName}`.toLowerCase().includes(staffSearch.toLowerCase()) ||
      m.email.toLowerCase().includes(staffSearch.toLowerCase());
    const matchesRole = staffRoleFilter === 'ALL' || m.role === staffRoleFilter;
    const matchesDept = staffDeptFilter === 'ALL' || m.staffProfile?.departmentId === staffDeptFilter;
    return matchesSearch && matchesRole && matchesDept;
  });

  const tabs = [
    { key: 'staff', label: `Staff Records (${staff.length})`, icon: Users },
    { key: 'departments', label: `Departments (${departments.length})`, icon: Building2 },
    { key: 'leave', label: 'Leave Approvals', icon: CalendarCheck },
    { key: 'attendance', label: 'Attendance', icon: Check },
  ] as const;

  if (loading) {
    return (
      <div className="py-40 text-center text-sm text-[#6B7280]">
        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-[#26A96B] mx-auto mb-4"></div>
        Loading HR workspace...
      </div>
    );
  }

  return (
    <div className="max-w-6xl space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-6 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Human Resources</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1 max-w-2xl">
            Manage staff records, departments, leave approvals and daily staff attendance.
          </p>
        </div>
        <div className="flex gap-2 shrink-0 self-start sm:self-center">
          {activeTab === 'staff' && (
            <Link href="/school/hr/import" className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]">
              <Upload className="mr-2 w-4 h-4" strokeWidth={1.75} /> Import CSV
            </Link>
          )}
          {activeTab === 'staff' && (
            <button onClick={openCreate} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]">
              <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} /> Add Staff
            </button>
          )}
          {activeTab === 'departments' && (
            <button onClick={() => { setDeptForm({ id: null, name: '', headId: '' }); setShowDeptForm(true); }} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium transition-colors duration-150 text-[14px]">
              <Plus className="mr-2 w-4 h-4" strokeWidth={1.75} /> Add Department
            </button>
          )}
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

      {/* Temp password card (after creating a staff login) */}
      {tempPassword && (
        <div className="bg-white rounded-xl border border-[#26A96B] p-5 space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="font-display text-[16px] font-semibold text-[#1A1D23] flex items-center gap-2">
              <KeyRound className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} /> Temporary Login Created
            </h3>
            <button onClick={() => setTempPassword(null)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" strokeWidth={1.75} /></button>
          </div>
          <p className="font-body text-[13px] text-[#6B7280]">
            Share these credentials with <span className="font-semibold text-[#1A1D23]">{tempPassword.email}</span>. They must change the password on first login.
          </p>
          <div className="flex items-center gap-3 bg-[#F7F8FA] p-3 border border-[#E5E7EB] rounded-lg">
            <span className="font-mono text-lg font-bold text-[#1A1D23] tracking-wide">{tempPassword.password}</span>
            <button
              onClick={() => { navigator.clipboard.writeText(tempPassword.password); flashSuccess('Password copied.'); }}
              className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-8 px-3 rounded-md font-medium text-[13px]"
            >
              <Copy className="mr-1.5 w-3.5 h-3.5" strokeWidth={1.75} /> Copy
            </button>
          </div>
        </div>
      )}

      {/* Tabs */}
      <div className="flex items-center gap-2 border-b border-[#E5E7EB] overflow-x-auto">
        {tabs.map((t) => {
          const Icon = t.icon;
          return (
            <button
              key={t.key}
              onClick={() => setActiveTab(t.key)}
              className={`inline-flex items-center px-4 py-3 font-display text-[14px] font-semibold border-b-2 transition-all whitespace-nowrap ${
                activeTab === t.key ? 'border-[#26A96B] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'
              }`}
            >
              <Icon className="mr-2 w-4 h-4" strokeWidth={1.75} /> {t.label}
            </button>
          );
        })}
      </div>

      {/* TAB: STAFF RECORDS */}
      {activeTab === 'staff' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-4 border border-[#E5E7EB] rounded-xl">
            <div className="w-full sm:w-72 relative">
              <input type="text" placeholder="Search by name or email..." value={staffSearch} onChange={(e) => setStaffSearch(e.target.value)} className="w-full pl-9" />
              <Search className="w-4 h-4 text-gray-400 absolute left-3 top-[12px]" strokeWidth={1.75} />
            </div>
            <div className="flex flex-wrap gap-2 items-center">
              <select value={staffRoleFilter} onChange={(e) => setStaffRoleFilter(e.target.value as any)} className="font-semibold text-[#1A1D23]">
                <option value="ALL">All Roles</option>
                <option value="TEACHER">Teachers</option>
                <option value="STAFF">Staff</option>
                <option value="SCHOOL_ADMIN">Admins</option>
              </select>
              <select value={staffDeptFilter} onChange={(e) => setStaffDeptFilter(e.target.value)} className="font-semibold text-[#1A1D23]">
                <option value="ALL">All Departments</option>
                {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
              </select>
            </div>
          </div>

          {filteredStaff.length === 0 ? (
            <EmptyState icon={Users} title="No staff records" hint="Add a staff member to get started." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {filteredStaff.map((m) => {
                const p = m.staffProfile;
                return (
                  <div key={m.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-4">
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 rounded-full bg-[#D6F0E4] border border-[#26A96B] flex items-center justify-center font-bold text-xs text-[#0F6E56] uppercase shrink-0">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div className="min-w-0 flex-1">
                        <h4 className="font-display text-[14px] font-semibold text-[#1A1D23] truncate">{m.firstName} {m.lastName}</h4>
                        <p className="font-body text-[12px] text-[#6B7280] truncate">{m.email}</p>
                      </div>
                      <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded ${m.isActive ? 'bg-[#D6F0E4] text-[#0F6E56]' : 'bg-[#FAEEDA] text-[#854F0B]'}`}>
                        {m.isActive ? 'Active' : 'Inactive'}
                      </span>
                    </div>

                    <div className="grid grid-cols-2 gap-y-2.5 gap-x-3 text-[12px] border-t border-[#E5E7EB] pt-3">
                      <Field label="Role" value={ROLE_LABELS[m.role]} />
                      <Field label="Employee ID" value={p?.employeeId || '—'} />
                      <Field label="Department" value={p?.department?.name || '—'} />
                      <Field label="Designation" value={p?.designation || '—'} />
                      <Field label="Type" value={p ? EMPLOYMENT_LABELS[p.employmentType] : '—'} />
                      <Field label="Joined" value={p?.joiningDate ? new Date(p.joiningDate).toLocaleDateString('en-IN') : '—'} />
                    </div>

                    <div className="border-t border-[#E5E7EB] pt-3 flex items-center justify-end">
                      <button onClick={() => openEdit(m)} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-8 px-3 rounded-md font-medium text-[12px]">
                        <Pencil className="mr-1.5 w-3.5 h-3.5" strokeWidth={1.75} /> Edit Record
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB: DEPARTMENTS */}
      {activeTab === 'departments' && (
        <div className="space-y-6">
          {departments.length === 0 ? (
            <EmptyState icon={Building2} title="No departments" hint="Create departments to organise staff." />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {departments.map((d) => (
                <div key={d.id} className="bg-white border border-[#E5E7EB] rounded-xl p-5 space-y-3">
                  <div className="flex items-start justify-between">
                    <h4 className="font-display text-[16px] font-semibold text-[#1A1D23]">{d.name}</h4>
                    <div className="flex gap-1">
                      <button onClick={() => { setDeptForm({ id: d.id, name: d.name, headId: d.headId || '' }); setShowDeptForm(true); }} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#F3F4F6] text-[#6B7280] hover:text-[#1A1D23]" title="Edit">
                        <Pencil className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                      <button onClick={() => handleDeptDelete(d.id)} className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#FCEBEB] text-[#6B7280] hover:text-[#DC2626]" title="Delete">
                        <Trash2 className="w-4 h-4" strokeWidth={1.75} />
                      </button>
                    </div>
                  </div>
                  <div className="text-[12px] space-y-1.5 border-t border-[#E5E7EB] pt-3">
                    <p className="text-[#6B7280]">Head: <span className="text-[#1A1D23] font-medium">{d.head ? `${d.head.firstName} ${d.head.lastName}` : '—'}</span></p>
                    <p className="text-[#6B7280]">Staff: <span className="text-[#1A1D23] font-medium">{d._count?.staff ?? 0}</span></p>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TAB: LEAVE APPROVALS */}
      {activeTab === 'leave' && (
        <div className="space-y-6">
          <div className="flex gap-2">
            {(['PENDING', 'ALL'] as const).map((f) => (
              <button key={f} onClick={() => setLeaveFilter(f)} className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium text-[14px] ${leaveFilter === f ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>
                {f === 'PENDING' ? 'Pending' : 'All Requests'}
              </button>
            ))}
          </div>

          {leaves.length === 0 ? (
            <EmptyState icon={CalendarCheck} title="No leave requests" hint={leaveFilter === 'PENDING' ? 'No pending staff leave to review.' : 'No staff leave on record.'} />
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl overflow-hidden">
              <table className="w-full text-[13px]">
                <thead className="bg-[#F7F8FA] text-[#6B7280] text-left">
                  <tr>
                    <th className="px-4 py-3 font-medium">Staff</th>
                    <th className="px-4 py-3 font-medium">Dates</th>
                    <th className="px-4 py-3 font-medium">Reason</th>
                    <th className="px-4 py-3 font-medium">Status</th>
                    <th className="px-4 py-3 font-medium text-right">Action</th>
                  </tr>
                </thead>
                <tbody>
                  {leaves.map((l) => (
                    <tr key={l.id} className="border-t border-[#E5E7EB]">
                      <td className="px-4 py-3">
                        <div className="font-medium text-[#1A1D23]">{l.user?.firstName} {l.user?.lastName}</div>
                        <div className="text-[11px] text-[#6B7280]">{ROLE_LABELS[(l.user?.role as StaffRole)] || l.user?.role}</div>
                      </td>
                      <td className="px-4 py-3 text-[#374151] whitespace-nowrap">
                        {new Date(l.fromDate).toLocaleDateString('en-IN')} – {new Date(l.toDate).toLocaleDateString('en-IN')}
                      </td>
                      <td className="px-4 py-3 text-[#374151] max-w-xs truncate" title={l.reason}>{l.reason}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded ${
                          l.status === 'APPROVED' ? 'bg-[#D6F0E4] text-[#0F6E56]' : l.status === 'REJECTED' ? 'bg-[#FCEBEB] text-[#A32D2D]' : 'bg-[#FAEEDA] text-[#854F0B]'
                        }`}>{l.status}</span>
                      </td>
                      <td className="px-4 py-3">
                        {l.status === 'PENDING' ? (
                          <div className="flex gap-1.5 justify-end">
                            <button disabled={actionId === l.id} onClick={() => reviewLeave(l.id, 'APPROVED')} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-8 px-3 rounded-md font-medium text-[12px] disabled:opacity-50">Approve</button>
                            <button disabled={actionId === l.id} onClick={() => reviewLeave(l.id, 'REJECTED')} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#DC2626] hover:bg-[#FCEBEB] h-8 px-3 rounded-md font-medium text-[12px] disabled:opacity-50">Reject</button>
                          </div>
                        ) : (
                          <span className="text-[12px] text-[#6B7280] block text-right">Reviewed</span>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}

      {/* TAB: ATTENDANCE */}
      {activeTab === 'attendance' && (
        <div className="space-y-6">
          <div className="flex flex-wrap items-center gap-3 bg-white p-4 border border-[#E5E7EB] rounded-xl">
            <label className="font-body text-[13px] font-medium text-[#374151]">Date</label>
            <input type="date" value={attDate} max={todayISO()} onChange={(e) => setAttDate(e.target.value)} className="w-auto" />
            <span className="text-[12px] text-[#6B7280]">Marking attendance for {staff.length} staff member{staff.length === 1 ? '' : 's'}.</span>
          </div>

          {staff.length === 0 ? (
            <EmptyState icon={Check} title="No staff to mark" hint="Add staff records first." />
          ) : (
            <div className="bg-white border border-[#E5E7EB] rounded-xl divide-y divide-[#E5E7EB]">
              {staff.map((m) => {
                const current = attendance[m.id];
                return (
                  <div key={m.id} className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-9 h-9 rounded-full bg-[#D6F0E4] border border-[#26A96B] flex items-center justify-center font-bold text-[11px] text-[#0F6E56] uppercase shrink-0">
                        {m.firstName[0]}{m.lastName[0]}
                      </div>
                      <div className="min-w-0">
                        <div className="font-medium text-[14px] text-[#1A1D23] truncate">{m.firstName} {m.lastName}</div>
                        <div className="text-[11px] text-[#6B7280]">{ROLE_LABELS[m.role]}{m.staffProfile?.department ? ` · ${m.staffProfile.department.name}` : ''}</div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      {ATT_OPTIONS.map((opt) => (
                        <button
                          key={opt.value}
                          disabled={attSaving === m.id}
                          onClick={() => markAttendance(m.id, opt.value)}
                          className={`inline-flex items-center justify-center h-8 px-3 rounded-md font-medium text-[12px] border transition-colors disabled:opacity-50 ${
                            current === opt.value ? `${opt.cls} border-transparent` : 'bg-white border-[#E5E7EB] text-[#6B7280] hover:bg-[#F7F8FA]'
                          }`}
                        >
                          {opt.label}
                        </button>
                      ))}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* MODAL: STAFF CREATE / EDIT */}
      {showStaffForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[640px] max-w-[92vw] max-h-[90vh] overflow-y-auto p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[20px] font-semibold text-[#1A1D23]">
                {editingStaff ? 'Edit Employment Record' : 'Add Staff Member'}
              </h3>
              <button onClick={() => setShowStaffForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" strokeWidth={1.75} /></button>
            </div>

            {/* Step indicator only for the multi-step creation flow. */}
            {!editingStaff && (
              <div className="mt-4">
                <Stepper steps={['Account', 'Employment']} current={staffStep} onStepClick={(i) => { setError(''); setStaffStep(i); }} />
              </div>
            )}

            <form onSubmit={handleStaffSubmit} className="space-y-4 mt-4">
              {/* STEP 1 — Account (creation only) */}
              {!editingStaff && staffStep === 0 && (
                <>
                  <div className="grid grid-cols-2 gap-4">
                    <LabeledInput label="First Name" required value={form.firstName} onChange={(v) => setForm({ ...form, firstName: v })} />
                    <LabeledInput label="Last Name" required value={form.lastName} onChange={(v) => setForm({ ...form, lastName: v })} />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <LabeledInput label="Email" type="email" required value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
                    <LabeledInput label="Phone" value={form.phone} onChange={(v) => setForm({ ...form, phone: v })} />
                  </div>
                  <div>
                    <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Role</label>
                    <div className="flex gap-2">
                      {(['STAFF', 'TEACHER'] as const).map((r) => (
                        <button key={r} type="button" onClick={() => setForm({ ...form, role: r })} className={`inline-flex items-center justify-center h-[38px] px-4 rounded-lg font-medium text-[14px] ${form.role === r ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA]'}`}>
                          {ROLE_LABELS[r]}
                        </button>
                      ))}
                    </div>
                    <p className="text-[11px] text-[#6B7280] mt-1.5">A login is created with a temporary password the member changes on first sign-in.</p>
                  </div>
                </>
              )}

              {/* STEP 2 — Employment record (also the sole view when editing) */}
              {(editingStaff || staffStep === 1) && (
                <>
                  {editingStaff && (
                    <div className="bg-[#F7F8FA] border border-[#E5E7EB] rounded-lg p-3 text-[13px] text-[#374151]">
                      <span className="font-medium text-[#1A1D23]">{editingStaff.firstName} {editingStaff.lastName}</span> · {editingStaff.email}
                    </div>
                  )}

                  <div className="grid grid-cols-2 gap-4">
                    <LabeledInput label="Employee ID" value={form.employeeId} onChange={(v) => setForm({ ...form, employeeId: v })} placeholder="EMP-001" />
                    <div>
                      <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Department</label>
                      <select value={form.departmentId} onChange={(e) => setForm({ ...form, departmentId: e.target.value })} className="w-full">
                        <option value="">— None —</option>
                        {departments.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <LabeledInput label="Designation" value={form.designation} onChange={(v) => setForm({ ...form, designation: v })} placeholder="e.g. Accountant" />
                    <div>
                      <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Employment Type</label>
                      <select value={form.employmentType} onChange={(e) => setForm({ ...form, employmentType: e.target.value as EmploymentType })} className="w-full">
                        {(Object.keys(EMPLOYMENT_LABELS) as EmploymentType[]).map((t) => <option key={t} value={t}>{EMPLOYMENT_LABELS[t]}</option>)}
                      </select>
                    </div>
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Joining Date</label>
                      <input type="date" value={form.joiningDate} max={todayISO()} onChange={(e) => setForm({ ...form, joiningDate: e.target.value })} className="w-full" />
                    </div>
                    <LabeledInput label="Emergency Contact" value={form.emergencyContact} onChange={(v) => setForm({ ...form, emergencyContact: v })} placeholder="Name / phone" />
                  </div>
                </>
              )}

              <div className="flex justify-end gap-3 pt-5 border-t border-[#E5E7EB] mt-2">
                {!editingStaff && staffStep === 1 ? (
                  <button type="button" onClick={() => { setError(''); setStaffStep(0); }} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium text-[14px]">Back</button>
                ) : (
                  <button type="button" onClick={() => setShowStaffForm(false)} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium text-[14px]">Cancel</button>
                )}
                <button type="submit" disabled={submitting} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium text-[14px] disabled:opacity-50">
                  {submitting ? 'Saving...' : editingStaff ? 'Save Record' : staffStep === 0 ? 'Continue' : 'Create Staff'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MODAL: DEPARTMENT */}
      {showDeptForm && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-[480px] max-w-[92vw] p-6 shadow-xl">
            <div className="flex items-center justify-between pb-4 border-b border-[#E5E7EB]">
              <h3 className="font-display text-[20px] font-semibold text-[#1A1D23]">{deptForm.id ? 'Edit Department' : 'Add Department'}</h3>
              <button onClick={() => setShowDeptForm(false)} className="text-gray-400 hover:text-gray-600"><X className="w-5 h-5" strokeWidth={1.75} /></button>
            </div>
            <form onSubmit={handleDeptSubmit} className="space-y-4 mt-4">
              <LabeledInput label="Department Name" required value={deptForm.name} onChange={(v) => setDeptForm({ ...deptForm, name: v })} placeholder="e.g. Administration" />
              <div>
                <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">Department Head</label>
                <select value={deptForm.headId} onChange={(e) => setDeptForm({ ...deptForm, headId: e.target.value })} className="w-full">
                  <option value="">— None —</option>
                  {staff.map((m) => <option key={m.id} value={m.id}>{m.firstName} {m.lastName}</option>)}
                </select>
              </div>
              <div className="flex justify-end gap-3 pt-5 border-t border-[#E5E7EB] mt-2">
                <button type="button" onClick={() => setShowDeptForm(false)} className="inline-flex items-center justify-center bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] h-[38px] px-4 rounded-lg font-medium text-[14px]">Cancel</button>
                <button type="submit" disabled={submittingDept} className="inline-flex items-center justify-center bg-[#1D7A4A] hover:bg-[#0B4D2E] text-white h-[38px] px-4 rounded-lg font-medium text-[14px] disabled:opacity-50">
                  {submittingDept ? 'Saving...' : deptForm.id ? 'Save' : 'Create'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── Small presentational helpers ──────────────────────────────────────────────

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <span className="text-[#6B7280] block font-body text-[11px] font-medium uppercase tracking-wide">{label}</span>
      <span className="text-[#1A1D23] font-medium block truncate">{value}</span>
    </div>
  );
}

function LabeledInput({ label, value, onChange, required, type = 'text', placeholder }: {
  label: string; value: string; onChange: (v: string) => void; required?: boolean; type?: string; placeholder?: string;
}) {
  return (
    <div>
      <label className="font-body text-[13px] font-medium text-[#374151] mb-1.5 block">{label}</label>
      <input type={type} required={required} placeholder={placeholder} value={value} onChange={(e) => onChange(e.target.value)} className="w-full" />
    </div>
  );
}

function EmptyState({ icon: Icon, title, hint }: { icon: any; title: string; hint: string }) {
  return (
    <div className="py-16 text-center bg-white rounded-xl border border-[#E5E7EB] p-6 flex flex-col items-center">
      <Icon className="w-10 h-10 text-[#D1D5DB]" strokeWidth={1.75} />
      <h3 className="font-display text-[16px] font-semibold text-[#374151] mt-3">{title}</h3>
      <p className="font-body text-[14px] text-[#6B7280] mt-1">{hint}</p>
    </div>
  );
}
