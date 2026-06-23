'use client';

// Registers the service worker (enables PWA install) and shows a thin banner when
// the device goes offline. No data caching — see public/sw.js for why.
// Also registers for native push when running inside the Capacitor Android shell.
import { useEffect, useState } from 'react';
import Cookies from 'js-cookie';
import { registerPushNotifications } from '@/lib/push';

export function PwaProvider() {
  const [offline, setOffline] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.register('/sw.js').catch(() => {});
    }
    // Only attempt push registration for a logged-in user (token POST needs auth).
    if (Cookies.get('user')) registerPushNotifications();
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
      role="alertdialog"
      aria-label="You are offline"
      style={{
        position: 'fixed', inset: 0, zIndex: 9999,
        background: '#F7F8FA', color: '#1A1D23',
        display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
        textAlign: 'center', padding: '2rem',
      }}
    >
      <div
        style={{
          width: 72, height: 72, borderRadius: '50%', background: '#FCEBEB',
          display: 'flex', alignItems: 'center', justifyContent: 'center', marginBottom: '1.25rem',
        }}
      >
        <svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="#A32D2D" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round">
          <path d="M1 1l22 22" />
          <path d="M16.72 11.06A10.94 10.94 0 0 1 19 12.55" />
          <path d="M5 12.55a10.94 10.94 0 0 1 5.17-2.39" />
          <path d="M10.71 5.05A16 16 0 0 1 22.58 9" />
          <path d="M1.42 9a15.91 15.91 0 0 1 4.7-2.88" />
          <path d="M8.53 16.11a6 6 0 0 1 6.95 0" />
          <line x1="12" y1="20" x2="12.01" y2="20" />
        </svg>
      </div>
      <h2 style={{ fontFamily: "'Plus Jakarta Sans', sans-serif", fontSize: '1.25rem', fontWeight: 700, margin: 0 }}>
        You&apos;re offline
      </h2>
      <p style={{ fontSize: '0.9rem', color: '#6B7280', margin: '0.5rem 0 1.5rem', maxWidth: 320, lineHeight: 1.5 }}>
        Check your internet connection. This app needs a connection to load your school data.
      </p>
      <button
        onClick={() => window.location.reload()}
        style={{
          background: '#1D7A4A', color: '#fff', border: 'none', borderRadius: 10,
          padding: '0.75rem 1.5rem', fontSize: '0.9rem', fontWeight: 600, cursor: 'pointer',
          minHeight: 44,
        }}
      >
        Try Again
      </button>
    </div>
  );
}

export default PwaProvider;
