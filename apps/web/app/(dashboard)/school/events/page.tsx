'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getVideoEmbedUrl } from '@/lib/videoUtils';
import { CalendarDays, Plus, Trash2, X, MapPin, Loader2, ImagePlus, Film } from 'lucide-react';

const empty = { title: '', description: '', eventDate: '', endDate: '', location: '', classId: '' };

export default function EventsAdminPage() {
  const [events, setEvents] = useState<any[]>([]);
  const [classes, setClasses] = useState<any[]>([]);
  const [scope, setScope] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(empty);
  const [ytLinks, setYtLinks] = useState<string[]>(['']);
  const [photos, setPhotos] = useState<{ url: string; key?: string }[]>([]);
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => { const { data } = await api.get('/events', { params: scope ? { scope } : {} }); setEvents(data); }, [scope]);
  useEffect(() => { load(); }, [load]);
  useEffect(() => { api.get('/sis/classes').then(r => setClasses(r.data)).catch(() => {}); }, []);

  async function uploadPhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files || []); if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const fd = new FormData(); fd.append('file', file); fd.append('folder', 'events');
        const { data } = await api.post('/uploads', fd, { headers: { 'Content-Type': undefined } as any });
        setPhotos(p => [...p, { url: data.url, key: data.key }]);
      }
    } finally { setUploading(false); }
  }

  async function create(e: React.FormEvent) {
    e.preventDefault(); setSaving(true);
    try {
      const media = [
        ...photos.map(p => ({ type: 'PHOTO', url: p.url, key: p.key })),
        ...ytLinks.filter(l => l.trim()).map(l => ({ type: 'YOUTUBE', url: l.trim() })),
      ];
      await api.post('/events', { ...form, media });
      setShowForm(false); setForm(empty); setYtLinks(['']); setPhotos([]);
      await load();
    } finally { setSaving(false); }
  }
  async function del(id: string) { if (!confirm('Delete event?')) return; await api.delete(`/events/${id}`); await load(); }
  async function delMedia(mediaId: string) { await api.delete(`/events/media/${mediaId}`); await load(); }
  async function addYt(eventId: string) { const url = prompt('YouTube link:'); if (!url) return; await api.post(`/events/${eventId}/media`, { type: 'YOUTUBE', url }); await load(); }
  async function addPhoto(eventId: string, e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]; if (!file) return;
    const fd = new FormData(); fd.append('file', file); fd.append('folder', 'events');
    const { data } = await api.post('/uploads', fd, { headers: { 'Content-Type': undefined } as any });
    await api.post(`/events/${eventId}/media`, { type: 'PHOTO', url: data.url, key: data.key });
    await load();
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-6">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-[#1A1D23] flex items-center gap-2"><CalendarDays className="w-6 h-6 text-[#1D7A4A]" /> Events</h1>
          <p className="text-sm text-[#6B7280] font-medium mt-1">Post events with photos & YouTube links. Parents see school-wide and their child's class events.</p>
        </div>
        <button onClick={() => setShowForm(true)} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-2"><Plus className="w-4 h-4" /> New Event</button>
      </div>

      <div className="flex gap-2 mb-5">
        {[['', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']].map(([s, l]) => <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${scope === s ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{l}</button>)}
      </div>

      <div className="space-y-5">
        {events.map(ev => (
          <div key={ev.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <div className="flex items-start justify-between">
              <div>
                <h2 className="text-lg font-bold text-[#1A1D23]">{ev.title}</h2>
                <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] font-medium mt-1">
                  <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {new Date(ev.eventDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
                  {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</span>}
                  <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] font-bold">{ev.class ? ev.class.name : 'Whole school'}</span>
                </div>
              </div>
              <button onClick={() => del(ev.id)} className="p-2 rounded-lg border border-[#E5E7EB] hover:bg-[#FEF2F2]"><Trash2 className="w-4 h-4 text-[#DC2626]" /></button>
            </div>
            {ev.description && <p className="text-sm text-[#4B5563] mt-3">{ev.description}</p>}

            {/* media */}
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
              {ev.media.map((m: any) => (
                <div key={m.id} className="relative group">
                  {m.type === 'PHOTO'
                    ? <img src={m.url} alt="" className="w-full h-32 object-cover rounded-lg border border-[#E5E7EB]" />
                    : <div className="aspect-video rounded-lg overflow-hidden border border-[#E5E7EB]">{getVideoEmbedUrl(m.url) ? <iframe src={getVideoEmbedUrl(m.url)!} className="w-full h-full" allowFullScreen title="video" /> : <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-full text-xs text-[#1D7A4A]">Open video</a>}</div>}
                  <button onClick={() => delMedia(m.id)} className="absolute top-1 right-1 p-1 rounded-full bg-black/50 opacity-0 group-hover:opacity-100"><X className="w-3 h-3 text-white" /></button>
                </div>
              ))}
            </div>
            <div className="flex gap-2 mt-3">
              <label className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB] cursor-pointer inline-flex items-center gap-1"><ImagePlus className="w-3.5 h-3.5" /> Add photo<input type="file" accept="image/*" onChange={(e) => addPhoto(ev.id, e)} className="hidden" /></label>
              <button onClick={() => addYt(ev.id)} className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-[#E5E7EB] inline-flex items-center gap-1"><Film className="w-3.5 h-3.5" /> Add YouTube</button>
            </div>
          </div>
        ))}
        {events.length === 0 && <p className="text-sm text-[#9CA3AF] italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">No events yet.</p>}
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/40 flex items-center justify-center z-50 p-4 overflow-y-auto" onClick={() => setShowForm(false)}>
          <form onClick={e => e.stopPropagation()} onSubmit={create} className="bg-white rounded-xl p-6 w-full max-w-lg space-y-3 my-8">
            <h2 className="text-lg font-bold text-[#1A1D23]">New Event</h2>
            <input required placeholder="Title *" value={form.title} onChange={e => setForm({ ...form, title: e.target.value })} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <textarea placeholder="Description" value={form.description} onChange={e => setForm({ ...form, description: e.target.value })} rows={2} className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
            <div className="grid grid-cols-2 gap-3">
              <label className="text-xs font-semibold text-[#6B7280]">Date & time *<input required type="datetime-local" value={form.eventDate} onChange={e => setForm({ ...form, eventDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" /></label>
              <label className="text-xs font-semibold text-[#6B7280]">End (optional)<input type="datetime-local" value={form.endDate} onChange={e => setForm({ ...form, endDate: e.target.value })} className="w-full mt-1 px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" /></label>
              <input placeholder="Location" value={form.location} onChange={e => setForm({ ...form, location: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm" />
              <select value={form.classId} onChange={e => setForm({ ...form, classId: e.target.value })} className="px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm"><option value="">Whole school</option>{classes.map(c => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
            </div>
            {/* youtube links */}
            <div>
              <p className="text-xs font-semibold text-[#6B7280] mb-1">YouTube links</p>
              {ytLinks.map((l, i) => (
                <input key={i} placeholder="https://youtube.com/watch?v=…" value={l}
                  onChange={e => { const n = [...ytLinks]; n[i] = e.target.value; if (i === ytLinks.length - 1 && e.target.value) n.push(''); setYtLinks(n); }}
                  className="w-full px-3 py-2 rounded-lg border border-[#E5E7EB] text-sm mb-1" />
              ))}
            </div>
            {/* photos */}
            <div>
              <label className="text-xs font-semibold px-3 py-2 rounded-lg border border-dashed border-[#E5E7EB] cursor-pointer inline-flex items-center gap-1">{uploading ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <ImagePlus className="w-3.5 h-3.5" />} Add photos<input type="file" accept="image/*" multiple onChange={uploadPhoto} className="hidden" /></label>
              {photos.length > 0 && <div className="flex gap-2 flex-wrap mt-2">{photos.map((p, i) => <img key={i} src={p.url} className="w-14 h-14 rounded object-cover" alt="" />)}</div>}
            </div>
            <div className="flex justify-end gap-2 pt-2"><button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 rounded-lg border border-[#E5E7EB] text-sm font-semibold">Cancel</button><button type="submit" disabled={saving} className="px-4 py-2 rounded-lg bg-[#1D7A4A] text-white text-sm font-semibold inline-flex items-center gap-2">{saving && <Loader2 className="w-4 h-4 animate-spin" />} Create</button></div>
          </form>
        </div>
      )}
    </div>
  );
}
