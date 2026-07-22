'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  ArrowLeft,
  Upload,
  Download,
  FileText,
  CheckCircle2,
  AlertTriangle,
  Info,
  KeyRound,
} from 'lucide-react';

interface ClassItem { id: string; name: string; }
interface Section { id: string; name: string; }

interface PreviewRow {
  line: number;
  name: string;
  admissionNumber: string | null;
  guardian: string | null;
  guardianPhone: string | null;
  status: 'NEW' | 'GUARDIAN' | 'EXISTING' | 'ERROR';
  errors: string[];
}

interface Preview {
  className: string;
  sections: Section[];
  rows: PreviewRow[];
  counts: { total: number; new: number; guardians: number; existing: number; errors: number };
}

interface Created { admissionNumber: string; name: string; portalPin: string; }
interface Result {
  className: string;
  created: Created[];
  guardiansAdded: string[];
  skipped: { existing: number; errors: number };
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-[#D6F0E4] text-[#0F6E56]',
  GUARDIAN: 'bg-[#EEF2FF] text-[#4338CA]',
  EXISTING: 'bg-[#FAEEDA] text-[#854F0B]',
  ERROR: 'bg-[#FDE8E8] text-[#9B1C1C]',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Will be added',
  GUARDIAN: 'Will add guardian',
  EXISTING: 'Already enrolled',
  ERROR: 'Needs fixing',
};

export default function ImportStudentsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/sis/classes').then((r) => setClasses(r.data)).catch(console.error); }, []);

  // Changing the class or the file invalidates the preview — importing against a
  // stale one would write rows the admin never actually saw.
  function pickClass(id: string) {
    setClassId(id);
    setSectionId('');
    setPreview(null);
    setResult(null);
  }

