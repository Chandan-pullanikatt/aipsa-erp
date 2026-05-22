'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import Link from 'next/link';
import api from '@/lib/api';
import { 
  User, 
  GraduationCap, 
  Users, 
  ArrowLeft, 
  Calendar, 
  MapPin, 
  Mail, 
  Briefcase, 
  Phone,
  AlertTriangle,
  Heart,
  ShieldAlert
} from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface Section { id: string; name: string; }

const GENDERS = ['MALE', 'FEMALE', 'OTHER'];
const BLOOD_GROUPS = ['A+', 'A-', 'B+', 'B-', 'AB+', 'AB-', 'O+', 'O-'];

export default function NewStudentPage() {
  const router = useRouter();
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [form, setForm] = useState({
    firstName: '', lastName: '', dateOfBirth: '', gender: '',
    bloodGroup: '', address: '', city: '', state: '', phone: '',
    classId: '', sectionId: '', admissionDate: new Date().toISOString().split('T')[0],
  });
  const [guardian, setGuardian] = useState({
    firstName: '', lastName: '', relation: 'FATHER', phone: '', email: '', occupation: '',
  });
  const [addGuardian, setAddGuardian] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/sis/classes').then((r) => setClasses(r.data)).catch(console.error); }, []);

  useEffect(() => {
    if (form.classId) {
      api.get(`/sis/classes/${form.classId}/sections`).then((r) => setSections(r.data)).catch(console.error);
      setForm((f) => ({ ...f, sectionId: '' }));
    } else {
      setSections([]);
    }
  }, [form.classId]);

  function set(key: string, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      const { data: student } = await api.post('/sis/students', form);
      if (addGuardian && guardian.firstName && guardian.phone) {
        await api.post(`/sis/students/${student.id}/guardians`, { ...guardian, isPrimary: true });
      }
      router.push(`/school/students/${student.id}`);
    } catch (err: any) {
      setError(err.response?.data?.error || err.response?.data?.errors?.[0]?.msg || 'Failed to admit student.');
      setLoading(false);
    }
  }

  function field(label: string, key: string, type = 'text', placeholder = '', required = false, icon: React.ReactNode = null) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">
          {label}
          {required && <span className="text-[#DC2626] ml-1">*</span>}
        </label>
        <div className="relative flex items-center">
          {icon && <div className="absolute left-3 text-[#9CA3AF] pointer-events-none">{icon}</div>}
          <input
            type={type}
            required={required}
            value={(form as any)[key]}
            onChange={(e) => set(key, e.target.value)}
            placeholder={placeholder}
            className={`w-full border border-[#E5E7EB] rounded-lg py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all ${
              icon ? 'pl-10 pr-3.5' : 'px-3.5'
            }`}
          />
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      {/* Top bar header */}
      <div className="flex flex-col gap-4 pb-6 border-b border-[#E5E7EB]">
        <Link href="/school/students" className="inline-flex items-center gap-1.5 text-xs font-bold text-[#6B7280] hover:text-[#1A1D23] transition-colors w-fit">
          <ArrowLeft className="w-3.5 h-3.5" strokeWidth={2.5} /> Back to Directory
        </Link>
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">Student Admission</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Enroll a new pupil into your school registry, allocate classrooms, and map primary guardians.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="space-y-6">
        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-sm rounded-lg px-4 py-3 flex gap-2 items-center shadow-sm animate-pulse">
            <ShieldAlert className="w-5 h-5 text-[#DC2626] shrink-0" strokeWidth={1.75} />
            <span className="font-semibold">{error}</span>
          </div>
        )}

        {/* Section 1: Personal Info */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <User className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Personal Details</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('First Name', 'firstName', 'text', 'E.g. Rahul', true, <User className="w-4 h-4" strokeWidth={1.75} />)}
            {field('Last Name', 'lastName', 'text', 'E.g. Sharma', true, <User className="w-4 h-4" strokeWidth={1.75} />)}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Date of Birth', 'dateOfBirth', 'date', '', false, <Calendar className="w-4 h-4" strokeWidth={1.75} />)}
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Gender</label>
              <select value={form.gender} onChange={(e) => set('gender', e.target.value)} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                <option value="">Select gender</option>
                {GENDERS.map((g) => <option key={g} value={g}>{g[0] + g.slice(1).toLowerCase()}</option>)}
              </select>
            </div>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Blood Group</label>
              <select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                <option value="">Select blood type</option>
                {BLOOD_GROUPS.map((b) => <option key={b} value={b}>{b}</option>)}
              </select>
            </div>
            {field('Contact Phone', 'phone', 'tel', '+91 98765 43210', false, <Phone className="w-4 h-4" strokeWidth={1.75} />)}
          </div>
          
          {field('Residential Address', 'address', 'text', '123 Main Street', false, <MapPin className="w-4 h-4" strokeWidth={1.75} />)}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('City', 'city', 'text', 'Mumbai')}
            {field('State / Province', 'state', 'text', 'Maharashtra')}
          </div>
        </div>

        {/* Section 2: Class & Admission */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-5 shadow-sm">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <GraduationCap className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Classroom Allocation</h3>
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Class Grade</label>
              <select value={form.classId} onChange={(e) => set('classId', e.target.value)} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                <option value="">Select class</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Section Division</label>
              <select value={form.sectionId} onChange={(e) => set('sectionId', e.target.value)} 
                disabled={!form.classId || sections.length === 0} 
                className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all disabled:bg-[#F3F4F6] disabled:text-[#9CA3AF] disabled:cursor-not-allowed">
                <option value="">Select section</option>
                {sections.map((s) => <option key={s.id} value={s.id}>Section {s.name}</option>)}
              </select>
            </div>
          </div>
          {field('Official Admission Date', 'admissionDate', 'date', '', false, <Calendar className="w-4 h-4" strokeWidth={1.75} />)}
        </div>

        {/* Section 3: Guardian */}
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 space-y-5 shadow-sm">
          <div className="flex items-center justify-between pb-2 border-b border-[#F3F4F6]">
            <div className="flex items-center gap-2">
              <Users className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
              <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Primary Guardian Registry</h3>
            </div>
            <label className="flex items-center gap-2 text-xs font-semibold text-[#4B5563] cursor-pointer">
              <input type="checkbox" checked={addGuardian} onChange={(e) => setAddGuardian(e.target.checked)} 
                className="rounded border-[#E5E7EB] text-[#1D7A4A] focus:ring-[#1D7A4A]/20" />
              Add credentials now
            </label>
          </div>
          
          {addGuardian && (
            <div className="space-y-4 pt-1">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">First Name</label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                    <input value={guardian.firstName} onChange={(e) => setGuardian({ ...guardian, firstName: e.target.value })} 
                      className="w-full border border-[#E5E7EB] rounded-lg pl-10 pr-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" placeholder="E.g. Suresh" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Last Name</label>
                  <div className="relative flex items-center">
                    <User className="absolute left-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                    <input value={guardian.lastName} onChange={(e) => setGuardian({ ...guardian, lastName: e.target.value })} 
                      className="w-full border border-[#E5E7EB] rounded-lg pl-10 pr-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" placeholder="E.g. Sharma" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Family Relation</label>
                  <select value={guardian.relation} onChange={(e) => setGuardian({ ...guardian, relation: e.target.value })} 
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all">
                    {['FATHER','MOTHER','GUARDIAN','SIBLING','OTHER'].map((r) => <option key={r} value={r}>{r[0]+r.slice(1).toLowerCase()}</option>)}
                  </select>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Phone Number</label>
                  <div className="relative flex items-center">
                    <Phone className="absolute left-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                    <input value={guardian.phone} onChange={(e) => setGuardian({ ...guardian, phone: e.target.value })} 
                      placeholder="+91 98765 43210" className="w-full border border-[#E5E7EB] rounded-lg pl-10 pr-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                  </div>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Email Address</label>
                  <div className="relative flex items-center">
                    <Mail className="absolute left-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                    <input type="email" value={guardian.email} onChange={(e) => setGuardian({ ...guardian, email: e.target.value })} 
                      placeholder="parent@email.com" className="w-full border border-[#E5E7EB] rounded-lg pl-10 pr-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                  </div>
                </div>
                <div className="space-y-1.5">
                  <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Occupation</label>
                  <div className="relative flex items-center">
                    <Briefcase className="absolute left-3 w-4 h-4 text-[#9CA3AF] pointer-events-none" strokeWidth={1.75} />
                    <input value={guardian.occupation} onChange={(e) => setGuardian({ ...guardian, occupation: e.target.value })} 
                      placeholder="E.g. Engineer / Business" className="w-full border border-[#E5E7EB] rounded-lg pl-10 pr-3.5 py-2 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all" />
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        {/* Action Buttons */}
        <div className="flex gap-4">
          <button type="submit" disabled={loading} 
            className="flex-1 bg-[#1D7A4A] hover:bg-[#155B37] text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-60 transition-all shadow-sm">
            {loading ? 'Admitting New Student...' : 'Finalise Student Admission'}
          </button>
          <Link href="/school/students" 
            className="px-5 py-2.5 border border-[#E5E7EB] bg-white text-[#4B5563] font-semibold hover:bg-gray-50 rounded-lg text-sm transition-all text-center">
            Cancel
          </Link>
        </div>
      </form>
    </div>
  );
}
