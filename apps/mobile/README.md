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

## Push notifications (FCM) — setup

The app code is wired: `@capacitor/push-notifications` is a dependency, the web app
registers the device token via the Capacitor bridge (`apps/web/lib/push.ts`), the API
stores tokens (`POST /communication/device-token`) and sends pushes through
`firebase-admin`. To turn it on you need a Firebase project:

1. **Create a Firebase project** → add an **Android app** with package name `in.aipsa.school`.
2. Download **`google-services.json`** and place it at `apps/mobile/android/app/google-services.json`.
   (Run `npx cap add android` first if the `android/` folder doesn't exist.)
3. Capacitor's push plugin auto-configures Gradle on `npx cap sync android`. If building
   manually, ensure the `com.google.gms:google-services` plugin is applied (the plugin's
   docs cover this; recent Capacitor versions wire it automatically).
4. **Backend env** (Render) — from Firebase **Project settings → Service accounts →
   Generate new private key**, then set:
   ```
   FIREBASE_PROJECT_ID=...
   FIREBASE_CLIENT_EMAIL=...
   FIREBASE_PRIVATE_KEY="-----BEGIN PRIVATE KEY-----\n...\n-----END PRIVATE KEY-----\n"
   ```
   (Keep the literal `\n` sequences — the API converts them.)
5. Rebuild the app, log in once on a device → the token registers automatically. Sending
   an announcement / recording a fee / marking a student absent will deliver a push.

If `FIREBASE_*` env is absent, push is simply disabled — the rest of the app is unaffected.

## SMS + WhatsApp (MSG91) — setup
Handled entirely on the API (no app change). See `apps/api/.env.example` for the
`MSG91_*` variables. SMS requires **TRAI DLT-approved templates** and WhatsApp requires
**Meta-approved templates**; map each event's template id/name via env.

## Not done yet (later steps)
- iOS platform (deferred — Android first).
- `FEE_DUE` reminders need a scheduled job (cron) to scan upcoming due dates and call
  the dispatcher; the event itself is already defined.
