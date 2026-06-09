const multer = require('multer');

// In-memory storage: the file buffer is streamed straight to the storage adapter
// (Cloudinary/Spaces). Render's filesystem is ephemeral, so we never touch disk.

const ALLOWED = new Set([
  'image/jpeg', 'image/png', 'image/webp', 'image/gif', 'application/pdf',
]);

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 8 * 1024 * 1024 }, // 8 MB
  fileFilter(req, file, cb) {
    if (ALLOWED.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP, GIF, PDF.'), { status: 415 }));
  },
});

module.exports = { upload };
