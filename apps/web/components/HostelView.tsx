'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { Building2, Bed, Utensils, DoorOpen, Phone, Plus, Loader2, AlertCircle, CalendarDays } from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];

// Shared student/parent hostel view. Pass studentId for parents.
export default function HostelView({ studentId }: { studentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gateForm, setGateForm] = useState({ reason: '', destination: '', fromDate: '', toDate: '' });
  const [complaintForm, setComplaintForm] = useState({ title: '', category: '', description: '' });
  const [busy, setBusy] = useState(false);

  const params = studentId ? { studentId } : {};
  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/hostel/portal/my-hostel', { params });
      setData(data);
    } catch (e: any) { setError(e.response?.data?.error || 'Could not load hostel info.'); }
    finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  async function applyGatePass(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/hostel/gate-passes', { ...gateForm, ...params });
      setGateForm({ reason: '', destination: '', fromDate: '', toDate: '' });
      await load();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed.'); }
    finally { setBusy(false); }
  }
  async function raiseComplaint(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      await api.post('/hostel/complaints', { ...complaintForm, ...params });
      setComplaintForm({ title: '', category: '', description: '' });
      await load();
    } catch (e: any) { alert(e.response?.data?.error || 'Failed.'); }
    finally { setBusy(false); }
  }

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  if (error) return <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</p>;

  const allot = data?.hostelAllotment;
  const isHosteler = data?.boardingType === 'HOSTELER' || !!allot;
  const badge = (s: string) => s === 'APPROVED' || s === 'RESOLVED' ? 'bg-[#E5F6EE] text-[#1D7A4A]' : s === 'REJECTED' ? 'bg-[#FEF2F2] text-[#DC2626]' : s === 'IN_PROGRESS' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#FEF9C3] text-[#A16207]';
  const cell = (day: number, meal: string) => (data?.mess || []).filter((m: any) => m.dayOfWeek === day && m.meal === meal);

  if (!isHosteler) {
    return (
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-6 text-center">
        <Building2 className="w-8 h-8 text-[#9CA3AF] mx-auto mb-2" />
        <p className="text-sm text-[#6B7280] font-medium">This student is a <strong>day scholar</strong> — no hostel is allotted.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* allotment + leaves */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 sm:col-span-2">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><Building2 className="w-4 h-4 text-[#1D7A4A]" /> Allotment</h3>
          {allot ? (
            <div className="grid grid-cols-2 gap-3 text-sm">
              <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Hostel</div><div className="font-medium text-[#1A1D23]">{allot.hostel.name}{allot.hostel.type ? ` (${allot.hostel.type})` : ''}</div></div>
              <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Room</div><div className="font-medium text-[#1A1D23] inline-flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" /> {allot.room.roomNumber}{allot.room.floor ? ` · Floor ${allot.room.floor}` : ''}{allot.bedLabel ? ` · Bed ${allot.bedLabel}` : ''}</div></div>
              {allot.hostel.wardenName && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Warden</div><div className="font-medium text-[#1A1D23]">{allot.hostel.wardenName}</div></div>}
              {allot.hostel.wardenPhone && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Warden Phone</div><a href={`tel:${allot.hostel.wardenPhone}`} className="font-medium text-[#1D7A4A] inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {allot.hostel.wardenPhone}</a></div>}
            </div>
          ) : <p className="text-sm text-[#9CA3AF] italic">Hosteler, but no room allotted yet.</p>}
        </div>
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex flex-col items-center justify-center">
          <div className="text-3xl font-bold text-[#1D7A4A]">{data.leavesTaken ?? 0}</div>
          <div className="text-xs text-[#6B7280] font-semibold uppercase tracking-wider mt-1">Leaves taken</div>
        </div>
      </div>

      {/* mess timetable */}
      {data.mess?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 overflow-x-auto">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><Utensils className="w-4 h-4 text-[#1D7A4A]" /> Mess / Food Timetable</h3>
          <table className="w-full text-sm">
            <thead><tr className="text-xs uppercase text-[#9CA3AF]"><th className="text-left p-2">Day</th>{MEALS.map((m) => <th key={m} className="text-left p-2">{m[0] + m.slice(1).toLowerCase()}</th>)}</tr></thead>
            <tbody>
              {DAYS.map((d, i) => (
                <tr key={i} className="border-t border-[#F3F4F6]">
                  <td className="p-2 font-semibold text-[#1A1D23]">{d}</td>
                  {MEALS.map((meal) => (
                    <td key={meal} className="p-2 align-top text-[#4B5563]">
                      {cell(i, meal).map((m: any) => <div key={m.id}>{m.time && <span className="text-xs text-[#9CA3AF] mr-1">{m.time}</span>}{m.items}</div>)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* gate pass */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><CalendarDays className="w-4 h-4 text-[#1D7A4A]" /> Gate Passes</h3>
        <form onSubmit={applyGatePass} className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-4">
          <input required placeholder="Reason *" value={gateForm.reason} onChange={(e) => setGateForm({ ...gateForm, reason: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          <input placeholder="Destination" value={gateForm.destination} onChange={(e) => setGateForm({ ...gateForm, destination: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          <input required type="date" value={gateForm.fromDate} onChange={(e) => setGateForm({ ...gateForm, fromDate: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          <input required type="date" value={gateForm.toDate} onChange={(e) => setGateForm({ ...gateForm, toDate: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          <button disabled={busy} className="col-span-2 sm:col-span-4 px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Apply for gate pass</button>
        </form>
        <div className="space-y-2">
          {data.gatePasses?.map((p: any) => (
            <div key={p.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded-lg px-3 py-2">
              <span>{p.reason}{p.destination ? ` → ${p.destination}` : ''} <span className="text-xs text-[#9CA3AF]">{new Date(p.fromDate).toLocaleDateString()}–{new Date(p.toDate).toLocaleDateString()}</span></span>
              <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(p.status)}`}>{p.status}</span>
            </div>
          ))}
          {!data.gatePasses?.length && <p className="text-xs text-[#9CA3AF] italic">No gate passes yet.</p>}
        </div>
      </div>

      {/* complaints */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><AlertCircle className="w-4 h-4 text-[#1D7A4A]" /> Report an Issue</h3>
        <form onSubmit={raiseComplaint} className="grid grid-cols-2 gap-2 mb-4">
          <input required placeholder="Title *" value={complaintForm.title} onChange={(e) => setComplaintForm({ ...complaintForm, title: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
          <select value={complaintForm.category} onChange={(e) => setComplaintForm({ ...complaintForm, category: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
            <option value="">Category…</option><option>Maintenance</option><option>Food</option><option>Cleanliness</option><option>Wi-Fi</option><option>Other</option>
          </select>
          <textarea placeholder="Describe the issue" value={complaintForm.description} onChange={(e) => setComplaintForm({ ...complaintForm, description: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" rows={2} />
          <button disabled={busy} className="col-span-2 px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Submit complaint</button>
        </form>
        <div className="space-y-2">
          {data.complaints?.map((c: any) => (
            <div key={c.id} className="bg-[#F9FAFB] rounded-lg px-3 py-2">
              <div className="flex items-center justify-between text-sm">
                <span className="font-medium text-[#1A1D23]">{c.title}{c.category ? ` · ${c.category}` : ''}</span>
                <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${badge(c.status)}`}>{c.status.replace('_', ' ')}</span>
              </div>
              {c.description && <p className="text-xs text-[#6B7280] mt-1">{c.description}</p>}
            </div>
          ))}
          {!data.complaints?.length && <p className="text-xs text-[#9CA3AF] italic">No complaints raised.</p>}
        </div>
      </div>
    </div>
  );
}
