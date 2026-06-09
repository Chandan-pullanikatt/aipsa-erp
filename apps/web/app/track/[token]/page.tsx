'use client';

import { useEffect, useRef, useState } from 'react';
import { Bus, Navigation, Loader2, CheckCircle, AlertCircle } from 'lucide-react';

interface RouteInfo { id: string; name: string; routeNumber: string | null; busNumber: string | null; driverName: string | null; }

export default function DriverTrackPage({ params }: { params: Promise<{ token: string }> }) {
  const [token, setToken] = useState('');
  const [route, setRoute] = useState<RouteInfo | null>(null);
  const [error, setError] = useState('');
  const [sharing, setSharing] = useState(false);
  const [lastSent, setLastSent] = useState<Date | null>(null);
  const [sentCount, setSentCount] = useState(0);
  const watchId = useRef<number | null>(null);
  const lastPost = useRef<number>(0);

  useEffect(() => { params.then((p) => setToken(p.token)); }, [params]);

  useEffect(() => {
    if (!token) return;
    fetch(`/api/proxy/transport/track/${token}`)
      .then((r) => r.ok ? r.json() : Promise.reject())
      .then(setRoute)
      .catch(() => setError('Invalid or expired tracking link.'));
  }, [token]);

  async function post(lat: number, lng: number) {
    // throttle to ~1 post / 12s even though watchPosition fires more often
    const now = Date.now();
    if (now - lastPost.current < 12000) return;
    lastPost.current = now;
    try {
      await fetch(`/api/proxy/transport/track/${token}/location`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ lat, lng }),
      });
      setLastSent(new Date());
      setSentCount((c) => c + 1);
    } catch { /* keep trying on next tick */ }
  }

  function start() {
    if (!navigator.geolocation) { setError('Geolocation is not supported on this device.'); return; }
    setError('');
    setSharing(true);
    lastPost.current = 0;
    watchId.current = navigator.geolocation.watchPosition(
      (pos) => post(pos.coords.latitude, pos.coords.longitude),
      (err) => setError(`Location error: ${err.message}`),
      { enableHighAccuracy: true, maximumAge: 5000, timeout: 20000 },
    );
  }
  function stop() {
    if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current);
    watchId.current = null;
    setSharing(false);
  }
  useEffect(() => () => { if (watchId.current != null) navigator.geolocation.clearWatch(watchId.current); }, []);

  return (
    <div className="min-h-screen bg-[#F3F4F6] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl shadow-lg w-full max-w-md p-6">
        <div className="flex items-center gap-2 mb-1">
          <Bus className="w-6 h-6 text-[#1D7A4A]" />
          <h1 className="text-xl font-bold text-[#1A1D23]">Bus Location Sharing</h1>
        </div>

        {error && <p className="text-sm font-semibold text-[#B91C1C] bg-[#FEF2F2] border border-[#FECACA] rounded-lg px-3 py-2 my-3 flex items-center gap-2"><AlertCircle className="w-4 h-4" /> {error}</p>}

        {!route && !error && <p className="text-sm text-[#6B7280] flex items-center gap-2 py-8"><Loader2 className="w-4 h-4 animate-spin" /> Loading…</p>}

        {route && (
          <>
            <div className="bg-[#F9FAFB] rounded-xl p-4 my-4 text-sm">
              <div className="font-bold text-[#1A1D23] text-base">{route.name}</div>
              <div className="text-[#6B7280] mt-1 space-y-0.5">
                {route.busNumber && <div>Bus: <strong>{route.busNumber}</strong></div>}
                {route.driverName && <div>Driver: {route.driverName}</div>}
              </div>
            </div>

            {!sharing ? (
              <button onClick={start} className="w-full py-3 rounded-xl bg-[#1D7A4A] text-white font-bold text-sm inline-flex items-center justify-center gap-2 hover:bg-[#166038]">
                <Navigation className="w-5 h-5" /> Start sharing my location
              </button>
            ) : (
              <button onClick={stop} className="w-full py-3 rounded-xl bg-[#DC2626] text-white font-bold text-sm hover:bg-[#B91C1C]">
                Stop sharing
              </button>
            )}

            {sharing && (
              <div className="mt-4 text-center">
                <p className="text-sm font-semibold text-[#1D7A4A] flex items-center justify-center gap-2">
                  <span className="w-2.5 h-2.5 rounded-full bg-[#1D7A4A] animate-pulse" /> Sharing live ({sentCount} updates)
                </p>
                {lastSent && <p className="text-xs text-[#6B7280] mt-1">Last update {lastSent.toLocaleTimeString()}</p>}
                <p className="text-xs text-[#9CA3AF] mt-3 flex items-center justify-center gap-1"><CheckCircle className="w-3.5 h-3.5" /> Keep this screen on while driving the route.</p>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );
}
