// ─── SMS channel (MSG91) ────────────────────────────────────────────────────────
// Uses MSG91's Flow API (v5). In India, transactional SMS MUST use a DLT-approved
// template, so each event maps to an MSG91 template_id (configured via env) plus
// variables. If the auth key or the event's template id is missing, the channel
// no-ops gracefully.
//
// Required env:
//   MSG91_AUTH_KEY
//   MSG91_SENDER_ID         (6-char DLT-approved header, optional per template)
//   MSG91_TEMPLATE_<EVENT>  (DLT template id per event, e.g. MSG91_TEMPLATE_FEE_DUE)

const FLOW_URL = 'https://control.msg91.com/api/v5/flow/';

function isConfigured() {
  return !!process.env.MSG91_AUTH_KEY;
}

// Normalize an Indian mobile to MSG91's expected 91XXXXXXXXXX (no +).
function normalize(phone) {
  if (!phone) return null;
  const digits = String(phone).replace(/\D/g, '');
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  if (digits.length === 11 && digits.startsWith('0')) return `91${digits.slice(1)}`;
  return digits || null;
}

// recipients: [{ phone, variables: { var1: '...', ... } }]
async function send(recipients, { templateId } = {}) {
  if (!isConfigured()) {
    console.warn('[sms] MSG91_AUTH_KEY not set — SMS skipped.');
    return { skipped: true };
  }
  if (!templateId) {
    console.warn('[sms] no DLT template_id for this event — SMS skipped.');
    return { skipped: true };
  }
  const list = (recipients || [])
    .map((r) => {
      const mobiles = normalize(r.phone);
      return mobiles ? { mobiles, ...(r.variables || {}) } : null;
    })
    .filter(Boolean);
  if (list.length === 0) return { skipped: true };

  const payload = {
    template_id: templateId,
    ...(process.env.MSG91_SENDER_ID && { sender: process.env.MSG91_SENDER_ID }),
    recipients: list,
  };

  try {
    const res = await fetch(FLOW_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[sms] MSG91 error:', res.status, data);
      return { error: data };
    }
    return { sent: list.length, response: data };
  } catch (e) {
    console.error('[sms] send failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { send, isConfigured, normalize };