  function pickFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
  }

  async function downloadTemplate() {
    try {
      const { data } = await api.get('/sis/students/import/template', { responseType: 'blob' });
      saveBlob(new Blob([data], { type: 'text/csv' }), 'student-import-template.csv');
    } catch {
      setError('Could not download the template.');
    }
  }

  async function runPreview() {
    if (!classId || !file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('classId', classId);
      const { data } = await api.post('/sis/students/import/preview', form);
      setPreview(data);
      if (data.sections?.length === 1) setSectionId(data.sections[0].id);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!classId || !file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      form.append('classId', classId);
      if (sectionId) form.append('sectionId', sectionId);
      const { data } = await api.post('/sis/students/import', form);
      setResult(data);
      setPreview(null);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'The import failed.');
    } finally {
      setBusy(false);
    }
  }

  function downloadPins() {
    if (!result) return;
    const csv = 'class,admissionNumber,name,portalPin\n'
      + result.created.map((c) => `${result.className},${c.admissionNumber},"${c.name}",${c.portalPin}`).join('\n')
      + '\n';
    saveBlob(new Blob([csv], { type: 'text/csv' }), `portal-pins-${result.className.replace(/\s+/g, '-')}.csv`);
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/school/students" className="inline-flex items-center text-[13px] text-text-muted hover:text-text-primary mb-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
            Back to Students
          </Link>
          <h1 className="font-display text-[32px] font-bold leading-tight text-text-primary">Import Students</h1>
          <p className="font-body text-[14px] text-text-muted mt-2">
            Upload one class register at a time. Nothing is saved until you review the preview.
          </p>
        </div>
        <button
          onClick={downloadTemplate}
          className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
        >
          <Download className="w-4 h-4 mr-2" strokeWidth={1.75} />
          Download Template
        </button>
      </div>

      {error && (
        <div className="flex items-start gap-2.5 bg-[#FDE8E8] text-[#9B1C1C] rounded-xl p-4 text-[14px]">
          <AlertTriangle className="w-4.5 h-4.5 mt-0.5 shrink-0" strokeWidth={1.75} />
          <span>{error}</span>
        </div>
      )}

      {/* ─── Step 1: pick class + file ─────────────────────────────────────── */}
      {!result && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-5">
          <div className="flex flex-wrap gap-4">
            <div className="flex-1 min-w-[200px]">
              <label className="block text-[13px] font-medium text-text-primary mb-1.5">Class</label>
              <select value={classId} onChange={(e) => pickClass(e.target.value)} className="w-full">
                <option value="">Select a class...</option>
                {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
              </select>
            </div>

            {preview && preview.sections.length > 0 && (
              <div className="flex-1 min-w-[200px]">
                <label className="block text-[13px] font-medium text-text-primary mb-1.5">Section</label>
                <select value={sectionId} onChange={(e) => setSectionId(e.target.value)} className="w-full">
                  <option value="">No section</option>
                  {preview.sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                </select>
              </div>
            )}
          </div>

          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Register file (.csv)</label>
            <label className="flex items-center gap-3 border border-dashed border-[#D1D5DB] rounded-lg px-4 py-5 cursor-pointer hover:bg-[#F7F8FA] transition-colors">
              <FileText className="w-5 h-5 text-text-muted shrink-0" strokeWidth={1.75} />
              <span className="text-[14px] text-text-primary">
                {file ? file.name : 'Choose a CSV file...'}
              </span>
              <input
                type="file"
                accept=".csv,text/csv"
                className="hidden"
                onChange={(e) => pickFile(e.target.files?.[0] || null)}
              />
            </label>
            <p className="text-[12px] text-text-muted mt-2">
              Needs a <code>firstName</code> column. Guardian details are optional — add
              <code> guardianName</code>, <code>guardianRelation</code>, <code>guardianPhone</code> and
              <code> guardianEmail</code> to create the parent contact at the same time.
            </p>
          </div>

          <button
            onClick={runPreview}
            disabled={!classId || !file || busy}
            className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.75} />
            {busy ? 'Reading...' : 'Preview Import'}
          </button>
        </div>
      )}

      {/* ─── Step 2: review before writing ─────────────────────────────────── */}
      {preview && (() => {
        const applicable = preview.counts.new + preview.counts.guardians;
        return (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-[18px] font-bold text-text-primary">
              Preview — {preview.className}
            </h2>
            <p className="text-[14px] text-text-muted mt-1.5">
              {preview.counts.total} row{preview.counts.total !== 1 ? 's' : ''} read ·{' '}
              <span className="text-[#0F6E56] font-medium">{preview.counts.new} to add</span> ·{' '}
              {preview.counts.guardians > 0 && (
                <>
                  <span className="text-[#4338CA] font-medium">{preview.counts.guardians} guardian{preview.counts.guardians !== 1 ? 's' : ''} to attach</span> ·{' '}
                </>
              )}
              {preview.counts.existing} already enrolled ·{' '}
              <span className={preview.counts.errors ? 'text-[#9B1C1C] font-medium' : ''}>
                {preview.counts.errors} with errors
              </span>
            </p>
            {preview.counts.errors > 0 && (
              <div className="flex items-start gap-2.5 bg-[#FEF6E7] text-[#854F0B] rounded-lg p-3 mt-4 text-[13px]">
                <Info className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                <span>
                  Rows with errors and students already enrolled will be skipped. Fix the file and
                  upload it again — re-importing will not create duplicates.
                </span>
              </div>
            )}
          </div>

          <div className="overflow-x-auto">
            <table className="w-full text-[14px]">
              <thead className="bg-[#F7F8FA] text-text-muted text-[12px] uppercase tracking-wider">
                <tr>
                  <th className="text-left font-medium px-6 py-3">Line</th>
                  <th className="text-left font-medium px-6 py-3">Name</th>
                  <th className="text-left font-medium px-6 py-3">Adm. No.</th>
                  <th className="text-left font-medium px-6 py-3">Guardian</th>
                  <th className="text-left font-medium px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.status === 'ERROR' ? 'bg-[#FEF2F2]' : ''}>
                    <td className="px-6 py-3 text-text-muted">{r.line}</td>
                    <td className="px-6 py-3 text-text-primary font-medium">
                      {r.name || <span className="text-text-muted">—</span>}
                      {r.errors.length > 0 && (
                        <div className="text-[12px] text-[#9B1C1C] font-normal mt-1">{r.errors.join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-text-muted">{r.admissionNumber || <span className="text-gray-300">auto</span>}</td>
                    <td className="px-6 py-3 text-text-muted">
                      {r.guardian ? `${r.guardian} · ${r.guardianPhone}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-6 py-3">
                      <span className={`inline-block px-2.5 py-1 rounded-md text-[12px] font-medium ${STATUS_STYLE[r.status]}`}>
                        {STATUS_LABEL[r.status]}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="p-6 border-t border-border flex items-center gap-4">
            <button
              onClick={runImport}
              disabled={busy || applicable === 0}
              className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" strokeWidth={1.75} />
              {busy ? 'Importing...' : `Apply to ${applicable} Row${applicable !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors font-medium text-[14px]"
            >
              Cancel
            </button>
            {applicable === 0 && (
              <span className="text-[13px] text-text-muted">Nothing new to import in this file.</span>
            )}
          </div>
        </div>
        );
      })()}

      {/* ─── Step 3: done — hand over the PINs ─────────────────────────────── */}
      {result && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#0F6E56]" strokeWidth={1.75} />
              <h2 className="font-display text-[18px] font-bold text-text-primary">
                {result.className} updated
              </h2>
            </div>
            <p className="text-[14px] text-text-muted mt-1.5">
              Added {result.created.length} student{result.created.length !== 1 ? 's' : ''}
              {result.guardiansAdded.length > 0 && ` · attached ${result.guardiansAdded.length} guardian${result.guardiansAdded.length !== 1 ? 's' : ''} to students already enrolled`}
              {' '}· skipped {result.skipped.existing} already enrolled and {result.skipped.errors} with errors.
            </p>

            {result.created.length > 0 && (
              <div className="flex items-start gap-2.5 bg-[#FEF6E7] text-[#854F0B] rounded-lg p-4 mt-4 text-[13px]">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                <span>
                  <strong>Download these portal PINs now.</strong> Parents need the admission number
                  and PIN to link their child. They are stored encrypted and cannot be shown again —
                  only reset from the student&apos;s profile.
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-b border-border flex gap-4">
            {result.created.length > 0 && (
              <button
                onClick={downloadPins}
                className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={1.75} />
                Download PINs (CSV)
              </button>
            )}
            <Link
              href="/school/students"
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
            >
              View Students
            </Link>
          </div>

          {result.created.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="bg-[#F7F8FA] text-text-muted text-[12px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-medium px-6 py-3">Admission No.</th>
                    <th className="text-left font-medium px-6 py-3">Name</th>
                    <th className="text-left font-medium px-6 py-3">Portal PIN</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.created.map((c) => (
                    <tr key={c.admissionNumber}>
                      <td className="px-6 py-3 text-text-muted">{c.admissionNumber}</td>
                      <td className="px-6 py-3 text-text-primary font-medium">{c.name}</td>
                      <td className="px-6 py-3 font-mono text-text-primary">{c.portalPin}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function saveBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}
