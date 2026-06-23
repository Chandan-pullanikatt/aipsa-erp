// ─── WhatsApp channel (MSG91 WhatsApp Business API) ─────────────────────────────
// WhatsApp business messaging requires Meta-approved templates. Each event maps to
// an approved template name (configured via env) plus ordered body values. If the
// auth key / integrated number / template is missing, the channel no-ops.
//
// Required env:
//   MSG91_AUTH_KEY
//   MSG91_WHATSAPP_NUMBER          (the integrated WhatsApp business number)
//   MSG91_WA_TEMPLATE_<EVENT>      (approved template name per event)
//   MSG91_WA_LANG                  (template language code, default "en")

const WA_URL = 'https://control.msg91.com/api/v5/whatsapp/whatsapp-outbound-message/bulk/';

const { normalize } = require('./sms.channel');

function isConfigured() {
  return !!process.env.MSG91_AUTH_KEY && !!process.env.MSG91_WHATSAPP_NUMBER;
}

// recipients: [{ phone, bodyValues: ['v1','v2',...] }]
async function send(recipients, { templateName } = {}) {
  if (!isConfigured()) {
    console.warn('[whatsapp] MSG91 WhatsApp not configured — WhatsApp skipped.');
    return { skipped: true };
  }
  if (!templateName) {
    console.warn('[whatsapp] no approved template for this event — WhatsApp skipped.');
    return { skipped: true };
  }

  const toAndComponents = (recipients || [])
    .map((r) => {
      const to = normalize(r.phone);
      if (!to) return null;
      const components = {};
      (r.bodyValues || []).forEach((value, i) => {
        components[`body_${i + 1}`] = { type: 'text', value: String(value) };
      });
      return { to: [to], components };
    })
    .filter(Boolean);
  if (toAndComponents.length === 0) return { skipped: true };

  const payload = {
    integrated_number: process.env.MSG91_WHATSAPP_NUMBER,
    content_type: 'template',
    payload: {
      messaging_product: 'whatsapp',
      type: 'template',
      template: {
        name: templateName,
        language: { code: process.env.MSG91_WA_LANG || 'en', policy: 'deterministic' },
        to_and_components: toAndComponents,
      },
    },
  };

  try {
    const res = await fetch(WA_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        authkey: process.env.MSG91_AUTH_KEY,
      },
      body: JSON.stringify(payload),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) {
      console.error('[whatsapp] MSG91 error:', res.status, data);
      return { error: data };
    }
    return { sent: toAndComponents.length, response: data };
  } catch (e) {
    console.error('[whatsapp] send failed:', e.message);
    return { error: e.message };
  }
}

module.exports = { send, isConfigured };
