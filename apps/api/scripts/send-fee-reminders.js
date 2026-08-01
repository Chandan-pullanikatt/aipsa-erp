#!/usr/bin/env node
// ─── Nightly fee-due reminder job ─────────────────────────────────────────────
// Walks every ACTIVE tenant and dispatches fee reminders across whichever channels
// each guardian has enabled (in-app + push + email, and SMS/WhatsApp if opted in).
//
// Cadence lives in fee.service.sendFeeReminders: 3 days before the due date, on
// the due date, then weekly while unpaid. Every send is written to
// fee_reminder_logs, so running this twice in a day sends nothing the second time
// — safe to retry, and safe to run alongside the admin's manual button.
//
// Usage:
//   node scripts/send-fee-reminders.js              # send
//   node scripts/send-fee-reminders.js --dry-run    # preview only, writes nothing
//   node scripts/send-fee-reminders.js --tenant=<id|slug>
//
// Droplet cron (9:30am IST = 04:00 UTC):
//   0 4 * * * cd /srv/aipsaerp/apps/api && /usr/bin/node scripts/send-fee-reminders.js >> /var/log/aipsa-fee-reminders.log 2>&1

require('dotenv').config();
const prisma = require('../src/lib/prisma');
const fee = require('../src/services/fee.service');

const args = process.argv.slice(2);
const dryRun = args.includes('--dry-run');
const only = (args.find((a) => a.startsWith('--tenant=')) || '').split('=')[1] || null;

async function main() {
  const tenants = await prisma.tenant.findMany({
    where: {
      status: 'ACTIVE',
      ...(only ? { OR: [{ id: only }, { slug: only }] } : {}),
    },
    select: { id: true, name: true, slug: true },
    orderBy: { name: 'asc' },
  });

  if (!tenants.length) {
    console.log('[fee-reminders] no matching active tenants — nothing to do.');
    return;
  }

  let totalSent = 0;
  for (const t of tenants) {
    try {
      const r = await fee.sendFeeReminders(t.id, { dryRun });
      totalSent += r.sent;
      console.log(
        `[fee-reminders] ${t.slug}: sent=${r.sent} skipped=${r.skipped} ` +
        `unreachable=${r.unreachable.length}${dryRun ? ' (dry run)' : ''}`,
      );
      // Guardians without a portal account cannot be reached on any channel —
      // surface them so the school knows who to onboard.
      if (r.unreachable.length) {
        console.log(`[fee-reminders] ${t.slug}: no linked guardian account for — ` +
          r.unreachable.map((u) => `${u.studentName} (${u.admissionNumber})`).join(', '));
      }
    } catch (e) {
      // One bad tenant must not stop the rest of the run.
      console.error(`[fee-reminders] ${t.slug} FAILED:`, e.message);
      process.exitCode = 1;
    }
  }
  console.log(`[fee-reminders] done — ${totalSent} reminder(s) across ${tenants.length} tenant(s).`);
}

main()
  .catch((e) => { console.error('[fee-reminders] fatal:', e); process.exitCode = 1; })
  .finally(() => prisma.$disconnect());
