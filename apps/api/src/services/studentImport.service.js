const bcrypt = require('bcryptjs');
const prisma = require('../lib/prisma');

/**
 * Bulk student import from a class register CSV.
 *
 * One upload = one class, so the file carries no class column — the caller picks
 * the class and every row lands in it. Guardian columns are optional; when a row
 * has them, the guardian is created alongside the student as the primary contact.
 *
 * Always a two-phase flow: `previewImport` writes nothing and reports a verdict
 * per row, `commitImport` applies it. The UI must show the preview first — a
 * malformed register would otherwise create a hundred bad records with no undo.
 */

const TEMPLATE_COLUMNS = [
  'firstName', 'lastName', 'admissionNumber', 'gender', 'dateOfBirth',
  'guardianName', 'guardianRelation', 'guardianPhone', 'guardianEmail',
];

const GENDERS = new Set(['MALE', 'FEMALE', 'OTHER']);
const RELATIONS = new Set(['FATHER', 'MOTHER', 'GUARDIAN', 'SIBLING', 'OTHER']);

const generatePortalPin = () => String(Math.floor(100000 + Math.random() * 900000));

/** RFC4180-ish: handles quoted fields so a name containing a comma survives. */
function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let quoted = false;

  for (let i = 0; i < line.length; i += 1) {
    const ch = line[i];
    if (quoted) {
      if (ch === '"' && line[i + 1] === '"') { cur += '"'; i += 1; }
      else if (ch === '"') quoted = false;
      else cur += ch;
    } else if (ch === '"') quoted = true;
    else if (ch === ',') { out.push(cur.trim()); cur = ''; }
    else cur += ch;
  }
  out.push(cur.trim());
  return out;
}

/** Tolerates whatever casing/spacing a school's spreadsheet produces. */
function normaliseHeader(name) {
  const key = name.replace(/[\s_-]/g, '').toLowerCase();
  return TEMPLATE_COLUMNS.find((c) => c.toLowerCase() === key) || null;
}

function parseCsv(text) {
  const clean = String(text).replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw Object.assign(new Error('The file is empty.'), { status: 400 });

  const header = splitCsvLine(lines[0]).map(normaliseHeader);
  if (!header.includes('firstName')) {
    throw Object.assign(
      new Error('The file needs a "firstName" column. Download the template to see the expected format.'),
      { status: 400 },
    );
  }

  return lines.slice(1).map((line, i) => {
    const cells = splitCsvLine(line);
    const row = { line: i + 2 }; // 1-indexed, +1 for the header row
    header.forEach((col, j) => { if (col) row[col] = cells[j] || ''; });
    return row;
  });
}

function normaliseRow(row) {
  const guardianName = (row.guardianName || '').trim();
  const [gFirst, ...gRest] = guardianName.split(/\s+/);

  return {
    line: row.line,
    firstName: (row.firstName || '').trim(),
    lastName: (row.lastName || '').trim(),
    admissionNumber: (row.admissionNumber || '').trim(),
    gender: (row.gender || '').trim().toUpperCase(),
    dateOfBirth: (row.dateOfBirth || '').trim(),
    guardian: guardianName
      ? {
        firstName: gFirst,
        lastName: gRest.join(' '),
        relation: (row.guardianRelation || 'GUARDIAN').trim().toUpperCase(),
        phone: (row.guardianPhone || '').trim(),
        email: (row.guardianEmail || '').trim(),
      }
      : null,
  };
}

/** Field-level checks that need no database lookup. */
function validateRow(row) {
  const errors = [];

  if (!row.firstName) errors.push('First name is required');
  if (row.gender && !GENDERS.has(row.gender)) {
    errors.push(`Gender must be Male, Female or Other (got "${row.gender}")`);
  }
  if (row.dateOfBirth && Number.isNaN(new Date(row.dateOfBirth).getTime())) {
    errors.push(`Date of birth is not a valid date (got "${row.dateOfBirth}")`);
  }
  if (row.guardian) {
    if (!row.guardian.phone) errors.push('Guardian phone is required when a guardian name is given');
    if (!RELATIONS.has(row.guardian.relation)) {
      errors.push(`Relation must be Father, Mother, Guardian, Sibling or Other (got "${row.guardian.relation}")`);
    }
    if (row.guardian.email && !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(row.guardian.email)) {
      errors.push(`Guardian email is not valid (got "${row.guardian.email}")`);
    }
  }
  return errors;
}

