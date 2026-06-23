// ─── Push channel (Firebase Cloud Messaging) ───────────────────────────────────
// Lazily initializes firebase-admin from env. If credentials are absent the
// channel disables itself and every send() becomes a no-op, so the app runs fine
// in environments where push isn't configured yet.
//
// Required env:
//   FIREBASE_PROJECT_ID
//   FIREBASE_CLIENT_EMAIL
//   FIREBASE_PRIVATE_KEY   (paste the full key; literal "\n" sequences are converted)

let admin = null;
let initialized = false;
let enabled = false;

function init() {
  if (initialized) return;
  initialized = true;
  const projectId = process.env.FIREBASE_PROJECT_ID;
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL;
  const privateKey = (process.env.FIREBASE_PRIVATE_KEY || '').replace(/\\n/g, '\n');
  if (!projectId || !clientEmail || !privateKey) {
    console.warn('[push] FCM not configured (FIREBASE_* env missing) — push disabled.');
    return;
  }
  try {
    admin = require('firebase-admin');
    if (!admin.apps.length) {
      admin.initializeApp({
        credential: admin.credential.cert({ projectId, clientEmail, privateKey }),
      });
    }
    enabled = true;
  } catch (e) {
    console.error('[push] FCM init failed:', e.message);
  }
}

function isConfigured() {
  init();
  return enabled;
}

// tokens: string[]. Returns { successCount, failureCount, invalidTokens } so the
// dispatcher can prune dead device tokens from the DB.
async function send(tokens, { title, body, data } = {}) {
  init();
  if (!enabled || !Array.isArray(tokens) || tokens.length === 0) return { skipped: true };

  const message = {
    notification: { title, body },
    tokens,
    ...(data && {
      data: Object.fromEntries(Object.entries(data).map(([k, v]) => [k, String(v)])),
    }),
  };

  try {
    const res = await admin.messaging().sendEachForMulticast(message);
    const invalidTokens = [];
    res.responses.forEach((r, i) => {
      if (!r.success) {
        const code = r.error?.code || '';
        if (
          code.includes('registration-token-not-registered') ||
          code.includes('invalid-registration-token') ||
          code.includes('invalid-argument')
        ) {
          invalidTokens.push(tokens[i]);
        }
      }
    });
    return { successCount: res.successCount, failureCount: res.failureCount, invalidTokens };
  } catch (e) {
    console.error('[push] send failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { send, isConfigured };
