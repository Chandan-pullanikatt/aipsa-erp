'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  Building2, Plus, Trash2, Pencil, X, Loader2, Bed, Utensils, DoorOpen,
  AlertCircle, Search, Check, Phone,
} from 'lucide-react';

const DAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
const MEALS = ['BREAKFAST', 'LUNCH', 'SNACKS', 'DINNER'];
const TABS = ['Hostels', 'Mess Timetable', 'Gate Passes', 'Complaints'] as const;
type Tab = typeof TABS[number];

export default function HostelPage() {
  const [tab, setTab] = useState<Tab>('Hostels');
  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="mb-6">
        <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><Building2 className="w-6 h-6 text-[#1D7A4A]" /> Hostel Management</h1>
        <p className="text-sm text-[#6B7280] font-medium mt-1">Rooms & bed allotment, mess timetable, gate passes and complaints.</p>
      </div>
      <div className="flex gap-1 border-b border-[#E5E7EB] mb-6 overflow-x-auto">
        {TABS.map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`px-4 py-2.5 text-sm font-semibold whitespace-nowrap border-b-2 -mb-px transition-colors ${tab === t ? 'border-[#1D7A4A] text-[#1D7A4A]' : 'border-transparent text-[#6B7280] hover:text-[#1A1D23]'}`}>
            {t}
          </button>
        ))}
      </div>
      {tab === 'Hostels' && <HostelsTab />}
      {tab === 'Mess Timetable' && <MessTab />}
      {tab === 'Gate Passes' && <GatePassesTab />}
      {tab === 'Complaints' && <ComplaintsTab />}
    </div>
  );
}