async function assertClassInTenant(tenantId, classId) {
  const cls = await prisma.class.findFirst({
    where: { id: classId, tenantId },
    select: { id: true, name: true, sections: { select: { id: true, name: true }, orderBy: { name: 'asc' } } },
  });
  if (!cls) throw Object.assign(new Error('Class not found'), { status: 404 });
  return cls;
}

/**
 * Dry run. Returns a verdict per row plus counts, and writes nothing.
 * Verdicts: NEW (will be created), EXISTING (already enrolled, will be skipped),
 * ERROR (will be left alone).
 */
async function previewImport(tenantId, { classId, csv }) {
  const cls = await assertClassInTenant(tenantId, classId);
  const rows = parseCsv(csv).map(normaliseRow);

  if (!rows.length) throw Object.assign(new Error('The file has a header but no rows.'), { status: 400 });

  // Admission numbers must be unique per tenant, so a repeat inside the file
  // would fail mid-import. Catch it here instead.
  const seenAdmission = new Map();
  const fileDuplicates = new Map();
  for (const row of rows) {
    if (!row.admissionNumber) continue;
    const first = seenAdmission.get(row.admissionNumber);
    if (first) fileDuplicates.set(row.line, first);
    else seenAdmission.set(row.admissionNumber, row.line);
  }

  // Who currently holds each admission number, not merely whether it is taken —
  // a re-uploaded file would otherwise flag every student as clashing with itself.
  const holderByAdmission = new Map(
    (await prisma.student.findMany({
      where: { tenantId, admissionNumber: { in: [...seenAdmission.keys()] } },
      select: { id: true, admissionNumber: true },
    })).map((s) => [s.admissionNumber, s.id]),
  );

  const existing = await prisma.student.findMany({
    where: { tenantId, classId },
    select: {
      id: true, firstName: true, lastName: true, admissionNumber: true,
      guardians: { select: { phone: true } },
    },
  });
  const existingByName = new Map(
    existing.map((s) => [`${s.firstName} ${s.lastName}`.trim().toLowerCase(), s]),
  );

  const results = rows.map((row) => {
    const errors = validateRow(row);
    const match = existingByName.get(`${row.firstName} ${row.lastName}`.trim().toLowerCase());

    const dupLine = fileDuplicates.get(row.line);
    if (dupLine) errors.push(`Admission number ${row.admissionNumber} is already used on line ${dupLine}`);

    const holder = row.admissionNumber ? holderByAdmission.get(row.admissionNumber) : null;
    if (holder && holder !== match?.id) {
      errors.push(`Admission number ${row.admissionNumber} already belongs to another student`);
    }

    // Schools import names first and collect parent contacts later, so a second
    // upload of the same register with the guardian columns filled in must attach
    // them rather than skip the row as a duplicate.
    const willAddGuardian = Boolean(
      !errors.length && match && row.guardian
      && !match.guardians.some((g) => g.phone === row.guardian.phone),
    );

    return {
      line: row.line,
      name: `${row.firstName} ${row.lastName}`.trim(),
      admissionNumber: row.admissionNumber || null,
      guardian: row.guardian ? `${row.guardian.firstName} ${row.guardian.lastName}`.trim() : null,
      guardianPhone: row.guardian?.phone || null,
      status: errors.length ? 'ERROR' : !match ? 'NEW' : willAddGuardian ? 'GUARDIAN' : 'EXISTING',
      errors,
    };
  });

  return {
    className: cls.name,
    sections: cls.sections,
    rows: results,
    counts: {
      total: results.length,
      new: results.filter((r) => r.status === 'NEW').length,
      guardians: results.filter((r) => r.status === 'GUARDIAN').length,
      existing: results.filter((r) => r.status === 'EXISTING').length,
      errors: results.filter((r) => r.status === 'ERROR').length,
    },
  };
}

async function nextAdmissionNumber(tenantId, taken) {
  // Mirrors sis.service.generateAdmissionNumber, but skips numbers already
  // claimed earlier in this same import (the count lags until each create lands).
  const year = new Date().getFullYear();
  let n = await prisma.student.count({ where: { tenantId } });

  for (;;) {
    n += 1;
    const candidate = `ADM-${year}-${String(n).padStart(4, '0')}`;
    if (taken.has(candidate)) continue;
    const clash = await prisma.student.findUnique({
      where: { tenantId_admissionNumber: { tenantId, admissionNumber: candidate } },
      select: { id: true },
    });
    if (!clash) { taken.add(candidate); return candidate; }
  }
}

