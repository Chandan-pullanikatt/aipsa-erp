const express = require('express');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth.routes');
const schoolRoutes = require('./routes/school.routes');
const superadminRoutes = require('./routes/superadmin.routes');
const sisRoutes = require('./routes/sis.routes');
const attendanceRoutes = require('./routes/attendance.routes');
const feeRoutes = require('./routes/fee.routes');
const communicationRoutes = require('./routes/communication.routes');
const examRoutes = require('./routes/exam.routes');
const timetableRoutes = require('./routes/timetable.routes');
const homeworkRoutes = require('./routes/homework.routes');
const lmsRoutes = require('./routes/lms.routes');
const uploadRoutes = require('./routes/upload.routes');
const transportRoutes = require('./routes/transport.routes');
const hostelRoutes = require('./routes/hostel.routes');
const purchaseRoutes = require('./routes/purchase.routes');
const libraryRoutes = require('./routes/library.routes');
const eventRoutes = require('./routes/event.routes');
const progressRoutes = require('./routes/progress.routes');
const hrRoutes = require('./routes/hr.routes');
const homeschoolRoutes = require('./routes/homeschool.routes');
const hsCatalogRoutes = require('./routes/hsCatalog.routes');
const programRoutes = require('./routes/program.routes');
const kpiRoutes = require('./routes/kpi.routes');

const { UPLOAD_DIR } = require('./lib/storage');

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
// NOTE: Rate limits are currently DISABLED for demos (unlimited logins/requests).
//       Before production, set DISABLE_RATE_LIMIT to false (or remove the skip override)
//       to restore the 300 req / 20 auth-attempt limits per 15 min window.
const RATE_LIMIT_DISABLED = process.env.DISABLE_RATE_LIMIT !== 'false';

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  skip: () => RATE_LIMIT_DISABLED || process.env.NODE_ENV !== 'production',
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 20,
  skip: () => RATE_LIMIT_DISABLED || process.env.NODE_ENV !== 'production',
  message: { error: 'Too many auth attempts, please try again later.' },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Routes
app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/schools', schoolRoutes);
app.use('/api/superadmin', superadminRoutes);
app.use('/api/sis', sisRoutes);
app.use('/api/attendance', attendanceRoutes);
app.use('/api/fees', feeRoutes);
app.use('/api/communication', communicationRoutes);
app.use('/api/exams', examRoutes);
app.use('/api/timetable', timetableRoutes);
app.use('/api/homework', homeworkRoutes);
app.use('/api/lms', lmsRoutes);
app.use('/api/uploads', uploadRoutes);
// Serve locally-stored uploads (STORAGE_DRIVER=local). Reached from the browser
// through the Next.js proxy at /api/proxy/files/<key>. No-op for cloud drivers.
app.use('/api/files', express.static(UPLOAD_DIR, { fallthrough: false, maxAge: '7d' }));
app.use('/api/transport', transportRoutes);
app.use('/api/hostel', hostelRoutes);
app.use('/api/purchases', purchaseRoutes);
app.use('/api/library', libraryRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/hr', hrRoutes);
app.use('/api/homeschool', homeschoolRoutes);
app.use('/api/hs-catalog', hsCatalogRoutes);
app.use('/api/programs', programRoutes);
app.use('/api/kpi', kpiRoutes);

// 404
app.use((req, res) => {
  res.status(404).json({ error: 'Route not found' });
});

// Global error handler
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Internal server error',
  });
});

module.exports = app;
