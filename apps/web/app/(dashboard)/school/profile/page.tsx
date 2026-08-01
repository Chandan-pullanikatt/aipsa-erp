'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { clearBranding } from '@/lib/branding';
import {
  School,
  MapPin,
  Phone,
  Mail,
  Globe,
  Calendar,
  Award,
  Save,
  Check,
  AlertTriangle,
  Activity,
  IndianRupee,
  GraduationCap,
  ImagePlus,
  Trash2,
} from 'lucide-react';

interface Profile {
  schoolName: string;
  address: string;
  city: string;
  state: string;
  country: string;
  phone: string;
  email: string;
  website: string;
  board: string;
  logo: string;
  establishedYear: string;
  lateFeeAmount: string;
  lateFeeGraceDays: string;
  premiumLmsPrice: string;
}

const EMPTY: Profile = {
  schoolName: '', address: '', city: '', state: '', country: 'India',
  phone: '', email: '', website: '', board: '', logo: '', establishedYear: '',
  lateFeeAmount: '0', lateFeeGraceDays: '0', premiumLmsPrice: '',
};

export default function SchoolProfilePage() {
  const [form, setForm] = useState<Profile>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [success, setSuccess] = useState(false);
  const [error, setError] = useState('');
  const [uploadingLogo, setUploadingLogo] = useState(false);

  useEffect(() => {
    api.get('/schools/profile').then((r) => {
      if (r.data) {
        setForm({
          schoolName: r.data.schoolName ?? '',
          address: r.data.address ?? '',
          city: r.data.city ?? '',
          state: r.data.state ?? '',
          country: r.data.country ?? 'India',
          phone: r.data.phone ?? '',
          email: r.data.email ?? '',
          website: r.data.website ?? '',
          board: r.data.board ?? '',
          logo: r.data.logo ?? '',
          establishedYear: r.data.establishedYear ? String(r.data.establishedYear) : '',
          lateFeeAmount: String(r.data.lateFeeAmount ?? 0),
          lateFeeGraceDays: String(r.data.lateFeeGraceDays ?? 0),
          premiumLmsPrice: r.data.premiumLmsPrice != null ? String(r.data.premiumLmsPrice) : '',
        });
      }
    }).catch(console.error).finally(() => setLoading(false));
  }, []);

  async function handleLogo(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    e.target.value = ''; // allow re-picking the same file after a failure
    if (!file) return;
    setError('');
    setUploadingLogo(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      fd.append('folder', 'branding');
      const { data } = await api.post('/uploads', fd, { headers: { 'Content-Type': undefined } as any });
      setForm((f) => ({ ...f, logo: data.url }));
    } catch (err: any) {
      setError(err.response?.data?.error || 'Logo upload failed. Please try again.');
    } finally {
      setUploadingLogo(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    setSaving(true);
    try {
      await api.put('/schools/profile', {
        ...form,
        establishedYear: form.establishedYear ? parseInt(form.establishedYear) : undefined,
        lateFeeAmount: parseFloat(form.lateFeeAmount) || 0,
        lateFeeGraceDays: parseInt(form.lateFeeGraceDays) || 0,
        premiumLmsPrice: form.premiumLmsPrice !== '' ? parseFloat(form.premiumLmsPrice) : null,
      });
      clearBranding(); // sidebar picks up the new logo / name on the next render
      setSuccess(true);
      setTimeout(() => setSuccess(false), 3000);
    } catch {
      setError('Failed to save. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  function field(label: string, key: keyof Profile, type = 'text', placeholder = '', icon: React.ReactNode = null) {
    return (
      <div className="space-y-1.5">
        <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">{label}</label>
        <div className="relative flex items-center">
          {icon && <div className="absolute left-3 text-[#9CA3AF] pointer-events-none">{icon}</div>}
          <input
            type={type}
            value={form[key]}
            onChange={(e) => setForm({ ...form, [key]: e.target.value })}
            placeholder={placeholder}
            className={`w-full border border-[#E5E7EB] rounded-lg py-2.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all ${
              icon ? 'pl-10 pr-3.5' : 'px-3.5'
            }`}
          />
        </div>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="max-w-2xl space-y-6">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1D7A4A] bg-[#E5F6EE] px-4 py-3 rounded-lg border border-[#26A96B]/10 animate-pulse w-fit">
          <Activity className="w-4 h-4 animate-spin text-[#1D7A4A]" />
          <span>Synchronizing School Profile Matrix...</span>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-2xl space-y-6 pb-12">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 pb-6 border-b border-[#E5E7EB]">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-[#1A1D23]">School Settings</h1>
          <p className="font-body text-[14px] text-[#6B7280] mt-1">
            Manage your institution's registration details, location, and administrative parameters.
          </p>
        </div>
      </div>

      <form onSubmit={handleSubmit} className="bg-white rounded-xl border border-[#E5E7EB] p-6 space-y-6 shadow-sm">
        {error && (
          <div className="bg-[#FEF2F2] border border-[#FCA5A5] text-[#DC2626] text-sm rounded-lg px-4 py-3 flex gap-2 items-center">
            <AlertTriangle className="w-5 h-5 text-[#DC2626] shrink-0" strokeWidth={1.75} />
            <span className="font-semibold">{error}</span>
          </div>
        )}
        {success && (
          <div className="bg-[#D6F0E4] border border-[#26A96B]/20 text-[#0F6E56] text-sm rounded-lg px-4 py-3 flex gap-2 items-center">
            <Check className="w-5 h-5 text-[#0F6E56] shrink-0" strokeWidth={2} />
            <span className="font-semibold">School profile updated successfully.</span>
          </div>
        )}

        {/* Section 1: School Identity */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <School className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Institution Identity</h3>
          </div>
          {/* School logo — shown in the sidebar of every portal (admin, teacher, parent, student). */}
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">School Logo</label>
            <div className="flex items-center gap-4">
              <div className="w-20 h-20 rounded-lg border border-[#E5E7EB] bg-[#F7F8FA] flex items-center justify-center overflow-hidden shrink-0">
                {form.logo
                  ? <img src={form.logo} alt="School logo" className="w-full h-full object-contain" />
                  : <School className="w-8 h-8 text-[#9CA3AF]" strokeWidth={1.5} />}
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer border border-[#E5E7EB] rounded-lg px-3 py-2 text-xs font-semibold text-[#1A1D23] bg-white hover:bg-[#F7F8FA] transition-colors">
                    <ImagePlus className="w-3.5 h-3.5" strokeWidth={1.75} />
                    <span>{uploadingLogo ? 'Uploading…' : form.logo ? 'Change logo' : 'Upload logo'}</span>
                    <input type="file" accept="image/png,image/jpeg,image/webp" className="hidden" onChange={handleLogo} disabled={uploadingLogo} />
                  </label>
                  {form.logo && (
                    <button
                      type="button"
                      onClick={() => setForm({ ...form, logo: '' })}
                      className="inline-flex items-center gap-1.5 border border-[#FCA5A5] rounded-lg px-3 py-2 text-xs font-semibold text-[#DC2626] bg-white hover:bg-[#FEF2F2] transition-colors"
                    >
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                      <span>Remove</span>
                    </button>
                  )}
                </div>
                <p className="text-xs text-[#6B7280] font-body leading-relaxed">
                  Square PNG or JPG works best (min 200×200, max 8 MB). Appears in the sidebar of the admin, teacher, parent and student portals. Remember to save.
                </p>
              </div>
            </div>
          </div>

          {field('School Name', 'schoolName', 'text', 'E.g. St. Mary\'s High School', <School className="w-4 h-4" strokeWidth={1.75} />)}
          {field('Detailed Address', 'address', 'text', '123 Academic Road', <MapPin className="w-4 h-4" strokeWidth={1.75} />)}
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('City', 'city', 'text', 'Mumbai')}
            {field('State / Province', 'state', 'text', 'Maharashtra')}
          </div>
          
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {field('Country', 'country', 'text', 'India')}
            {field('Established Year', 'establishedYear', 'number', '1990', <Calendar className="w-4 h-4" strokeWidth={1.75} />)}
          </div>
          
          {field('Affiliated Board / Authority', 'board', 'text', 'CBSE / ICSE / State Board', <Award className="w-4 h-4" strokeWidth={1.75} />)}
        </div>

        {/* Section 2: Contact Info */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <Phone className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Administrative Contact Channels</h3>
          </div>
          {field('Telephone Number', 'phone', 'tel', '+91 98765 43210', <Phone className="w-4 h-4" strokeWidth={1.75} />)}
          {field('Official Email Address', 'email', 'email', 'principal@school.com', <Mail className="w-4 h-4" strokeWidth={1.75} />)}
          {field('Public Website URL', 'website', 'url', 'https://school.edu.in', <Globe className="w-4 h-4" strokeWidth={1.75} />)}
        </div>

        {/* Section 3: Late Fee Policy */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <IndianRupee className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Late Fee Policy</h3>
          </div>
          <p className="text-xs text-[#6B7280] font-body leading-relaxed">
            When a student has an outstanding balance past the due date + grace period, a flat late fee charge is automatically shown on their account. Set to 0 to disable.
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Late Fee Amount (₹)</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[#9CA3AF] pointer-events-none">
                  <IndianRupee className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <input
                  type="number" min="0" step="1"
                  value={form.lateFeeAmount}
                  onChange={(e) => setForm({ ...form, lateFeeAmount: e.target.value })}
                  placeholder="100"
                  className="w-full border border-[#E5E7EB] rounded-lg py-2.5 pl-10 pr-3.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all"
                />
              </div>
            </div>
            <div className="space-y-1.5">
              <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Grace Period (days after due date)</label>
              <div className="relative flex items-center">
                <div className="absolute left-3 text-[#9CA3AF] pointer-events-none">
                  <Calendar className="w-4 h-4" strokeWidth={1.75} />
                </div>
                <input
                  type="number" min="0" step="1"
                  value={form.lateFeeGraceDays}
                  onChange={(e) => setForm({ ...form, lateFeeGraceDays: e.target.value })}
                  placeholder="7"
                  className="w-full border border-[#E5E7EB] rounded-lg py-2.5 pl-10 pr-3.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all"
                />
              </div>
            </div>
          </div>
        </div>

        {/* Section 4: Premium LMS */}
        <div className="space-y-4">
          <div className="flex items-center gap-2 pb-2 border-b border-[#F3F4F6]">
            <GraduationCap className="w-4 h-4 text-[#1D7A4A]" strokeWidth={1.75} />
            <h3 className="text-xs font-bold text-[#1A1D23] uppercase tracking-wider">Premium LMS Pricing</h3>
          </div>
          <p className="text-xs text-[#6B7280] font-body leading-relaxed">
            Set the annual fee students pay to unlock premium recorded class videos. Leave blank to disable premium LMS for this school.
          </p>
          <div className="space-y-1.5">
            <label className="block text-xs font-semibold uppercase tracking-wider text-[#6B7280]">Annual Premium LMS Price (₹)</label>
            <div className="relative flex items-center">
              <div className="absolute left-3 text-[#9CA3AF] pointer-events-none">
                <IndianRupee className="w-4 h-4" strokeWidth={1.75} />
              </div>
              <input
                type="number" min="0" step="1"
                value={form.premiumLmsPrice}
                onChange={(e) => setForm({ ...form, premiumLmsPrice: e.target.value })}
                placeholder="e.g. 999 — leave blank to disable"
                className="w-full border border-[#E5E7EB] rounded-lg py-2.5 pl-10 pr-3.5 text-sm bg-white text-[#1A1D23] focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all"
              />
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="pt-2">
          <button
            type="submit"
            disabled={saving}
            className="w-full inline-flex items-center justify-center gap-2 bg-[#1D7A4A] hover:bg-[#155B37] text-white py-2.5 rounded-lg font-bold text-sm disabled:opacity-60 transition-all shadow-sm"
          >
            <Save className="w-4 h-4" strokeWidth={1.75} />
            {saving ? 'Synchronizing settings...' : 'Save Profile Changes'}
          </button>
        </div>
      </form>
    </div>
  );
}
