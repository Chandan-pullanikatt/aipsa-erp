// ─── Unified notification dispatcher ────────────────────────────────────────────
// One entry point — notify() / notifyRoles() — fans a single event out across every
// channel the recipient has enabled: in-app (always the baseline), push (FCM),
// email (SMTP), SMS (MSG91) and WhatsApp (MSG91). Channels that aren't configured,
// or that a user has turned off, are silently skipped. Sending never throws to the
// caller: failures in one channel/user don't block the others or the originating
// request, so this is safe to call fire-and-forget from any service.

const prisma = require('../lib/prisma');
const push = require('./channels/push.channel');
const sms = require('./channels/sms.channel');
const whatsapp = require('./channels/whatsapp.channel');
const email = require('./email.service');

const rupee = (n) => `₹${Number(n || 0).toLocaleString('en-IN')}`;
const esc = (s) => String(s ?? '').replace(/[<>&]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;' }[c]));

function shell(title, bodyHtml) {
  return `<div style="font-family:Arial,sans-serif;max-width:560px;margin:0 auto">
    <h2 style="color:#1A1D23">${esc(title)}</h2>
    <div style="color:#374151;font-size:14px;line-height:1.6">${bodyHtml}</div>
    <p style="color:#9CA3AF;font-size:12px;margin-top:24px">EduBridge</p>
  </div>`;
}

// Each event defines: a stable `type`, plain title/body (used for in-app + push),
// an email builder, and the variable shapes for SMS/WhatsApp templates. The
// SMS template id and WhatsApp template name are pulled from env per event.
const EVENTS = {
  ANNOUNCEMENT: {
    type: 'ANNOUNCEMENT',
    title: (d) => d.title,
    body: (d) => d.body,
    email: (d) => ({ subject: d.title, html: shell(d.title, `<p>${esc(d.body)}</p>`) }),
    smsTemplateEnv: 'MSG91_TEMPLATE_ANNOUNCEMENT',
    smsVariables: (d) => ({ var1: d.title }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_ANNOUNCEMENT',
    waBodyValues: (d) => [d.title, (d.body || '').slice(0, 250)],
  },
  FEE_DUE: {
    type: 'FEE',
    title: () => 'Fee Payment Due',
    body: (d) => `A fee of ${rupee(d.amount)} for ${d.studentName} is due on ${d.dueDate}.`,
    email: (d) => ({
      subject: `Fee Due — ${d.studentName}`,
      html: shell('Fee Payment Due', `<p>Dear Parent,</p><p>A fee of <strong>${rupee(d.amount)}</strong> for <strong>${esc(d.studentName)}</strong> is due on <strong>${esc(d.dueDate)}</strong>.</p>`),
    }),
    smsTemplateEnv: 'MSG91_TEMPLATE_FEE_DUE',
    smsVariables: (d) => ({ var1: d.studentName, var2: rupee(d.amount), var3: d.dueDate }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_FEE_DUE',
    waBodyValues: (d) => [d.studentName, rupee(d.amount), d.dueDate],
  },
  FEE_RECEIVED: {
    type: 'FEE',
    title: () => 'Payment Received',
    body: (d) => `Payment of ${rupee(d.amount)} received for ${d.studentName}. Receipt ${d.receiptNo}.`,
    email: (d) => ({
      subject: `Payment Received — ${d.studentName}`,
      html: shell('Payment Received', `<p>We have received <strong>${rupee(d.amount)}</strong> for <strong>${esc(d.studentName)}</strong>.</p><p>Receipt No: <strong>${esc(d.receiptNo)}</strong></p>`),
    }),
    smsTemplateEnv: 'MSG91_TEMPLATE_FEE_RECEIVED',
    smsVariables: (d) => ({ var1: d.studentName, var2: rupee(d.amount), var3: d.receiptNo }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_FEE_RECEIVED',
    waBodyValues: (d) => [d.studentName, rupee(d.amount), d.receiptNo],
  },
  ATTENDANCE_ABSENT: {
    type: 'ATTENDANCE',
    title: () => 'Absence Recorded',
    body: (d) => `${d.studentName} was marked absent on ${d.date}.`,
    email: (d) => ({
      subject: `Attendance Alert — ${d.studentName}`,
      html: shell('Absence Recorded', `<p>Dear Parent,</p><p><strong>${esc(d.studentName)}</strong> was marked <strong>absent</strong> on <strong>${esc(d.date)}</strong>.</p><p>If this is unexpected, please contact the school.</p>`),
    }),
    smsTemplateEnv: 'MSG91_TEMPLATE_ATTENDANCE_ABSENT',
    smsVariables: (d) => ({ var1: d.studentName, var2: d.date }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_ATTENDANCE_ABSENT',
    waBodyValues: (d) => [d.studentName, d.date],
  },
  // Fired to SCHOOL_ADMIN when someone registers for a program (competition,
  // course, counseling, event…). Satisfies the "notify admin on counseling/
  // registration" requirement via the same multi-channel fan-out.
  PROGRAM_REGISTRATION: {
    type: 'PROGRAM',
    title: (d) => `New registration: ${d.programTitle}`,
    body: (d) => `${d.registrantName} registered for ${d.programTitle}${d.itemName ? ` (${d.itemName})` : ''}${d.paid ? ` — ${rupee(d.amount)} paid` : ''}.`,
    email: (d) => ({
      subject: `New registration — ${d.programTitle}`,
      html: shell('New Program Registration', `<p><strong>${esc(d.registrantName)}</strong> registered for <strong>${esc(d.programTitle)}</strong>${d.itemName ? ` (${esc(d.itemName)})` : ''}.</p><p>Payment: <strong>${d.paid ? rupee(d.amount) + ' paid' : d.amount > 0 ? 'pending' : 'free'}</strong></p>`),
    }),
    smsTemplateEnv: 'MSG91_TEMPLATE_PROGRAM_REGISTRATION',
    smsVariables: (d) => ({ var1: d.registrantName, var2: d.programTitle }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_PROGRAM_REGISTRATION',
    waBodyValues: (d) => [d.registrantName, d.programTitle],
  },
  // Fired to SCHOOL_ADMIN when a teacher/staff member applies for leave, so the
  // pending request surfaces on the bell badge instead of waiting to be noticed
  // in HR › Leave Approvals.
  LEAVE_REQUEST: {
    type: 'LEAVE',
    title: () => 'New Leave Request',
    body: (d) => `${d.applicantName} (${d.applicantRole}) requested leave from ${d.fromDate} to ${d.toDate}.`,
    email: (d) => ({
      subject: `Leave request — ${d.applicantName}`,
      html: shell('New Leave Request', `<p><strong>${esc(d.applicantName)}</strong> (${esc(d.applicantRole)}) has requested leave from <strong>${esc(d.fromDate)}</strong> to <strong>${esc(d.toDate)}</strong>.</p><p>Reason: ${esc(d.reason)}</p><p>Review it under HR › Leave Approvals.</p>`),
    }),
    smsTemplateEnv: 'MSG91_TEMPLATE_LEAVE_REQUEST',
    smsVariables: (d) => ({ var1: d.applicantName, var2: d.fromDate, var3: d.toDate }),
    waTemplateEnv: 'MSG91_WA_TEMPLATE_LEAVE_REQUEST',
    waBodyValues: (d) => [d.applicantName, d.fromDate, d.toDate],
  },
};

// pref defaults: in-app/email/push ON unless explicitly false; sms/whatsapp OFF
// unless explicitly true (they cost money, so opt-in).
const on = (pref, key) => (pref ? pref[key] !== false : true);
const optIn = (pref, key) => (pref ? pref[key] === true : false);

async function dispatch(tenantId, users, eventKey, data) {
  const event = EVENTS[eventKey];
  if (!event) throw new Error(`Unknown notification event: ${eventKey}`);
  if (!users.length) return;

  const title = event.title(data);
  const body = event.body(data);
  const referenceId = data.referenceId || null;

  // 1) In-app (baseline)
  const inAppUsers = users.filter((u) => on(u.notificationPreference, 'inApp'));
  if (inAppUsers.length) {
    await prisma.notification.createMany({
      data: inAppUsers.map((u) => ({
        tenantId, userId: u.id, title, body: body.slice(0, 300), type: event.type, referenceId,
      })),
      skipDuplicates: true,
    }).catch((e) => console.error('[notify] in-app failed:', e.message));
  }

  // 2) Push (FCM)
  if (push.isConfigured()) {
    const tokens = users
      .filter((u) => on(u.notificationPreference, 'push'))
      .flatMap((u) => (u.deviceTokens || []).map((t) => t.token));
    if (tokens.length) {
      const r = await push.send(tokens, { title, body, data: { type: event.type, referenceId: referenceId || '' } });
      if (r.invalidTokens?.length) {
        await prisma.deviceToken.deleteMany({ where: { token: { in: r.invalidTokens } } }).catch(() => {});
      }
    }
  }

  // 3) Email
  if (email.isConfigured() && event.email) {
    const emailUsers = users.filter((u) => u.email && on(u.notificationPreference, 'email'));
    await Promise.allSettled(emailUsers.map((u) => {
      const { subject, html } = event.email({ ...data, user: u });
      return email.sendRaw({ to: u.email, subject, html });
    }));
  }

  // 4) SMS (opt-in)
  if (sms.isConfigured() && event.smsVariables) {
    const templateId = process.env[event.smsTemplateEnv];
    const smsUsers = users.filter((u) => u.phone && optIn(u.notificationPreference, 'sms'));
    if (templateId && smsUsers.length) {
      await sms.send(
        smsUsers.map((u) => ({ phone: u.phone, variables: event.smsVariables({ ...data, user: u }) })),
        { templateId },
      );
    }
  }

  // 5) WhatsApp (opt-in)
  if (whatsapp.isConfigured() && event.waBodyValues) {
    const templateName = process.env[event.waTemplateEnv];
    const waUsers = users.filter((u) => u.phone && optIn(u.notificationPreference, 'whatsapp'));
    if (templateName && waUsers.length) {
      await whatsapp.send(
        waUsers.map((u) => ({ phone: u.phone, bodyValues: event.waBodyValues({ ...data, user: u }) })),
        { templateName },
      );
    }
  }
}

const USER_SELECT = {
  id: true, email: true, phone: true, firstName: true, lastName: true,
  notificationPreference: true,
  deviceTokens: { select: { token: true } },
};

// Notify specific users by id.
async function notify(tenantId, userIds, eventKey, data = {}) {
  try {
    const ids = (Array.isArray(userIds) ? userIds : [userIds]).filter(Boolean);
    if (!ids.length) return;
    const users = await prisma.user.findMany({
      where: { id: { in: ids }, tenantId, isActive: true },
      select: USER_SELECT,
    });
    await dispatch(tenantId, users, eventKey, data);
  } catch (e) {
    console.error('[notify] failed:', e.message);
  }
}

// Notify everyone in a tenant matching the given roles (['ALL'] = everyone).
async function notifyRoles(tenantId, roles, eventKey, data = {}) {
  try {
    const where = {
      tenantId, isActive: true,
      ...(roles && !roles.includes('ALL') ? { role: { in: roles } } : {}),
    };
    const users = await prisma.user.findMany({ where, select: USER_SELECT });
    await dispatch(tenantId, users, eventKey, data);
  } catch (e) {
    console.error('[notifyRoles] failed:', e.message);
  }
}

// Notify a student's linked guardians (and optionally the student's own account).
async function notifyStudentGuardians(tenantId, studentId, eventKey, data = {}, { includeStudent = false } = {}) {
  try {
    const guardians = await prisma.guardian.findMany({
      where: { tenantId, studentId, userId: { not: null } },
      select: { userId: true },
    });
    const ids = guardians.map((g) => g.userId);
    if (includeStudent) {
      const student = await prisma.student.findFirst({ where: { id: studentId, tenantId }, select: { userId: true } });
      if (student?.userId) ids.push(student.userId);
    }
    await notify(tenantId, ids, eventKey, data);
  } catch (e) {
    console.error('[notifyStudentGuardians] failed:', e.message);
  }
}

module.exports = { notify, notifyRoles, notifyStudentGuardians, EVENTS };
