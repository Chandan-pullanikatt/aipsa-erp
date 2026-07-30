'use client';

import { useState } from 'react';
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

interface PreviewRow {
  line: number;
  name: string;
  email: string;
  role: string;
  designation: string | null;
  employeeId: string | null;
  status: 'NEW' | 'ERROR';
  errors: string[];
}

interface Preview {
  emailDomain: string;
  rows: PreviewRow[];
  counts: { total: number; new: number; errors: number };
}

interface Created { name: string; email: string; role: string; tempPassword: string; }
interface Failed { line: number; name: string; error: string; }
interface Result {
  created: Created[];
  failed: Failed[];
  skipped: { errors: number };
}

const STATUS_STYLE: Record<string, string> = {
  NEW: 'bg-[#D6F0E4] text-[#0F6E56]',
  ERROR: 'bg-[#FDE8E8] text-[#9B1C1C]',
};

const STATUS_LABEL: Record<string, string> = {
  NEW: 'Will be added',
  ERROR: 'Needs fixing',
};

export default function ImportStaffPage() {
  const [emailDomain, setEmailDomain] = useState('');
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [result, setResult] = useState<Result | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  // Changing the file or the domain invalidates the preview — importing against a
  // stale one would write rows the admin never actually saw.
  function pickFile(f: File | null) {
    setFile(f);
    setPreview(null);
    setResult(null);
    setError('');
  }

  function changeDomain(value: string) {
    setEmailDomain(value);
    setPreview(null);
    setResult(null);
  }

  async function downloadTemplate() {
    try {
      const { data } = await api.get('/hr/staff/import/template', { responseType: 'blob' });
      saveBlob(new Blob([data], { type: 'text/csv' }), 'teacher-import-template.csv');
    } catch {
      setError('Could not download the template.');
    }
  }

  async function runPreview() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (emailDomain.trim()) form.append('emailDomain', emailDomain.trim());
      const { data } = await api.post('/hr/staff/import/preview', form);
      setPreview(data);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'Could not read that file.');
    } finally {
      setBusy(false);
    }
  }

  async function runImport() {
    if (!file) return;
    setBusy(true); setError('');
    try {
      const form = new FormData();
      form.append('file', file);
      if (emailDomain.trim()) form.append('emailDomain', emailDomain.trim());
      const { data } = await api.post('/hr/staff/import', form);
      setResult(data);
      setPreview(null);
    } catch (err) {
      const e = err as { response?: { data?: { error?: string } } };
      setError(e.response?.data?.error || 'The import failed.');
    } finally {
      setBusy(false);
    }
  }

  function downloadCredentials() {
    if (!result) return;
    const csv = 'name,email,role,tempPassword\n'
      + result.created.map((c) => `"${c.name}",${c.email},${c.role},${c.tempPassword}`).join('\n')
      + '\n';
    saveBlob(new Blob([csv], { type: 'text/csv' }), 'staff-credentials.csv');
  }

  return (
    <div className="space-y-8">
      <div className="flex items-center justify-between">
        <div>
          <Link href="/school/hr" className="inline-flex items-center text-[13px] text-text-muted hover:text-text-primary mb-2">
            <ArrowLeft className="w-4 h-4 mr-1.5" strokeWidth={1.75} />
            Back to Staff
          </Link>
          <h1 className="font-display text-[32px] font-bold leading-tight text-text-primary">Import Teachers</h1>
          <p className="font-body text-[14px] text-text-muted mt-2">
            Upload the school&apos;s staff list. Only names are required — logins are created for you.
            Nothing is saved until you review the preview.
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

      {/* ─── Step 1: pick the file ─────────────────────────────────────────── */}
      {!result && (
        <div className="bg-white rounded-xl border border-border p-6 space-y-5">
          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">
              Email domain for staff without an address
            </label>
            <input
              type="text"
              value={emailDomain}
              onChange={(e) => changeDomain(e.target.value)}
              placeholder="levana.local"
              className="w-full max-w-[320px]"
            />
            <p className="text-[12px] text-text-muted mt-2">
              Every login needs a unique email, so teachers without one get
              <code> firstname.lastname@domain</code>. Leave this blank to use
              <code> levana.local</code>, which cannot receive mail — safe as a placeholder,
              but those teachers cannot reset their own password by email. Add real addresses
              later from the staff screen.
            </p>
          </div>

          <div>
            <label className="block text-[13px] font-medium text-text-primary mb-1.5">Staff list (.csv)</label>
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
              Needs a <code>firstName</code> column. Everything else is optional —
              <code> lastName</code>, <code>email</code>, <code>phone</code>, <code>employeeId</code>,
              <code> designation</code>, and <code>role</code> (Teacher or Staff, defaulting to Teacher).
              Subjects are assigned later on the curriculum page, once classes exist.
            </p>
          </div>

          <button
            onClick={runPreview}
            disabled={!file || busy}
            className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.75} />
            {busy ? 'Reading...' : 'Preview Import'}
          </button>
        </div>
      )}

      {/* ─── Step 2: review before writing ─────────────────────────────────── */}
      {preview && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <h2 className="font-display text-[18px] font-bold text-text-primary">Preview</h2>
            <p className="text-[14px] text-text-muted mt-1.5">
              {preview.counts.total} row{preview.counts.total !== 1 ? 's' : ''} read ·{' '}
              <span className="text-[#0F6E56] font-medium">{preview.counts.new} to add</span> ·{' '}
              <span className={preview.counts.errors ? 'text-[#9B1C1C] font-medium' : ''}>
                {preview.counts.errors} with errors
              </span>
              {' '}· generated addresses use <code>@{preview.emailDomain}</code>
            </p>
            {preview.counts.errors > 0 && (
              <div className="flex items-start gap-2.5 bg-[#FEF6E7] text-[#854F0B] rounded-lg p-3 mt-4 text-[13px]">
                <Info className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                <span>
                  Rows with errors will be skipped. Fix the file and upload it again — the staff
                  already added will be reported as existing rather than duplicated.
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
                  <th className="text-left font-medium px-6 py-3">Login Email</th>
                  <th className="text-left font-medium px-6 py-3">Role</th>
                  <th className="text-left font-medium px-6 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {preview.rows.map((r) => (
                  <tr key={r.line} className={r.status === 'ERROR' ? 'bg-[#FEF2F2]' : ''}>
                    <td className="px-6 py-3 text-text-muted">{r.line}</td>
                    <td className="px-6 py-3 text-text-primary font-medium">
                      {r.name || <span className="text-text-muted">—</span>}
                      {r.designation && (
                        <div className="text-[12px] text-text-muted font-normal mt-0.5">{r.designation}</div>
                      )}
                      {r.errors.length > 0 && (
                        <div className="text-[12px] text-[#9B1C1C] font-normal mt-1">{r.errors.join(' · ')}</div>
                      )}
                    </td>
                    <td className="px-6 py-3 text-text-muted">{r.email}</td>
                    <td className="px-6 py-3 text-text-muted">{r.role === 'TEACHER' ? 'Teacher' : 'Staff'}</td>
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
              disabled={busy || preview.counts.new === 0}
              className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 disabled:opacity-50 disabled:cursor-not-allowed text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
            >
              <CheckCircle2 className="w-4 h-4 mr-2" strokeWidth={1.75} />
              {busy ? 'Importing...' : `Add ${preview.counts.new} Staff Member${preview.counts.new !== 1 ? 's' : ''}`}
            </button>
            <button
              onClick={() => setPreview(null)}
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors font-medium text-[14px]"
            >
              Cancel
            </button>
            {preview.counts.new === 0 && (
              <span className="text-[13px] text-text-muted">Nothing new to import in this file.</span>
            )}
          </div>
        </div>
      )}

      {/* ─── Step 3: done — hand over the credentials ──────────────────────── */}
      {result && (
        <div className="bg-white rounded-xl border border-border overflow-hidden">
          <div className="p-6 border-b border-border">
            <div className="flex items-center gap-2.5">
              <CheckCircle2 className="w-5 h-5 text-[#0F6E56]" strokeWidth={1.75} />
              <h2 className="font-display text-[18px] font-bold text-text-primary">Staff added</h2>
            </div>
            <p className="text-[14px] text-text-muted mt-1.5">
              Added {result.created.length} account{result.created.length !== 1 ? 's' : ''}
              {' '}· skipped {result.skipped.errors} with errors
              {result.failed.length > 0 && ` · ${result.failed.length} could not be created`}.
            </p>

            {result.created.length > 0 && (
              <div className="flex items-start gap-2.5 bg-[#FEF6E7] text-[#854F0B] rounded-lg p-4 mt-4 text-[13px]">
                <KeyRound className="w-4 h-4 mt-0.5 shrink-0" strokeWidth={1.75} />
                <span>
                  <strong>Download these credentials now.</strong> Each teacher is prompted to
                  change their password at first login. The passwords are stored hashed and cannot
                  be shown again — only reset from the staff screen.
                </span>
              </div>
            )}
          </div>

          <div className="px-6 py-4 border-b border-border flex gap-4">
            {result.created.length > 0 && (
              <button
                onClick={downloadCredentials}
                className="h-[38px] px-5 rounded-lg bg-primary-700 hover:bg-primary-900 text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
              >
                <Download className="w-4 h-4 mr-2" strokeWidth={1.75} />
                Download Credentials (CSV)
              </button>
            )}
            <Link
              href="/school/hr"
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
            >
              View Staff
            </Link>
          </div>

          {result.failed.length > 0 && (
            <div className="px-6 py-4 border-b border-border">
              <p className="text-[13px] font-medium text-[#9B1C1C] mb-2">Could not be created</p>
              <ul className="text-[13px] text-text-muted space-y-1">
                {result.failed.map((f) => (
                  <li key={f.line}>Line {f.line} — {f.name}: {f.error}</li>
                ))}
              </ul>
            </div>
          )}

          {result.created.length > 0 && (
            <div className="overflow-x-auto">
              <table className="w-full text-[14px]">
                <thead className="bg-[#F7F8FA] text-text-muted text-[12px] uppercase tracking-wider">
                  <tr>
                    <th className="text-left font-medium px-6 py-3">Name</th>
                    <th className="text-left font-medium px-6 py-3">Login Email</th>
                    <th className="text-left font-medium px-6 py-3">Role</th>
                    <th className="text-left font-medium px-6 py-3">Temp Password</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-border">
                  {result.created.map((c) => (
                    <tr key={c.email}>
                      <td className="px-6 py-3 text-text-primary font-medium">{c.name}</td>
                      <td className="px-6 py-3 text-text-muted">{c.email}</td>
                      <td className="px-6 py-3 text-text-muted">{c.role === 'TEACHER' ? 'Teacher' : 'Staff'}</td>
                      <td className="px-6 py-3 font-mono text-text-primary">{c.tempPassword}</td>
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
