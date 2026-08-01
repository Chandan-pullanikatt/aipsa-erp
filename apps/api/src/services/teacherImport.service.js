const prisma = require('../lib/prisma');
const csv = require('../lib/csv');
const hr = require('./hr.service');

/**
 * Bulk teacher/staff import from a school's staff list CSV.
 *
 * Schools hand over a name list long before they have per-teacher email
 * addresses, so `firstName` is the only required column: everything else is
 * derived. Accounts are created through `hr.createStaff`, the same path the HR
 * screen uses, so an imported teacher is indistinguishable from a typed one.
 *
 * Two-phase like the student importer: `previewImport` writes nothing and
 * reports a verdict per row, `commitImport` applies it and returns the
 * credentials once — the stored copy is hashed.
 */

const TEMPLATE_COLUMNS = [
  'firstName', 'lastName', 'email', 'phone', 'role', 'employeeId', 'designation',
];

const IMPORT_ROLES = new Set(['TEACHER', 'STAFF']);

// A synthetic address is a placeholder, not a mailbox: `.local` can never
// resolve, so a stray password-reset cannot leak to whoever owns the real
// domain. Admins replace these from the HR screen once the school supplies them.
const DEFAULT_EMAIL_DOMAIN = 'levana.local';

const parseCsv = (text) => csv.parseCsv(text, TEMPLATE_COLUMNS, { required: 'firstName' });

const slug = (s) => s.toLowerCase().replace(/[^a-z0-9]+/g, '');

// Lives in hr.service now: single creates, bulk imports and admin resets all
// hand out the same readable shape, so there is one rule to explain to a school.
const { tempPasswordFor } = hr;

function normaliseRow(row) {
  return {
    line: row.line,
    firstName: (row.firstName || '').trim(),
    lastName: (row.lastName || '').trim(),
    email: (row.email || '').trim().toLowerCase(),
    phone: (row.phone || '').trim(),
    role: (row.role || 'TEACHER').trim().toUpperCase(),
    employeeId: (row.employeeId || '').trim(),
    designation: (row.designation || '').trim(),
  };
}

/** Field-level checks that need no database lookup. */
function validateRow(row) {
  const errors = [];

  if (!row.firstName) errors.push('First name is required');
  if (!IMPORT_ROLES.has(row.role)) {
    errors.push(`Role must be Teacher or Staff (got "${row.role}")`);
  }
  if (row.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.email)) {
    errors.push(`Email is not valid (got "${row.email}")`);
  }
  return errors;
}

/**
 * Assigns every row an email: the one in the file where given, otherwise
 * `first.last@domain`. Uniqueness is global on User.email, so collisions are
 * broken with a numeric suffix against both the file and the whole database —
 * two unrelated schools may each employ a Priya Nair.
 */
async function assignEmails(rows, domain) {
  const derived = rows.map((row) => {
    if (row.email) return row.email;
    const base = [slug(row.firstName), slug(row.lastName)].filter(Boolean).join('.');
    return `${base || 'staff'}@${domain}`;
  });

  const taken = new Set(
    (await prisma.user.findMany({
      where: { email: { in: [...new Set(derived)] } },
      select: { email: true },
    })).map((u) => u.email),
  );

  const used = new Set();
  return derived.map((email, i) => {
    // An address typed into the file is the school's own instruction — report the
    // clash rather than quietly rewriting it to something they never chose.
    if (rows[i].email) return email;

    const [local, host] = email.split('@');
    let candidate = email;
    let n = 1;
    while (taken.has(candidate) || used.has(candidate)) {
      n += 1;
      candidate = `${local}${n}@${host}`;
    }
    used.add(candidate);
    return candidate;
  });
}

/**
 * Dry run. Returns a verdict per row plus counts, and writes nothing.
 * Verdicts: NEW (will be created), ERROR (will be left alone).
 */
