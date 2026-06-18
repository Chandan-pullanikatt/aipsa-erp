import type { CapacitorConfig } from '@capacitor/cli';

// Hosted / remote-URL model: the native Android shell does NOT bundle the web app.
// It loads the live deployed site, so all SSR, the /api/proxy, and the httpOnly
// cookie auth keep working exactly as in a browser. Native push (FCM) is layered
// on top later. See apps/mobile/README.md.
//
// IMPORTANT: replace server.url with your real production URL (the Vercel domain).
const config: CapacitorConfig = {
  appId: 'in.aipsa.school',
  appName: 'AIPSA Digital School',
  // webDir is unused in the hosted model but Capacitor requires a valid path.
  webDir: 'www',
  server: {
    url: 'https://aipsa-erp-api.vercel.app',
    cleartext: false,
    androidScheme: 'https',
  },
};

export default config;
