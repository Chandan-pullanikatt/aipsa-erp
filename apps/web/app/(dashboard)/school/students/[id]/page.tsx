'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ArrowLeft,
  User,
  Users,
  Phone,
  Mail,
  MapPin,
  Calendar,
  CalendarCheck,
  Award,
  Plus,
  Trash2,
  Copy,
  Check,
  Eye,
  Briefcase,
  AlertTriangle,
  GraduationCap,
  ShieldCheck,
  CheckCircle,
  Sparkles,
  Info,
  Edit3,
  IndianRupee,
  Flag,
  Star,
  MessageSquare,
  X,
  IdCard,
} from 'lucide-react';

interface Student {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  dateOfBirth: string | null; gender: string | null; bloodGroup: string | null;
  address: string | null; city: string | null; state: string | null; phone: string | null;
  status: string; admissionDate: string;
  photoUrl: string | null; boardingType: string | null; needsBus: boolean;
  feeAccessOverride: boolean;
  class: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  guardians: Guardian[];
}
interface Guardian {
  id: string; firstName: string; lastName: string; relation: string;
  phone: string; email: string | null; occupation: string | null; isPrimary: boolean;
}
interface ClassItem { id: string; name: string; }
interface SectionItem { id: string; name: string; }


interface AttendanceSummary {
  summary: { total: number; present: number; absent: number; late: number; percentage: number };
  records: Array<{ id: string; date: string; status: string; note: string | null }>;
}
interface ExamResultRow {
  id: string;
  marksObtained: number | null;
  grade: string | null;
  isAbsent: boolean;
  remarks: string | null;
  subject: { id: string; name: string; code: string | null };
}
interface ExamSummary {
  exam: { id: string; name: string; startDate: string; endDate: string | null; maxMarks: number; passingMarks: number };
  results: ExamResultRow[];
  totalMarks: number;
  maxPossible: number;
  percentage: number;
  overallGrade: string | null;
}
interface ReportCard {
  academicYear: string;
  examSummaries: ExamSummary[];
}
interface FeeBreakdownRow {
  structureId: string;
  feeCategoryId: string;
  feeCategoryName: string;
  structureAmount: number;
  frequency: string;
  dueDate: string | null;
  paid: number;
  due: number;
  daysOverdue: number;
  lateFeeApplicable: boolean;
  lateFeeWaived: boolean;
  lateFee: number;
}
interface FeePaymentRow {
  id: string;
  amount: number;
  paidAt: string;
  method: string;
  referenceNumber: string | null;
  receiptNumber: string;
  note: string | null;
  feeCategory: { id: string; name: string };
}
interface FeeAccount {
  academicYear: string;
  summary: { totalStructure: number; totalPaid: number; totalDue: number; totalLateFee: number };
  breakdown: FeeBreakdownRow[];
  payments: FeePaymentRow[];
  lateFeePolicy: { lateFeeAmount: number; lateFeeGraceDays: number };
}

interface Activity {
  id: string;
  type: 'DISCIPLINARY' | 'ACHIEVEMENT' | 'REMARK';
  title: string;
  description: string | null;
  date: string;
  createdAt: string;
  addedBy: { id: string; firstName: string; lastName: string; role: string };
}

const ACTIVITY_META: Record<string, { label: string; bg: string; text: string; border: string; Icon: any }> = {
  DISCIPLINARY: { label: 'Disciplinary', bg: 'bg-[#FEF2F2]', text: 'text-[#DC2626]', border: 'border-[#FCA5A5]/30', Icon: Flag },
  ACHIEVEMENT:  { label: 'Achievement',  bg: 'bg-[#D6F0E4]', text: 'text-[#0F6E56]', border: 'border-[#26A96B]/15', Icon: Star },
  REMARK:       { label: 'Remark',       bg: 'bg-[#EEF2FF]', text: 'text-[#4338CA]', border: 'border-[#4338CA]/10', Icon: MessageSquare },
};

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-[#D6F0E4] text-[#0F6E56] border border-[#26A96B]/15',
  INACTIVE: 'bg-[#FAEEDA] text-[#854F0B] border border-[#F59E0B]/15',
  TRANSFERRED: 'bg-[#EEF2FF] text-[#4338CA] border border-[#4338CA]/15',
  GRADUATED: 'bg-[#EEF2FF] text-[#4338CA] border border-[#4338CA]/15',
};

