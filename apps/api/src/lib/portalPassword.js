const crypto = require('crypto');

// Parent/student portal credentials.
//
// The default password is DERIVED from the school name + admission number, so the
// office can share it with a whole section in one message without looking anything
// up. This is a deliberate product decision: admission numbers are sequential and
// semi-public, so anyone who knows the pattern can derive a classmate's password
// and read their records. Accepted trade-off in favour of rollout simplicity —
// revisit by switching DEFAULT_IS_DERIVABLE to false and issuing random passwords.
const DEFAULT_IS_DERIVABLE = true;

const KEY = crypto.createHash('sha256').update(
  process.env.PORTAL_PIN_SECRET || process.env.JWT_SECRET || ''
).digest();

function buildDefaultPassword(schoolName, admissionNumber) {
  const firstWord = (schoolName || '').trim().split(/\s+/)[0].replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  const adm = String(admissionNumber || '').replace(/[^a-zA-Z0-9]/g, '').toLowerCase();
  return `aipsa${firstWord}${adm}`;
}

function encryptSecret(value) {
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', KEY, iv);
  const ciphertext = Buffer.concat([cipher.update(String(value), 'utf8'), cipher.final()]);
  return `v1:${iv.toString('base64')}:${cipher.getAuthTag().toString('base64')}:${ciphertext.toString('base64')}`;
}

function decryptSecret(stored) {
  if (!stored || !stored.startsWith('v1:')) return null;
  const [, iv, tag, ciphertext] = stored.split(':');
  try {
    const decipher = crypto.createDecipheriv('aes-256-gcm', KEY, Buffer.from(iv, 'base64'));
    decipher.setAuthTag(Buffer.from(tag, 'base64'));
    return Buffer.concat([decipher.update(Buffer.from(ciphertext, 'base64')), decipher.final()]).toString('utf8');
  } catch {
    return null;
  }
}

// A null/legacy column means the student is still on the derived default.
function currentPassword(student, schoolName) {
  return decryptSecret(student.portalPin)
    || buildDefaultPassword(schoolName, student.admissionNumber);
}

function isCustom(student) {
  return decryptSecret(student.portalPin) !== null;
}

function matches(input, student, schoolName) {
  const expected = currentPassword(student, schoolName);
  const a = Buffer.from(String(input));
  const b = Buffer.from(expected);
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

module.exports = {
  DEFAULT_IS_DERIVABLE,
  buildDefaultPassword,
  encryptSecret,
  decryptSecret,
  currentPassword,
  isCustom,
  matches,
};
