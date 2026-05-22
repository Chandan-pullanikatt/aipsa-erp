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
  Edit3
} from 'lucide-react';

interface Student {
  id: string; admissionNumber: string; firstName: string; lastName: string;
  dateOfBirth: string | null; gender: string | null; bloodGroup: string | null;
  address: string | null; city: string | null; state: string | null; phone: string | null;
  status: string; admissionDate: string;
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
  const [inviteEmail, setInviteEmail] = useState('');
  const [inviteName, setInviteName] = useState({ firstName: '', lastName: '' });
  const [showInviteParent, setShowInviteParent] = useState(false);
  const [inviting, setInviting] = useState(false);
  const [inviteSuccess, setInviteSuccess] = useState('');

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

  async function handleShowPin() {
    if (!id) return;
    const { data } = await api.get(`/sis/students/${id}/portal-pin`);
    setPortalPin(data.portalPin);
    setShowPin(true);
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

  return (
    <div className="max-w-3xl space-y-6 pb-12">
      {/* Top bar header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-[#E5E7EB]">
        <Link href="/school/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] hover:text-[#1A1D23] transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> Back to Directory
        </Link>
        <div className="flex flex-wrap items-center gap-3">
          <div className="w-12 h-12 rounded-full bg-[#E5F6EE] text-[#1D7A4A] flex items-center justify-center font-bold text-lg border border-[#26A96B]/15">
            {student.firstName[0]}{student.lastName[0]}
          </div>
          <div>
            <h1 className="font-display text-[26px] sm:text-[32px] font-bold leading-tight text-[#1A1D23]">{student.firstName} {student.lastName}</h1>
            <div className="flex items-center gap-2 mt-0.5">
              <span className="font-mono text-xs font-semibold text-[#6B7280] bg-[#F3F4F6] px-2 py-0.5 rounded border border-[#E5E7EB]">{student.admissionNumber}</span>
              <span className={`px-2.5 py-0.5 rounded-full text-xs font-bold ${STATUS_STYLE[student.status]}`}>{student.status}</span>
            </div>
          </div>
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
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6 pt-1">
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
    </div>
  );
}