export default function StudentProfilePage({ params }: { params: Promise<{ id: string }> }) {
  const [id, setId] = useState<string | null>(null);
  const [student, setStudent] = useState<Student | null>(null);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<SectionItem[]>([]);
  const [editing, setEditing] = useState(false);
  const [form, setForm] = useState<any>({});
  const [addingGuardian, setAddingGuardian] = useState(false);
  const [newGuardian, setNewGuardian] = useState({ firstName: '', lastName: '', relation: 'FATHER', phone: '', email: '', occupation: '', isPrimary: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [portalPin, setPortalPin] = useState<string | null>(null);
  const [showPin, setShowPin] = useState(false);
  const [pinCopied, setPinCopied] = useState(false);
  const [resettingPassword, setResettingPassword] = useState(false);
  const [resetResult, setResetResult] = useState<string | null>(null);
  const [resetCopied, setResetCopied] = useState(false);
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState({ firstName: '', lastName: '' });
  const [showInviteParent, setShowInviteParent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');
  const [feeOverrideLoading, setFeeOverrideLoading] = useState(false);
  const [attendance, setAttendance] = useState<AttendanceSummary | null>(null);
  const [reportCard, setReportCard] = useState<ReportCard | null>(null);
  const [feeAccount, setFeeAccount] = useState<FeeAccount | null>(null);
  const [activities, setActivities] = useState<Activity[]>([]);
  const [activitiesLoaded, setActivitiesLoaded] = useState(false);
  const [addingActivity, setAddingActivity] = useState(false);
  const [activityForm, setActivityForm] = useState({ type: 'REMARK', title: '', description: '', date: new Date().toISOString().split('T')[0] });
  const [activitySaving, setActivitySaving] = useState(false);

  useEffect(() => { params.then((p) => setId(p.id)); }, [params]);

  async function loadStudent(sid: string) {
    const { data } = await api.get(`/sis/students/${sid}`);
    setStudent(data);
    setForm({
      firstName: data.firstName, lastName: data.lastName,
      dateOfBirth: data.dateOfBirth ? data.dateOfBirth.split('T')[0] : '',
      gender: data.gender ?? '', bloodGroup: data.bloodGroup ?? '',
      address: data.address ?? '', city: data.city ?? '', state: data.state ?? '',
      phone: data.phone ?? '', classId: data.class?.id ?? '', sectionId: data.section?.id ?? '',
      status: data.status,
    });
    if (data.class?.id) api.get(`/sis/classes/${data.class.id}/sections`).then((r) => setSections(r.data));
  }

  useEffect(() => {
    if (!id) return;
    loadStudent(id).catch(console.error);
    api.get('/sis/classes').then((r) => setClasses(r.data)).catch(console.error);

    // current month range for attendance
    const now = new Date();
    const y = now.getFullYear();
    const m = String(now.getMonth() + 1).padStart(2, '0');
    const lastDay = new Date(y, now.getMonth() + 1, 0).getDate();
    const fromDate = `${y}-${m}-01`;
    const toDate = `${y}-${m}-${String(lastDay).padStart(2, '0')}`;

    api.get(`/attendance/students/report?studentId=${id}&fromDate=${fromDate}&toDate=${toDate}`)
      .then((r) => setAttendance(r.data)).catch(console.error);
    api.get(`/exams/report-card/${id}`)
      .then((r) => setReportCard(r.data)).catch(console.error);
    api.get(`/fees/students/${id}/account`)
      .then((r) => setFeeAccount(r.data)).catch(console.error);
    api.get(`/sis/students/${id}/activities`)
      .then((r) => { setActivities(r.data); setActivitiesLoaded(true); }).catch(console.error);
  }, [id]);

  async function handleSave() {
    if (!id) return;
    setSaving(true); setError('');
    try {
      const { data } = await api.put(`/sis/students/${id}`, form);
      setStudent(data); setEditing(false);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to save.');
    } finally { setSaving(false); }
  }

  async function handleAddGuardian(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    try {
      await api.post(`/sis/students/${id}/guardians`, newGuardian);
      await loadStudent(id);
      setAddingGuardian(false);
      setNewGuardian({ firstName: '', lastName: '', relation: 'FATHER', phone: '', email: '', occupation: '', isPrimary: false });
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to add guardian.'); }
  }

  async function handleDeleteGuardian(gid: string) {
    if (!confirm('Remove this guardian?') || !id) return;
    try {
      await api.delete(`/sis/guardians/${gid}`);
      await loadStudent(id);
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to remove.'); }
  }

  async function handleFeeOverrideToggle() {
    if (!id || !student) return;
    setFeeOverrideLoading(true);
    try {
      const { data } = await api.patch(`/sis/students/${id}/fee-override`, { enabled: !student.feeAccessOverride });
      setStudent(data);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to update fee override.');
    } finally {
      setFeeOverrideLoading(false);
    }
  }

  async function handleShowPin() {
    if (!id) return;
    const { data } = await api.get(`/sis/students/${id}/portal-pin`);
    setPortalPin(data.portalPin);
    setShowPin(true);
  }

  async function handleResetPassword() {
    if (!id) return;
    if (!confirm('Reset this student\'s password to the default pattern? They will be required to change it on next login.')) return;
    setResettingPassword(true);
    setResetResult(null);
    try {
      const { data } = await api.post(`/sis/students/${id}/reset-password`);
      setResetResult(data.defaultPassword);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to reset password.');
    } finally { setResettingPassword(false); }
  }

  async function handleInviteParent(e: React.FormEvent) {
    e.preventDefault();
    if (!id) return;
    setInviting(true); setError('');
    try {
      await api.post('/auth/invite', { ...inviteName, email: inviteEmail, role: 'PARENT' });
      setInviteSuccess(`Invite sent to ${inviteEmail}`);
      setShowInviteParent(false);
      setInviteEmail(''); setInviteName({ firstName: '', lastName: '' });
      setTimeout(() => setInviteSuccess(''), 4000);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to send invite.');
    } finally { setInviting(false); }
  }

  if (!student) {
    return (
      <div className="flex items-center gap-2 text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] px-4 py-3 rounded-lg border border-[#26A96B]/10 animate-pulse w-fit">
        <span>Synchronizing Student File...</span>
      </div>
    );
  }

  const inf = (v: string | null | undefined) => v || <span className="text-[#9CA3AF] font-medium italic">—</span>;
  const monthName = new Date().toLocaleDateString('en-IN', { month: 'long', year: 'numeric' });

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Top bar header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-[#E5E7EB]">
        <Link href="/school/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] hover:text-[#1A1D23] transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> Back to Directory
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center font-bold text-lg border border-[#26A96B]/15 overflow-hidden">
            {student.photoUrl
              ? <img src={student.photoUrl} alt={`${student.firstName} ${student.lastName}`} className="w-full h-full object-cover" />
              : <>{student.firstName[0]}{student.lastName[0]}</>}
          </div>
          <div>
            <h1 className="font-display text-[26px] sm:text-[32px] font-bold leading-tight text-[#1A1D23]">{student.firstName} {student.lastName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded border border-[#E5E7EB]">{student.admissionNumber}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[student.status]}`}>{student.status}</span>
            </div>
          </div>
          <Link
            href={`/school/students/id-cards?studentId=${student.id}`}
            className="ml-auto inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#4B5563] bg-white hover:bg-[#F9FAFB] transition-all shadow-sm font-display"
          >
            <IdCard className="w-3.5 h-3.5" strokeWidth={1.75} /> ID Card
          </Link>
        </div>
      </div>

      {error && (
        <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-sm rounded-lg px-4 py-3 flex gap-2 items-center shadow-sm">
          <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0" strokeWidth={1.75} />
          <span className="font-semibold">{error}</span>
        </div>
      )}

      {/* Student Details Card */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-5">
        <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <User className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Student Profile Record</h3>
          </div>
          {editing ? (
            <div className="flex gap-2">
              <button onClick={handleSave} disabled={saving} 
                className="px-3.5 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm">
                {saving ? 'Saving...' : 'Save'}
              </button>
              <button onClick={() => setEditing(false)} 
                className="px-3.5 py-1.5 border border-[#E5E7EB] hover:bg-white bg-gray-50 rounded-lg text-xs font-semibold text-[#4B5563] transition-all">
                Cancel
              </button>
            </div>
          ) : (
            <button onClick={() => setEditing(true)} 
              className="inline-flex items-center gap-1.5 px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-bold text-[#4B5563] bg-white hover:bg-[#F9FAFB] transition-all shadow-sm font-display">
              <Edit3 className="w-3.5 h-3.5" strokeWidth={1.75} />
              Modify File
            </button>
          )}
        </div>

        {editing ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {(['firstName', 'lastName', 'phone', 'address', 'city', 'state'] as const).map((key) => (
              <div key={key} className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{key.replace(/([A-Z])/g, ' $1')}</label>
                <input value={form[key]} onChange={(e) => setForm({ ...form, [key]: e.target.value })} 
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
              </div>
            ))}
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Date of Birth</label>
              <input type="date" value={form.dateOfBirth} onChange={(e) => setForm({ ...form, dateOfBirth: e.target.value })} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Status</label>
              <select value={form.status} onChange={(e) => setForm({ ...form, status: e.target.value })} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                {['ACTIVE', 'INACTIVE', 'TRANSFERRED', 'GRADUATED'].map((s) => <option key={s} value={s}>{s[0] + s.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Class Grade</label>
              <select value={form.classId} onChange={(e) => { setForm({ ...form, classId: e.target.value, sectionId: '' }); if (e.target.value) api.get(`/sis/classes/${e.target.value}/sections`).then((r) => setSections(r.data)); }} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                <option value="">No class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Section Division</label>
              <select value={form.sectionId} onChange={(e) => setForm({ ...form, sectionId: e.target.value })} disabled={!form.classId} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF]">
                <option value="">No section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            </div>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-4 gap-x-6 text-sm">
            {([
              ['Class / Classroom', student.class ? `${student.class.name}${student.section ? ' – Section ' + student.section.name : ''}` : null, <GraduationCap className="w-4 h-4 text-[#1D7A4A]" />],
              ['Date of Birth', student.dateOfBirth ? new Date(student.dateOfBirth).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }) : null, <Calendar className="w-4 h-4 text-[#1D7A4A]" />],
              ['Gender Identity', student.gender ? student.gender[0] + student.gender.slice(1).toLowerCase() : null, <User className="w-4 h-4 text-[#1D7A4A]" />],
              ['Blood Group', student.bloodGroup, <Sparkles className="w-4 h-4 text-[#1D7A4A]" />],
              ['Contact Phone', student.phone, <Phone className="w-4 h-4 text-[#1D7A4A]" />],
              ['Permanent Address', [student.address, student.city, student.state].filter(Boolean).join(', ') || null, <MapPin className="w-4 h-4 text-[#1D7A4A]" />],
              ['Official Admission Date', new Date(student.admissionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'long', year: 'numeric' }), <Calendar className="w-4 h-4 text-[#1D7A4A]" />],
            ] as [string, string | null, React.ReactNode][]).map(([label, value, icon]) => (
              <div key={label} className="flex gap-2.5 items-start bg-[#F9FAFB] p-3 rounded-lg border border-[#E5E7EB]">
                <div className="mt-0.5 shrink-0">{icon}</div>
                <div>
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">{label}</p>
                  <p className="font-bold text-[#1A1D23] mt-0.5">{inf(value)}</p>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Portal PIN + Parent Invite */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
          <ShieldCheck className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
          <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Parent Portal Governance</h3>
        </div>
        
        {inviteSuccess && (
          <div className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-xs rounded-lg px-3 py-2 flex gap-2 items-center shadow-sm animate-pulse">
            <CheckCircle className="w-4 h-4 text-[#0F6E56]" strokeWidth={2} />
            <span className="font-semibold">{inviteSuccess}</span>
          </div>
        )}
        
        {/* Fee Access Override banner */}
        {student.feeAccessOverride && (
          <div className="flex items-center gap-2 px-3 py-2 bg-[#FAEEDA] border border-[#F59E0B]/20 rounded-lg text-xs font-semibold text-[#854F0B]">
            <AlertTriangle className="w-3.5 h-3.5 shrink-0" strokeWidth={2} />
            Fee access override is active — student can view attendance &amp; exam results despite outstanding dues.
          </div>
        )}

        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 pt-1">
          {/* PIN Card */}
          <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB] flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider flex items-center gap-1.5">
                <Info className="w-3.5 h-3.5 text-[#6B7280]" />
                Portal Connection PIN
              </p>
              <p className="text-[11px] text-[#6B7280] font-semibold mt-1">Provide this secure pin to parents so they can cleanly link their child's dashboard profile.</p>
            </div>
            
            {showPin && portalPin ? (
              <div className="flex items-center gap-2 mt-2">
                <span className="font-mono text-xl font-black text-[#1D7A4A] tracking-widest bg-white border border-[#E5E7EB] px-3.5 py-2 rounded-xl shadow-sm">{portalPin}</span>
                <button onClick={() => { navigator.clipboard.writeText(portalPin); setPinCopied(true); setTimeout(() => setPinCopied(false), 2000); }} 
                  className="inline-flex items-center gap-1 text-xs border border-[#E5E7EB] bg-white font-bold px-3 py-2 rounded-lg hover:bg-gray-50 transition-all shadow-sm">
                  {pinCopied ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />}
                  {pinCopied ? 'Copied' : 'Copy'}
                </button>
                <button onClick={() => setShowPin(false)} className="text-xs font-semibold text-[#6B7280] hover:text-[#1A1D23] ml-1">Hide</button>
              </div>
            ) : (
              <button onClick={handleShowPin} 
                className="w-fit inline-flex items-center gap-1.5 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] bg-white border border-[#26A96B]/25 hover:border-[#1D7A4A] px-4 py-2 rounded-lg transition-all shadow-sm mt-1">
                <Eye className="w-3.5 h-3.5" strokeWidth={1.75} />
                Reveal Portal Access PIN
              </button>
            )}
          </div>

          {/* Fee Access Override Card */}
          <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB] flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider flex items-center gap-1.5">
                <AlertTriangle className="w-3.5 h-3.5 text-[#6B7280]" />
                Fee Access Override
              </p>
              <p className="text-[11px] text-[#6B7280] font-semibold mt-1">
                When enabled, student can access attendance &amp; exam records even with outstanding dues.
              </p>
            </div>
            <div className="flex items-center justify-between mt-1">
              <span className={`text-xs font-bold ${student.feeAccessOverride ? 'text-[#854F0B]' : 'text-[#6B7280]'}`}>
                {student.feeAccessOverride ? 'Override Active' : 'Override Off'}
              </span>
              <button
                onClick={handleFeeOverrideToggle}
                disabled={feeOverrideLoading}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none disabled:opacity-50 ${
                  student.feeAccessOverride ? 'bg-[#F59E0B]' : 'bg-[#D1D5DB]'
                }`}
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white shadow transition-transform ${
                    student.feeAccessOverride ? 'translate-x-4' : 'translate-x-1'
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Email Invite Card */}
          <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB] flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-[#6B7280]" />
                Direct Email Invitation
              </p>
              <p className="text-[11px] text-[#6B7280] font-semibold mt-1">Email a secure, one-click invitation directly to the parent's personal mailbox.</p>
            </div>
            
            {showInviteParent ? (
              <form onSubmit={handleInviteParent} className="space-y-2 mt-1">
                <div className="flex gap-2">
                  <input required placeholder="First name" value={inviteName.firstName} onChange={(e) => setInviteName({ ...inviteName, firstName: e.target.value })} 
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] focus:border-[#1D7A4A] w-full" />
                  <input required placeholder="Last name" value={inviteName.lastName} onChange={(e) => setInviteName({ ...inviteName, lastName: e.target.value })} 
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] focus:border-[#1D7A4A] w-full" />
                </div>
                <div className="flex gap-2">
                  <input type="email" required placeholder="parent@email.com" value={inviteEmail} onChange={(e) => setInviteEmail(e.target.value)} 
                    className="border border-[#E5E7EB] rounded-lg px-2.5 py-1.5 text-xs bg-white focus:outline-none focus:ring-1 focus:ring-[#1D7A4A] focus:border-[#1D7A4A] flex-1" />
                  <button type="submit" disabled={inviting} 
                    className="px-3 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold disabled:opacity-60 transition-all shadow-sm">
                    {inviting ? '...' : 'Send'}
                  </button>
                  <button type="button" onClick={() => setShowInviteParent(false)} 
                    className="px-2.5 py-1.5 border border-[#E5E7EB] hover:bg-white bg-gray-50 rounded-lg text-xs font-semibold text-[#4B5563] transition-all">
                    Cancel
                  </button>
                </div>
              </form>
            ) : (
              <button onClick={() => setShowInviteParent(true)} 
                className="w-fit inline-flex items-center gap-1.5 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] bg-white border border-[#26A96B]/25 hover:border-[#1D7A4A] px-4 py-2 rounded-lg transition-all shadow-sm mt-1">
                <Plus className="w-3.5 h-3.5" strokeWidth={2.25} />
                Send Parent Invitation
              </button>
            )}
          </div>

          {/* Reset Password Card */}
          <div className="bg-[#F9FAFB] p-4 rounded-xl border border-[#E5E7EB] flex flex-col justify-between gap-3">
            <div>
              <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider flex items-center gap-1.5">
                <ShieldCheck className="w-3.5 h-3.5 text-[#6B7280]" />
                Reset Login Password
              </p>
              <p className="text-[11px] text-[#6B7280] font-semibold mt-1">
                Resets the student's password to the default pattern (aipsa + school name + admission number). Student must change it on next login.
              </p>
            </div>

            {resetResult ? (
              <div className="space-y-2 mt-1">
                <p className="text-[10px] text-[#6B7280] font-semibold uppercase tracking-wide">New temporary password:</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 font-mono text-sm font-bold text-[#1A1D23] bg-white border border-[#E5E7EB] rounded-lg px-3 py-1.5 tracking-wide break-all">
                    {resetResult}
                  </code>
                  <button
                    onClick={() => { navigator.clipboard.writeText(resetResult); setResetCopied(true); setTimeout(() => setResetCopied(false), 2000); }}
                    className="shrink-0 inline-flex items-center gap-1 text-xs border border-[#E5E7EB] bg-white font-bold px-3 py-2 rounded-lg hover:bg-gray-50 transition-all shadow-sm"
                  >
                    {resetCopied ? <Check className="w-3.5 h-3.5 text-[#0F6E56]" strokeWidth={2.5} /> : <Copy className="w-3.5 h-3.5 text-[#6B7280]" strokeWidth={1.75} />}
                    {resetCopied ? 'Copied' : 'Copy'}
                  </button>
                </div>
                <button onClick={() => setResetResult(null)} className="text-[10px] text-[#6B7280] hover:text-[#1A1D23] underline">Dismiss</button>
              </div>
            ) : (
              <button
                onClick={handleResetPassword}
                disabled={resettingPassword}
                className="w-fit inline-flex items-center gap-1.5 text-xs font-bold text-[#DC2626] hover:text-[#B91C1C] bg-white border border-[#FCA5A5] hover:border-[#DC2626] px-4 py-2 rounded-lg transition-all shadow-sm mt-1 disabled:opacity-50"
              >
                {resettingPassword ? 'Resetting...' : 'Reset to Default Password'}
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Guardians Registry */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <Users className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Registered Family Guardians</h3>
          </div>
          <button onClick={() => setAddingGuardian(true)} 
            className="inline-flex items-center gap-1 text-xs font-bold text-[#1D7A4A] hover:text-[#155B37] transition-all font-display">
            <Plus className="w-3.5 h-3.5" strokeWidth={2.5} /> Add Guardian
          </button>
        </div>

        <div className="space-y-3">
          {student.guardians.map((g) => (
            <div key={g.id} className="flex items-start justify-between p-3.5 bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl shadow-sm hover:border-[#1D7A4A]/10 transition-all">
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <span className="font-bold text-sm text-[#1A1D23]">{g.firstName} {g.lastName}</span>
                  <span className="inline-flex items-center px-2 py-0.5 bg-[#EEF2FF] text-[#4338CA] text-[10px] font-bold rounded-lg border border-[#EEF2FF]/30">{g.relation[0] + g.relation.slice(1).toLowerCase()}</span>
                  {g.isPrimary && <span className="inline-flex items-center px-2 py-0.5 bg-[#D6F0E4] text-[#0F6E56] text-[10px] font-bold rounded-lg border border-[#26A96B]/15">Primary Contact</span>}
                </div>
                <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-[#6B7280] font-medium pt-0.5">
                  {g.phone && <span className="flex items-center gap-1"><Phone className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.75} /> {g.phone}</span>}
                  {g.email && <span className="flex items-center gap-1"><Mail className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.75} /> {g.email}</span>}
                  {g.occupation && <span className="flex items-center gap-1"><Briefcase className="w-3.5 h-3.5 text-[#9CA3AF]" strokeWidth={1.75} /> {g.occupation}</span>}
                </div>
              </div>
              <button onClick={() => handleDeleteGuardian(g.id)} 
                className="inline-flex items-center justify-center p-1.5 rounded-lg hover:bg-[#FEF2F2] text-[#DC2626] hover:text-[#B91C1C] transition-all ml-4 shrink-0">
                <Trash2 className="w-4 h-4" strokeWidth={1.75} />
              </button>
            </div>
          ))}
          {student.guardians.length === 0 && (
            <p className="text-xs text-[#9CA3AF] font-semibold italic text-center py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">No mapped guardians enrolled in this student's profile registry.</p>
          )}
        </div>

        {addingGuardian && (
          <form onSubmit={handleAddGuardian} className="mt-4 p-5 border border-[#E5E7EB] bg-[#F9FAFB]/50 rounded-xl space-y-4 shadow-inner">
            <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider pb-1 border-b border-[#E5E7EB]">Enlist New Guardian</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {(['firstName', 'lastName', 'phone', 'email', 'occupation'] as const).map((key) => (
                <div key={key} className="space-y-1">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{key.replace(/([A-Z])/g, ' $1')}</label>
                  <input value={newGuardian[key]} onChange={(e) => setNewGuardian({ ...newGuardian, [key]: e.target.value })} 
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                </div>
              ))}
              <div className="space-y-1">
                <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Relation</label>
                <select value={newGuardian.relation} onChange={(e) => setNewGuardian({ ...newGuardian, relation: e.target.value })} 
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                  {['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER'].map((r) => <option key={r} value={r}>{r[0] + r.slice(1).toLowerCase()}</option>)}
                </select>
              </div>
            </div>
            
            <label className="flex items-center gap-2 text-xs font-semibold text-[#4B5563] cursor-pointer pt-1 w-fit">
              <input type="checkbox" checked={newGuardian.isPrimary} onChange={(e) => setNewGuardian({ ...newGuardian, isPrimary: e.target.checked })} 
                className="rounded border-[#E5E7EB] text-[#1D7A4A] focus:ring-[#1D7A4A]/20" />
              Set as primary family contact
            </label>
            
            <div className="flex gap-2.5 pt-1">
              <button type="submit" className="px-4 py-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm">Add Guardian</button>
              <button type="button" onClick={() => setAddingGuardian(false)} 
                className="px-4 py-2 border border-[#E5E7EB] hover:bg-white bg-gray-50 rounded-lg text-xs font-semibold text-[#4B5563] transition-all">Cancel</button>
            </div>
          </form>
        )}
      </div>
      {/* ── Attendance — Current Month ─────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F3F4F6]">
          <CalendarCheck className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
          <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Attendance — {monthName}</h3>
        </div>

        {attendance ? (
          <>
            {/* Summary chips */}
            <div className="flex flex-wrap gap-3">
              <div className="flex items-center gap-2 px-3 py-2 bg-[#D6F0E4] border border-[#26A96B]/15 rounded-lg">
                <span className="text-[11px] font-bold text-[#0F6E56] uppercase tracking-wider">Present</span>
                <span className="font-mono font-black text-[#0F6E56] text-base">{attendance.summary.present}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FEF2F2] border border-[#FCA5A5]/30 rounded-lg">
                <span className="text-[11px] font-bold text-[#DC2626] uppercase tracking-wider">Absent</span>
                <span className="font-mono font-black text-[#DC2626] text-base">{attendance.summary.absent}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#FAEEDA] border border-[#F59E0B]/15 rounded-lg">
                <span className="text-[11px] font-bold text-[#854F0B] uppercase tracking-wider">Late</span>
                <span className="font-mono font-black text-[#854F0B] text-base">{attendance.summary.late}</span>
              </div>
              <div className="flex items-center gap-2 px-3 py-2 bg-[#F3F4F6] border border-[#E5E7EB] rounded-lg">
                <span className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Attendance</span>
                <span className={`font-mono font-black text-base ${attendance.summary.percentage >= 75 ? 'text-[#0F6E56]' : 'text-[#DC2626]'}`}>
                  {attendance.summary.percentage}%
                </span>
              </div>
            </div>

            {/* Exception days */}
            {(() => {
              const exceptions = attendance.records.filter((r) => r.status === 'ABSENT' || r.status === 'LATE');
              return exceptions.length > 0 ? (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Exceptions this month</p>
                  <div className="divide-y divide-[#F3F4F6] border border-[#E5E7EB] rounded-xl overflow-hidden">
                    {exceptions.map((r) => (
                      <div key={r.id} className="flex items-center justify-between px-3.5 py-2.5 bg-white hover:bg-[#F9FAFB] transition-colors">
                        <span className="text-sm font-semibold text-[#1A1D23]">
                          {new Date(r.date).toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' })}
                        </span>
                        <div className="flex items-center gap-2.5">
                          {r.note && <span className="text-xs text-[#6B7280] font-medium italic">{r.note}</span>}
                          <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            r.status === 'ABSENT'
                              ? 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]/30'
                              : 'bg-[#FAEEDA] text-[#854F0B] border border-[#F59E0B]/15'
                          }`}>
                            {r.status[0] + r.status.slice(1).toLowerCase()}
                          </span>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ) : (
                <p className="text-xs text-[#9CA3AF] font-semibold italic text-center py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">
                  No absences or late marks this month.
                </p>
              );
            })()}
          </>
        ) : (
          <p className="text-xs text-[#9CA3AF] animate-pulse font-semibold">Loading attendance…</p>
        )}
      </div>

      {/* ── Exam Marks ─────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F3F4F6]">
          <Award className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
          <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">
            Exam Marks{reportCard ? ` — ${reportCard.academicYear}` : ''}
          </h3>
        </div>

        {reportCard ? (
          reportCard.examSummaries.length === 0 ? (
            <p className="text-xs text-[#9CA3AF] font-semibold italic text-center py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">
              No completed exams for this academic year.
            </p>
          ) : (
            <div className="space-y-4">
              {[...reportCard.examSummaries].reverse().map(({ exam, results, percentage, overallGrade }) => (
                <div key={exam.id} className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                  {/* Exam header */}
                  <div className="bg-[#F9FAFB] px-4 py-3 flex items-center justify-between border-b border-[#E5E7EB]">
                    <div>
                      <p className="text-sm font-bold text-[#1A1D23]">{exam.name}</p>
                      <p className="text-[11px] text-[#6B7280] font-semibold mt-0.5">
                        {new Date(exam.startDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                        {exam.endDate
                          ? ` – ${new Date(exam.endDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}`
                          : ''}
                      </p>
                    </div>
                    {overallGrade && (
                      <div className="text-right shrink-0 ml-4">
                        <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Overall</p>
                        <div className="flex items-center gap-2 mt-0.5 justify-end">
                          <span className="font-mono font-black text-[#1D7A4A] text-lg">{overallGrade}</span>
                          <span className="text-xs text-[#6B7280] font-semibold">{percentage}%</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Subject rows */}
                  {results.length === 0 ? (
                    <p className="text-xs text-[#9CA3AF] font-semibold italic px-4 py-3">No marks entered yet.</p>
                  ) : (
                    <div className="overflow-x-auto">
                      <table className="w-full text-sm">
                        <thead>
                          <tr className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider border-b border-[#F3F4F6]">
                            <th className="text-left px-4 py-2">Subject</th>
                            <th className="text-center px-4 py-2">Marks</th>
                            <th className="text-center px-4 py-2">Grade</th>
                            <th className="text-center px-4 py-2">Status</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-[#F9FAFB]">
                          {results.map((r) => {
                            const pass =
                              !r.isAbsent &&
                              r.marksObtained !== null &&
                              (r.marksObtained / exam.maxMarks) * 100 >= exam.passingMarks;
                            return (
                              <tr key={r.id} className="hover:bg-[#F9FAFB] transition-colors">
                                <td className="px-4 py-2.5 font-semibold text-[#1A1D23]">{r.subject.name}</td>
                                <td className="px-4 py-2.5 text-center font-mono font-bold text-[#4B5563]">
                                  {r.isAbsent
                                    ? '—'
                                    : r.marksObtained !== null
                                    ? `${r.marksObtained}/${exam.maxMarks}`
                                    : '—'}
                                </td>
                                <td className="px-4 py-2.5 text-center font-bold text-[#4B5563]">
                                  {r.isAbsent ? '—' : r.grade ?? '—'}
                                </td>
                                <td className="px-4 py-2.5 text-center">
                                  {r.isAbsent ? (
                                    <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#F3F4F6] text-[#6B7280] border border-[#E5E7EB]">
                                      Absent
                                    </span>
                                  ) : r.marksObtained !== null ? (
                                    <span
                                      className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                                        pass
                                          ? 'bg-[#D6F0E4] text-[#0F6E56] border border-[#26A96B]/15'
                                          : 'bg-[#FEF2F2] text-[#DC2626] border border-[#FCA5A5]/30'
                                      }`}
                                    >
                                      {pass ? 'Pass' : 'Fail'}
                                    </span>
                                  ) : (
                                    <span className="text-[10px] text-[#9CA3AF] font-semibold italic">Pending</span>
                                  )}
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )
        ) : (
          <p className="text-xs text-[#9CA3AF] animate-pulse font-semibold">Loading marks…</p>
        )}
      </div>

      {/* ── Fee Account ────────────────────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center gap-2 pb-3 border-b border-[#F3F4F6]">
          <IndianRupee className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
          <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">
            Fee Account{feeAccount ? ` — ${feeAccount.academicYear}` : ''}
          </h3>
        </div>

        {feeAccount ? (
          <>
            {/* Summary bar */}
            <div className="grid grid-cols-3 gap-3">
              <div className="bg-[#F9FAFB] border border-[#E5E7EB] rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider">Total Due</p>
                <p className="font-mono font-black text-[#1A1D23] text-lg mt-0.5">
                  ₹{feeAccount.summary.totalStructure.toLocaleString('en-IN')}
                </p>
              </div>
              <div className="bg-[#D6F0E4] border border-[#26A96B]/15 rounded-xl p-3 text-center">
                <p className="text-[11px] font-bold text-[#0F6E56] uppercase tracking-wider">Paid</p>
                <p className="font-mono font-black text-[#0F6E56] text-lg mt-0.5">
                  ₹{feeAccount.summary.totalPaid.toLocaleString('en-IN')}
                </p>
              </div>
              <div
                className={`rounded-xl p-3 text-center border ${
                  feeAccount.summary.totalDue > 0
                    ? 'bg-[#FEF2F2] border-[#FCA5A5]/30'
                    : 'bg-[#D6F0E4] border-[#26A96B]/15'
                }`}
              >
                <p className={`text-[11px] font-bold uppercase tracking-wider ${feeAccount.summary.totalDue > 0 ? 'text-[#DC2626]' : 'text-[#0F6E56]'}`}>
                  Balance
                </p>
                <p className={`font-mono font-black text-lg mt-0.5 ${feeAccount.summary.totalDue > 0 ? 'text-[#DC2626]' : 'text-[#0F6E56]'}`}>
                  {feeAccount.summary.totalDue > 0
                    ? `₹${feeAccount.summary.totalDue.toLocaleString('en-IN')} due`
                    : 'Cleared'}
                </p>
              </div>
              {feeAccount.summary.totalLateFee > 0 && (
                <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 rounded-xl p-3 text-center col-span-3 md:col-span-1">
                  <p className="text-[11px] font-bold text-[#854F0B] uppercase tracking-wider">Late Fee</p>
                  <p className="font-mono font-black text-[#854F0B] text-lg mt-0.5">
                    +₹{feeAccount.summary.totalLateFee.toLocaleString('en-IN')}
                  </p>
                </div>
              )}
            </div>

            {/* Late Fee Charges */}
            {feeAccount.lateFeePolicy.lateFeeAmount > 0 && feeAccount.breakdown.some(b => b.lateFeeApplicable) && (
              <div className="space-y-1.5">
                <p className="text-[11px] font-bold text-[#854F0B] uppercase tracking-wider">Late Fee Charges</p>
                <div className="divide-y divide-[#F3F4F6] border border-[#F59E0B]/20 rounded-xl overflow-hidden">
                  {feeAccount.breakdown.filter(b => b.lateFeeApplicable).map(b => (
                    <div key={b.structureId} className="flex items-center justify-between px-4 py-3 bg-[#FAEEDA]/30 hover:bg-[#FAEEDA]/50 transition-colors">
                      <div>
                        <p className="text-sm font-semibold text-[#1A1D23]">{b.feeCategoryName}</p>
                        <p className="text-[11px] text-[#854F0B] font-semibold mt-0.5">
                          {b.daysOverdue} day{b.daysOverdue !== 1 ? 's' : ''} overdue
                          {b.lateFeeWaived && <span className="ml-1.5 text-[#0F6E56]">· Waived</span>}
                        </p>
                      </div>
                      <div className="flex items-center gap-3 ml-4 shrink-0">
                        {!b.lateFeeWaived && (
                          <span className="font-mono font-bold text-[#854F0B] text-sm">
                            +₹{feeAccount.lateFeePolicy.lateFeeAmount.toLocaleString('en-IN')}
                          </span>
                        )}
                        <button
                          onClick={async () => {
                            if (!id) return;
                            if (b.lateFeeWaived) {
                              await api.delete(`/fees/students/${id}/late-fee-waiver`, { data: { feeStructureId: b.structureId, academicYear: feeAccount.academicYear } });
                            } else {
                              await api.post(`/fees/students/${id}/late-fee-waiver`, { feeStructureId: b.structureId, academicYear: feeAccount.academicYear });
                            }
                            api.get(`/fees/students/${id}/account`).then(r => setFeeAccount(r.data)).catch(console.error);
                          }}
                          className={`text-[11px] font-bold px-2.5 py-1 rounded-lg border transition-all ${
                            b.lateFeeWaived
                              ? 'bg-[#FEF2F2] text-[#DC2626] border-[#FCA5A5]/30 hover:bg-[#FEF2F2]/80'
                              : 'bg-[#D6F0E4] text-[#0F6E56] border-[#26A96B]/15 hover:bg-[#D6F0E4]/80'
                          }`}
                        >
                          {b.lateFeeWaived ? 'Remove Waiver' : 'Waive'}
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Payment history */}
            {feeAccount.payments.length === 0 ? (
              <p className="text-xs text-[#9CA3AF] font-semibold italic text-center py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">
                No payments recorded yet.
              </p>
            ) : (
              <div>
                <p className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider mb-2">Payment History</p>
                <div className="border border-[#E5E7EB] rounded-xl overflow-hidden">
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="text-[11px] font-bold text-[#6B7280] uppercase tracking-wider bg-[#F9FAFB] border-b border-[#E5E7EB]">
                          <th className="text-left px-4 py-2.5">Date</th>
                          <th className="text-left px-4 py-2.5">Category</th>
                          <th className="text-right px-4 py-2.5">Amount</th>
                          <th className="text-center px-4 py-2.5">Method</th>
                          <th className="text-left px-4 py-2.5">Receipt</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-[#F9FAFB]">
                        {feeAccount.payments.map((p) => (
                          <tr key={p.id} className="hover:bg-[#F9FAFB] transition-colors">
                            <td className="px-4 py-2.5 text-[#4B5563] font-semibold whitespace-nowrap">
                              {new Date(p.paidAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                            </td>
                            <td className="px-4 py-2.5 font-semibold text-[#1A1D23]">{p.feeCategory.name}</td>
                            <td className="px-4 py-2.5 text-right font-mono font-bold text-[#0F6E56]">
                              ₹{p.amount.toLocaleString('en-IN')}
                            </td>
                            <td className="px-4 py-2.5 text-center">
                              <span className="px-2 py-0.5 rounded-full text-[10px] font-bold bg-[#EEF2FF] text-[#4338CA] border border-[#4338CA]/10">
                                {p.method[0] + p.method.slice(1).toLowerCase().replace('_', ' ')}
                              </span>
                            </td>
                            <td className="px-4 py-2.5 font-mono text-xs text-[#6B7280] font-semibold">
                              {p.receiptNumber}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            )}
          </>
        ) : (
          <p className="text-xs text-[#9CA3AF] animate-pulse font-semibold">Loading fees…</p>
        )}
      </div>

      {/* ── Miscellaneous Activities ───────────────────────────────────────── */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-3 border-b border-[#F3F4F6]">
          <div className="flex items-center gap-2">
            <Sparkles className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Miscellaneous Activities</h3>
          </div>
          {!addingActivity && (
            <button
              onClick={() => setAddingActivity(true)}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5" strokeWidth={2.5} />
              Add Activity
            </button>
          )}
        </div>

        {/* Add Activity Form */}
        {addingActivity && (
          <div className="border border-[#E5E7EB] rounded-xl p-4 bg-[#F9FAFB] space-y-3">
            <p className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">New Activity Record</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Type</label>
                <select
                  value={activityForm.type}
                  onChange={(e) => setActivityForm({ ...activityForm, type: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                >
                  <option value="REMARK">Remark</option>
                  <option value="ACHIEVEMENT">Achievement</option>
                  <option value="DISCIPLINARY">Disciplinary</option>
                </select>
              </div>
              <div className="space-y-1.5">
                <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Date</label>
                <input
                  type="date"
                  value={activityForm.date}
                  onChange={(e) => setActivityForm({ ...activityForm, date: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Title</label>
              <input
                type="text"
                value={activityForm.title}
                onChange={(e) => setActivityForm({ ...activityForm, title: e.target.value })}
                placeholder="Brief title for this activity"
                className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A]"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Description <span className="normal-case font-medium text-[#9CA3AF]">(optional)</span></label>
              <textarea
                value={activityForm.description}
                onChange={(e) => setActivityForm({ ...activityForm, description: e.target.value })}
                placeholder="Additional details…"
                rows={3}
                className="w-full border border-[#E5E7EB] rounded-lg py-2.5 px-3 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] resize-none"
              />
            </div>
            <div className="flex gap-2 justify-end">
              <button
                onClick={() => { setAddingActivity(false); setActivityForm({ type: 'REMARK', title: '', description: '', date: new Date().toISOString().split('T')[0] }); }}
                className="px-3.5 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold text-[#4B5563] hover:bg-white transition-all"
              >
                Cancel
              </button>
              <button
                disabled={activitySaving || !activityForm.title.trim() || !activityForm.date}
                onClick={async () => {
                  if (!id) return;
                  setActivitySaving(true);
                  try {
                    const { data } = await api.post(`/sis/students/${id}/activities`, activityForm);
                    setActivities([data, ...activities]);
                    setAddingActivity(false);
                    setActivityForm({ type: 'REMARK', title: '', description: '', date: new Date().toISOString().split('T')[0] });
                  } catch (err: any) {
                    setError(err.response?.data?.error || 'Failed to save activity.');
                  } finally { setActivitySaving(false); }
                }}
                className="px-3.5 py-1.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white rounded-lg text-xs font-bold transition-all shadow-sm disabled:opacity-60"
              >
                {activitySaving ? 'Saving…' : 'Save Activity'}
              </button>
            </div>
          </div>
        )}

        {/* Activities List */}
        {!activitiesLoaded ? (
          <p className="text-xs text-[#9CA3AF] animate-pulse font-semibold">Loading activities…</p>
        ) : activities.length === 0 ? (
          <p className="text-xs text-[#9CA3AF] font-semibold italic text-center py-4 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">
            No activity records yet.
          </p>
        ) : (
          <div className="space-y-2">
            {activities.map((act) => {
              const meta = ACTIVITY_META[act.type];
              const Icon = meta.Icon;
              return (
                <div key={act.id} className="flex items-start gap-3 p-3.5 border border-[#E5E7EB] rounded-xl hover:bg-[#F9FAFB] transition-colors">
                  <div className={`w-8 h-8 rounded-lg flex items-center justify-center shrink-0 ${meta.bg} ${meta.border} border`}>
                    <Icon className={`w-4 h-4 ${meta.text}`} strokeWidth={1.75} />
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full border ${meta.bg} ${meta.text} ${meta.border}`}>
                        {meta.label}
                      </span>
                      <p className="text-sm font-semibold text-[#1A1D23]">{act.title}</p>
                    </div>
                    {act.description && (
                      <p className="text-xs text-[#4B5563] mt-1 leading-relaxed">{act.description}</p>
                    )}
                    <p className="text-[11px] text-[#9CA3AF] font-semibold mt-1.5">
                      {new Date(act.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      {' · '}Added by {act.addedBy.firstName} {act.addedBy.lastName}
                    </p>
                  </div>
                  <button
                    onClick={async () => {
                      if (!confirm('Delete this activity record?')) return;
                      try {
                        await api.delete(`/sis/activities/${act.id}`);
                        setActivities(activities.filter((a) => a.id !== act.id));
                      } catch (err: any) {
                        setError(err.response?.data?.error || 'Failed to delete.');
                      }
                    }}
                    className="p-1.5 rounded-lg text-[#9CA3AF] hover:text-[#DC2626] hover:bg-[#FEF2F2] transition-colors shrink-0"
                    title="Delete activity"
                  >
                    <X className="w-3.5 h-3.5" strokeWidth={2} />
                  </button>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}