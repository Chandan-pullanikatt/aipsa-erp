import type { MetadataRoute } from 'next';

// PWA manifest. Next serves this at /manifest.webmanifest and auto-injects the
// <link rel="manifest"> tag. Icons live in public/icons/ — see README note; drop
// real PNGs there before shipping. Brand green matches the app (#1D7A4A).
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: 'EduBridge',
    short_name: 'EduBridge',
    description: 'Multi-Tenant School ERP & LMS',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#ffffff',
    theme_color: '#1D7A4A',
    icons: [
      { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
      { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
      { src: '/icons/maskable-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
    ],
  };
}