async function previewImport(tenantId, { csv: text, emailDomain }) {
  const domain = (emailDomain || DEFAULT_EMAIL_DOMAIN).trim().replace(/^@/, '').toLowerCase();
  const rows = parseCsv(text).map(normaliseRow);

  if (!rows.length) throw Object.assign(new Error('The file has a header but no rows.'), { status: 400 });

  const emails = await assignEmails(rows, domain);

  // Employee IDs are unique per tenant, so a repeat inside the file would fail
  // mid-import. Catch it here instead.
  const seenEmployeeId = new Map();
  const idDuplicates = new Map();
  rows.forEach((row) => {
    if (!row.employeeId) return;
    const first = seenEmployeeId.get(row.employeeId);
    if (first) idDuplicates.set(row.line, first);
    else seenEmployeeId.set(row.employeeId, row.line);
  });

  const takenEmployeeIds = new Set(
    (await prisma.staffProfile.findMany({
      where: { tenantId, employeeId: { in: [...seenEmployeeId.keys()] } },
      select: { employeeId: true },
    })).map((p) => p.employeeId),
  );

  const existingEmails = new Set(
    (await prisma.user.findMany({
      where: { email: { in: emails } },
      select: { email: true },
    })).map((u) => u.email),
  );

  // Same person twice in one file — names are all we have to go on, so this is
  // a warning surfaced to the admin, not a silent merge.
  const seenNames = new Map();
  const nameDuplicates = new Map();
  rows.forEach((row) => {
    const key = `${row.firstName} ${row.lastName}`.trim().toLowerCase();
    const first = seenNames.get(key);
    if (first) nameDuplicates.set(row.line, first);
    else seenNames.set(key, row.line);
  });

  const results = rows.map((row, i) => {
    const errors = validateRow(row);
    const email = emails[i];

    const dupLine = nameDuplicates.get(row.line);
    if (dupLine) errors.push(`The same name appears on line ${dupLine}`);

    if (existingEmails.has(email)) {
      errors.push(row.email
        ? `${email} already has an account`
        : `The generated address ${email} is already taken — add an email column for this row`);
    }

    const idDupLine = idDuplicates.get(row.line);
    if (idDupLine) errors.push(`Employee ID ${row.employeeId} is already used on line ${idDupLine}`);
    if (row.employeeId && takenEmployeeIds.has(row.employeeId)) {
      errors.push(`Employee ID ${row.employeeId} already belongs to another staff member`);
    }

    return {
      line: row.line,
      name: `${row.firstName} ${row.lastName}`.trim(),
      email,
      role: row.role,
      designation: row.designation || null,
      employeeId: row.employeeId || null,
      status: errors.length ? 'ERROR' : 'NEW',
      errors,
    };
  });

  return {
    emailDomain: domain,
    rows: results,
    counts: {
      total: results.length,
      new: results.filter((r) => r.status === 'NEW').length,
      errors: results.filter((r) => r.status === 'ERROR').length,
    },
  };
}

/**
 * Applies the import. Rows that failed validation are skipped, so a partly
 * corrected file can be re-uploaded safely. Returns each created account with
 * its plain temp password — the only moment those are readable.
 */
async function commitImport(tenantId, { csv: text, emailDomain }) {
  const preview = await previewImport(tenantId, { csv: text, emailDomain });

  const emailByLine = new Map(preview.rows.map((r) => [r.line, r.email]));
  const rows = parseCsv(text).map(normaliseRow)
    .filter((r) => preview.rows.find((p) => p.line === r.line)?.status === 'NEW');

  const created = [];
  const failed = [];

  for (const row of rows) {
    const password = tempPasswordFor(row.firstName, row.lastName);
    try {
      // One row at a time, not one transaction: a single bad row should not
      // roll back forty good ones on a list the admin cannot easily re-check.
      const staff = await hr.createStaff(tenantId, {
        email: emailByLine.get(row.line),
        firstName: row.firstName,
        lastName: row.lastName,
        phone: row.phone || null,
        role: row.role,
        password,
        profile: {
          ...(row.employeeId && { employeeId: row.employeeId }),
          ...(row.designation && { designation: row.designation }),
        },
      });

      created.push({
        name: `${staff.firstName} ${staff.lastName}`.trim(),
        email: staff.email,
        role: staff.role,
        tempPassword: staff.tempPassword,
      });
    } catch (err) {
      failed.push({
        line: row.line,
        name: `${row.firstName} ${row.lastName}`.trim(),
        error: err.message || 'Could not be created',
      });
    }
  }

  return {
    created,
    failed,
    skipped: { errors: preview.counts.errors },
  };
}

function templateCsv() {
  return `${TEMPLATE_COLUMNS.join(',')}\n`
    + 'Anitha,Menon,,9876543210,TEACHER,EMP-001,Senior Teacher\n'
    + 'Rajesh,Kumar,rajesh@example.com,,TEACHER,EMP-002,\n';
}

module.exports = {
  previewImport, commitImport, templateCsv,
  parseCsv, normaliseRow, validateRow, tempPasswordFor,
  TEMPLATE_COLUMNS, DEFAULT_EMAIL_DOMAIN,
};
