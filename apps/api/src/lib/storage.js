// ─── Storage Adapter ──────────────────────────────────────────────────────────
// Single interface (`upload` / `remove`) with swappable backends, so feature code
// (ID cards, events, library covers, student photos) never depends on the provider.
//
//   STORAGE_DRIVER=cloudinary   → demo (free tier)
//   STORAGE_DRIVER=spaces       → production (DigitalOcean Spaces, S3-compatible)
//
// Both backends return the same shape: { url, key }.
// `key` is what you pass back to `remove()` to delete the file later.

const DRIVER = (process.env.STORAGE_DRIVER || 'cloudinary').toLowerCase();

// ─── Cloudinary (demo) ──────────────────────────────────────────────────────

let _cloudinary;
function cloudinaryClient() {
  if (_cloudinary) return _cloudinary;
  const cloudinary = require('cloudinary').v2;
  const { CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET } = process.env;
  if (!CLOUDINARY_CLOUD_NAME || !CLOUDINARY_API_KEY || !CLOUDINARY_API_SECRET) {
    throw Object.assign(
      new Error('Cloudinary is not configured. Set CLOUDINARY_CLOUD_NAME, CLOUDINARY_API_KEY, CLOUDINARY_API_SECRET.'),
      { status: 500 }
    );
  }
  cloudinary.config({
    cloud_name: CLOUDINARY_CLOUD_NAME,
    api_key: CLOUDINARY_API_KEY,
    api_secret: CLOUDINARY_API_SECRET,
    secure: true,
  });
  _cloudinary = cloudinary;
  return _cloudinary;
}

const cloudinaryDriver = {
  upload(buffer, { folder = 'aipsa', resourceType = 'image' } = {}) {
    const cloudinary = cloudinaryClient();
    return new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder, resource_type: resourceType },
        (err, result) => {
          if (err) return reject(err);
          resolve({ url: result.secure_url, key: result.public_id });
        }
      );
      stream.end(buffer);
    });
  },
  async remove(key) {
    if (!key) return;
    await cloudinaryClient().uploader.destroy(key);
  },
};

// ─── DigitalOcean Spaces (production) ─────────────────────────────────────────
// Lazily requires @aws-sdk/client-s3 so the demo install stays lean. Install the
// dependency and set the SPACES_* env vars before flipping STORAGE_DRIVER=spaces.

let _s3;
function spacesClient() {
  if (_s3) return _s3;
  const { S3Client } = require('@aws-sdk/client-s3'); // eslint-disable-line global-require
  const { SPACES_ENDPOINT, SPACES_REGION, SPACES_KEY, SPACES_SECRET } = process.env;
  if (!SPACES_ENDPOINT || !SPACES_KEY || !SPACES_SECRET) {
    throw Object.assign(new Error('DigitalOcean Spaces is not configured.'), { status: 500 });
  }
  _s3 = new S3Client({
    endpoint: SPACES_ENDPOINT,
    region: SPACES_REGION || 'us-east-1',
    credentials: { accessKeyId: SPACES_KEY, secretAccessKey: SPACES_SECRET },
  });
  return _s3;
}

const spacesDriver = {
  async upload(buffer, { folder = 'aipsa', contentType = 'application/octet-stream' } = {}) {
    const { PutObjectCommand } = require('@aws-sdk/client-s3'); // eslint-disable-line global-require
    const client = spacesClient();
    const key = `${folder}/${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
    await client.send(new PutObjectCommand({
      Bucket: process.env.SPACES_BUCKET,
      Key: key,
      Body: buffer,
      ACL: 'public-read',
      ContentType: contentType,
    }));
    const base = process.env.SPACES_CDN_URL || `${process.env.SPACES_ENDPOINT}/${process.env.SPACES_BUCKET}`;
    return { url: `${base}/${key}`, key };
  },
  async remove(key) {
    if (!key) return;
    const { DeleteObjectCommand } = require('@aws-sdk/client-s3'); // eslint-disable-line global-require
    await spacesClient().send(new DeleteObjectCommand({ Bucket: process.env.SPACES_BUCKET, Key: key }));
  },
};

const storage = DRIVER === 'spaces' ? spacesDriver : cloudinaryDriver;

module.exports = { storage, STORAGE_DRIVER: DRIVER };
