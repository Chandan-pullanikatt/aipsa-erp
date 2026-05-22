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

const app = express();

// Security
app.use(helmet());
app.use(cors({
  origin: process.env.WEB_URL || 'http://localhost:3000',
  credentials: true,
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 100,
  message: { error: 'Too many requests, please try again later.' },
});
app.use('/api/', limiter);

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 10,
  message: { error: 'Too many auth attempts, please try again later.' },
});

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));

// Health check
app.get('/health', (req, res) => {
  const rawPassword = process.env.SUPER_ADMIN_PASSWORD || 'AipsaAdmin@2024';
  const trimmedPassword = typeof rawPassword === 'string' ? rawPassword.trim() : rawPassword;
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    diagnostics: {
      hasSuperAdminPassword: !!process.env.SUPER_ADMIN_PASSWORD,
      rawLength: rawPassword.length,
      rawChars: Array.from(rawPassword).map(c => c.charCodeAt(0)),
      trimmedLength: trimmedPassword.length,
      trimmedChars: Array.from(trimmedPassword).map(c => c.charCodeAt(0)),
      trimmedMasked: trimmedPassword.length > 4 ? trimmedPassword.slice(0, 2) + '*'.repeat(trimmedPassword.length - 4) + trimmedPassword.slice(-2) : '****'
    }
  });
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
