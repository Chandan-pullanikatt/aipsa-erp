'use client';

import { useEffect, useState, useCallback } from 'react';
import api from '@/lib/api';
import { getVideoEmbedUrl } from '@/lib/videoUtils';
import { CalendarDays, MapPin, Loader2 } from 'lucide-react';

// Read-only events feed for students/parents: school-wide + their class events.
export default function EventsFeed({ studentId }: { studentId?: string }) {
  const [events, setEvents] = useState<any[]>([]);
  const [scope, setScope] = useState('');
  const [loading, setLoading] = useState(true);
  const load = useCallback(async () => {
    setLoading(true);
    try { const { data } = await api.get('/events/feed', { params: { ...(studentId ? { studentId } : {}), ...(scope ? { scope } : {}) } }); setEvents(data); }
    finally { setLoading(false); }
  }, [studentId, scope]);
  useEffect(() => { load(); }, [load]);

  return (
    <div className="space-y-5">
      <div className="flex gap-2">
        {[['', 'All'], ['upcoming', 'Upcoming'], ['past', 'Past']].map(([s, l]) => <button key={s} onClick={() => setScope(s)} className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${scope === s ? 'bg-[#1D7A4A] text-white' : 'bg-white border border-[#E5E7EB] text-[#6B7280]'}`}>{l}</button>)}
      </div>
      {loading ? <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>
        : events.length === 0 ? <p className="text-sm text-[#9CA3AF] italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">No events to show.</p>
        : events.map(ev => (
          <div key={ev.id} className="bg-white rounded-xl border border-[#E5E7EB] p-5">
            <h2 className="text-lg font-bold text-[#1A1D23]">{ev.title}</h2>
            <div className="flex flex-wrap items-center gap-3 text-xs text-[#6B7280] font-medium mt-1">
              <span className="inline-flex items-center gap-1"><CalendarDays className="w-3.5 h-3.5" /> {new Date(ev.eventDate).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' })}</span>
              {ev.location && <span className="inline-flex items-center gap-1"><MapPin className="w-3.5 h-3.5" /> {ev.location}</span>}
              <span className="px-2 py-0.5 rounded-full bg-[#EFF6FF] text-[#1D4ED8] font-bold">{ev.class ? ev.class.name : 'Whole school'}</span>
            </div>
            {ev.description && <p className="text-sm text-[#4B5563] mt-3">{ev.description}</p>}
            {ev.media?.length > 0 && (
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4">
                {ev.media.map((m: any) => (
                  m.type === 'PHOTO'
                    ? <a key={m.id} href={m.url} target="_blank" rel="noreferrer"><img src={m.url} alt={m.caption || ''} className="w-full h-32 object-cover rounded-lg border border-[#E5E7EB]" /></a>
                    : <div key={m.id} className="aspect-video rounded-lg overflow-hidden border border-[#E5E7EB] col-span-2 sm:col-span-1">{getVideoEmbedUrl(m.url) ? <iframe src={getVideoEmbedUrl(m.url)!} className="w-full h-full" allowFullScreen title="video" /> : <a href={m.url} target="_blank" rel="noreferrer" className="flex items-center justify-center h-full text-xs text-[#1D7A4A]">Open video</a>}</div>
                ))}
              </div>
            )}
          </div>
        ))}
    </div>
  );
}
