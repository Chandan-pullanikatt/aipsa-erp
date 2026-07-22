/**
 * AIPSA — bulk student import from a CSV register (command line).
 *
 * A thin wrapper over services/studentImport.service.js, which is the same code
 * the admin UI calls at /school/students/import. Prefer the UI; this exists for
 * a one-off load by someone with shell access to the API container.
 *
 * The UI imports one class at a time, so its CSV has no class column. This script
 * takes a master file covering several classes, adds a `class` column, and splits
 * it per class — creating any class or section that does not exist yet.
 *
 * Run (from apps/api, or inside the api container):
 *   node prisma/import_students.js --tenant=<slug> --file=prisma/data/stmarys_students.csv --dry-run
 *   node prisma/import_students.js --tenant=<slug> --file=prisma/data/stmarys_students.csv
 *
 * Idempotent: students already in the class are skipped, so a corrected file can
 * be re-run. Plain portal PINs are written to a CSV once — they are hashed in the
 * database and cannot be read back, only reset.
 */

require('dotenv').config();
const fs = require('fs');
const path = require('path');
const prisma = require('../src/lib/prisma');
const studentImport = require('../src/services/studentImport.service');

const SECTION_NAME = 'A'; // registers have no sections; attendance still wants one

const args = Object.fromEntries(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, '').split('=');
    return [k, v === undefined ? true : v];
  }),
);

/** Splits a master CSV into { className: csvText }, preserving the header. */
function splitByClass(text) {
  const lines = text.replace(/^﻿/, '').split(/\r?\n/).filter((l) => l.trim());
  const header = lines[0];
  const classIdx = header.split(',').findIndex((h) => h.trim().toLowerCase() === 'class');
  if (classIdx === -1) throw new Error('The master CSV needs a "class" column');

  const byClass = new Map();
  for (const line of lines.slice(1)) {
    const name = (line.split(',')[classIdx] || '').trim();
    if (!name) continue;
    if (!byClass.has(name)) byClass.set(name, [header]);
    byClass.get(name).push(line);
  }
  // The service ignores the leftover `class` column — unknown headers are dropped.
  return new Map([...byClass].map(([name, rows]) => [name, rows.join('\n')]));
}

async function main() {
  const slug = args.tenant;
  const file = args.file || 'prisma/data/stmarys_students.csv';
  const dryRun = !!args['dry-run'];

  if (!slug) throw new Error('Pass --tenant=<school-slug>');

  const tenant = await prisma.tenant.findUnique({
    where: { slug },
    select: { id: true, name: true, status: true },
  });
  if (!tenant) throw new Error(`No school with slug "${slug}"`);

  const byClass = splitByClass(fs.readFileSync(path.resolve(file), 'utf8'));

  console.log(`School : ${tenant.name} (${slug}, ${tenant.status})`);
  console.log(`Classes: ${byClass.size}${dryRun ? '   [DRY RUN — no writes]' : ''}\n`);

  const allCreated = [];

  for (const [className, csv] of byClass) {
    let cls = await prisma.class.findUnique({
      where: { tenantId_name: { tenantId: tenant.id, name: className } },
      select: { id: true },
    });

    if (!cls) {
      if (dryRun) { console.log(`${className.padEnd(10)} would be created — skipping preview`); continue; }
      cls = await prisma.class.create({
        data: { tenantId: tenant.id, name: className },
        select: { id: true },
      });
      console.log(`  + class ${className}`);
    }

    let section = await prisma.section.findUnique({
      where: { classId_name: { classId: cls.id, name: SECTION_NAME } },
      select: { id: true },
    });
    if (!section && !dryRun) {
      section = await prisma.section.create({
        data: { tenantId: tenant.id, classId: cls.id, name: SECTION_NAME },
        select: { id: true },
      });
      console.log(`  + section ${className}-${SECTION_NAME}`);
    }

    if (dryRun) {
      const preview = await studentImport.previewImport(tenant.id, { classId: cls.id, csv });
      const { total, new: fresh, guardians, existing, errors } = preview.counts;
      console.log(`${className.padEnd(10)} ${total} rows — ${fresh} new, ${guardians} guardians to attach, ${existing} already there, ${errors} errors`);
      preview.rows.filter((r) => r.errors.length)
        .forEach((r) => console.log(`   line ${r.line}: ${r.name} — ${r.errors.join('; ')}`));
      continue;
    }

    const result = await studentImport.commitImport(tenant.id, {
      classId: cls.id,
      sectionId: section?.id || null,
      csv,
    });
    console.log(`${className.padEnd(10)} created ${result.created.length}, guardians ${result.guardiansAdded.length}, skipped ${result.skipped.existing} existing / ${result.skipped.errors} errors`);
    allCreated.push(...result.created.map((c) => ({ ...c, className })));
  }

  if (dryRun) {
    console.log('\nDry run only. Re-run without --dry-run to write.');
    return;
  }

  console.log(`\nCreated ${allCreated.length} students.`);

  if (allCreated.length) {
    const out = path.resolve(`student-pins-${slug}-${Date.now()}.csv`);
    fs.writeFileSync(
      out,
      'class,admissionNumber,name,portalPin\n'
      + allCreated.map((c) => `${c.className},${c.admissionNumber},"${c.name}",${c.portalPin}`).join('\n') + '\n',
    );
    console.log(`Portal PINs written to ${out}`);
    console.log('Parents need these to link a child — they cannot be recovered later, only reset.');
  }
}

main()
  .catch((err) => {
    console.error(err.message);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
