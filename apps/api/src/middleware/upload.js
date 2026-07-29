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

// Student-register imports. Kept separate from `upload` because the allowed types
// and size are different, and a CSV is parsed in the request — never stored.
// Browsers and Excel disagree on the CSV mime type, hence the spread.
const CSV_TYPES = new Set([
  'text/csv', 'application/csv', 'text/plain',
  'application/vnd.ms-excel', 'application/octet-stream',
]);

const csvUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 1024 * 1024 }, // 1 MB — a class register is a few KB
  fileFilter(req, file, cb) {
    if (CSV_TYPES.has(file.mimetype) || /\.csv$/i.test(file.originalname)) return cb(null, true);
    cb(Object.assign(new Error('Please upload a .csv file.'), { status: 415 }));
  },
});

// Public self-registration photo (student-join flow, no logged-in user yet).
// Images only, tighter size cap than the authenticated `upload` above.
const IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

const joinPhotoUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 4 * 1024 * 1024 }, // 4 MB
  fileFilter(req, file, cb) {
    if (IMAGE_TYPES.has(file.mimetype)) return cb(null, true);
    cb(Object.assign(new Error('Unsupported file type. Allowed: JPG, PNG, WEBP.'), { status: 415 }));
  },
});

module.exports = { upload, csvUpload, joinPhotoUpload };
