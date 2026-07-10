// Shared Razorpay helpers. The existing hsSubscription / premiumLms services each
// inline their own copy of this one-time-order + HMAC-verify flow; new modules
// (Programs, Store) reuse this single helper instead of duplicating it again.
const Razorpay = require('razorpay');
const crypto = require('crypto');

let _razorpay = null;

// Lazily construct the client so the app boots even when Razorpay isn't configured
// (e.g. local dev). Callers hit a clean 503 only when they actually try to pay.
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw Object.assign(new Error('Razorpay credentials not configured'), { status: 503 });
    }
    _razorpay = new Razorpay({
      key_id: process.env.RAZORPAY_KEY_ID,
      key_secret: process.env.RAZORPAY_KEY_SECRET,
    });
  }
  return _razorpay;
}

// Create a one-time order for `amountInr` rupees. `receipt` is truncated to
// Razorpay's 40-char limit.
async function createOrder(amountInr, receipt) {
  const order = await getRazorpay().orders.create({
    amount: Math.round(amountInr * 100), // paise
    currency: 'INR',
    receipt: String(receipt).slice(0, 40),
  });
  return order;
}

// Verify the checkout callback signature. Returns true/false; never throws.
function verifySignature({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!razorpay_order_id || !razorpay_payment_id || !razorpay_signature) return false;
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  // timing-safe compare
  const a = Buffer.from(expected);
  const b = Buffer.from(String(razorpay_signature));
  return a.length === b.length && crypto.timingSafeEqual(a, b);
}

function keyId() {
  return process.env.RAZORPAY_KEY_ID || null;
}

module.exports = { getRazorpay, createOrder, verifySignature, keyId };
