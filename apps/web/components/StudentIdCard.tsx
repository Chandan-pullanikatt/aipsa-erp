'use client';

// Printable student ID card (front + back) at true CR80 size (85.6mm x 54mm) so
// admins can print and cut physical cards. The QR on the back encodes the
// admission number for quick lookup. Students/parents see the same card read-only.
import { QRCodeSVG } from 'qrcode.react';
import { GraduationCap } from 'lucide-react';

export interface IdCardStudent {
  admissionNumber: string;
  firstName: string;
  lastName: string;
  dateOfBirth?: string | null;
  bloodGroup?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  photoUrl?: string | null;
  boardingType?: string | null;
  class?: { name: string } | null;
  section?: { name: string } | null;
  guardians?: Array<{ phone?: string | null; firstName?: string; relation?: string; isPrimary?: boolean }>;
}

export interface IdCardSchool {
  schoolName?: string;
  logo?: string | null;
  address?: string | null;
  city?: string | null;
  state?: string | null;
  phone?: string | null;
}

// India academic year runs Apr–Mar. June 2026 => "2026-27".
function academicYear(d = new Date()): string {
  const y = d.getFullYear();
  const startYear = d.getMonth() >= 3 ? y : y - 1; // month 3 == April
  return `${startYear}-${String((startYear + 1) % 100).padStart(2, '0')}`;
}

function fmtDate(s?: string | null): string {
  if (!s) return '—';
  const d = new Date(s);
  if (Number.isNaN(d.getTime())) return '—';
  return d.toLocaleDateString('en-IN', { day: '2-digit', month: 'short', year: 'numeric' });
}

const GREEN = '#1D7A4A';
const DARK = '#1A1D23';

const CARD: React.CSSProperties = {
  width: '85.6mm',
  height: '54mm',
  borderRadius: '3mm',
  overflow: 'hidden',
  background: '#fff',
  border: '1px solid #E5E7EB',
  boxShadow: '0 1px 3px rgba(0,0,0,0.08)',
  fontFamily: 'var(--font-sans, system-ui, sans-serif)',
  color: DARK,
  position: 'relative',
  flexShrink: 0,
};

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div style={{ lineHeight: 1.15 }}>
      <div style={{ fontSize: '4.6pt', textTransform: 'uppercase', letterSpacing: '0.04em', color: '#9CA3AF', fontWeight: 700 }}>{label}</div>
      <div style={{ fontSize: '6.4pt', fontWeight: 600, color: DARK }}>{value || '—'}</div>
    </div>
  );
}

