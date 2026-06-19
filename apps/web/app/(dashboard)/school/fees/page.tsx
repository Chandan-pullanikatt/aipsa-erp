'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Plus, Pencil, Trash2, X, Search, DollarSign, Calendar, FileText, CheckCircle, User } from 'lucide-react';

type Tab = 'structure' | 'collect' | 'history' | 'dues' | 'defaulters';

interface FeeCategory { id: string; name: string; description: string | null; serviceType?: string; _count: { structures: number; payments: number }; }
interface FeeStructure { id: string; feeCategoryId: string; feeCategory: { name: string }; class: { name: string } | null; amount: number; frequency: string; dueDate: string | null; }
interface ClassItem { id: string; name: string; }
interface StudentSummary { id: string; firstName: string; lastName: string; admissionNumber: string; }
interface Payment { id: string; receiptNumber: string; amount: number; method: string; paidAt: string; month: string | null; feeCategory: { name: string }; student: { firstName: string; lastName: string; admissionNumber: string }; }

const FREQ_LABEL: Record<string, string> = { MONTHLY: 'Monthly', QUARTERLY: 'Quarterly', ANNUALLY: 'Annual', ONE_TIME: 'One-Time' };
const SERVICE_LABEL: Record<string, string> = { NONE: 'Class-wide', TRANSPORT: 'Transport (bus users)', HOSTEL: 'Hostel (hostelers)' };
const METHOD_LABEL: Record<string, string> = { CASH: 'Cash', UPI: 'UPI', BANK_TRANSFER: 'Bank Transfer', CHEQUE: 'Cheque', ONLINE: 'Online' };
const rupees = (n: number) => '₹' + n.toLocaleString('en-IN', { minimumFractionDigits: 2 });

