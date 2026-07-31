'use client';

import { useEffect, useState } from 'react';
import api from '@/lib/api';
import { Download, KeyRound, Loader2, Users } from 'lucide-react';

interface ClassItem { id: string; name: string }
interface Section { id: string; name: string }
interface Credential {
  id: string;
  name: string;
  admissionNumber: string;
  password: string;
  isCustom: boolean;
}

export default function PortalCredentialsPage() {
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [sections, setSections] = useState<Section[]>([]);
  const [classId, setClassId] = useState('');
  const [sectionId, setSectionId] = useState('');

  const [className, setClassName] = useState('');
  const [rows, setRows] = useState<Credential[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    api.get('/sis/classes')
      .then(({ data }) => setClasses(data))
      .catch(() => setError('Failed to load classes.'));
  }, []);

  useEffect(() => {
    setSectionId('');
    setSections([]);
    setRows([]);
    if (!classId) return;
    api.get(`/sis/classes/${classId}/sections`)
      .then(({ data }) => setSections(data))
      .catch(() => setError('Failed to load sections.'));
  }, [classId]);

  async function load(id: string) {
    setSectionId(id);
    setRows([]);
    if (!id) return;
    setLoading(true);
    setError('');
    try {
      const { data } = await api.get(`/sis/sections/${id}/credentials`);
      setClassName(data.className);
      setRows(data.students);
    } catch (err: any) {
      setError(err.response?.data?.error || 'Failed to load credentials.');
    } finally {
      setLoading(false);
    }
  }

  function exportCsv() {
    const csv = 'admissionNumber,name,password\n'
      + rows.map((r) => `${r.admissionNumber},"${r.name}",${r.password}`).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `portal-credentials-${className.replace(/\s+/g, '-')}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="font-display text-[28px] font-bold text-[#1A1D23] leading-tight flex items-center gap-2">
          <KeyRound className="w-6 h-6 text-[#1D7A4A]" strokeWidth={1.75} />
          Portal Credentials
        </h1>
        <p className="text-sm text-gray-500 mt-1">
          Sign-in details for parents and students, section by section. Share each parent their own row.
        </p>
      </div>

      {error && (
        <div className="p-4 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
      )}

      <div className="bg-white rounded-2xl border border-gray-200 p-5 flex flex-col sm:flex-row gap-4 sm:items-end">
        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Class</label>
          <select
            value={classId}
            onChange={(e) => setClassId(e.target.value)}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]"
          >
            <option value="">Select a class</option>
            {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>

        <div className="flex-1">
          <label className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5">Section</label>
          <select
            value={sectionId}
            onChange={(e) => load(e.target.value)}
            disabled={!classId}
            className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A] disabled:bg-gray-50 disabled:text-gray-400"
          >
            <option value="">Select a section</option>
            {sections.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
          </select>
        </div>

        <button
          onClick={exportCsv}
          disabled={!rows.length}
          className="px-4 py-2.5 bg-[#1D7A4A] hover:bg-[#155B37] text-white text-sm font-semibold rounded-xl transition-all shadow-sm shrink-0 flex items-center gap-1.5 disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Download className="w-4 h-4" strokeWidth={1.75} />
          Export CSV
        </button>
      </div>

      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="py-20 text-center text-sm text-gray-400">
            <Loader2 className="w-5 h-5 animate-spin mx-auto mb-2" strokeWidth={1.75} />
            Loading credentials...
          </div>
        ) : rows.length === 0 ? (
          <div className="py-20 text-center">
            <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" strokeWidth={1.5} />
            <p className="text-sm text-gray-500">Select a class and section to view sign-in details.</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr className="text-left text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  <th className="px-6 py-3">Student</th>
                  <th className="px-6 py-3">Admission Number</th>
                  <th className="px-6 py-3">Password</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {rows.map((r) => (
                  <tr key={r.id} className="hover:bg-gray-50/50">
                    <td className="px-6 py-3 font-medium text-gray-800">{r.name}</td>
                    <td className="px-6 py-3 font-mono text-gray-600">{r.admissionNumber}</td>
                    <td className="px-6 py-3 font-mono text-[#1D7A4A]">
                      {r.password}
                      {r.isCustom && (
                        <span className="ml-2 text-[10px] font-sans font-semibold text-amber-600 bg-amber-50 border border-amber-200 px-1.5 py-0.5 rounded">
                          changed by parent
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