export function StudentIdCard({ student, school }: { student: IdCardStudent; school: IdCardSchool }) {
  const fullName = `${student.firstName} ${student.lastName}`.trim();
  const primaryGuardian =
    student.guardians?.find((g) => g.isPrimary) || student.guardians?.[0];
  const parentPhone = primaryGuardian?.phone || '—';
  const classLine = [student.class?.name, student.section?.name].filter(Boolean).join(' • ') || '—';
  const studentAddr = [student.address, student.city, student.state].filter(Boolean).join(', ') || '—';
  const schoolAddr = [school.address, school.city, school.state].filter(Boolean).join(', ');
  const ay = academicYear();

  return (
    <div className="idcard-pair" style={{ display: 'flex', gap: '5mm', flexWrap: 'wrap' }}>
      {/* ───── FRONT ───── */}
      <div style={CARD}>
        {/* header band */}
        <div style={{ background: GREEN, color: '#fff', padding: '2mm 3mm', display: 'flex', alignItems: 'center', gap: '2mm', height: '11mm', boxSizing: 'border-box' }}>
          {school.logo ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={school.logo} alt="" style={{ width: '7mm', height: '7mm', borderRadius: '1mm', objectFit: 'cover', background: '#fff' }} />
          ) : (
            <div style={{ width: '7mm', height: '7mm', borderRadius: '1mm', background: 'rgba(255,255,255,0.2)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <GraduationCap style={{ width: '4mm', height: '4mm', color: '#fff' }} />
            </div>
          )}
          <div style={{ minWidth: 0 }}>
            <div style={{ fontSize: '7pt', fontWeight: 800, lineHeight: 1.05, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
              {school.schoolName || 'School'}
            </div>
            <div style={{ fontSize: '4.6pt', opacity: 0.85, fontWeight: 600, letterSpacing: '0.05em' }}>STUDENT IDENTITY CARD</div>
          </div>
        </div>

        {/* body */}
        <div style={{ display: 'flex', gap: '2.5mm', padding: '2.5mm 3mm' }}>
          {/* photo */}
          <div style={{ width: '17mm', height: '21mm', borderRadius: '1.5mm', overflow: 'hidden', border: `0.5mm solid ${GREEN}`, background: '#F3F4F6', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {student.photoUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={student.photoUrl} alt="" style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
            ) : (
              <span style={{ fontSize: '5pt', color: '#9CA3AF', fontWeight: 600 }}>No Photo</span>
            )}
          </div>

          {/* details */}
          <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.4mm' }}>
            <div style={{ fontSize: '8.5pt', fontWeight: 800, color: GREEN, lineHeight: 1.1 }}>{fullName}</div>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1.2mm 2mm' }}>
              <Field label="Adm No" value={student.admissionNumber} />
              <Field label="Class" value={classLine} />
              <Field label="Blood Group" value={student.bloodGroup} />
              <Field label="DOB" value={fmtDate(student.dateOfBirth)} />
            </div>
          </div>
        </div>

        {/* footer */}
        <div style={{ position: 'absolute', bottom: 0, left: 0, right: 0, background: '#F9FAFB', borderTop: '1px solid #E5E7EB', padding: '1.2mm 3mm', display: 'flex', justifyContent: 'space-between', fontSize: '4.8pt', fontWeight: 700, color: '#6B7280' }}>
          <span>{student.boardingType === 'HOSTELER' ? 'HOSTELER' : 'DAY SCHOLAR'}</span>
          <span>VALID FOR A.Y. {ay}</span>
        </div>
      </div>

      {/* ───── BACK ───── */}
      <div style={CARD}>
        <div style={{ padding: '2.5mm 3mm', display: 'flex', flexDirection: 'column', height: '100%', boxSizing: 'border-box' }}>
          <div style={{ display: 'flex', gap: '3mm' }}>
            <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: '1.6mm' }}>
              <Field label="Address" value={<span style={{ fontSize: '5.4pt', fontWeight: 500 }}>{studentAddr}</span>} />
              <Field label="Parent / Guardian Mobile" value={parentPhone} />
              <Field label="Admission No" value={student.admissionNumber} />
            </div>
            {/* QR encodes admission number for quick scan lookup */}
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '0.8mm' }}>
              <QRCodeSVG value={student.admissionNumber} size={64} level="M" style={{ width: '17mm', height: '17mm' }} />
              <span style={{ fontSize: '4pt', color: '#9CA3AF', fontWeight: 600 }}>SCAN</span>
            </div>
          </div>

          <div style={{ marginTop: 'auto', borderTop: '1px solid #E5E7EB', paddingTop: '1.4mm' }}>
            <div style={{ fontSize: '4.6pt', color: '#6B7280', fontWeight: 600, lineHeight: 1.25 }}>
              If found, please return to <strong>{school.schoolName || 'the school'}</strong>
              {schoolAddr ? `, ${schoolAddr}` : ''}{school.phone ? ` · ${school.phone}` : ''}.
            </div>
            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '2mm' }}>
              <div style={{ textAlign: 'center' }}>
                <div style={{ borderTop: '0.4mm solid #9CA3AF', width: '24mm' }} />
                <div style={{ fontSize: '4.4pt', color: '#6B7280', fontWeight: 700, marginTop: '0.5mm' }}>Principal / Authorised Sign.</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default StudentIdCard;
