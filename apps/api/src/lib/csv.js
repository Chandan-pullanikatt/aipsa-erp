/**
 * Shared CSV parsing for the register uploads (students, teachers).
 *
 * Schools hand over whatever their spreadsheet exported, so parsing stays
 * forgiving: quoted fields, a UTF-8 BOM, blank lines and free-form header
 * casing all survive. Columns the caller does not know about are dropped.
 */

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
function matchHeader(name, columns) {
  const key = name.replace(/[\s_-]/g, '').toLowerCase();
  return columns.find((c) => c.toLowerCase() === key) || null;
}

/**
 * Parses `text` into one object per data row, keyed by the recognised columns
 * plus `line` (the 1-indexed spreadsheet row, for error messages).
 *
 * `required` names the one column a file cannot be understood without — its
 * absence means the school uploaded the wrong file, not a fixable row error.
 */
function parseCsv(text, columns, { required } = {}) {
  const clean = String(text).replace(/^﻿/, '');
  const lines = clean.split(/\r?\n/).filter((l) => l.trim());
  if (!lines.length) throw Object.assign(new Error('The file is empty.'), { status: 400 });

  const header = splitCsvLine(lines[0]).map((h) => matchHeader(h, columns));
  if (required && !header.includes(required)) {
    throw Object.assign(
      new Error(`The file needs a "${required}" column. Download the template to see the expected format.`),
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

module.exports = { splitCsvLine, parseCsv };
