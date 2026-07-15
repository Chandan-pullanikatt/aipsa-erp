// Home Schooling — family subscription (B2C). v1 is TIME-BOXED access: one
// Razorpay order grants the whole family catalog access until currentPeriodEnd;
// renewing means paying again. Runs on the separate home-schooling database.
const Razorpay = require('razorpay');
const crypto = require('crypto');
const hsPrisma = require('../lib/hsPrisma');

const DEFAULT_PRICE = 999; // INR, per period — overridden by HS_SUBSCRIPTION_PRICE
const DEFAULT_MONTHS = 12; // access window — overridden by HS_SUBSCRIPTION_MONTHS

let _razorpay = null;
function getRazorpay() {
  if (!_razorpay) {
    if (!process.env.RAZORPAY_KEY_ID || !process.env.RAZORPAY_KEY_SECRET) {
      throw Object.assign(new Error('Razorpay credentials not configured'), { status: 503 });
    }
    _razorpay = new Razorpay({ key_id: process.env.RAZORPAY_KEY_ID, key_secret: process.env.RAZORPAY_KEY_SECRET });
  }
  return _razorpay;
}

function priceInr() {
  const p = Number(process.env.HS_SUBSCRIPTION_PRICE);
  return Number.isFinite(p) && p > 0 ? p : DEFAULT_PRICE;
}
function periodMonths() {
  const m = Number(process.env.HS_SUBSCRIPTION_MONTHS);
  return Number.isFinite(m) && m > 0 ? m : DEFAULT_MONTHS;
}

// Single source of truth for "is this family unlocked right now?" — used by the
// catalog/lesson gate in homeschool.service.js and by the status endpoint.
async function getAccess(accountId) {
  const sub = await hsPrisma.hsSubscription.findFirst({
    where: { accountId, status: 'ACTIVE', currentPeriodEnd: { gt: new Date() } },
    orderBy: { currentPeriodEnd: 'desc' },
    select: { currentPeriodEnd: true, plan: true },
  });
  return { active: !!sub, currentPeriodEnd: sub?.currentPeriodEnd ?? null, plan: sub?.plan ?? null };
}

async function getStatus(accountId) {
  const access = await getAccess(accountId);
  return { ...access, price: priceInr(), months: periodMonths() };
}

async function initiatePayment(accountId) {
  const price = priceInr();
  const amountPaise = Math.round(price * 100);

  const order = await getRazorpay().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `hs_${accountId}_${Date.now()}`.slice(0, 40),
  });

  await hsPrisma.hsSubscription.create({
    data: { accountId, plan: 'FAMILY', amount: price, status: 'PENDING', razorpayOrderId: order.id },
  });

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    months: periodMonths(),
  };
}

async function verifyPayment(accountId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expected = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');
  if (expected !== razorpay_signature) {
    throw Object.assign(new Error('Payment verification failed: invalid signature'), { status: 400 });
  }

  const sub = await hsPrisma.hsSubscription.findUnique({ where: { razorpayOrderId: razorpay_order_id } });
  if (!sub) throw Object.assign(new Error('Order not found'), { status: 404 });
  if (sub.accountId !== accountId) throw Object.assign(new Error('Order does not belong to this account'), { status: 403 });

  // Extend from the later of "now" or any still-valid current period.
  const current = await getAccess(accountId);
  const base = current.active && current.currentPeriodEnd ? new Date(current.currentPeriodEnd) : new Date();
  const periodEnd = new Date(base);
  periodEnd.setMonth(periodEnd.getMonth() + periodMonths());

  await hsPrisma.hsSubscription.update({
    where: { id: sub.id },
    data: { status: 'ACTIVE', razorpayPaymentId: razorpay_payment_id, currentPeriodEnd: periodEnd },
  });

  return { success: true, currentPeriodEnd: periodEnd };
}

module.exports = { getAccess, getStatus, initiatePayment, verifyPayment };
