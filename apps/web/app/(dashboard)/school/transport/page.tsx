'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import {
  Bus, Plus, Trash2, Pencil, Check, X, MapPin, Navigation, Phone,
  Copy, RefreshCw, Loader2, Users, Search,
} from 'lucide-react';

interface Stop { id: string; name: string; sequence: number; pickupTime: string | null; dropTime: string | null; }
interface RouteStudent { id: string; firstName: string; lastName: string; admissionNumber: string; boardingPoint: string | null; class: { name: string } | null; }
interface Route {
  id: string; name: string; routeNumber: string | null; busNumber: string | null;
  driverName: string | null; driverPhone: string | null; capacity: number | null; notes: string | null;
  trackToken: string | null; lastLat: number | null; lastLng: number | null; lastLocationAt: string | null;
  stops: Stop[]; students?: RouteStudent[]; _count?: { students: number };
}
interface StudentHit { id: string; firstName: string; lastName: string; admissionNumber: string; class?: { name: string } | null; }

const empty = { name: '', routeNumber: '', busNumber: '', driverName: '', driverPhone: '', capacity: '', notes: '' };

export default function TransportPage() {
  const [routes, setRoutes] = useState<Route[]>([]);
  const [selected, setSelected] = useState<Route | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState<Route | null>(null);
  const [form, setForm] = useState(empty);
  const [saving, setSaving] = useState(false);

  // stop + student forms
  const [stopForm, setStopForm] = useState({ name: '', sequence: '', pickupTime: '', dropTime: '' });
  const [studentQuery, setStudentQuery] = useState('');
  const [studentHits, setStudentHits] = useState<StudentHit[]>([]);
  const [boardingPoint, setBoardingPoint] = useState('');
  const [live, setLive] = useState<any>(null);

  const loadRoutes = useCallback(async () => {
    setLoading(true);
    try {
      const { data } = await api.get('/transport/routes');
      setRoutes(data);
    } catch { setError('Failed to load routes.'); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { loadRoutes(); }, [loadRoutes]);

  async function openRoute(id: string) {
    try {
      const { data } = await api.get(`/transport/routes/${id}`);
      setSelected(data);
      setLive(null);
    } catch { setError('Failed to open route.'); }
  }

  async function saveRoute(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError('');
    try {
      if (editing) await api.put(`/transport/routes/${editing.id}`, form);
      else await api.post('/transport/routes', form);
      setShowForm(false); setEditing(null); setForm(empty);
      await loadRoutes();
    } catch (err: any) { setError(err.response?.data?.error || 'Save failed.'); }
    finally { setSaving(false); }
  }

  async function deleteRoute(id: string) {
    if (!confirm('Delete this route? Students will be unassigned.')) return;
    await api.delete(`/transport/routes/${id}`);
    if (selected?.id === id) setSelected(null);
    await loadRoutes();
  }

  async function addStop() {
    if (!selected || !stopForm.name.trim()) return;
    await api.post(`/transport/routes/${selected.id}/stops`, stopForm);
    setStopForm({ name: '', sequence: '', pickupTime: '', dropTime: '' });
    await openRoute(selected.id);
  }
  async function deleteStop(stopId: string) {
    if (!selected) return;
    await api.delete(`/transport/stops/${stopId}`);
    await openRoute(selected.id);
  }

  async function searchStudents(q: string) {
    setStudentQuery(q);
    if (q.trim().length < 2) { setStudentHits([]); return; }
    const { data } = await api.get('/sis/students', { params: { search: q, limit: 8 } });
    setStudentHits(data.students || []);
  }
  async function assignStudent(studentId: string) {
    if (!selected) return;
    await api.post(`/transport/routes/${selected.id}/students`, { studentId, boardingPoint });
    setStudentQuery(''); setStudentHits([]); setBoardingPoint('');
    await openRoute(selected.id);
    await loadRoutes();
  }
  async function unassignStudent(studentId: string) {
    if (!selected) return;
    await api.delete(`/transport/students/${studentId}`);
    await openRoute(selected.id);
    await loadRoutes();
  }

  async function regenToken() {
    if (!selected) return;
    const { data } = await api.post(`/transport/routes/${selected.id}/track-token`);
    setSelected({ ...selected, trackToken: data.trackToken });
  }
  async function checkLive() {
    if (!selected) return;
    const { data } = await api.get(`/transport/routes/${selected.id}/location`);
    setLive(data);
  }

  const trackUrl = selected?.trackToken
    ? `${typeof window !== 'undefined' ? window.location.origin : ''}/track/${selected.trackToken}`
    : '';

  return (
    <div className="max-w-6xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2">
            <Bus className="w-6 h-6 text-[#1D7A4A]" /> Transport
          </h1>
          <p className="text-sm text-[#6B7280] font-medium mt-1">Bus routes, stops, driver details, student assignment & live tracking.</p>
        </div>
        <button onClick={() => { setEditing(null); setForm(empty); setShowForm(true); }}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold hover:bg-[#166038]">
          <Plus className="w-4 h-4" /> Add Route
        </button>
      </div>

      {error && <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3 mb-4">{error}</p>}

      <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
        {/* routes list */}
        <div className="lg:col-span-2 space-y-3">
          {loading ? (
            <p className="text-sm text-[#6B7280] flex items-center gap-2"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
          ) : routes.length === 0 ? (
            <p className="text-sm text-[#9CA3AF] italic text-center py-12 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">No routes yet. Add one to begin.</p>
          ) : routes.map((r) => (
            <button key={r.id} onClick={() => openRoute(r.id)}
              className={`w-full text-left bg-white rounded-xl border p-4 transition-all ${selected?.id === r.id ? 'border-[#1D7A4A] ring-2 ring-[#1D7A4A]/20' : 'border-[#E5E7EB] hover:border-[#D1D5DB]'}`}>
              <div className="flex items-center justify-between">
                <span className="font-bold text-[#1A1D23]">{r.name}</span>
                {r.routeNumber && <span className="text-xs font-mono bg-[#F3F4F6] px-2 py-0.5 rounded">{r.routeNumber}</span>}
              </div>
              <div className="flex items-center gap-3 text-xs text-[#6B7280] font-medium mt-2">
                {r.busNumber && <span className="inline-flex items-center gap-1"><Bus className="w-3.5 h-3.5" /> {r.busNumber}</span>}
                <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {r.stops.length} stops</span>
                <span className="inline-flex items-center gap-1"><Users className="w-3.5 h-3.5" /> {r._count?.students ?? 0}</span>
              </div>
            </button>
          ))}
        </div>

        {/* detail */}
        <div className="lg:col-span-3">
          {!selected ? (
            <p className="text-sm text-[#9CA3AF] italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">Select a route to manage stops, students and tracking.</p>
          ) : (
            <div className="space-y-5">
              {/* header */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <h2 className="text-lg font-bold text-[#1A1D23]">{selected.name}</h2>
                    <div className="text-sm text-[#6B7280] font-medium mt-1 space-y-0.5">
                      {selected.busNumber && <div className="inline-flex items-center gap-1.5 mr-4"><Bus className="w-4 h-4" /> {selected.busNumber}</div>}
                      {selected.driverName && <div className="inline-flex items-center gap-1.5 mr-4">{selected.driverName}</div>}
                      {selected.driverPhone && <div className="inline-flex items-center gap-1.5"><Phone className="w-4 h-4" /> {selected.driverPhone}</div>}
                    </div>
                  </div>
                  <div className="flex gap-2">
                    <button onClick={() => { setEditing(selected); setForm({ name: selected.name, routeNumber: selected.routeNumber || '', busNumber: selected.busNumber || '', driverName: selected.driverName || '', driverPhone: selected.driverPhone || '', capacity: selected.capacity?.toString() || '', notes: selected.notes || '' }); setShowForm(true); }}
                      className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]"><Pencil className="w-4 h-4 text-[#6B7280]" /></button>
                    <button onClick={() => deleteRoute(selected.id)} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#FEF2F2]"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
                  </div>
                </div>
              </div>

              {/* tracking */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] flex items-center gap-1.5 mb-3"><Navigation className="w-4 h-4 text-[#1D7A4A]" /> Live Tracking</h3>
                <p className="text-xs text-[#6B7280] mb-3">Share this link with the bus driver. Opening it on their phone shares the bus location with parents (keep the screen on).</p>
                {trackUrl ? (
                  <div className="flex items-center gap-2">
                    <input readOnly value={trackUrl} className="flex-1 px-3 py-2 rounded-lg border border-[#E5E7EB] bg-[#F9FAFB] text-xs font-mono" />
                    <button onClick={() => navigator.clipboard.writeText(trackUrl)} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]"><Copy className="w-4 h-4 text-[#6B7280]" /></button>
                    <button onClick={regenToken} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]" title="Regenerate link"><RefreshCw className="w-4 h-4 text-[#6B7280]" /></button>
                  </div>
                ) : (
                  <button onClick={regenToken} className="text-sm font-semibold text-[#1D7A4A]">Generate tracking link</button>
                )}
                <div className="mt-3 flex items-center gap-3">
                  <button onClick={checkLive} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB] hover:bg-[#F9FAFB]">Check current location</button>
                  {live && (live.lastLat != null
                    ? <a className="text-xs font-semibold text-[#1D7A4A] underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${live.lastLat}&mlon=${live.lastLng}#map=16/${live.lastLat}/${live.lastLng}`}>
                        {live.live ? '🟢 Live' : '⚪ Last seen'} — open map
                      </a>
                    : <span className="text-xs text-[#9CA3AF]">No location yet.</span>)}
                </div>
              </div>

              {/* stops */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] flex items-center gap-1.5 mb-3"><MapPin className="w-4 h-4 text-[#1D7A4A]" /> Stops ({selected.stops.length})</h3>
                <div className="space-y-2 mb-3">
                  {selected.stops.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded-lg px-3 py-2">
                      <span className="font-medium text-[#1A1D23]"><span className="text-[#9CA3AF] mr-2">{s.sequence}.</span>{s.name}</span>
                      <span className="flex items-center gap-3 text-xs text-[#6B7280]">
                        {s.pickupTime && <span>Pickup {s.pickupTime}</span>}
                        {s.dropTime && <span>Drop {s.dropTime}</span>}
                        <button onClick={() => deleteStop(s.id)}><Trash2 className="w-3.5 h-3.5 text-[#DC2626]" /></button>
                      </span>
                    </div>
                  ))}
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  <input placeholder="Stop name" value={stopForm.name} onChange={(e) => setStopForm({ ...stopForm, name: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                  <input placeholder="Seq" type="number" value={stopForm.sequence} onChange={(e) => setStopForm({ ...stopForm, sequence: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                  <input placeholder="Pickup" value={stopForm.pickupTime} onChange={(e) => setStopForm({ ...stopForm, pickupTime: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                  <button onClick={addStop} className="px-3 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center justify-center gap-1"><Plus className="w-4 h-4" /> Add</button>
                </div>
              </div>

              {/* students */}
              <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
                <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] flex items-center gap-1.5 mb-3"><Users className="w-4 h-4 text-[#1D7A4A]" /> Assigned Students ({selected.students?.length ?? 0})</h3>
                <div className="space-y-2 mb-4">
                  {selected.students?.map((s) => (
                    <div key={s.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded-lg px-3 py-2">
                      <span className="font-medium text-[#1A1D23]">{s.firstName} {s.lastName}
                        <span className="text-xs text-[#9CA3AF] ml-2">{s.admissionNumber}{s.class ? ` · ${s.class.name}` : ''}{s.boardingPoint ? ` · ${s.boardingPoint}` : ''}</span>
                      </span>
                      <button onClick={() => unassignStudent(s.id)}><X className="w-4 h-4 text-[#DC2626]" /></button>
                    </div>
                  ))}
                  {!selected.students?.length && <p className="text-xs text-[#9CA3AF] italic">No students assigned yet.</p>}
                </div>
                <div className="relative">
                  <div className="flex gap-2">
                    <div className="relative flex-1">
                      <Search className="w-4 h-4 text-[#9CA3AF] absolute left-3 top-1/2 -translate-y-1/2" />
                      <input placeholder="Search student to assign…" value={studentQuery} onChange={(e) => searchStudents(e.target.value)} className="w-full pl-9 pr-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
                    </div>
                    <input placeholder="Boarding point (optional)" value={boardingPoint} onChange={(e) => setBoardingPoint(e.target.value)} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm w-48" />
                  </div>
                  {studentHits.length > 0 && (
                    <div className="absolute z-10 mt-1 w-full bg-white border border-[#E5E7EB] rounded-lg shadow-lg max-h-60 overflow-auto">
                      {studentHits.map((h) => (
                        <button key={h.id} onClick={() => assignStudent(h.id)} className="w-full text-left px-3 py-2 text-sm hover:bg-[#F9FAFB] flex justify-between">
                          <span>{h.firstName} {h.lastName}</span>
                          <span className="text-xs text-[#9CA3AF]">{h.admissionNumber}{h.class ? ` · ${h.class.name}` : ''}</span>
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* route form modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4" onClick={() => setShowForm(false)}>
          <form onClick={(e) => e.stopPropagation()} onSubmit={saveRoute} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3">
            <h2 className="text-lg font-bold text-[#1A1D23]">{editing ? 'Edit Route' : 'Add Route'}</h2>
            <div className="grid grid-cols-2 gap-3">
              <input required placeholder="Route name *" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Route number" value={form.routeNumber} onChange={(e) => setForm({ ...form, routeNumber: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Bus number" value={form.busNumber} onChange={(e) => setForm({ ...form, busNumber: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Driver name" value={form.driverName} onChange={(e) => setForm({ ...form, driverName: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Driver phone" value={form.driverPhone} onChange={(e) => setForm({ ...form, driverPhone: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <input placeholder="Capacity" type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <textarea placeholder="Notes" value={form.notes} onChange={(e) => setForm({ ...form, notes: e.target.value })} className="col-span-2 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" rows={2} />
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold">Cancel</button>
              <button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Save</button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
