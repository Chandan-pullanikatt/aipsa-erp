const multer = require('multer');

// In-memory storage: the file buffer is handed straight to the storage adapter,
// which writes it to the server's upload directory. Multer itself never writes to disk.

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
