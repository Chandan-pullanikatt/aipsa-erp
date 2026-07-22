'use client';

import { useEffect, useState, useCallback } from 'react';
import Link from 'next/link';
import api from '@/lib/api';
import {
  GraduationCap,
  SlidersHorizontal,
  Search,
  Eye,
  Plus,
  ChevronLeft,
  IdCard,
  Upload
} from 'lucide-react';

interface Student {
  id: string;
  admissionNumber: string;
  firstName: string;
  lastName: string;
  gender: string | null;
  status: string;
  phone: string | null;
  class: { id: string; name: string } | null;
  section: { id: string; name: string } | null;
  guardians: { firstName: string; lastName: string; phone: string; relation: string }[];
}

interface ClassItem { id: string; name: string; }

const STATUS_STYLE: Record<string, string> = {
  ACTIVE: 'bg-[#D6F0E4] text-[#0F6E56]',
  INACTIVE: 'bg-[#FAEEDA] text-[#854F0B]',
  TRANSFERRED: 'bg-[#EEF2FF] text-[#4338CA]',
  GRADUATED: 'bg-[#EEF2FF] text-[#4338CA]',
};

export default function StudentsPage() {
  const [students, setStudents] = useState<Student[]>([]);
  const [classes, setClasses] = useState<ClassItem[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [classFilter, setClassFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState('ACTIVE');
  const [page, setPage] = useState(1);
  const LIMIT = 20;

  const fetchStudents = useCallback(async () => {
    setLoading(true);
    try {
      const params: Record<string, string> = { page: String(page), limit: String(LIMIT), status: statusFilter };
      if (search) params.search = search;
      if (classFilter) params.classId = classFilter;
      const { data } = await api.get('/sis/students', { params });
      setStudents(data.students);
      setTotal(data.total);
    } finally {
      setLoading(false);
    }
  }, [search, classFilter, statusFilter, page]);

  useEffect(() => { api.get('/sis/classes').then((r) => setClasses(r.data)).catch(console.error); }, []);
  useEffect(() => { setPage(1); }, [search, classFilter, statusFilter]);
  useEffect(() => { fetchStudents(); }, [fetchStudents]);

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="space-y-8">
      {/* Top bar header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-[32px] font-bold leading-tight text-text-primary">Students</h1>
          <p className="font-body text-[14px] text-text-muted mt-2">{total} total student{total !== 1 ? 's' : ''}</p>
        </div>
        <div className="flex gap-4">
          <Link
            href="/school/students/id-cards"
            className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <IdCard className="w-4 h-4 mr-2" strokeWidth={1.75} />
            ID Cards
          </Link>
          <Link
            href="/school/students/classes"
            className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <SlidersHorizontal className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Manage Classes
          </Link>
          <Link
            href="/school/students/import"
            className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <Upload className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Import CSV
          </Link>
          <Link
            href="/school/students/new"
            className="h-[38px] px-4 rounded-lg bg-primary-700 hover:bg-primary-900 text-white transition-colors inline-flex items-center justify-center font-medium text-[14px]"
          >
            <Plus className="w-4 h-4 mr-2" strokeWidth={1.75} />
            Admit Student
          </Link>
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 items-center bg-white p-4 rounded-xl border border-border">
        <div className="relative flex-1 max-w-sm">
          <input
            type="text"
            placeholder="Search name or admission no..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9"
          />
          <Search className="w-4.5 h-4.5 text-text-muted absolute left-3 top-2.5" strokeWidth={1.75} />
        </div>
        
        <select
          value={classFilter}
          onChange={(e) => setClassFilter(e.target.value)}
          className="min-w-[160px]"
        >
          <option value="">All Classes</option>
          {classes.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-w-[160px]"
        >
          <option value="">All Status</option>
          <option value="ACTIVE">Active</option>
          <option value="INACTIVE">Inactive</option>
          <option value="TRANSFERRED">Transferred</option>
          <option value="GRADUATED">Graduated</option>
        </select>
      </div>

      {/* Table & Empty States */}
      {loading ? (
        <div className="py-16 text-center text-text-muted font-body">Loading students...</div>
      ) : (
        <div className="bg-white rounded-xl border border-border overflow-x-auto">
          {students.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 text-center">
              <GraduationCap className="w-10 h-10 text-gray-300" strokeWidth={1.75} />
              <h3 className="font-display text-[16px] font-semibold text-text-primary mt-3">No students found</h3>
              <p className="font-body text-[14px] text-text-muted mt-1">Try adapting your search terms or filters.</p>
              <Link href="/school/students/new" className="mt-4 px-4 py-2 bg-primary-700 hover:bg-primary-900 text-white rounded-lg text-sm font-medium transition-colors inline-flex items-center">
                <Plus className="w-4 h-4 mr-2" strokeWidth={1.75} />
                Admit Student
              </Link>
            </div>
          ) : (
            <table className="w-full min-w-[720px] text-sm">
              <thead>
                <tr>
                  <th className="px-4 py-3 font-semibold text-[12px] uppercase tracking-wide text-text-muted">Adm. No.</th>
                  <th className="px-4 py-3 font-semibold text-[12px] uppercase tracking-wide text-text-muted">Name</th>
                  <th className="px-4 py-3 font-semibold text-[12px] uppercase tracking-wide text-text-muted">Class</th>
                  <th className="px-4 py-3 font-semibold text-[12px] uppercase tracking-wide text-text-muted">Parent Contact</th>
                  <th className="px-4 py-3 font-semibold text-[12px] uppercase tracking-wide text-text-muted">Status</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {students.map((s) => (
                  <tr key={s.id} className="hover:bg-[#F9FAFB]">
                    <td className="px-4 py-3 text-text-muted font-mono text-xs">{s.admissionNumber}</td>
                    <td className="px-4 py-3 font-medium text-text-primary">
                      {s.firstName} {s.lastName}
                      {s.gender && <span className="ml-1 text-xs text-text-muted">({s.gender[0]})</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {s.class ? `${s.class.name}${s.section ? ' - ' + s.section.name : ''}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3 text-text-muted">
                      {s.guardians[0] ? `${s.guardians[0].firstName} · ${s.guardians[0].phone}` : <span className="text-gray-300">—</span>}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex items-center text-[12px] font-semibold px-2.5 py-0.5 rounded ${STATUS_STYLE[s.status] ?? ''}`}>{s.status}</span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <Link
                        href={`/school/students/${s.id}`}
                        className="inline-flex items-center justify-center w-8 h-8 rounded-md hover:bg-[#F3F4F6] text-text-primary transition-colors"
                        title="View details"
                      >
                        <Eye className="w-4 h-4" strokeWidth={1.75} />
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="flex items-center justify-between mt-4">
          <p className="text-sm text-text-muted">Page {page} of {totalPages}</p>
          <div className="flex gap-2">
            <button
              disabled={page === 1}
              onClick={() => setPage(p => p - 1)}
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] disabled:opacity-40 hover:bg-gray-50 text-[14px]"
            >
              Prev
            </button>
            <button
              disabled={page === totalPages}
              onClick={() => setPage(p => p + 1)}
              className="h-[38px] px-4 rounded-lg bg-white border border-[#E5E7EB] text-[#1A1D23] hover:bg-[#F7F8FA] disabled:opacity-40 hover:bg-gray-50 text-[14px]"
            >
              Next
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
