const Razorpay = require('razorpay');
const crypto = require('crypto');
const prisma = require('../lib/prisma');

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

function currentAcademicYear() {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  return month >= 6 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
}

async function initiatePayment(tenantId, userId) {
  const student = await prisma.student.findFirst({
    where: { tenantId, userId },
    select: { id: true, firstName: true, lastName: true },
  });
  if (!student) throw Object.assign(new Error('Student record not found'), { status: 404 });

  const profile = await prisma.schoolProfile.findUnique({
    where: { tenantId },
    select: { premiumLmsPrice: true },
  });
  const price = profile?.premiumLmsPrice;
  if (!price || price <= 0) {
    throw Object.assign(new Error('Premium LMS pricing not configured for this school'), { status: 400 });
  }

  const academicYear = currentAcademicYear();

  const existing = await prisma.premiumLmsSubscription.findUnique({
    where: { tenantId_studentId_academicYear: { tenantId, studentId: student.id, academicYear } },
  });
  if (existing?.status === 'PAID') {
    throw Object.assign(new Error('Student already has premium access for this academic year'), { status: 409 });
  }

  const amountPaise = Math.round(price * 100);
  const order = await getRazorpay().orders.create({
    amount: amountPaise,
    currency: 'INR',
    receipt: `lms_${student.id}_${academicYear}`.slice(0, 40),
  });

  if (existing) {
    await prisma.premiumLmsSubscription.update({
      where: { id: existing.id },
      data: { razorpayOrderId: order.id, status: 'PENDING', razorpayPaymentId: null, paidAt: null },
    });
  } else {
    await prisma.premiumLmsSubscription.create({
      data: {
        tenantId,
        studentId: student.id,
        academicYear,
        amount: price,
        razorpayOrderId: order.id,
        status: 'PENDING',
      },
    });
  }

  return {
    orderId: order.id,
    amount: amountPaise,
    currency: 'INR',
    keyId: process.env.RAZORPAY_KEY_ID,
    studentName: `${student.firstName} ${student.lastName}`,
    academicYear,
  };
}

async function verifyPayment(tenantId, userId, { razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  const expectedSignature = crypto
    .createHmac('sha256', process.env.RAZORPAY_KEY_SECRET)
    .update(`${razorpay_order_id}|${razorpay_payment_id}`)
    .digest('hex');

  if (expectedSignature !== razorpay_signature) {
    throw Object.assign(new Error('Payment verification failed: invalid signature'), { status: 400 });
  }

  const subscription = await prisma.premiumLmsSubscription.findUnique({
    where: { razorpayOrderId: razorpay_order_id },
  });
  if (!subscription) {
    throw Object.assign(new Error('Order not found'), { status: 404 });
  }
  if (subscription.tenantId !== tenantId) {
    throw Object.assign(new Error('Order does not belong to this school'), { status: 403 });
  }

  const updated = await prisma.premiumLmsSubscription.update({
    where: { id: subscription.id },
    data: { status: 'PAID', razorpayPaymentId: razorpay_payment_id, paidAt: new Date() },
  });

  return { success: true, academicYear: updated.academicYear };
}

async function getStatus(tenantId, userId) {
  const student = await prisma.student.findFirst({
    where: { tenantId, userId },
    select: { id: true },
  });
  if (!student) return { isPremium: false, academicYear: currentAcademicYear() };

  const academicYear = currentAcademicYear();
  const subscription = await prisma.premiumLmsSubscription.findUnique({
    where: { tenantId_studentId_academicYear: { tenantId, studentId: student.id, academicYear } },
    select: { status: true, paidAt: true },
  });

  return {
    isPremium: subscription?.status === 'PAID',
    academicYear,
    paidAt: subscription?.paidAt ?? null,
  };
}

module.exports = { initiatePayment, verifyPayment, getStatus };