// ─── Hostels + Rooms + Allotment ──────────────────────────────────────────────
function HostelsTab() {
  const [hostels, setHostels] = useState<any[]>([]);
  const [selected, setSelected] = useState<any>(null);
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<any>(null);
  const [form, setForm] = useState({ name: '', type: '', wardenName: '', wardenPhone: '', address: '', notes: '' });
  const [roomForm, setRoomForm] = useState({ roomNumber: '', floor: '', capacity: '1' });
  const [allotFor, setAllotFor] = useState<string | null>(null); // roomId being allotted
  const [studentQuery, setStudentQuery] = useState('');
  const [hits, setHits] = useState<any[]>([]);

  const load = useCallback(async () => {
    const { data } = await api.get('/hostel'); setHostels(data);
  }, []);
  useEffect(() => { load(); }, [load]);

  async function openHostel(id: string) { const { data } = await api.get(`/hostel/${id}`); setSelected(data); }
  async function saveHostel(e: React.FormEvent) {
    e.preventDefault();
    if (editing) await api.put(`/hostel/${editing.id}`, form); else await api.post('/hostel', form);
    setShowForm(false); setEditing(null); setForm({ name: '', type: '', wardenName: '', wardenPhone: '', address: '', notes: '' });
    await load();
  }
  async function delHostel(id: string) { if (!confirm('Delete hostel and its rooms?')) return; await api.delete(`/hostel/${id}`); if (selected?.id === id) setSelected(null); await load(); }
  async function addRoom() {
    if (!selected || !roomForm.roomNumber.trim()) return;
    await api.post(`/hostel/${selected.id}/rooms`, roomForm);
    setRoomForm({ roomNumber: '', floor: '', capacity: '1' });
    await openHostel(selected.id); await load();
  }
  async function delRoom(roomId: string) { if (!selected) return; await api.delete(`/hostel/rooms/${roomId}`); await openHostel(selected.id); await load(); }
  async function searchStudents(q: string) {
    setStudentQuery(q);
    if (q.trim().length < 2) { setHits([]); return; }
    const { data } = await api.get('/sis/students', { params: { search: q, limit: 8 } });
    setHits(data.students || []);
  }
  async function allot(roomId: string, studentId: string) {
    try {
      await api.post('/hostel/allotments', { roomId, studentId });
      setAllotFor(null); setStudentQuery(''); setHits([]);
      if (selected) await openHostel(selected.id); await load();
    } catch (e: any) { alert(e.response?.data?.error || 'Could not allot.'); }
  }
  async function vacate(studentId: string) {
    if (!confirm('Vacate this student?')) return;
    await api.delete(`/hostel/allotments/${studentId}`);
    if (selected) await openHostel(selected.id); await load();
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
      <div className="lg:col-span-2 space-y-3">
        <button onClick={() => { setEditing(null); setForm({ name: '', type: '', wardenName: '', wardenPhone: '', address: '', notes: '' }); setShowForm(true); }}
          className="w-full inline-flex items-center justify-center gap-2 px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold hover:bg-[#166038]"><Plus className="w-4 h-4" /> Add Hostel</button>
        {hostels.map((h) => (
          <button key={h.id} onClick={() => openHostel(h.id)}
            className={`w-full text-left bg-white rounded-xl border p-4 ${selected?.id === h.id ? 'border-[#1D7A4A] ring-2 ring-[#1D7A4A]/20' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'}`}>
            <div className="flex items-center justify-between">
              <span className="font-bold text-[#1A1D23]">{h.name}</span>
              {h.type && <span className="text-xs font-semibold bg-[#F3F4F6] px-2 py-0.5 rounded">{h.type}</span>}
            </div>
            <div className="flex gap-3 text-xs text-[#6B7280] font-medium mt-2">
              <span className="inline-flex items-center gap-1"><DoorOpen className="w-3.5 h-3.5" /> {h._count?.rooms ?? 0} rooms</span>
              <span className="inline-flex items-center gap-1"><Bed className="w-3.5 h-3.5" /> {h.occupied}/{h.totalBeds} beds</span>
            </div>
          </button>
        ))}
        {hostels.length === 0 && <p className="text-sm text-[#9CA3AF] italic text-center py-8">No hostels yet.</p>}
      </div>

      <div className="lg:col-span-3">
        {!selected ? (
          <p className="text-sm text-[#9CA3AF] italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">Select a hostel to manage rooms and allotment.</p>
        ) : (
          <div className="space-y-5">
            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5 flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1A1D23]">{selected.name}</h2>
                <div className="text-sm text-[#6B7280] mt-1">
                  {selected.wardenName && <span>Warden: {selected.wardenName} </span>}
                  {selected.wardenPhone && <span className="inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {selected.wardenPhone}</span>}
                </div>
              </div>
              <div className="flex gap-2">
                <button onClick={() => { setEditing(selected); setForm({ name: selected.name, type: selected.type || '', wardenName: selected.wardenName || '', wardenPhone: selected.wardenPhone || '', address: selected.address || '', notes: selected.notes || '' }); setShowForm(true); }} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]"><Pencil className="w-4 h-4 text-[#6B7280]" /></button>
                <button onClick={() => delHostel(selected.id)} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#FEF2F2]"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
              </div>
            </div>

            <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
              <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><DoorOpen className="w-4 h-4 text-[#1D7A4A]" /> Rooms & Beds</h3>
              <div className="space-y-3 mb-4">
                {selected.rooms?.map((room: any) => (
                  <div key={room.id} className="border border-[#E5E7EB] rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="font-semibold text-sm text-[#1A1D23]">Room {room.roomNumber}{room.floor ? ` · Floor ${room.floor}` : ''} <span className="text-xs text-[#9CA3AF]">({room.allotments.length}/{room.capacity})</span></span>
                      <div className="flex gap-2">
                        {room.allotments.length < room.capacity && (
                          <button onClick={() => { setAllotFor(allotFor === room.id ? null : room.id); setStudentQuery(''); setHits([]); }} className="text-xs font-semibold text-[#1D7A4A]">+ Allot</button>
                        )}
                        <button onClick={() => delRoom(room.id)}><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button>
                      </div>
                    </div>
                    {room.allotments.map((a: any) => (
                      <div key={a.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded px-2 py-1 mt-2">
                        <span>{a.student.firstName} {a.student.lastName} <span className="text-xs text-[#9CA3AF]">{a.student.admissionNumber}{a.student.class ? ` · ${a.student.class.name}` : ''}</span></span>
                        <button onClick={() => vacate(a.student.id)} className="text-xs text-[#DC2626] font-semibold">Vacate</button>
                      </div>
                    ))}
                    {allotFor === room.id && (
                      <div className="relative mt-2">
                        <div className="relative">
                          <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                          <input autoFocus placeholder="Search student…" value={studentQuery} onChange={(e) => searchStudents(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                        </div>
                        {hits.length > 0 && (
                          <div className="absolute z-10 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-52 overflow-auto">
                            {hits.map((h) => (
                              <button key={h.id} onClick={() => allot(room.id, h.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] flex justify-between">
                                <span>{h.firstName} {h.lastName}</span><span className="text-xs text-[#9CA3AF]">{h.admissionNumber}</span>
                              </button>
                            ))}
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                ))}
                {!selected.rooms?.length && <p className="text-xs text-[#9CA3AF] italic">No rooms yet.</p>}
              </div>
              <div className="grid grid-cols-4 gap-2">
                <input placeholder="Room no." value={roomForm.roomNumber} onChange={(e) => setRoomForm({ ...roomForm, roomNumber: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                <input placeholder="Floor" value={roomForm.floor} onChange={(e) => setRoomForm({ ...roomForm, floor: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                <input placeholder="Capacity" type="number" value={roomForm.capacity} onChange={(e) => setRoomForm({ ...roomForm, capacity: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                <button onClick={addRoom} className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add</button>
              </div>
            </div>
          </div>
        )}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveHostel} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-bold text-[#1A1D23]">{editing ? 'Edit Hostel' : 'Add Hostel'}</h2>
            <input required placeholder="Hostel name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <select value={form.type} onChange={(e) => setForm({ ...form, type: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
                <option value="">Type…</option><option value="BOYS">Boys</option><option value="GIRLS">Girls</option><option value="MIXED">Mixed</option>
              </select>
              <input placeholder="Warden name" value={form.wardenName} onChange={(e) => setForm({ ...form, wardenName: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Warden phone" value={form.wardenPhone} onChange={(e) => setForm({ ...form, wardenPhone: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Address" value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold">Cancel</button>
              <button type="submit" className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold">Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}

// ─── Mess Timetable ───────────────────────────────────────────────────────────
function MessTab() {
  const [menus, setMenus] = useState<any[]>([]);
  const [form, setForm] = useState({ dayOfWeek: '1', meal: 'BREAKFAST', items: '', time: '' });
  const load = useCallback(async () => { const { data } = await api.get('/hostel/mess/list'); setMenus(data); }, []);
  useEffect(() => { load(); }, [load]);
  async function add(e: React.FormEvent) { e.preventDefault(); if (!form.items.trim()) return; await api.post('/hostel/mess', form); setForm({ ...form, items: '', time: '' }); await load(); }
  async function del(id: string) { await api.delete(`/hostel/mess/${id}`); await load(); }
  const cell = (day: number, meal: string) => menus.filter((m) => m.dayOfWeek === day && m.meal === meal);

  return (
    <div className="space-y-5">
      <form onSubmit={add} className="bg-white rounded-xl border border-[#E5E7EB] p-4 grid grid-cols-2 sm:grid-cols-5 gap-2">
        <select value={form.dayOfWeek} onChange={(e) => setForm({ ...form, dayOfWeek: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
          {DAYS.map((d, i) => <option key={i} value={i}>{d}</option>)}
        </select>
        <select value={form.meal} onChange={(e) => setForm({ ...form, meal: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm">
          {MEALS.map((m) => <option key={m} value={m}>{m[0] + m.slice(1).toLowerCase()}</option>)}
        </select>
        <input placeholder="Time (e.g. 8:00 AM)" value={form.time} onChange={(e) => setForm({ ...form, time: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <input placeholder="Items" value={form.items} onChange={(e) => setForm({ ...form, items: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
        <button className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add</button>
      </form>

      <div className="bg-white rounded-xl border border-[#E5E7EB] p-4 overflow-x-auto">
        <table className="w-full min-w-[720px] text-sm">
          <thead><tr className="text-xs uppercase text-[#9CA3AF]"><th className="text-left p-2">Day</th>{MEALS.map((m) => <th key={m} className="text-left p-2">{m[0] + m.slice(1).toLowerCase()}</th>)}</tr></thead>
          <tbody>
            {DAYS.map((d, i) => (
              <tr key={i} className="border-t border-[#F3F4F6]">
                <td className="p-2 font-semibold text-[#1A1D23]">{d}</td>
                {MEALS.map((meal) => (
                  <td key={meal} className="p-2 align-top">
                    {cell(i, meal).map((m) => (
                      <div key={m.id} className="group flex items-start gap-1 mb-1">
                        <span className="text-[#1A1D23]">{m.time && <span className="text-xs text-[#9CA3AF] mr-1">{m.time}</span>}{m.items}</span>
                        <button onClick={() => del(m.id)} className="opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-[#DC2626]" /></button>
                      </div>
                    ))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Gate Passes ──────────────────────────────────────────────────────────────
function GatePassesTab() {
  const [passes, setPasses] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => { const { data } = await api.get('/hostel/gate-passes/list', { params: filter ? { status: filter } : {} }); setPasses(data); }, [filter]);
  useEffect(() => { load(); }, [load]);
  async function review(id: string, status: string) { await api.patch(`/hostel/gate-passes/${id}`, { status }); await load(); }
  const badge = (s: string) => s === 'APPROVED' ? 'bg-[#E5F6EE] text-[#1D7A4A]' : s === 'REJECTED' ? 'bg-[#FEF2F2] text-[#DC2626]' : 'bg-[#FEF9C3] text-[#A16207]';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'PENDING', 'APPROVED', 'REJECTED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{s || 'All'}</button>
        ))}
      </div>
      <div className="space-y-2">
        {passes.map((p) => (
          <div key={p.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4 flex items-center justify-between">
            <div>
              <div className="font-semibold text-[#1A1D23]">{p.student.firstName} {p.student.lastName} <span className="text-xs text-[#9CA3AF]">{p.student.admissionNumber}{p.student.class ? ` · ${p.student.class.name}` : ''}</span></div>
              <div className="text-sm text-[#6B7280] mt-1">{p.reason}{p.destination ? ` → ${p.destination}` : ''}</div>
              <div className="text-xs text-[#9CA3AF] mt-1">{new Date(p.fromDate).toLocaleDateString()} – {new Date(p.toDate).toLocaleDateString()}</div>
            </div>
            <div className="flex items-center gap-2">
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge(p.status)}`}>{p.status}</span>
              {p.status === 'PENDING' && (
                <>
                  <button onClick={() => review(p.id, 'APPROVED')} className="p-2 rounded-lg bg-[#E5F6EE] hover:bg-[#D1F0E0]"><Check className="w-4 h-4 text-[#1D7A4A]" /></button>
                  <button onClick={() => review(p.id, 'REJECTED')} className="p-2 rounded-lg bg-[#FEF2F2] hover:bg-[#FCE4E4]"><X className="w-4 h-4 text-[#DC2626]" /></button>
                </>
              )}
            </div>
          </div>
        ))}
        {passes.length === 0 && <p className="text-sm text-[#9CA3AF] italic text-center py-12">No gate passes.</p>}
      </div>
    </div>
  );
}

// ─── Complaints ───────────────────────────────────────────────────────────────
function ComplaintsTab() {
  const [items, setItems] = useState<any[]>([]);
  const [filter, setFilter] = useState('');
  const load = useCallback(async () => { const { data } = await api.get('/hostel/complaints/list', { params: filter ? { status: filter } : {} }); setItems(data); }, [filter]);
  useEffect(() => { load(); }, [load]);
  async function setStatus(id: string, status: string) { await api.patch(`/hostel/complaints/${id}`, { status }); await load(); }
  const badge = (s: string) => s === 'RESOLVED' ? 'bg-[#E5F6EE] text-[#1D7A4A]' : s === 'IN_PROGRESS' ? 'bg-[#EFF6FF] text-[#1D4ED8]' : 'bg-[#FEF9C3] text-[#A16207]';

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        {['', 'OPEN', 'IN_PROGRESS', 'RESOLVED'].map((s) => (
          <button key={s} onClick={() => setFilter(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${filter === s ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{s ? s.replace('_', ' ') : 'All'}</button>
        ))}
      </div>
      <div className="space-y-2">
        {items.map((c) => (
          <div key={c.id} className="bg-white rounded-xl border border-[#E5E7EB] p-4">
            <div className="flex items-center justify-between">
              <div className="font-semibold text-[#1A1D23] flex items-center gap-2"><AlertCircle className="w-4 h-4 text-[#A16207]" /> {c.title} {c.category && <span className="text-xs font-normal bg-[#F3F4F6] px-2 py-0.5 rounded">{c.category}</span>}</div>
              <span className={`px-2.5 py-1 rounded-full text-xs font-bold ${badge(c.status)}`}>{c.status.replace('_', ' ')}</span>
            </div>
            <div className="text-sm text-[#6B7280] mt-1">{c.student.firstName} {c.student.lastName} <span className="text-xs text-[#9CA3AF]">{c.student.admissionNumber}</span></div>
            {c.description && <p className="text-sm text-[#4B5563] mt-2">{c.description}</p>}
            <div className="flex gap-2 mt-3">
              {c.status !== 'IN_PROGRESS' && c.status !== 'RESOLVED' && <button onClick={() => setStatus(c.id, 'IN_PROGRESS')} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB]">Mark In Progress</button>}
              {c.status !== 'RESOLVED' && <button onClick={() => setStatus(c.id, 'RESOLVED')} className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-[#E5F6EE] text-[#1D7A4A]">Mark Resolved</button>}
            </div>
          </div>
        ))}
        {items.length === 0 && <p className="text-sm text-[#9CA3AF] italic text-center py-12">No complaints.</p>}
      </div>
    </div>
  );
}
