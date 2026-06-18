# AIPSA Mobile (Android · Capacitor)

Native Android shell that loads the **deployed** web app (hosted / remote-URL model).
It does not bundle the Next.js app — `server.url` in `capacitor.config.ts` points at
the live site, so SSR, `/api/proxy`, and httpOnly cookie auth all work unchanged.
Native push (FCM) is added on top of this in a later step.

## Prerequisites (your machine, not CI yet)
- Node 20
- **Android Studio** + Android SDK
- **JDK 17**

## One-time setup
```bash
cd apps/mobile

# 1. Set your production URL in capacitor.config.ts (replace REPLACE_WITH_YOUR_PRODUCTION_URL)

# 2. Install deps
npm install

# 3. Add the Android platform (creates the android/ project)
npx cap add android

# 4. Add app icon + splash:
#    put a 1024x1024 logo at  apps/mobile/assets/logo.png  then:
npx @capacitor/assets generate --android

# 5. Sync config into the native project
npx cap sync android

# 6. Open in Android Studio to build / run / generate a signed APK/AAB
npx cap open android
```

## Web-side icons (PWA)
The PWA manifest (`apps/web/app/manifest.ts`) expects these — add them:
- `apps/web/public/icons/icon-192.png`
- `apps/web/public/icons/icon-512.png`
- `apps/web/public/icons/maskable-512.png`

## Releasing to Google Play
1. In Android Studio: **Build > Generate Signed Bundle / APK > Android App Bundle (.aab)**.
2. Create a keystore (keep it safe — losing it means you can never update the app).
3. Upload the `.aab` to the Play Console (one-time $25 developer account).

## Not done yet (later steps)
- Native push: `@capacitor/push-notifications` + FCM project + per-tenant device-token
  storage on the API + server triggers (fee due/received, attendance-absent, announcements).
- iOS platform (deferred — Android first).
