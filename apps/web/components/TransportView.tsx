'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import api from '@/lib/api';
import { Bus, MapPin, Phone, Navigation, Loader2 } from 'lucide-react';

// Shared student/parent transport view. Pass studentId for parents (omit for the
// logged-in student). Polls the assigned route's live location every 15s.
export default function TransportView({ studentId }: { studentId?: string }) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const timer = useRef<any>(null);

  const load = useCallback(async () => {
    try {
      const { data } = await api.get('/transport/my-transport', { params: studentId ? { studentId } : {} });
      setData(data);
    } catch (e: any) { setError(e.response?.data?.error || 'Could not load transport.'); }
    finally { setLoading(false); }
  }, [studentId]);

  useEffect(() => { load(); }, [load]);

  // Poll while a route is assigned (cheap; backend just reads last ping).
  useEffect(() => {
    if (!data?.busRoute) return;
    timer.current = setInterval(load, 15000);
    return () => clearInterval(timer.current);
  }, [data?.busRoute, load]);

  if (loading) return <p className="text-sm text-[#6B7280] flex items-center gap-2 py-12 justify-center"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>;
  if (error) return <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-4 py-3">{error}</p>;

  const route = data?.busRoute;
  if (!route) {
    return <p className="text-sm text-[#9CA3AF] italic text-center py-16 bg-[#F9FAFB] rounded-xl border border-dashed border-[#E5E7EB]">No bus route is assigned{data?.needsBus ? ' yet. Please contact the school office.' : '. This student is a day scholar / uses own transport.'}</p>;
  }

  const lat = route.lastLat, lng = route.lastLng;
  const mapUrl = lat != null && lng != null
    ? `https://www.openstreetmap.org/export/embed.html?bbox=${lng - 0.012}%2C${lat - 0.008}%2C${lng + 0.012}%2C${lat + 0.008}&layer=mapnik&marker=${lat}%2C${lng}`
    : null;

  return (
    <div className="space-y-5">
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-bold text-[#1A1D23] flex items-center gap-2"><Bus className="w-5 h-5 text-[#1D7A4A]" /> {route.name}</h2>
          {route.routeNumber && <span className="text-xs font-mono bg-[#F3F4F6] px-2 py-0.5 rounded">{route.routeNumber}</span>}
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 mt-4 text-sm">
          {route.busNumber && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Bus</div><div className="font-medium text-[#1A1D23]">{route.busNumber}</div></div>}
          {route.driverName && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Driver</div><div className="font-medium text-[#1A1D23]">{route.driverName}</div></div>}
          {route.driverPhone && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Driver Phone</div><a href={`tel:${route.driverPhone}`} className="font-medium text-[#1D7A4A] inline-flex items-center gap-1"><Phone className="w-3.5 h-3.5" /> {route.driverPhone}</a></div>}
          {data.boardingPoint && <div><div className="text-xs text-[#9CA3AF] uppercase font-semibold">Boarding Point</div><div className="font-medium text-[#1A1D23]">{data.boardingPoint}</div></div>}
        </div>
      </div>

      {/* live tracking */}
      <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] flex items-center gap-1.5"><Navigation className="w-4 h-4 text-[#1D7A4A]" /> Live Bus Location</h3>
          <span className={`text-xs font-bold flex items-center gap-1.5 ${data.live ? 'text-[#1D7A4A]' : 'text-[#9CA3AF]'}`}>
            <span className={`w-2 h-2 rounded-full ${data.live ? 'bg-[#1D7A4A] animate-pulse' : 'bg-[#9CA3AF]'}`} />
            {data.live ? 'Live now' : 'Offline'}
          </span>
        </div>
        {mapUrl ? (
          <>
            <iframe title="Bus location" src={mapUrl} className="w-full h-64 rounded-lg border border-[#E5E7EB]" />
            <p className="text-xs text-[#9CA3AF] mt-2">
              {route.lastLocationAt ? `Updated ${new Date(route.lastLocationAt).toLocaleTimeString()}` : ''} · auto-refreshes every 15s.
              {' '}<a className="text-[#1D7A4A] underline" target="_blank" rel="noreferrer" href={`https://www.openstreetmap.org/?mlat=${lat}&mlon=${lng}#map=16/${lat}/${lng}`}>Open full map</a>
            </p>
          </>
        ) : (
          <p className="text-sm text-[#9CA3AF] italic">The bus is not sharing its location right now. It appears here when the driver starts the trip.</p>
        )}
      </div>

      {/* stops */}
      {route.stops?.length > 0 && (
        <div className="bg-white rounded-xl border border-[#E5E7EB] p-5">
          <h3 className="text-xs font-bold uppercase tracking-wider text-[#1A1D23] mb-3 flex items-center gap-1.5"><MapPin className="w-4 h-4 text-[#1D7A4A]" /> Route Stops</h3>
          <ol className="space-y-2">
            {route.stops.map((s: any) => (
              <li key={s.id} className="flex items-center justify-between text-sm bg-[#F9FAFB] rounded-lg px-3 py-2">
                <span className="font-medium text-[#1A1D23]"><span className="text-[#9CA3AF] mr-2">{s.sequence}.</span>{s.name}</span>
                <span className="text-xs text-[#6B7280]">{s.pickupTime && `Pickup ${s.pickupTime}`}{s.dropTime && ` · Drop ${s.dropTime}`}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </div>
  );
}
