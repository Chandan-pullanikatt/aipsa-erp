'use client';

// Registers the service worker (enables PWA install) and shows a thin banner when
// the device goes offline. No data caching — see public/sw.js for why.
import { useEffect, useState } from 'react';

export function PwaProvider() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    const update = () => setOffline(!navigator.onLine);
    update();
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => {
      window.removeEventListener('online', update);
      window.removeEventListener('offline', update);
    };
  }, []);

  if (!offline) return null;
  return (
    <div
      role="status"
      style={{
        position: 'fixed', bottom: 0, left: 0, right: 0, zIndex: 9999,
        background: '#1A1D23', color: '#fff', textAlign: 'center',
        fontSize: '0.8rem', fontWeight: 600, padding: '0.5rem 1rem',
      }}
    >
      You're offline — some actions won't work until you reconnect.
    </div>
  );
}

export default PwaProvider;
