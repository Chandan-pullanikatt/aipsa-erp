// ─── Storage Adapter ──────────────────────────────────────────────────────────
// Single interface (`upload` / `remove`) over server-disk storage, so feature code
// (ID cards, events, library covers, student photos) never depends on where files
// physically live. If a hosted object store is needed later (production S3/Spaces),
// add a driver here behind STORAGE_DRIVER and keep the same { url, key } shape.
//
// Returns { url, key } — `key` is what you pass back to `remove()` to delete later.

// ─── Local server disk (self-hosted) ─────────────────────────────────────────
// Writes files to UPLOAD_DIR — a Docker volume mounted into the API container, so
// uploads survive container rebuilds. The API serves them back statically at
// `/api/files/<key>` (see app.js); the browser reaches that through the Next.js
// proxy, so the returned url is the proxy-relative path `/api/proxy/files/<key>`.
// No external provider or public bucket required.

const fs = require('fs');
const path = require('path');

const UPLOAD_DIR = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
// Public prefix the browser uses. Defaults to the Next.js proxy path so the API
// never needs its own public port. Override with LOCAL_UPLOAD_URL_PREFIX (e.g.
// an absolute CDN/origin URL) if files are served directly.
const URL_PREFIX = (process.env.LOCAL_UPLOAD_URL_PREFIX || '/api/proxy/files').replace(/\/$/, '');

const EXT_BY_TYPE = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/gif': 'gif',
  'application/pdf': 'pdf',
};

const localDriver = {
  async upload(buffer, { folder = 'aipsa', contentType = 'application/octet-stream' } = {}) {
    const ext = EXT_BY_TYPE[contentType] || 'bin';
    const safeFolder = folder.replace(/\.\.+/g, '').replace(/^\/+/, '');
    const key = `${safeFolder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}.${ext}`;
    const dest = path.join(UPLOAD_DIR, key);
    await fs.promises.mkdir(path.dirname(dest), { recursive: true });
    await fs.promises.writeFile(dest, buffer);
    return { url: `${URL_PREFIX}/${key}`, key };
  },
  async remove(key) {
    if (!key) return;
    const target = path.join(UPLOAD_DIR, key);
    // Guard against path traversal escaping the upload dir.
    if (!target.startsWith(path.resolve(UPLOAD_DIR))) return;
    await fs.promises.rm(target, { force: true });
  },
};

const storage = localDriver;

module.exports = { storage, STORAGE_DRIVER: 'local', UPLOAD_DIR };
