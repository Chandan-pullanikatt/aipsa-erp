const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host: process.env.SMTP_HOST,
  port: parseInt(process.env.SMTP_PORT || '587'),
  secure: process.env.SMTP_SECURE === 'true',
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
});

async function sendPasswordReset(to, resetUrl) {
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: 'Reset your AIPSA Digital School password',
    html: `
      <p>You requested a password reset.</p>
      <p><a href="${resetUrl}">Click here to reset your password</a></p>
      <p>This link expires in 1 hour.</p>
      <p>If you did not request this, ignore this email.</p>
    `,
  });
}

async function sendWelcome(to, schoolName, loginUrl) {
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Welcome to AIPSA Digital School — ${schoolName}`,
    html: `
      <h2>Welcome to AIPSA School ERP!</h2>
      <p>Your school workspace for <strong>${schoolName}</strong> has been created.</p>
      <p><a href="${loginUrl}">Login to your dashboard</a></p>
      <p>Your application is pending AIPSA approval. You will be notified once approved.</p>
    `,
  });
}

async function sendApprovalNotification(to, schoolName, loginUrl) {
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Your school has been approved — ${schoolName}`,
    html: `
      <h2>Congratulations!</h2>
      <p><strong>${schoolName}</strong> has been approved on AIPSA Digital School.</p>
      <p><a href="${loginUrl}">Login to your dashboard</a></p>
    `,
  });
}

async function sendInvite(to, firstName, schoolName, role, inviteUrl) {
  const roleLabel = role === 'TEACHER' ? 'teacher' : 'parent';
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: `You've been invited to join ${schoolName} on AIPSA Digital School`,
    html: `
      <h2>Hello, ${firstName}!</h2>
      <p>You have been invited to join <strong>${schoolName}</strong> as a ${roleLabel} on AIPSA Digital School.</p>
      <p><a href="${inviteUrl}" style="background:#2563eb;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0">Set Up Your Account</a></p>
      <p>This link expires in 48 hours.</p>
      <p>If you weren't expecting this, you can safely ignore this email.</p>
    `,
  });
}

async function sendAttendanceSummary(to, schoolName, date, summaries) {
  const rows = summaries.map(s =>
    `<tr><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0">${s.className}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${s.total}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#16a34a">${s.present}</td><td style="padding:6px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#dc2626">${s.absent}</td></tr>`
  ).join('');
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Daily Attendance Summary — ${schoolName} — ${date.toDateString()}`,
    html: `<h2>Daily Attendance Summary</h2><p><strong>${schoolName}</strong> · ${date.toDateString()}</p><table style="border-collapse:collapse;width:100%;margin-top:12px"><thead><tr style="background:#f9fafb"><th style="padding:8px 12px;text-align:left">Class</th><th style="padding:8px 12px">Total</th><th style="padding:8px 12px">Present</th><th style="padding:8px 12px">Absent</th></tr></thead><tbody>${rows}</tbody></table>`,
  });
}

async function sendStudentApproval(to, { firstName, schoolName, admissionNumber, tempPassword, loginUrl }) {
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject: `Your registration has been approved — ${schoolName}`,
    html: `
      <h2>Welcome to ${schoolName}!</h2>
      <p>Hello <strong>${firstName}</strong>, your registration request has been approved by your class teacher.</p>
      <p>Here are your login details:</p>
      <table style="border-collapse:collapse;margin:12px 0;background:#f9fafb;border-radius:8px;padding:12px">
        <tr><td style="padding:6px 16px;font-weight:bold;color:#555">Email</td><td style="padding:6px 16px;font-family:monospace">${to}</td></tr>
        <tr><td style="padding:6px 16px;font-weight:bold;color:#555">Admission No.</td><td style="padding:6px 16px;font-family:monospace">${admissionNumber}</td></tr>
        <tr><td style="padding:6px 16px;font-weight:bold;color:#555">Temporary Password</td><td style="padding:6px 16px;font-family:monospace">${tempPassword}</td></tr>
      </table>
      <p><a href="${loginUrl}" style="background:#1D7A4A;color:#fff;padding:10px 20px;border-radius:6px;text-decoration:none;display:inline-block;margin:12px 0">Login to Your Portal</a></p>
      <p style="color:#888;font-size:13px">You will be asked to set a new password on your first login. Please keep your credentials safe.</p>
    `,
  });
}

// Generic sender used by the notification dispatcher (email channel).
function isConfigured() {
  return !!process.env.SMTP_HOST && !!process.env.SMTP_USER;
}

async function sendRaw({ to, subject, html }) {
  if (!isConfigured()) {
    console.warn('[email] SMTP not configured — email skipped:', subject);
    return { skipped: true };
  }
  await transporter.sendMail({
    from: `"AIPSA Digital School" <${process.env.SMTP_FROM}>`,
    to,
    subject,
    html,
  });
  return { sent: true };
}

module.exports = { sendPasswordReset, sendWelcome, sendApprovalNotification, sendInvite, sendAttendanceSummary, sendStudentApproval, sendRaw, isConfigured };