export default function FeesPage() {
  const [tab, setTab] = useState<Tab>('structure');
  const [academicYear, setAcademicYear] = useState('');
  const [classes, setClasses] = useState<ClassItem[]>([]);

  useEffect(() => {
    api.get('/fees/academic-year').then(r => setAcademicYear(r.data.academicYear)).catch(console.error);
    api.get('/sis/classes').then(r => setClasses(r.data)).catch(console.error);
  }, []);

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-[32px] font-bold text-[#1A1D23] font-display leading-tight">Fee Management</h1>
          {academicYear && <p className="text-sm text-gray-500 mt-1 font-body">Academic Year: <span className="font-semibold text-gray-700">{academicYear}</span></p>}
        </div>
      </div>

      <div className="flex gap-1 bg-[#F3F4F6] p-1.5 rounded-xl w-fit border border-[#E5E7EB]">
        {([['structure','Fee Structure'],['collect','Collect Fee'],['history','Payment History'],['dues','Due Report'],['defaulters','Defaulter Report']] as [Tab,string][]).map(([t,l]) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all ${tab === t ? 'bg-white text-[#1A1D23] shadow-sm' : 'text-gray-500 hover:text-gray-900'}`}>
            {l}
          </button>
        ))}
      </div>

      {tab === 'structure' && <FeeStructureTab classes={classes} academicYear={academicYear} />}
      {tab === 'collect' && <CollectFeeTab classes={classes} academicYear={academicYear} />}
      {tab === 'history' && <PaymentHistoryTab />}
      {tab === 'dues' && <DueReportTab classes={classes} />}
      {tab === 'defaulters' && <DefaulterReportTab classes={classes} />}
    </div>
  );
}

// ─── Fee Structure Tab ────────────────────────────────────────────────────────

function FeeStructureTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [structures, setStructures] = useState<FeeStructure[]>([]);
  const [newCat, setNewCat] = useState({ name: '', description: '', serviceType: 'NONE' });
  const [newStruct, setNewStruct] = useState({ feeCategoryId: '', classId: '', amount: '', frequency: 'MONTHLY', dueDate: '' });
  const [editCat, setEditCat] = useState<{ id: string; name: string; serviceType: string } | null>(null);
  const [showAddStruct, setShowAddStruct] = useState(false);
  const [error, setError] = useState('');

  const load = useCallback(async () => {
    const [c, s] = await Promise.all([api.get('/fees/categories'), api.get('/fees/structures')]);
    setCategories(c.data); setStructures(s.data);
  }, []);

  useEffect(() => { load(); }, [load]);

  async function addCategory(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try { await api.post('/fees/categories', newCat); setNewCat({ name: '', description: '', serviceType: 'NONE' }); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  }

  async function addStructure(e: React.FormEvent) {
    e.preventDefault(); setError('');
    try { await api.post('/fees/structures', newStruct); setNewStruct({ feeCategoryId: '', classId: '', amount: '', frequency: 'MONTHLY', dueDate: '' }); setShowAddStruct(false); load(); }
    catch (err: any) { setError(err.response?.data?.error || 'Error'); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {error && (
        <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-xl px-4 py-3 flex justify-between items-center font-body font-medium">
          <span>{error}</span>
          <button onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded">
            <X className="w-4 h-4" strokeWidth={1.75} />
          </button>
        </div>
      )}

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-body">Fee Categories</p>
        <form onSubmit={addCategory} className="flex flex-col sm:flex-row gap-2 mb-4">
          <input value={newCat.name} onChange={e => setNewCat({ ...newCat, name: e.target.value })} placeholder="Category name (e.g. Tuition Fee)" required
            className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] font-body" />
          <input value={newCat.description} onChange={e => setNewCat({ ...newCat, description: e.target.value })} placeholder="Description (optional)"
            className="flex-1 border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] font-body" />
          <select value={newCat.serviceType} onChange={e => setNewCat({ ...newCat, serviceType: e.target.value })} title="Who is billed for this fee?"
            className="border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] font-body shrink-0">
            <option value="NONE">Class-wide</option>
            <option value="TRANSPORT">Transport (bus users)</option>
            <option value="HOSTEL">Hostel (hostelers)</option>
          </select>
          <button type="submit" className="px-4 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all shrink-0">Add Category</button>
        </form>
        <div className="space-y-2">
          {categories.map(cat => (
            <div key={cat.id} className="flex items-center justify-between px-4 py-3 bg-gray-50 border border-[#E5E7EB] rounded-lg">
              {editCat?.id === cat.id ? (
                <form className="flex gap-2 flex-1" onSubmit={async e => { e.preventDefault(); await api.put(`/fees/categories/${cat.id}`, editCat); setEditCat(null); load(); }}>
                  <input value={editCat.name} onChange={e => setEditCat({ ...editCat, name: e.target.value })} className="flex-1 border border-[#E5E7EB] rounded px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 font-body" />
                  <select value={editCat.serviceType} onChange={e => setEditCat({ ...editCat, serviceType: e.target.value })} className="border border-[#E5E7EB] rounded px-2 py-1.5 text-xs font-body">
                    <option value="NONE">Class-wide</option>
                    <option value="TRANSPORT">Transport</option>
                    <option value="HOSTEL">Hostel</option>
                  </select>
                  <button type="submit" className="px-3 py-1.5 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded text-xs font-semibold transition-all">Save</button>
                  <button type="button" onClick={() => setEditCat(null)} className="px-3 py-1.5 border border-[#E5E7EB] rounded text-xs font-semibold text-gray-600 hover:bg-white transition-all">Cancel</button>
                </form>
              ) : (
                <>
                  <div>
                    <span className="text-sm font-semibold text-gray-800 font-display">{cat.name}</span>
                    {cat.serviceType && cat.serviceType !== 'NONE' && (
                      <span className="text-[10px] font-bold uppercase tracking-wide ml-2 px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8] align-middle">{cat.serviceType}</span>
                    )}
                    {cat.description && <span className="text-xs text-gray-500 ml-2 font-body">({cat.description})</span>}
                  </div>
                  <div className="flex gap-1">
                    <button onClick={() => setEditCat({ id: cat.id, name: cat.name, serviceType: cat.serviceType || 'NONE' })} className="p-1 text-gray-400 hover:text-[#1D7A4A] hover:bg-gray-100 rounded transition-colors" title="Edit Category">
                      <Pencil className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                    <button onClick={() => api.delete(`/fees/categories/${cat.id}`).then(() => load()).catch(e => setError(e.response?.data?.error || 'Error'))} className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors" title="Delete Category">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </div>
                </>
              )}
            </div>
          ))}
          {categories.length === 0 && <p className="text-gray-400 text-sm text-center py-6 font-body">No categories yet. Add your first fee category above.</p>}
        </div>
      </div>

      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
        <div className="flex items-center justify-between pb-2 border-b border-[#E5E7EB]">
          <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-body">
            Fee Structures <span className="text-gray-400 font-normal normal-case font-body">({academicYear})</span>
          </p>
          <button onClick={() => setShowAddStruct(true)} className="inline-flex items-center gap-1 text-xs font-bold text-[#1D7A4A] hover:text-[#155D37] transition-all">
            <Plus className="w-3.5 h-3.5" strokeWidth={2} />
            Add Structure
          </button>
        </div>

        {showAddStruct && (
          <form onSubmit={addStructure} className="mb-4 p-4 border border-[#26A96B]/20 bg-[#D6F0E4]/10 rounded-xl space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Fee Category</label>
                <select required value={newStruct.feeCategoryId} onChange={e => setNewStruct({ ...newStruct, feeCategoryId: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                  <option value="">Select category</option>
                  {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Class (blank = all)</label>
                <select value={newStruct.classId} onChange={e => setNewStruct({ ...newStruct, classId: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                  <option value="">All classes</option>
                  {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Amount (₹)</label>
                <input type="number" min="0" step="0.01" required value={newStruct.amount} onChange={e => setNewStruct({ ...newStruct, amount: e.target.value })} placeholder="2000"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Frequency</label>
                <select value={newStruct.frequency} onChange={e => setNewStruct({ ...newStruct, frequency: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                  {Object.entries(FREQ_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">
                  Due Date <span className="text-gray-400 normal-case font-normal">(optional)</span>
                </label>
                <input type="date" value={newStruct.dueDate} onChange={e => setNewStruct({ ...newStruct, dueDate: e.target.value })}
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
              </div>
            </div>
            <div className="flex gap-3 pt-2 border-t border-[#E5E7EB]">
              <button type="submit" className="px-4 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-colors">Save Structure</button>
              <button type="button" onClick={() => setShowAddStruct(false)} className="px-4 py-2 border border-[#E5E7EB] rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors">Cancel</button>
            </div>
          </form>
        )}

        <div className="overflow-x-auto rounded-xl border border-[#E5E7EB]">
          <table className="w-full min-w-[720px] text-sm">
            <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
              <tr>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Category</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Class</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Amount</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Frequency</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Due Date</th>
                <th className="px-4 py-3"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E5E7EB]">
              {structures.map(s => (
                <tr key={s.id} className="hover:bg-gray-50/50">
                  <td className="px-4 py-3.5 font-semibold text-[#1A1D23] font-display">{s.feeCategory.name}</td>
                  <td className="px-4 py-3.5 text-gray-600 font-body">{s.class?.name || <span className="text-gray-400 italic">All classes</span>}</td>
                  <td className="px-4 py-3.5 font-mono font-semibold text-gray-800">{rupees(s.amount)}</td>
                  <td className="px-4 py-3.5">
                    <span className="text-[11px] bg-[#EEF2FF] text-[#4338CA] px-2.5 py-0.5 rounded-full font-bold border border-[#EEF2FF]">
                      {FREQ_LABEL[s.frequency]}
                    </span>
                  </td>
                  <td className="px-4 py-3.5 text-sm font-body">
                    {s.dueDate ? (
                      <span className="font-semibold text-[#1A1D23]">
                        {new Date(s.dueDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
                      </span>
                    ) : (
                      <span className="text-gray-400 italic text-xs">Not set</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-right">
                    <button onClick={() => api.delete(`/fees/structures/${s.id}`).then(() => load()).catch(e => setError(e.response?.data?.error || 'Error'))}
                      className="p-1 text-gray-400 hover:text-red-600 hover:bg-gray-100 rounded transition-colors" title="Remove Structure">
                      <Trash2 className="w-3.5 h-3.5" strokeWidth={1.75} />
                    </button>
                  </td>
                </tr>
              ))}
              {structures.length === 0 && (
                <tr>
                  <td colSpan={6} className="text-center text-gray-400 py-10 font-body">
                    No fee structures yet. Add a class-specific or global fee structure above.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

// ─── Collect Fee Tab ──────────────────────────────────────────────────────────

function CollectFeeTab({ classes, academicYear }: { classes: ClassItem[]; academicYear: string }) {
  const [search, setSearch] = useState('');
  const [students, setStudents] = useState<StudentSummary[]>([]);
  const [selected, setSelected] = useState<StudentSummary | null>(null);
  const [account, setAccount] = useState<any>(null);
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [form, setForm] = useState({ feeCategoryId: '', amount: '', month: '', method: 'CASH', referenceNumber: '', note: '', paidAt: new Date().toISOString().split('T')[0] });
  const [saving, setSaving] = useState(false);
  const [receipt, setReceipt] = useState<any>(null);
  const [error, setError] = useState('');

  useEffect(() => { api.get('/fees/categories').then(r => setCategories(r.data)).catch(console.error); }, []);

  useEffect(() => {
    if (!search.trim()) { setStudents([]); return; }
    const t = setTimeout(() => {
      api.get('/sis/students', { params: { search: search.trim(), limit: 8 } })
        .then(r => setStudents(r.data.students)).catch(console.error);
    }, 300);
    return () => clearTimeout(t);
  }, [search]);

  async function selectStudent(s: StudentSummary) {
    setSelected(s); setStudents([]); setSearch(''); setReceipt(null); setError('');
    const { data } = await api.get(`/fees/students/${s.id}/account`);
    setAccount(data);
    const firstDue = data.breakdown.find((b: any) => b.due > 0);
    if (firstDue) setForm(f => ({ ...f, feeCategoryId: firstDue.feeCategoryId, amount: String(firstDue.structureAmount) }));
  }

  async function handleCollect(e: React.FormEvent) {
    e.preventDefault(); setError(''); setSaving(true);
    try {
      const { data } = await api.post('/fees/payments', { ...form, studentId: selected!.id });
      const { data: full } = await api.get(`/fees/payments/${data.id}`);
      setReceipt(full);
      const { data: acc } = await api.get(`/fees/students/${selected!.id}/account`);
      setAccount(acc);
      setForm(f => ({ ...f, feeCategoryId: '', amount: '', month: '', referenceNumber: '', note: '' }));
    } catch (err: any) { setError(err.response?.data?.error || 'Failed to record payment.'); }
    finally { setSaving(false); }
  }

  return (
    <div className="max-w-4xl space-y-6">
      {!selected ? (
        <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm space-y-4">
          <label className="block text-sm font-semibold text-gray-700 font-display">Collect Student Fee</label>
          <div className="relative">
            <input value={search} onChange={e => setSearch(e.target.value)} placeholder="Search student by name or admission number... (e.g. Amit Kumar)"
              className="w-full pl-9 border border-[#E5E7EB] rounded-lg py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
            <Search className="w-4 h-4 text-gray-400 absolute left-3 top-3" strokeWidth={1.75} />
          </div>
          {students.length > 0 && (
            <div className="border border-[#E5E7EB] rounded-xl overflow-hidden shadow-sm divide-y divide-[#E5E7EB]">
              {students.map(s => (
                <button key={s.id} onClick={() => selectStudent(s)} className="w-full flex items-center justify-between px-4 py-3 bg-white hover:bg-gray-50 transition-colors text-left">
                  <div>
                    <span className="font-semibold text-sm text-[#1A1D23] font-display">{s.firstName} {s.lastName}</span>
                    <span className="text-[11px] bg-gray-100 text-gray-600 px-2 py-0.5 rounded border border-gray-200 ml-2 font-mono">{s.admissionNumber}</span>
                  </div>
                  <User className="w-4 h-4 text-gray-400" strokeWidth={1.75} />
                </button>
              ))}
            </div>
          )}
        </div>
      ) : (
        <div className="space-y-6">
          <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-[#D6F0E4] border border-[#26A96B] flex items-center justify-center font-bold text-xs text-[#0F6E56] uppercase shrink-0 font-display">
                {selected.firstName[0]}{selected.lastName[0]}
              </div>
              <div>
                <p className="font-semibold text-gray-900 font-display">{selected.firstName} {selected.lastName}</p>
                <p className="text-xs text-gray-400 font-mono mt-0.5">{selected.admissionNumber}</p>
              </div>
            </div>
            <button onClick={() => { setSelected(null); setAccount(null); setReceipt(null); }} className="text-xs font-semibold text-gray-500 hover:text-red-600 transition-colors">Change Student</button>
          </div>

          {account && (
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              {([['Total Structure', account.summary.totalStructure, 'text-[#1A1D23] bg-white border-[#E5E7EB]'],['Total Paid', account.summary.totalPaid, 'text-[#0F6E56] bg-[#D6F0E4]/10 border-[#26A96B]/20'],['Outstanding Balance', account.summary.totalDue, account.summary.totalDue > 0 ? 'text-[#991B1B] bg-[#FEE2E2]/20 border-[#EF4444]/20' : 'text-[#0F6E56] bg-[#D6F0E4]/10 border-[#26A96B]/20']] as [string,number,string][]).map(([l, v, c]) => (
                <div key={l} className={`rounded-xl border p-4 text-center ${c} shadow-sm space-y-1`}>
                  <p className="text-2xl font-bold font-mono">{rupees(v)}</p>
                  <p className="text-xs text-gray-500 font-semibold uppercase tracking-wider font-body">{l}</p>
                </div>
              ))}
            </div>
          )}

          {receipt ? (
            <div className="bg-white rounded-xl border border-[#26A96B] p-5 shadow-sm space-y-4">
              <div className="flex items-center gap-2 border-b border-[#26A96B]/20 pb-3">
                <div className="w-5 h-5 rounded-full bg-[#D6F0E4] border border-[#26A96B] flex items-center justify-center text-[#0F6E56] font-bold text-xs">✓</div>
                <p className="font-semibold text-gray-900 font-display">Payment successfully processed!</p>
                <span className="ml-auto font-mono text-xs text-gray-500 bg-gray-100 border border-gray-200 px-2 py-0.5 rounded">{receipt.receiptNumber}</span>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-sm font-body">
                <div><span className="text-gray-400">Category: </span><span className="font-semibold text-gray-800">{receipt.feeCategory.name}</span></div>
                <div><span className="text-gray-400">Amount Collected: </span><span className="font-bold text-[#0F6E56]">{rupees(receipt.amount)}</span></div>
                <div><span className="text-gray-400">Payment Method: </span><span className="font-semibold text-gray-800">{METHOD_LABEL[receipt.method]}</span></div>
                <div><span className="text-gray-400">Transaction Date: </span><span className="font-semibold text-gray-800">{new Date(receipt.paidAt).toLocaleDateString('en-IN')}</span></div>
              </div>
              <button onClick={() => setReceipt(null)} className="text-sm font-semibold text-[#1D7A4A] hover:underline pt-2 block transition-all">Record Another Fee Payment →</button>
            </div>
          ) : (
            <form onSubmit={handleCollect} className="bg-white rounded-xl border border-[#E5E7EB] p-5 shadow-sm space-y-5">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 font-body">Record Cash / Online Payment</p>
              {error && (
                <div className="bg-[#FAEEDA] border border-[#F59E0B]/20 text-[#854F0B] text-sm rounded-lg px-4 py-2 font-body font-medium flex justify-between items-center">
                  <span>{error}</span>
                  <button type="button" onClick={() => setError('')} className="p-1 hover:bg-[#854F0B]/10 rounded"><X className="w-3.5 h-3.5" /></button>
                </div>
              )}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Fee Category *</label>
                  <select required value={form.feeCategoryId} onChange={e => setForm({ ...form, feeCategoryId: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                    <option value="">Select category</option>
                    {categories.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Amount (₹) *</label>
                  <input type="number" min="0.01" step="0.01" required value={form.amount} onChange={e => setForm({ ...form, amount: e.target.value })} placeholder="2000"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Payment Method</label>
                  <select value={form.method} onChange={e => setForm({ ...form, method: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
                    {Object.entries(METHOD_LABEL).map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Payment Date</label>
                  <input type="date" value={form.paidAt} onChange={e => setForm({ ...form, paidAt: e.target.value })}
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Month/Period</label>
                  <input value={form.month} onChange={e => setForm({ ...form, month: e.target.value })} placeholder="e.g. April 2025"
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
                </div>
                <div>
                  <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Reference No.</label>
                  <input value={form.referenceNumber} onChange={e => setForm({ ...form, referenceNumber: e.target.value })} placeholder="Cheque/UPI/transaction no."
                    className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
                </div>
              </div>
              <div>
                <label className="block text-xs font-semibold uppercase tracking-wider text-gray-500 mb-1 font-body">Note</label>
                <input value={form.note} onChange={e => setForm({ ...form, note: e.target.value })} placeholder="Any remarks"
                  className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] transition-all font-body" />
              </div>
              <button type="submit" disabled={saving} className="w-full bg-[#1D7A4A] hover:bg-[#155D37] text-white py-2.5 rounded-lg font-semibold text-sm transition-all disabled:opacity-60">
                {saving ? 'Recording transaction...' : 'Record Payment & Generate Receipt'}
              </button>
            </form>
          )}
        </div>
      )}
    </div>
  );
}

// ─── Payment History Tab ──────────────────────────────────────────────────────

function PaymentHistoryTab() {
  const [payments, setPayments] = useState<Payment[]>([]);
  const [total, setTotal] = useState(0);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [receipt, setReceipt] = useState<any>(null);
  const LIMIT = 20;

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/payments', { params: { page, limit: LIMIT } });
      setPayments(data.payments); setTotal(data.total);
    } finally { setLoading(false); }
  }, [page]);

  useEffect(() => { load(); }, [load]);

  async function viewReceipt(id: string) {
    const { data } = await api.get(`/fees/payments/${id}`);
    setReceipt(data);
  }

  const totalPages = Math.ceil(total / LIMIT);

  return (
    <div className="max-w-4xl space-y-4">
      {receipt && (
        <div className="fixed inset-0 bg-black/40 backdrop-blur-[2px] z-50 flex items-center justify-center p-4" onClick={() => setReceipt(null)}>
          <div className="bg-white rounded-2xl p-6 sm:p-8 max-w-md w-full shadow-2xl border border-[#E5E7EB]" onClick={e => e.stopPropagation()}>
            <div className="text-center pb-4 border-b border-dashed border-[#E5E7EB] space-y-1">
              <p className="text-[10px] font-bold bg-[#D6F0E4] text-[#0F6E56] border border-[#26A96B]/20 px-2 py-0.5 rounded-full inline-block">FEE PAYMENT RECEIPT</p>
              <p className="text-xl font-bold text-gray-900 font-display mt-2">{receipt.tenant?.profile?.schoolName || 'School Workspace'}</p>
              {receipt.tenant?.profile?.address && <p className="text-xs text-gray-500 font-body">{receipt.tenant.profile.address}</p>}
            </div>
            <div className="pt-4 space-y-2 text-sm font-body">
              {[
                ['Receipt No.', receipt.receiptNumber, 'font-mono font-semibold text-gray-800 bg-gray-50 border border-gray-200 px-1.5 py-0.2 rounded text-[12px]'],
                ['Student', `${receipt.student?.firstName} ${receipt.student?.lastName}`, 'font-semibold text-gray-800'],
                ['Adm. No.', receipt.student?.admissionNumber, 'font-mono text-xs text-gray-800'],
                ['Class', receipt.student?.class?.name || '—', 'text-gray-800'],
                ['Fee Category', receipt.feeCategory?.name, 'font-semibold text-gray-800'],
                ...(receipt.month ? [['Period', receipt.month, 'text-gray-800']] : []),
                ['Method', METHOD_LABEL[receipt.method] || receipt.method, 'text-gray-800'],
                ...(receipt.referenceNumber ? [['Ref. No.', receipt.referenceNumber, 'font-mono text-xs text-gray-800']] : []),
                ['Date Paid', new Date(receipt.paidAt).toLocaleDateString('en-IN'), 'text-gray-800'],
              ].map(([label, val, cls]) => (
                <div key={String(label)} className="flex justify-between py-0.5">
                  <span className="text-gray-400 font-medium">{label}</span>
                  <span className={String(cls)}>{val}</span>
                </div>
              ))}
              <div className="flex justify-between items-center border-t border-dashed border-[#E5E7EB] pt-3 mt-3">
                <span className="font-semibold text-gray-600 font-display">Amount Paid</span>
                <span className="text-2xl font-bold text-[#0F6E56] font-mono">{rupees(receipt.amount)}</span>
              </div>
            </div>
            <div className="border-t border-[#E5E7EB] pt-4 mt-6 flex flex-col items-center gap-4">
              <p className="text-center text-[11px] text-gray-400 font-body">Collected by: <span className="font-semibold text-gray-600">{receipt.collectedBy?.firstName} {receipt.collectedBy?.lastName}</span></p>
              <button onClick={() => setReceipt(null)} className="w-full border border-[#E5E7EB] text-gray-600 font-semibold rounded-lg py-2 text-sm hover:bg-gray-50 transition-colors">Close Receipt</button>
            </div>
          </div>
        </div>
      )}

      {loading ? (
        <div className="py-12 text-center text-gray-400 font-body text-sm">Loading payment log history...</div>
      ) : (
        <>
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Receipt</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Category</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Amount</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Method</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Date</th>
                  <th className="px-4 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {payments.map(p => (
                  <tr key={p.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3 font-mono text-xs text-gray-500 font-bold">{p.receiptNumber}</td>
                    <td className="px-4 py-3 font-semibold text-gray-900 font-display">{p.student.firstName} {p.student.lastName}</td>
                    <td className="px-4 py-3 text-gray-600 font-body">{p.feeCategory.name}{p.month && <span className="text-gray-400 text-xs ml-1 font-body">({p.month})</span>}</td>
                    <td className="px-4 py-3 font-semibold text-[#0F6E56] font-mono">{rupees(p.amount)}</td>
                    <td className="px-4 py-3">
                      <span className="text-[11px] bg-gray-100 text-gray-700 px-2 py-0.5 rounded border border-gray-200 font-semibold font-body">
                        {METHOD_LABEL[p.method] || p.method}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-400 text-xs font-body">{new Date(p.paidAt).toLocaleDateString('en-IN')}</td>
                    <td className="px-4 py-3 text-right">
                      <button onClick={() => viewReceipt(p.id)} className="text-xs font-semibold text-[#1D7A4A] hover:underline">View Receipt</button>
                    </td>
                  </tr>
                ))}
                {payments.length === 0 && (
                  <tr>
                    <td colSpan={7} className="text-center text-gray-400 py-10 font-body">
                      No payments found on the ledger yet.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
          {totalPages > 1 && (
            <div className="flex justify-between items-center pt-2">
              <p className="text-sm text-gray-500 font-body">Page {page} of {totalPages}</p>
              <div className="flex gap-2">
                <button disabled={page === 1} onClick={() => setPage(p => p - 1)} className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors">Prev</button>
                <button disabled={page === totalPages} onClick={() => setPage(p => p + 1)} className="px-3 py-1.5 border border-[#E5E7EB] rounded-lg text-xs font-semibold disabled:opacity-40 hover:bg-gray-50 transition-colors">Next</button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}

// ─── Due Report Tab ───────────────────────────────────────────────────────────

function DueReportTab({ classes }: { classes: ClassItem[] }) {
  const [classId, setClassId] = useState('');
  const [report, setReport] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  async function loadReport() {
    setLoading(true);
    try {
      const { data } = await api.get('/fees/due-report', { params: classId ? { classId } : {} });
      setReport(data); setLoaded(true);
    } finally { setLoading(false); }
  }

  const totalDue = report.reduce((a, r) => a + r.balance, 0);

  return (
    <div className="max-w-4xl space-y-6">
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 font-body">Filter by Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20 focus:border-[#1D7A4A] bg-white transition-all font-body">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <button onClick={loadReport} disabled={loading}
          className="w-full sm:w-auto px-5 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shrink-0">
          {loading ? 'Generating...' : 'Generate Report'}
        </button>
      </div>

      {loaded && (
        <>
          <div className="p-4 bg-[#FEE2E2]/30 border border-[#EF4444]/20 rounded-xl flex items-center justify-between shadow-sm">
            <p className="text-sm font-semibold text-[#991B1B] font-display">{report.length} student{report.length !== 1 ? 's' : ''} found with outstanding dues</p>
            <p className="text-2xl font-bold text-[#991B1B] font-mono">{rupees(totalDue)}</p>
          </div>

          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto shadow-sm">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Class</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Total Fees</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Balance Due</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {report.map(r => (
                  <tr key={r.student.id} className="hover:bg-gray-50/50">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-900 font-display">{r.student.firstName} {r.student.lastName}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{r.student.admissionNumber}</p>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-body">{r.student.class?.name || '—'}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-600">{rupees(r.totalDue)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[#0F6E56] font-semibold">{rupees(r.totalPaid)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-red-600">{rupees(r.balance)}</td>
                  </tr>
                ))}
                {report.length === 0 && (
                  <tr>
                    <td colSpan={5} className="text-center text-[#0F6E56] font-bold py-10 text-sm font-body">
                      All clear! There are zero outstanding student dues for this selection.
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

// ─── Defaulter Report Tab (class + category, service-aware) ───────────────────
function DefaulterReportTab({ classes }: { classes: ClassItem[] }) {
  const [categories, setCategories] = useState<FeeCategory[]>([]);
  const [classId, setClassId] = useState('');
  const [feeCategoryId, setFeeCategoryId] = useState('');
  const [defaultersOnly, setDefaultersOnly] = useState(true);
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => { api.get('/fees/categories').then(r => setCategories(r.data)).catch(() => {}); }, []);

  async function generate() {
    setLoading(true);
    try {
      const params: any = { defaultersOnly: String(defaultersOnly) };
      if (classId) params.classId = classId;
      if (feeCategoryId) params.feeCategoryId = feeCategoryId;
      const { data } = await api.get('/fees/defaulter-report', { params });
      setData(data);
    } finally { setLoading(false); }
  }

  const s = data?.summary;

  return (
    <div className="space-y-6">
      {/* filters */}
      <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm flex flex-col sm:flex-row gap-4 items-end">
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 font-body">Class</label>
          <select value={classId} onChange={e => setClassId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white font-body focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20">
            <option value="">All Classes</option>
            {classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </div>
        <div className="flex-1 w-full">
          <label className="block text-xs font-bold uppercase tracking-wider text-gray-500 mb-1 font-body">Fee Category</label>
          <select value={feeCategoryId} onChange={e => setFeeCategoryId(e.target.value)}
            className="w-full border border-[#E5E7EB] rounded-lg px-3 py-2 text-sm bg-white font-body focus:outline-none focus:ring-2 focus:ring-[#1D7A4A]/20">
            <option value="">All Categories</option>
            {categories.map(c => <option key={c.id} value={c.id}>{c.name}{c.serviceType && c.serviceType !== 'NONE' ? ` (${c.serviceType})` : ''}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 text-sm font-medium text-gray-600 font-body pb-2 shrink-0">
          <input type="checkbox" checked={defaultersOnly} onChange={e => setDefaultersOnly(e.target.checked)} className="accent-[#1D7A4A]" />
          Defaulters only
        </label>
        <button onClick={generate} disabled={loading}
          className="w-full sm:w-auto px-5 py-2 bg-[#1D7A4A] hover:bg-[#155D37] text-white rounded-lg text-sm font-semibold transition-all disabled:opacity-50 shrink-0">
          {loading ? 'Generating...' : 'Generate'}
        </button>
      </div>

      {data && (
        <>
          {/* summary cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            <Stat label="Students" value={s.totalStudents} />
            <Stat label="Defaulters" value={s.defaulters} tone="red" />
            <Stat label="Collected" value={rupees(s.totalCollected)} tone="green" />
            <Stat label="Outstanding" value={rupees(s.totalOutstanding)} tone="red" />
          </div>

          {/* per-category headline (e.g. transport fee defaulters) */}
          {data.categoryTotals?.length > 0 && (
            <div className="bg-white border border-[#E5E7EB] rounded-xl p-5 shadow-sm">
              <p className="text-xs font-bold uppercase tracking-wider text-gray-500 mb-3 font-body">Outstanding by Category</p>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                {data.categoryTotals.map((c: any) => (
                  <div key={c.feeCategoryId} className="border border-[#E5E7EB] rounded-lg px-3 py-2">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-semibold text-gray-800 font-display">{c.name}</span>
                      {c.serviceType !== 'NONE' && <span className="text-[10px] font-bold uppercase px-1.5 py-0.5 rounded bg-[#EFF6FF] text-[#1D4ED8]">{c.serviceType}</span>}
                    </div>
                    <div className="flex items-center justify-between mt-1 text-xs font-body">
                      <span className="text-red-600 font-bold">{c.defaulters} unpaid</span>
                      <span className="font-mono font-bold text-red-600">{rupees(c.outstanding)}</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* detailed table */}
          <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden shadow-sm overflow-x-auto">
            <table className="w-full min-w-[720px] text-sm">
              <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]">
                <tr>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Student</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Class</th>
                  <th className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Unpaid Categories</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Billed</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Paid</th>
                  <th className="text-right px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider font-body">Outstanding</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E5E7EB]">
                {data.rows.map((r: any) => (
                  <tr key={r.student.id} className="hover:bg-gray-50/50 align-top">
                    <td className="px-4 py-3.5">
                      <p className="font-semibold text-gray-900 font-display">{r.student.firstName} {r.student.lastName}</p>
                      <p className="text-xs text-gray-400 font-mono mt-0.5">{r.student.admissionNumber}</p>
                      <span className="text-[10px] font-bold uppercase text-gray-400">{r.student.boardingType === 'HOSTELER' ? 'Hosteler' : 'Day Scholar'}{r.student.hasBus ? ' · Bus' : ''}</span>
                    </td>
                    <td className="px-4 py-3.5 text-gray-600 font-body">{r.student.class?.name || '—'}{r.student.section?.name ? ` · ${r.student.section.name}` : ''}</td>
                    <td className="px-4 py-3.5">
                      <div className="flex flex-wrap gap-1">
                        {r.categories.filter((c: any) => c.due > 0).map((c: any) => (
                          <span key={c.feeCategoryId} className="text-[11px] font-medium px-1.5 py-0.5 rounded bg-[#FEF2F2] text-[#B91C1C] font-body" title={`Billed ${rupees(c.billed)}, paid ${rupees(c.paid)}`}>
                            {c.name}: {rupees(c.due)}
                          </span>
                        ))}
                        {r.categories.filter((c: any) => c.due > 0).length === 0 && <span className="text-xs text-[#0F6E56] font-semibold">Fully paid</span>}
                      </div>
                    </td>
                    <td className="px-4 py-3.5 text-right font-mono text-gray-600">{rupees(r.billed)}</td>
                    <td className="px-4 py-3.5 text-right font-mono text-[#0F6E56] font-semibold">{rupees(r.paid)}</td>
                    <td className="px-4 py-3.5 text-right font-mono font-bold text-red-600">{rupees(r.outstanding)}</td>
                  </tr>
                ))}
                {data.rows.length === 0 && (
                  <tr><td colSpan={6} className="text-center text-[#0F6E56] font-bold py-10 text-sm font-body">No defaulters for this selection. 🎉</td></tr>
                )}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}

function Stat({ label, value, tone }: { label: string; value: React.ReactNode; tone?: 'red' | 'green' }) {
  const color = tone === 'red' ? 'text-[#B91C1C]' : tone === 'green' ? 'text-[#0F6E56]' : 'text-[#1A1D23]';
  return (
    <div className="bg-white border border-[#E5E7EB] rounded-xl p-4 shadow-sm">
      <p className="text-xs font-bold uppercase tracking-wider text-gray-400 font-body">{label}</p>
      <p className={`text-xl font-bold font-mono mt-1 ${color}`}>{value}</p>
    </div>
  );
}