/**
 * Applies the import. Rows that failed validation and rows whose student already
 * exists are skipped, so a partly-corrected file can be re-uploaded safely.
 * Returns the created students with their plain portal PINs — the only moment
 * those are readable, since the stored copy is hashed.
 */
async function commitImport(tenantId, { classId, sectionId, csv }) {
  const preview = await previewImport(tenantId, { classId, csv });

  if (sectionId) {
    const section = await prisma.section.findFirst({ where: { id: sectionId, tenantId, classId } });
    if (!section) throw Object.assign(new Error('Section not found in this class'), { status: 404 });
  }

  const byLine = new Map(preview.rows.map((r) => [r.line, r.status]));
  const rows = parseCsv(csv).map(normaliseRow)
    .filter((r) => ['NEW', 'GUARDIAN'].includes(byLine.get(r.line)));

  const created = [];
  const guardiansAdded = [];
  const taken = new Set();

  for (const row of rows) {
    // Student already enrolled; the file only brings new parent contact details.
    if (byLine.get(row.line) === 'GUARDIAN') {
      const student = await prisma.student.findFirst({
        where: {
          tenantId,
          classId,
          firstName: { equals: row.firstName, mode: 'insensitive' },
          lastName: { equals: row.lastName, mode: 'insensitive' },
        },
        select: { id: true, phone: true },
      });
      if (!student) continue;

      await prisma.$transaction(async (tx) => {
        await tx.guardian.create({
          data: {
            tenantId,
            studentId: student.id,
            firstName: row.guardian.firstName,
            lastName: row.guardian.lastName,
            relation: RELATIONS.has(row.guardian.relation) ? row.guardian.relation : 'GUARDIAN',
            phone: row.guardian.phone,
            email: row.guardian.email || undefined,
            isPrimary: true,
          },
        });
        if (!student.phone) {
          await tx.student.update({ where: { id: student.id }, data: { phone: row.guardian.phone } });
        }
      });

      guardiansAdded.push(`${row.firstName} ${row.lastName}`.trim());
      continue;
    }

    const admissionNumber = row.admissionNumber || await nextAdmissionNumber(tenantId, taken);
    const plainPin = generatePortalPin();

    // Student + guardian together: a half-written row is worse than none.
    const student = await prisma.$transaction(async (tx) => {
      const s = await tx.student.create({
        data: {
          tenantId,
          admissionNumber,
          portalPin: await bcrypt.hash(plainPin, 10),
          firstName: row.firstName,
          lastName: row.lastName,
          classId,
          sectionId: sectionId || undefined,
          gender: GENDERS.has(row.gender) ? row.gender : undefined,
          dateOfBirth: row.dateOfBirth ? new Date(row.dateOfBirth) : undefined,
          phone: row.guardian?.phone || undefined,
          status: 'ACTIVE',
        },
      });

      if (row.guardian) {
        await tx.guardian.create({
          data: {
            tenantId,
            studentId: s.id,
            firstName: row.guardian.firstName,
            lastName: row.guardian.lastName,
            relation: RELATIONS.has(row.guardian.relation) ? row.guardian.relation : 'GUARDIAN',
            phone: row.guardian.phone,
            email: row.guardian.email || undefined,
            isPrimary: true,
          },
        });
      }
      return s;
    });

    created.push({
      admissionNumber: student.admissionNumber,
      name: `${student.firstName} ${student.lastName}`.trim(),
      portalPin: plainPin,
    });
  }

  return {
    className: preview.className,
    created,
    guardiansAdded,
    skipped: {
      existing: preview.counts.existing,
      errors: preview.counts.errors,
    },
  };
}

function templateCsv() {
  return `${TEMPLATE_COLUMNS.join(',')}\n`
    + 'Kevin,Reji,,MALE,2020-05-14,Reji Thomas,FATHER,9876543210,reji@example.com\n'
    + 'Helen,Tressa Benny,2326,FEMALE,,Benny Varghese,FATHER,9876543211,\n';
}

module.exports = {
  previewImport, commitImport, templateCsv, parseCsv, normaliseRow, validateRow, TEMPLATE_COLUMNS,
};
