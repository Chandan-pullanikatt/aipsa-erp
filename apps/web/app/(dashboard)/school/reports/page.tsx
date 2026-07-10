'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { ClipboardList, Loader2, Plus, Trash2, BarChart3, Save, CheckCircle2, Wrench, History as HistoryIcon } from 'lucide-react';

const rupees = (n: number) => '₹' + (n || 0).toLocaleString('en-IN');
const todayStr = () => new Date().toISOString().split('T')[0];

interface Particular { id: string; name: string; inputType: 'TEXT' | 'NUMBER' | 'CURRENCY' | 'STATUS'; isKpi: boolean; isActive: boolean; }
interface Area { id: string; name: string; isActive: boolean; particulars: Particular[]; }
interface EntryVal { valueText?: string; valueNum?: string; remarks?: string; followUp?: string; }

const TABS = ['Daily Report', 'Dashboard', 'KPI Builder', 'History'] as const;
type Tab = typeof TABS[number];

export default function ReportsPage() {
  const [tab, setTab] = useState<Tab>('Daily Report');
  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><ClipboardList className="w-6 h-6 text-[#1D7A4A]" /> Daily KPI &amp; Reports</h1>
        <p className="text-sm text-[#6B7280] font-medium mt-1">Principal&apos;s daily monitoring report — academics, hostel &amp; administration.</p>
      </div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
        {TABS.map(t => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Daily Report' && <DailyReportTab />}
      {tab === 'Dashboard' && <DashboardTab />}
      {tab === 'KPI Builder' && <BuilderTab />}
      {tab === 'History' && <HistoryTab onOpen={() => setTab('Daily Report')} />}
    </div>
  );
}

// ─── Daily Report ────────────────────────────────────────────────────────────────

function DailyReportTab() {
  const [date, setDate] = useState(todayStr());
  const [areas, setAreas] = useState<Area[]>([]);
  const [entries, setEntries] = useState<Record<string, EntryVal>>({});
  const [summary, setSummary] = useState('');
  const [status, setStatus] = useState<'DRAFT' | 'SUBMITTED'>('DRAFT');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [notice, setNotice] = useState('');
  const [error, setError] = useState('');

  const load = useCallback(async (d: string) => {
    setLoading(true); setNotice(''); setError('');
    try {
      const [areasRes, reportRes] = await Promise.all([
        api.get('/kpi/areas'),
        api.get(`/kpi/reports/${d}`),
      ]);
      setAreas(areasRes.data);
      const report = reportRes.data;
      const next: Record<string, EntryVal> = {};
      if (report) {
        setSummary(report.summary || '');
        setStatus(report.status || 'DRAFT');
        for (const e of report.entries) {
          next[e.particularId] = {
            valueText: e.valueText ?? '',
            valueNum: e.valueNum != null ? String(e.valueNum) : '',
            remarks: e.remarks ?? '',
            followUp: e.followUp ?? '',
          };
        }
      } else {
        setSummary(''); setStatus('DRAFT');
      }
      setEntries(next);
    } catch (e: any) {
      setError(e.response?.data?.error || 'Failed to load report.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { load(date); }, [date, load]);

  function setField(pid: string, field: keyof EntryVal, value: string) {
    setEntries(prev => ({ ...prev, [pid]: { ...prev[pid], [field]: value } }));
  }

  async function save(nextStatus: 'DRAFT' | 'SUBMITTED') {
    setSaving(true); setNotice(''); setError('');
    try {
      const payload = {
        reportDate: date,
        status: nextStatus,
        summary,
        entries: Object.entries(entries)
          .filter(([, v]) => v && (v.valueText || v.valueNum || v.remarks || v.followUp))
          .map(([particularId, v]) => ({
            particularId,
            valueText: v.valueText || undefined,
            valueNum: v.valueNum || undefined,
            remarks: v.remarks || undefined,
            followUp: v.followUp || undefined,
          })),
      };
      await api.post('/kpi/reports', payload);
      setStatus(nextStatus);
      setNotice(nextStatus === 'SUBMITTED' ? 'Report submitted.' : 'Draft saved.');
    } catch (e: any) {
      setError(e.response?.data?.error || 'Could not save the report.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3 bg-white rounded-xl border border-[#E5E7EB] p-4">
        <label className="text-sm font-semibold text-[#6B7280]">Report date</label>
        <input type="date" value={date} max={todayStr()} onChange={e => setDate(e.target.value)}
          className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <span className={`text-xs font-semibold px-2 py-1 rounded ${status === 'SUBMITTED' ? 'bg-[#E5F6EE] text-[#0F6E56]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>{status}</span>
        <div className="ml-auto flex gap-2">
          <button onClick={() => save('DRAFT')} disabled={saving} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold text-[#6B7280] inline-flex items-center gap-1.5 disabled:opacity-60"><Save className="w-4 h-4" /> Save Draft</button>
          <button onClick={() => save('SUBMITTED')} disabled={saving} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-1.5 disabled:opacity-60">{saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <CheckCircle2 className="w-4 h-4" />} Submit</button>
        </div>
      </div>

      {notice && <p className="text-sm font-semibold text-[#0F6E56] bg-[#E5F6EE] border border-[#A7F3D0] rounded-lg px-4 py-2">{notice}</p>}
      {error && <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-2">{error}</p>}

      {loading ? (
        <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : (
        <>
          {areas.map(area => (
            <div key={area.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
              <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E7EB]"><h3 className="text-sm font-bold text-[#1A1D23]">{area.name}</h3></div>
              <div className="divide-y divide-[#F3F4F6]">
                {area.particulars.map(p => {
                  const v = entries[p.id] || {};
                  return (
                    <div key={p.id} className="px-4 py-3 grid grid-cols-1 sm:grid-cols-12 gap-2 items-center">
                      <div className="sm:col-span-4 flex items-center gap-1.5">
                        <span className="text-sm text-[#374151]">{p.name}</span>
                        {p.isKpi && <span className="text-[9px] font-bold px-1 py-0.5 rounded bg-[#EEF2FF] text-[#4F46E5]">KPI</span>}
                      </div>
                      <div className="sm:col-span-3">
                        {p.inputType === 'STATUS' ? (
                          <select value={v.valueText || ''} onChange={e => setField(p.id, 'valueText', e.target.value)} className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm bg-white">
                            <option value="">—</option>
                            <option value="Done">Done</option>
                            <option value="Pending">Pending</option>
                            <option value="Not Applicable">Not Applicable</option>
                            <option value="Issue">Issue</option>
                          </select>
                        ) : p.inputType === 'NUMBER' || p.inputType === 'CURRENCY' ? (
                          <input type="number" value={v.valueNum || ''} onChange={e => setField(p.id, 'valueNum', e.target.value)}
                            placeholder={p.inputType === 'CURRENCY' ? '₹ amount' : 'number'}
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
                        ) : (
                          <input value={v.valueText || ''} onChange={e => setField(p.id, 'valueText', e.target.value)} placeholder="Report"
                            className="w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
                        )}
                      </div>
                      <input value={v.remarks || ''} onChange={e => setField(p.id, 'remarks', e.target.value)} placeholder="Remarks"
                        className="sm:col-span-3 w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
                      <input value={v.followUp || ''} onChange={e => setField(p.id, 'followUp', e.target.value)} placeholder="Follow-up"
                        className="sm:col-span-2 w-full px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
                    </div>
                  );
                })}
                {area.particulars.length === 0 && <p className="px-4 py-4 text-sm text-[#9CA3AF] italic">No particulars in this area.</p>}
              </div>
            </div>
          ))}

          <div className="bg-white rounded-xl border border-[#E5E7EB] p-4">
            <label className="text-sm font-semibold text-[#6B7280] block mb-2">Overall summary / notes</label>
            <textarea value={summary} onChange={e => setSummary(e.target.value)} rows={3} placeholder="Prepared by, general remarks…"
              className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          </div>
        </>
      )}
    </div>
  );
}

// ─── Dashboard ───────────────────────────────────────────────────────────────────

interface KpiCard { id: string; name: string; area: string; inputType: string; series: { date: string; value: number }[]; latest: number | null; sum: number; avg: number | null; count: number; }

function Sparkline({ series }: { series: { value: number }[] }) {
  if (series.length < 2) return <div className="h-8" />;
  const vals = series.map(s => s.value);
  const min = Math.min(...vals), max = Math.max(...vals);
  const range = max - min || 1;
  const w = 120, h = 32;
  const pts = vals.map((v, i) => `${(i / (vals.length - 1)) * w},${h - ((v - min) / range) * h}`).join(' ');
  return (
    <svg width={w} height={h} className="overflow-visible">
      <polyline points={pts} fill="none" stroke="#1D7A4A" strokeWidth="1.5" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  );
}

function DashboardTab() {
  const [cards, setCards] = useState<KpiCard[]>([]);
  const [loading, setLoading] = useState(true);
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/kpi/dashboard', { params: { ...(from && { from }), ...(to && { to }) } });
      setCards(data);
    } finally {
      setLoading(false);
    }
  }, [from, to]);

  useEffect(() => { load(); }, [load]);

  const fmt = (n: number | null, type: string) => n == null ? '—' : type === 'CURRENCY' ? rupees(n) : n.toLocaleString('en-IN');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2 bg-white rounded-xl border border-[#E5E7EB] p-4">
        <BarChart3 className="w-4 h-4 text-[#1D7A4A]" />
        <span className="text-sm font-semibold text-[#6B7280] mr-2">Trends</span>
        <label className="text-xs text-[#9CA3AF]">From</label>
        <input type="date" value={from} onChange={e => setFrom(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
        <label className="text-xs text-[#9CA3AF]">To</label>
        <input type="date" value={to} onChange={e => setTo(e.target.value)} className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
      </div>

      {loading ? (
        <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
      ) : cards.length === 0 ? (
        <div className="bg-white rounded-xl border border-[#E5E7EB] py-16 text-center text-sm text-[#9CA3AF]">No KPI metrics defined. Mark particulars as KPI in the Builder.</div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {cards.map(c => (
            <div key={c.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
              <p className="text-[11px] font-semibold text-[#9CA3AF] uppercase tracking-wide">{c.area}</p>
              <p className="text-sm font-semibold text-[#1A1D23] mt-0.5">{c.name}</p>
              <div className="flex items-end justify-between mt-3">
                <div>
                  <p className="text-2xl font-bold text-[#1D7A4A] font-mono leading-none">{fmt(c.latest, c.inputType)}</p>
                  <p className="text-[11px] text-[#9CA3AF] mt-1">latest{c.count > 0 && ` · avg ${fmt(c.avg, c.inputType)} · ${c.count} days`}</p>
                </div>
                <Sparkline series={c.series} />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ─── KPI Builder ─────────────────────────────────────────────────────────────────

function BuilderTab() {
  const [areas, setAreas] = useState<Area[]>([]);
  const [loading, setLoading] = useState(true);
  const [newArea, setNewArea] = useState('');
  const [newPart, setNewPart] = useState<Record<string, { name: string; inputType: string; isKpi: boolean }>>({});

  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/kpi/areas', { params: { includeInactive: true } }); setAreas(data); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { load(); }, [load]);

  async function addArea() {
    if (!newArea.trim()) return;
    await api.post('/kpi/areas', { name: newArea, order: areas.length });
    setNewArea(''); await load();
  }
  async function delArea(id: string) { if (!confirm('Delete this area and all its particulars?')) return; await api.delete(`/kpi/areas/${id}`); await load(); }
  async function addPart(areaId: string) {
    const p = newPart[areaId]; if (!p?.name?.trim()) return;
    await api.post(`/kpi/areas/${areaId}/particulars`, { name: p.name, inputType: p.inputType || 'TEXT', isKpi: !!p.isKpi });
    setNewPart(prev => ({ ...prev, [areaId]: { name: '', inputType: 'TEXT', isKpi: false } })); await load();
  }
  async function delPart(id: string) { if (!confirm('Delete this particular?')) return; await api.delete(`/kpi/particulars/${id}`); await load(); }
  async function toggleKpi(p: Particular) { await api.put(`/kpi/particulars/${p.id}`, { isKpi: !p.isKpi }); await load(); }

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 bg-white rounded-xl border border-[#E5E7EB] p-4">
        <Wrench className="w-4 h-4 text-[#1D7A4A]" />
        <input placeholder="New area name (e.g. Transport)" value={newArea} onChange={e => setNewArea(e.target.value)} className="flex-1 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <button onClick={addArea} className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="w-4 h-4" /> Area</button>
      </div>

      {areas.map(area => {
        const np = newPart[area.id] || { name: '', inputType: 'TEXT', isKpi: false };
        return (
          <div key={area.id} className="bg-white rounded-xl border border-[#E5E7EB] overflow-hidden">
            <div className="px-4 py-2.5 bg-[#F8FAFC] border-b border-[#E5E7EB] flex items-center justify-between">
              <h3 className="text-sm font-bold text-[#1A1D23]">{area.name}</h3>
              <button onClick={() => delArea(area.id)}><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
            </div>
            <div className="divide-y divide-[#F3F4F6]">
              {area.particulars.map(p => (
                <div key={p.id} className="px-4 py-2.5 flex items-center gap-2 text-sm">
                  <span className="flex-1 text-[#374151]">{p.name}</span>
                  <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-[#F3F4F6] text-[#6B7280]">{p.inputType}</span>
                  <button onClick={() => toggleKpi(p)} className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${p.isKpi ? 'bg-[#EEF2FF] text-[#4F46E5]' : 'bg-[#F3F4F6] text-[#9CA3AF]'}`}>KPI</button>
                  <button onClick={() => delPart(p.id)}><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button>
                </div>
              ))}
            </div>
            <div className="px-4 py-3 bg-[#FBFCFD] flex flex-wrap items-center gap-2 border-t border-[#F3F4F6]">
              <input placeholder="New particular" value={np.name} onChange={e => setNewPart(prev => ({ ...prev, [area.id]: { ...np, name: e.target.value } }))} className="flex-1 min-w-[140px] px-3 py-1.5 rounded-lg border border-[#E5E7EB] text-sm" />
              <select value={np.inputType} onChange={e => setNewPart(prev => ({ ...prev, [area.id]: { ...np, inputType: e.target.value } }))} className="px-2.5 py-1.5 rounded-lg border border-[#E5E7EB] text-sm bg-white">
                {['TEXT', 'NUMBER', 'CURRENCY', 'STATUS'].map(t => <option key={t} value={t}>{t}</option>)}
              </select>
              <label className="text-xs text-[#6B7280] flex items-center gap-1"><input type="checkbox" checked={np.isKpi} onChange={e => setNewPart(prev => ({ ...prev, [area.id]: { ...np, isKpi: e.target.checked } }))} /> KPI</label>
              <button onClick={() => addPart(area.id)} className="px-3 py-1.5 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-1"><Plus className="w-3.5 h-3.5" /> Add</button>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── History ─────────────────────────────────────────────────────────────────────

function HistoryTab({ onOpen }: { onOpen: () => void }) {
  const [rows, setRows] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => { api.get('/kpi/reports', { params: { limit: 60 } }).then(r => setRows(r.data)).finally(() => setLoading(false)); }, []);
  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  return (
    <div className="bg-white rounded-xl border border-[#E5E7EB] overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-[#F8FAFC] border-b border-[#E5E7EB]"><tr>{['Date', 'Prepared by', 'Entries', 'Status'].map(h => <th key={h} className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">{h}</th>)}</tr></thead>
        <tbody className="divide-y divide-[#F3F4F6]">
          {rows.map(r => (
            <tr key={r.id} className="hover:bg-[#F9FAFB]">
              <td className="px-4 py-3 font-medium text-[#1A1D23]">{new Date(r.reportDate).toLocaleDateString('en-IN', { weekday: 'short', day: '2-digit', month: 'short', year: 'numeric' })}</td>
              <td className="px-4 py-3 text-[#6B7280]">{r.preparedBy ? `${r.preparedBy.firstName} ${r.preparedBy.lastName}` : '—'}</td>
              <td className="px-4 py-3 text-[#6B7280]">{r._count?.entries ?? 0}</td>
              <td className="px-4 py-3"><span className={`text-xs font-semibold px-2 py-0.5 rounded ${r.status === 'SUBMITTED' ? 'bg-[#E5F6EE] text-[#0F6E56]' : 'bg-[#FEF3C7] text-[#92400E]'}`}>{r.status}</span></td>
            </tr>
          ))}
          {rows.length === 0 && <tr><td colSpan={4} className="text-center text-[#9CA3AF] italic py-10">No reports filed yet.</td></tr>}
        </tbody>
      </table>
      <div className="px-4 py-3 border-t border-[#F3F4F6] flex items-center gap-2 text-xs text-[#9CA3AF]"><HistoryIcon className="w-3.5 h-3.5" /> Open the <button onClick={onOpen} className="text-[#1D7A4A] font-semibold underline">Daily Report</button> tab and pick a date to view or edit it.</div>
    </div>
  );
}
