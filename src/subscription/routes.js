import { Router } from 'express';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { getSequelize } from '../database/connection.js';
import { Subscription, PaymentTransaction, StudentJourney, User, Admin, Student, Plan, ReferralCampaign, IndividualStudent, InstitutionContract } from '../database/index.js';
import { config } from '../config.js';
import { validateReferralCode, applyReferralReward, computeReferralDiscount } from '../referral/service.js';
import { sendWelcomeEmail } from '../services/emailService.js';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';

const router = Router();

const FALLBACK_PLANS = {
  starter: {
    key: 'starter',
    name: 'Starter',
    access_level: 1,
    interviews_total: 10,
    amount: 199,
    total_amount: 199,
    purpose: 'Level 1: Foundation & Baseline',
    tagline: 'Diagnostic Assessment & 10 Foundational Interviews',
    popular: false,
    duration_months: 1,
    features: [
      'Level 1: Foundation (1–10 Sessions)',
      'Foundation Mock Evaluation (#10)',
      'Placement Readiness Assessment',
      'Resume ATS Analysis',
      'Aptitude Assessment',
      'Technical Knowledge Diagnostic',
      'Skill-Gap Analysis',
      'Performance Report',
    ],
  },
  career: {
    key: 'career',
    name: 'Career',
    access_level: 2,
    interviews_total: 20,
    amount: 499,
    total_amount: 499,
    popular: true,
    purpose: 'Levels 1 & 2: Skill Development & Mastery',
    tagline: 'Targeted Skill Development & 20 Progressive Interviews',
    duration_months: 3,
    features: [
      'Starter Features Included',
      'Levels 1 & 2 (1–20 Structured Sessions)',
      'Intermediate Mock Evaluation (#20)',
      'System Architecture & STAR Scenarios',
      'Technical & HR Practice',
      'Aptitude & Communication Practice',
      'Personalized Improvement Recommendations',
      'Full Competency Gap Breakdown',
    ],
  },
  placement_pro: {
    key: 'placement_pro',
    name: 'Placement Pro',
    access_level: 3,
    interviews_total: 30,
    amount: 849,
    total_amount: 849,
    popular: false,
    purpose: 'Complete Placement Ready Simulation',
    tagline: 'Full 30-Interview Progression & Official Certification',
    duration_months: 6,
    features: [
      'Career Features Included',
      'All 3 Levels (1–30 Full Progression)',
      'Final Placement Simulation (#30)',
      'Executive Leadership & Pressure Rounds',
      'Verified Placement Readiness Certificate',
      'Official Weighted Placement Scorecard',
      'Priority Retakes & 1-on-1 Support',
    ],
  },
};

// Aliases for seamless backward compatibility
FALLBACK_PLANS.basic = { ...FALLBACK_PLANS.starter, key: 'basic', alias_for: 'starter' };
FALLBACK_PLANS.advanced = { ...FALLBACK_PLANS.career, key: 'advanced', alias_for: 'career' };
FALLBACK_PLANS.professional = { ...FALLBACK_PLANS.placement_pro, key: 'professional', alias_for: 'placement_pro' };

let cachedPlansMap = null;
let lastPlansFetchTime = 0;

export async function getActivePlansMap() {
  const now = Date.now();
  if (cachedPlansMap && (now - lastPlansFetchTime < 60000)) {
    return cachedPlansMap;
  }
  try {
    const dbPlans = await Plan.findAll({
      where: { status: 'active' },
      order: [['price', 'ASC']],
    });
    if (dbPlans && dbPlans.length > 0) {
      const map = {};
      for (const p of dbPlans) {
        const norm = normalizePlanTier(p.plan_key, p.price, p.journey_access || p.max_level);
        map[p.plan_key] = {
          key: p.plan_key,
          name: p.plan_name,
          access_level: norm.level,
          interviews_total: norm.interviews,
          amount: p.price,
          total_amount: p.price,
          duration_months: p.duration_months || 1,
          purpose: p.purpose || '',
          tagline: p.tagline || '',
          popular: Boolean(p.popular),
          features: p.features || [],
        };
      }
      if (map['starter'] && !map['basic']) {
        map['basic'] = { ...map['starter'], key: 'basic', alias_for: 'starter' };
      }
      if (map['career'] && !map['advanced']) {
        map['advanced'] = { ...map['career'], key: 'advanced', alias_for: 'career' };
      }
      if (map['placement_pro'] && !map['professional']) {
        map['professional'] = { ...map['placement_pro'], key: 'professional', alias_for: 'placement_pro' };
      }
      cachedPlansMap = map;
      lastPlansFetchTime = now;
      return map;
    }
  } catch (_e) {}

  return FALLBACK_PLANS;
}

export async function resolvePlan(key) {
  if (!key) return null;
  const plans = await getActivePlansMap();
  return plans[key] || plans[String(key).toLowerCase()] || null;
}

function getRazorpayClient() {
  const key_id = process.env.RAZORPAY_KEY_ID;
  const key_secret = process.env.RAZORPAY_KEY_SECRET;
  if (!key_id || !key_secret) {
    if (config.isProduction) return null;
    return null;
  }
  return { key_id, key_secret };
}

function generateInvoiceNumber() {
  const now = new Date();
  const ym = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, '0')}`;
  const rand = String(Math.floor(Math.random() * 9999)).padStart(4, '0');
  return `INV-${ym}-${rand}`;
}

router.get('/plans', asyncHandler(async (req, res) => {
  const plansMap = await getActivePlansMap();
  const distinctKeys = ['starter', 'career', 'placement_pro'];
  const plans = distinctKeys
    .map((k) => plansMap[k])
    .filter(Boolean);

  res.json({ plans });
}));

router.post('/create-order', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const { plan_key, referral_code } = req.body || {};
  const plan = await resolvePlan(plan_key);
  if (!plan) throw new HttpError(400, 'Invalid plan key');

  let discountInfo = null;
  if (referral_code) {
    const validation = await validateReferralCode(referral_code, req.user._id);
    if (!validation.valid) throw new HttpError(400, validation.error);
    discountInfo = await computeReferralDiscount(validation.campaign, plan.amount, plan.key);
  }

  const totalAmount = discountInfo ? discountInfo.finalAmount : plan.amount;
  const discountAmount = discountInfo ? discountInfo.discount : 0;

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    if (config.isProduction) throw new HttpError(500, 'Payment gateway not configured');
    return res.json({
      order_id: `mock_order_${Date.now()}`,
      amount: totalAmount,
      original_amount: plan.amount,
      discount: discountAmount,
      currency: 'INR',
      key_id: 'rzp_test_mock',
      mock: true,
    });
  }

  const auth = Buffer.from(`${razorpay.key_id}:${razorpay.key_secret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `rcpt_${req.user._id.slice(0,8)}_${plan_key}_${Date.now().toString(36)}`,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new HttpError(500, err.error?.description || 'Failed to create payment order');
  }

  const order = await response.json();
  res.json({
    order_id: order.id,
    amount: totalAmount,
    original_amount: plan.amount,
    discount: discountAmount,
    currency: 'INR',
    key_id: razorpay.key_id,
    mock: false,
  });
}));

router.post('/verify', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const { plan_key, razorpay_order_id, razorpay_payment_id, razorpay_signature, referral_code } = req.body || {};
  const plan = await resolvePlan(plan_key);
  if (!plan) throw new HttpError(400, 'Invalid plan key');

  const studentId = req.user._id;

  let discountAmount = 0;
  let totalAmount = plan.amount;
  let referralCampaign = null;
  if (referral_code) {
    const validation = await validateReferralCode(referral_code, studentId);
    if (validation.valid) {
      referralCampaign = validation.campaign;
      const discountInfo = await computeReferralDiscount(validation.campaign, plan.amount, plan_key);
      discountAmount = discountInfo.discount;
      totalAmount = discountInfo.finalAmount;
    }
  }

  const razorpay = getRazorpayClient();
  if (razorpay && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const crypto = await import('node:crypto');
    const expectedSig = crypto.createHmac('sha256', razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      throw new HttpError(400, 'Payment verification failed');
    }
  }

  const invoiceNumber = generateInvoiceNumber();

  const planRecord = await Plan.findOne({ where: { plan_key: plan.key } });

  const subscription = await Subscription.create({
    student_id: studentId,
    plan_key: plan.key,
    plan_name: plan.name,
    plan_id: planRecord?._id || null,
    access_level: plan.access_level,
    interviews_total: plan.interviews_total,
    status: 'active',
    razorpay_order_id: razorpay_order_id || null,
    razorpay_payment_id: razorpay_payment_id || null,
    amount_paid: totalAmount,
    currency: 'INR',
    gst_amount: 0,
    start_date: new Date(),
    end_date: null,
    invoices: [{
      number: invoiceNumber,
      date: new Date().toISOString(),
      amount: plan.amount,
      discount: discountAmount,
      gst: 0,
      total: totalAmount,
    }],
  });

  const transaction = await PaymentTransaction.create({
    student_id: studentId,
    subscription_id: subscription._id,
    amount: totalAmount,
    currency: 'INR',
    gst_amount: 0,
    total_amount: totalAmount,
    payment_method: 'razorpay',
    payment_id: razorpay_payment_id || null,
    order_id: razorpay_order_id || null,
    status: 'completed',
    invoice_number: invoiceNumber,
    invoice_date: new Date(),
    invoice_items: [
      { description: `${plan.name} Plan - Journey Access`, amount: plan.amount, discount: discountAmount, gst: 0, total: totalAmount },
    ],
    plan_key: plan.key,
    plan_name: plan.name,
  });

  const existingJourney = await StudentJourney.findOne({ where: { student_id: studentId } });
  if (!existingJourney) {
    const student = await User.findOne({ where: { _id: studentId } });
    await StudentJourney.create({
      student_id: studentId,
      student_name: student?.name || '',
      student_email: student?.email || '',
      institution_id: null,
      journey_access_level: plan.access_level,
      current_level: 1,
      status: 'not_started',
    });
  } else {
    await existingJourney.update({ journey_access_level: plan.access_level });
  }

  let referral_result = null;
  if (referral_code && referralCampaign) {
    try {
      referral_result = await applyReferralReward(referralCampaign._id, referralCampaign.owner_user_id, studentId, subscription._id, totalAmount);
    } catch (_err) {
      // Referral reward failure should not block the subscription
    }
  }

  res.json({
    success: true,
    subscription: {
      id: subscription._id,
      plan_key: subscription.plan_key,
      plan_name: subscription.plan_name,
      access_level: subscription.access_level,
      interviews_total: subscription.interviews_total,
      status: subscription.status,
      amount_paid: subscription.amount_paid,
      gst_amount: 0,
    },
    invoice: { number: invoiceNumber, amount: plan.amount, discount: discountAmount, gst: 0, total: totalAmount },
    transaction_id: transaction._id,
    referral_applied: referral_result?.applied || false,
  });
}));

router.post(
  '/verify-upgrade',
  requireAuth,
  requireRole('individual_student'),
  asyncHandler(async (req, res) => {
    const { plan_key, razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

    if (!plan_key || !plan_key.startsWith('level_upgrade_')) {
      throw new HttpError(400, 'Invalid upgrade plan key');
    }

    const targetLevel = parseInt(plan_key.replace('level_upgrade_', ''), 10);
    if (!targetLevel || targetLevel < 1 || targetLevel > 3) {
      throw new HttpError(400, 'Invalid target level (must be 1-3)');
    }

    const currentSub = await Subscription.findOne({
      where: { student_id: req.user._id, status: 'active' },
      order: [['created_at', 'DESC']],
    });

    const currentLevel = currentSub ? normalizePlanTier(currentSub.plan_key, currentSub.amount_paid, currentSub.access_level).level : 0;
    if (targetLevel <= currentLevel) {
      throw new HttpError(400, 'Target level must be higher than current level');
    }

    const razorpay = getRazorpayClient();
    if (razorpay && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
      const crypto = await import('node:crypto');
      const expectedSig = crypto
        .createHmac('sha256', razorpay.key_secret)
        .update(`${razorpay_order_id}|${razorpay_payment_id}`)
        .digest('hex');
      if (expectedSig !== razorpay_signature) {
        throw new HttpError(400, 'Payment verification failed');
      }
    }

    const preview = calculateLevelUpgrade(currentLevel, targetLevel);
    const studentId = req.user._id;

    if (currentSub) {
      await currentSub.update({ status: 'upgraded' });
    }

    const invoiceNumber = generateInvoiceNumber();
    const levelName = `Level ${currentLevel + 1}${targetLevel > currentLevel + 1 ? `\u2013${targetLevel}` : ''}`;

    const newSub = await Subscription.create({
      student_id: studentId,
      plan_key: `level_upgrade_${targetLevel}`,
      plan_name: `Level Upgrade to ${targetLevel}`,
      access_level: targetLevel,
      interviews_total: targetLevel * 10,
      status: 'active',
      razorpay_order_id: razorpay_order_id || null,
      razorpay_payment_id: razorpay_payment_id || null,
      amount_paid: preview.final_price,
      currency: 'INR',
      gst_amount: 0,
      start_date: new Date(),
      end_date: null,
      invoices: [{
        number: invoiceNumber,
        date: new Date().toISOString(),
        amount: preview.final_price,
        gst: 0,
        total: preview.total_amount,
      }],
    });

    await PaymentTransaction.create({
      student_id: studentId,
      subscription_id: newSub._id,
      amount: preview.final_price,
      currency: 'INR',
      gst_amount: 0,
      total_amount: preview.total_amount,
      payment_method: 'razorpay',
      payment_id: razorpay_payment_id || null,
      order_id: razorpay_order_id || null,
      status: 'completed',
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
      invoice_items: [{
        description: `Level Upgrade: ${levelName}${preview.has_discount ? ' (25% bulk discount applied)' : ''}`,
        amount: preview.final_price,
        gst: 0,
        total: preview.total_amount,
      }],
      plan_key: `level_upgrade_${targetLevel}`,
      plan_name: `Level Upgrade to ${targetLevel}`,
    });

    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (journey) {
      await journey.update({ journey_access_level: targetLevel });
    } else {
      const student = await User.findOne({ where: { _id: studentId } });
      await StudentJourney.create({
        student_id: studentId,
        student_name: student?.name || '',
        student_email: student?.email || '',
        institution_id: null,
        journey_access_level: targetLevel,
        current_level: 1,
        status: 'not_started',
      });
    }

    res.json({
      success: true,
      subscription: {
        id: newSub._id,
        plan_key: newSub.plan_key,
        plan_name: newSub.plan_name,
        access_level: newSub.access_level,
        interviews_total: newSub.interviews_total,
        status: newSub.status,
        amount_paid: newSub.amount_paid,
      gst_amount: 0,
    },
    invoice: { number: invoiceNumber, amount: preview.final_price, gst: 0, total: preview.total_amount },
    });
  }),
);

router.get('/current', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const subscription = await Subscription.findOne({
    where: { student_id: req.user._id, status: 'active' },
    order: [['created_at', 'DESC']],
  });

  if (!subscription) {
    return res.json({ subscription: null });
  }

  const normalized = normalizePlanTier(subscription.plan_key, subscription.amount_paid, subscription.access_level);
  if (subscription.access_level !== normalized.level || subscription.interviews_total !== normalized.interviews) {
    try {
      await subscription.update({
        access_level: normalized.level,
        interviews_total: normalized.interviews,
        plan_name: normalized.name,
      });
    } catch (_err) {}
  }

  const journey = await StudentJourney.findOne({ where: { student_id: req.user._id } });
  if (journey) {
    const completed = journey.completed_interviews || 0;
    const calcLevel = completed >= 20 ? 3 : completed >= 10 ? 2 : 1;
    if (journey.journey_access_level !== normalized.level || journey.total_interviews !== 30 || journey.current_level > 3) {
      try {
        await journey.update({
          journey_access_level: normalized.level,
          total_interviews: 30,
          current_level: Math.min(normalized.level, calcLevel),
        });
      } catch (_err) {}
    }
  }

  res.json({
    subscription: {
      id: subscription._id,
      plan_key: subscription.plan_key,
      plan_name: normalized.name,
      access_level: normalized.level,
      interviews_total: normalized.interviews,
      status: subscription.status,
      amount_paid: subscription.amount_paid,
      start_date: subscription.start_date,
      end_date: subscription.end_date,
      created_at: subscription.created_at,
    },
    journey: journey ? {
      current_level: Math.min(normalized.level, (journey.completed_interviews || 0) >= 20 ? 3 : (journey.completed_interviews || 0) >= 10 ? 2 : 1),
      completed_interviews: journey.completed_interviews,
      total_interviews: 30,
      readiness_score: journey.readiness_score,
      status: journey.status,
    } : null,
  });
}));

router.get('/history', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const transactions = await PaymentTransaction.findAll({
    where: { student_id: req.user._id },
    order: [['created_at', 'DESC']],
  });

  res.json({
    transactions: transactions.map(t => ({
      id: t._id,
      amount: t.amount,
      total_amount: t.total_amount,
      status: t.status,
      invoice_number: t.invoice_number,
      invoice_date: t.invoice_date,
      plan_key: t.plan_key,
      plan_name: t.plan_name,
      created_at: t.created_at,
    })),
  });
}));

router.get('/invoice/:transactionId', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const transaction = await PaymentTransaction.findOne({
    where: { _id: req.params.transactionId, student_id: req.user._id },
  });
  if (!transaction) throw new HttpError(404, 'Transaction not found');

  const student = await User.findOne({ where: { _id: req.user._id } });

  res.json({
    invoice: {
      number: transaction.invoice_number,
      date: transaction.invoice_date,
      student: {
        name: student?.name,
        email: student?.email,
      },
      items: transaction.invoice_items,
      subtotal: transaction.amount,
      total: transaction.total_amount,
      payment_method: transaction.payment_method,
      payment_id: transaction.payment_id,
      plan_name: transaction.plan_name,
    },
  });
}));

export const LEVEL_PRICES = { 1: 199, 2: 499, 3: 849 };

export function normalizePlanTier(planKey, amountPaid, existingAccessLevel) {
  const k = String(planKey || '').toLowerCase();
  if (['placement_pro', 'professional', 'level_3', 'level_1_3'].includes(k)) {
    return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  }
  if (['career', 'advanced', 'level_2', 'level_1_2'].includes(k)) {
    return { level: 2, interviews: 20, name: 'Level 2: Skill Development' };
  }
  if (['starter', 'basic', 'level_1', 'level_1_1'].includes(k)) {
    return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
  }
  const amt = Number(amountPaid) || 0;
  if (amt >= 700) return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  if (amt >= 400) return { level: 2, interviews: 20, name: 'Level 2: Skill Development' };
  if (amt >= 150) return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
  if (existingAccessLevel === 2) return { level: 2, interviews: 20, name: 'Level 2: Skill Development' };
  if (existingAccessLevel === 3) return { level: 3, interviews: 30, name: 'Level 3: Placement Ready' };
  return { level: 1, interviews: 10, name: 'Level 1: Foundation' };
}

export function calculateLevelUpgrade(currentLevel, targetLevel) {
  if (targetLevel <= currentLevel) return null;
  const currentPrice = LEVEL_PRICES[currentLevel] || 0;
  const targetPrice = LEVEL_PRICES[targetLevel] || 849;
  const upgradeCost = Math.max(0, targetPrice - currentPrice);
  const levelsCount = targetLevel - currentLevel;
  return {
    levels_count: levelsCount,
    current_level: currentLevel,
    target_level: targetLevel,
    price_per_level: Math.round(upgradeCost / levelsCount),
    base_price: upgradeCost,
    has_discount: false,
    discount_percentage: 0,
    discount_amount: 0,
    final_price: upgradeCost,
    gst_amount: 0,
    total_amount: upgradeCost,
  };
}

router.get('/upgrade-preview', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const target = parseInt(req.query.target_level || req.query.target);
  if (!target || target < 1 || target > 3) throw new HttpError(400, 'Target level must be 1-3');

  const currentSub = await Subscription.findOne({
    where: { student_id: req.user._id, status: 'active' },
    order: [['created_at', 'DESC']],
  });

  const currentLevel = currentSub ? normalizePlanTier(currentSub.plan_key, currentSub.amount_paid, currentSub.access_level).level : 0;
  if (target <= currentLevel) throw new HttpError(400, 'Target level must be higher than current level');

  const preview = calculateLevelUpgrade(currentLevel, target);
  res.json({ preview });
}));

router.post(
  "/create-upgrade-order",
  requireAuth,
  requireRole("individual_student"),
  asyncHandler(async (req, res) => {
    const target = parseInt(req.body?.target_level || req.body?.target);
    if (!target || target < 1 || target > 3) throw new HttpError(400, "Target level must be 1-3");

    const currentSub = await Subscription.findOne({
      where: { student_id: req.user._id, status: "active" },
      order: [["created_at", "DESC"]],
    });

    const currentLevel = currentSub ? normalizePlanTier(currentSub.plan_key, currentSub.amount_paid, currentSub.access_level).level : 0;
    if (target <= currentLevel) throw new HttpError(400, "Target level must be higher than current level");

    const preview = calculateLevelUpgrade(currentLevel, target);
    const totalAmount = preview.total_amount;

    const razorpay = getRazorpayClient();
    if (!razorpay) {
      if (config.isProduction) throw new HttpError(500, 'Payment gateway not configured');
      return res.json({
        order_id: `mock_order_${Date.now()}`,
        amount: totalAmount,
        currency: "INR",
        key_id: "rzp_test_mock",
        mock: true,
      });
    }

    const auth = Buffer.from(`${razorpay.key_id}:${razorpay.key_secret}`).toString("base64");
    const response = await fetch("https://api.razorpay.com/v1/orders", {
      method: "POST",
      headers: {
        Authorization: `Basic ${auth}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        amount: totalAmount * 100,
        currency: "INR",
        receipt: `rcpt_${req.user._id.slice(0,8)}_upg${target}_${Date.now().toString(36)}`,
      }),
    });

    if (!response.ok) {
      const err = await response.json();
      throw new HttpError(500, err.error?.description || "Failed to create payment order");
    }

    const order = await response.json();
    res.json({
      order_id: order.id,
      amount: totalAmount,
      currency: "INR",
      key_id: razorpay.key_id,
      mock: false,
    });
  }),
);

router.post('/upgrade-level', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};
  const target = parseInt(req.body?.target_level || req.body?.target);
  if (!target || target < 1 || target > 3) throw new HttpError(400, 'Target level must be 1-3');

  const currentSub = await Subscription.findOne({
    where: { student_id: req.user._id, status: 'active' },
    order: [['created_at', 'DESC']],
  });

  const currentLevel = currentSub ? normalizePlanTier(currentSub.plan_key, currentSub.amount_paid, currentSub.access_level).level : 0;
  if (target <= currentLevel) throw new HttpError(400, 'Target level must be higher than current level');

  const razorpay = getRazorpayClient();
  if (razorpay && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const crypto = await import('node:crypto');
    const expectedSig = crypto.createHmac('sha256', razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      throw new HttpError(400, 'Payment verification failed');
    }
  }

  const preview = calculateLevelUpgrade(currentLevel, target);
  const studentId = req.user._id;

  if (currentSub) {
    await currentSub.update({ status: 'upgraded' });
  }

  const invoiceNumber = generateInvoiceNumber();
  const levelName = `Level ${currentLevel + 1}${target > currentLevel + 1 ? `–${target}` : ''}`;

  const newSub = await Subscription.create({
    student_id: studentId,
    plan_key: `level_upgrade_${target}`,
    plan_name: `Level Upgrade to ${target}`,
    access_level: target,
    interviews_total: target * 10,
    status: 'active',
    razorpay_order_id: razorpay_order_id || null,
    razorpay_payment_id: razorpay_payment_id || null,
    amount_paid: preview.final_price,
    currency: 'INR',
    gst_amount: 0,
    start_date: new Date(),
    end_date: null,
    invoices: [{
      number: invoiceNumber,
      date: new Date().toISOString(),
      amount: preview.final_price,
      gst: 0,
      total: preview.total_amount,
    }],
  });

  await PaymentTransaction.create({
    student_id: studentId,
    subscription_id: newSub._id,
    amount: preview.final_price,
    currency: 'INR',
    gst_amount: 0,
    total_amount: preview.total_amount,
    payment_method: 'razorpay',
    payment_id: razorpay_payment_id || null,
    order_id: razorpay_order_id || null,
    status: 'completed',
    invoice_number: invoiceNumber,
    invoice_date: new Date(),
    invoice_items: [
      {
        description: `Level Upgrade: ${levelName}${preview.has_discount ? ` (25% bulk discount applied)` : ''}`,
        amount: preview.final_price,
        gst: 0,
        total: preview.total_amount,
      },
    ],
    plan_key: `level_upgrade_${target}`,
    plan_name: `Level Upgrade to ${target}`,
  });

  const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
  if (journey) {
    await journey.update({ journey_access_level: target });
  } else {
    const student = await User.findOne({ where: { _id: studentId } });
    await StudentJourney.create({
      student_id: studentId,
      student_name: student?.name || '',
      student_email: student?.email || '',
      institution_id: null,
      journey_access_level: target,
      current_level: 1,
      status: 'not_started',
    });
  }

  res.json({
    success: true,
    subscription: {
      id: newSub._id,
      plan_key: newSub.plan_key,
      plan_name: newSub.plan_name,
      access_level: newSub.access_level,
      interviews_total: newSub.interviews_total,
      status: newSub.status,
      amount_paid: newSub.amount_paid,
      gst_amount: 0,
    },
    invoice: { number: invoiceNumber, amount: preview.final_price, gst: 0, total: preview.total_amount },
    upgrade: preview,
  });
}));

router.get('/admin/individual-students', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { search, college, page = 1, limit = 20 } = req.query;
  const { Op, literal } = await import('sequelize');
  const where = { role: 'individual_student' };
  if (search) {
    const esc = String(search).replace(/'/g, "''");
    where[Op.or] = [
      { name: { [Op.iLike]: `%${esc}%` } },
      { email: { [Op.iLike]: `%${esc}%` } },
      { phone: { [Op.iLike]: `%${esc}%` } },
      { college_name: { [Op.iLike]: `%${esc}%` } },
      { college_address: { [Op.iLike]: `%${esc}%` } },
      { course_details: { [Op.iLike]: `%${esc}%` } },
      { stream: { [Op.iLike]: `%${esc}%` } },
      { interested_role: { [Op.iLike]: `%${esc}%` } },
      literal(`EXISTS (SELECT 1 FROM subscriptions s WHERE s.student_id::TEXT = "User"."_id"::TEXT AND (s.plan_name ILIKE '%${esc}%' OR s.plan_key ILIKE '%${esc}%' OR s.access_level::TEXT ILIKE '%${esc}%'))`),
      literal(`EXISTS (SELECT 1 FROM student_journeys j WHERE j.student_id::TEXT = "User"."_id"::TEXT AND (j.current_level::TEXT ILIKE '%${esc}%' OR j.completed_interviews::TEXT ILIKE '%${esc}%'))`),
    ];
  }
  if (college) {
    where.college_name = { [Op.iLike]: college };
  }

  const [collegeRows] = await getSequelize().query(
    `SELECT DISTINCT college_name FROM users WHERE role = 'individual_student' AND college_name IS NOT NULL AND college_name <> '' ORDER BY college_name`
  );
  const colleges = collegeRows.map(r => r.college_name);

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: users } = await User.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
    raw: true,
  });

  const userIds = users.map(u => u._id);

  let profileMap = {};
  if (userIds.length) {
    const [profiles] = await getSequelize().query(
      `SELECT * FROM individual_students WHERE user_id IN (:uids)`,
      { replacements: { uids: userIds } }
    );
    for (const p of profiles) profileMap[p.user_id] = p;
  }

  const subIds = Object.values(profileMap).map(p => p.subscription_id).filter(Boolean);
  let subMap = {};
  if (subIds.length) {
    const subscriptions = await Subscription.findAll({
      where: { _id: subIds },
      order: [['created_at', 'DESC']],
      raw: true,
    });
    for (const sub of subscriptions) subMap[sub._id] = sub;
  }

  let journeyMap = {};
  if (userIds.length) {
    const journeys = await StudentJourney.findAll({
      where: { student_id: userIds },
      raw: true,
    });
    for (const j of journeys) journeyMap[j.student_id] = j;
  }

  res.json({
    students: users.map(u => {
      const profile = profileMap[u._id] || {};
      const sub = subMap[profile.subscription_id] || null;
      const j = journeyMap[u._id];
      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        role: u.role,
        is_active: u.is_active,
        stream: u.stream || '',
        interested_role: u.interested_role || '',
        college_name: u.college_name || '',
        college_address: u.college_address || '',
        course_details: u.course_details || '',
        subscription_status: profile.subscription_status || 'inactive',
        journey_access: profile.journey_access || 0,
        current_level: profile.current_level || 1,
        current_interview: profile.current_interview || 1,
        subscription: sub ? {
          id: sub._id,
          plan_key: sub.plan_key,
          plan_name: sub.plan_name,
          access_level: sub.access_level,
          status: sub.status,
          amount_paid: sub.amount_paid,
          start_date: sub.start_date,
        } : null,
        journey: j ? {
          current_level: j.current_level,
          completed_interviews: j.completed_interviews,
          readiness_score: j.readiness_score,
          status: j.status,
        } : null,
      };
    }),
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil(count / parseInt(limit)),
    colleges,
  });
}));

router.delete('/admin/individual-students/:studentId', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { studentId } = req.params;
  const user = await User.findByPk(studentId);
  if (!user) throw new HttpError(404, 'Student not found');
  if (user.role !== 'individual_student') throw new HttpError(400, 'User is not an individual student');

  const sequelize = getSequelize();
  await sequelize.query(`DELETE FROM individual_students WHERE user_id = :uid`, { replacements: { uid: studentId } });
  await StudentJourney.destroy({ where: { student_id: studentId } });
  await Subscription.destroy({ where: { student_id: studentId } });
  await PaymentTransaction.destroy({ where: { student_id: studentId } });
  await User.destroy({ where: { _id: studentId } });

  res.status(204).end();
}));

router.patch('/admin/individual-students/:studentId/subscription', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { action, plan_key } = req.body || {};
  const studentId = req.params.studentId;

  const student = await User.findOne({ where: { _id: studentId, role: 'individual_student' } });
  if (!student) throw new HttpError(404, 'Student not found');

  const currentSub = await Subscription.findOne({
    where: { student_id: studentId, status: 'active' },
    order: [['created_at', 'DESC']],
  });

  if (action === 'cancel') {
    if (currentSub) {
      await currentSub.update({ status: 'cancelled' });
      await StudentJourney.update(
        { journey_access_level: 0 },
        { where: { student_id: studentId } }
      );
    }
    return res.json({ success: true, message: 'Subscription cancelled' });
  }

  if (action === 'upgrade' || action === 'assign') {
    const plan = await resolvePlan(plan_key);
    if (!plan) throw new HttpError(400, 'Invalid plan key');

    if (currentSub) {
      await currentSub.update({ status: 'upgraded' });
    }

    const invoiceNumber = generateInvoiceNumber();

    const newSub = await Subscription.create({
      student_id: studentId,
      plan_key: plan.key,
      plan_name: plan.name,
      access_level: plan.access_level,
      interviews_total: plan.interviews_total,
      status: 'active',
      amount_paid: plan.amount,
      gst_amount: 0,
      start_date: new Date(),
      invoices: [{ number: invoiceNumber, date: new Date().toISOString(), amount: plan.amount, gst: 0, total: plan.amount }],
    });

    await PaymentTransaction.create({
      student_id: studentId,
      subscription_id: newSub._id,
      amount: plan.amount,
      gst_amount: 0,
      total_amount: plan.amount,
      status: 'completed',
      invoice_number: invoiceNumber,
      invoice_date: new Date(),
      invoice_items: [{ description: `${plan.name} Plan - Journey Access (Admin Assigned)`, amount: plan.amount, gst: 0, total: plan.amount }],
      plan_key: plan.key,
      plan_name: plan.name,
    });

    const journey = await StudentJourney.findOne({ where: { student_id: studentId } });
    if (journey) {
      await journey.update({ journey_access_level: plan.access_level });
    } else {
      await StudentJourney.create({
        student_id: studentId,
        student_name: student.name || '',
        student_email: student.email || '',
        journey_access_level: plan.access_level,
        current_level: 1,
        status: 'not_started',
      });
    }

    return res.json({
      success: true,
      subscription: {
        id: newSub._id,
        plan_key: newSub.plan_key,
        plan_name: newSub.plan_name,
        access_level: newSub.access_level,
      },
    });
  }

  throw new HttpError(400, 'Invalid action. Use: upgrade, assign, or cancel');
}));

function signToken(user) {
  return jwt.sign({ sub: user._id, role: user.role }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
}

function toSafeJSON(user) {
  return {
    _id: user._id,
    name: user.name,
    email: user.email,
    role: user.role,
    phone: user.phone || null,
    is_active: user.is_active,
    email_verified: user.email_verified,
    stream: user.stream || '',
    interested_role: user.interested_role || '',
    college_name: user.college_name || '',
    college_address: user.college_address || '',
    course_details: user.course_details || '',
  };
}

router.post('/check-email', asyncHandler(async (req, res) => {
  const { email } = req.body || {};
  if (!email || typeof email !== 'string') throw new HttpError(400, 'Email is required');
  const normalizedEmail = email.trim().toLowerCase();

  const [userExists, adminExists, studentExists] = await Promise.all([
    User.findOne({ where: { email: normalizedEmail }, attributes: ['_id'], raw: true }),
    Admin.findOne({ where: { email: normalizedEmail }, attributes: ['_id'], raw: true }),
    Student.findOne({ where: { email: normalizedEmail }, attributes: ['_id'], raw: true }),
  ]);

  const exists = !!(userExists || adminExists || studentExists);
  res.json({ exists, email: normalizedEmail });
}));

router.post('/guest-create-order', asyncHandler(async (req, res) => {
  const { plan_key, referral_code } = req.body || {};
  const plan = await resolvePlan(plan_key);
  if (!plan) throw new HttpError(400, 'Invalid plan key');

  let discountInfo = null;
  if (referral_code) {
    const validation = await validateReferralCode(referral_code, null);
    if (validation.valid) {
      discountInfo = await computeReferralDiscount(validation.campaign, plan.amount, plan.key);
    }
  }

  const totalAmount = discountInfo ? discountInfo.finalAmount : plan.amount;
  const discountAmount = discountInfo ? discountInfo.discount : 0;

  const razorpay = getRazorpayClient();
  if (!razorpay) {
    if (config.isProduction) throw new HttpError(500, 'Payment gateway not configured');
    return res.json({
      order_id: `mock_order_${Date.now()}`,
      amount: totalAmount,
      original_amount: plan.amount,
      discount: discountAmount,
      currency: 'INR',
      key_id: 'rzp_test_mock',
      mock: true,
    });
  }

  const auth = Buffer.from(`${razorpay.key_id}:${razorpay.key_secret}`).toString('base64');
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: {
      'Authorization': `Basic ${auth}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      amount: totalAmount * 100,
      currency: 'INR',
      receipt: `rcpt_guest_${plan.key}_${Date.now().toString(36)}`,
    }),
  });

  if (!response.ok) {
    const err = await response.json();
    throw new HttpError(500, err.error?.description || 'Failed to create payment order');
  }

  const order = await response.json();
  res.json({
    order_id: order.id,
    amount: totalAmount,
    original_amount: plan.amount,
    discount: discountAmount,
    currency: 'INR',
    key_id: razorpay.key_id,
    mock: false,
  });
}));

router.post('/guest-verify', asyncHandler(async (req, res) => {
  const { plan_key, name, email, password, razorpay_order_id, razorpay_payment_id, razorpay_signature, referral_code, stream, interested_role, college_name, college_address, course_details } = req.body || {};
  const plan = await resolvePlan(plan_key);
  if (!plan) throw new HttpError(400, 'Invalid plan key');
  if (!name || !email || !password) throw new HttpError(400, 'Name, email, and password are required');

  const razorpay = getRazorpayClient();
  if (razorpay && razorpay_order_id && razorpay_payment_id && razorpay_signature) {
    const crypto = await import('node:crypto');
    const expectedSig = crypto.createHmac('sha256', razorpay.key_secret)
      .update(`${razorpay_order_id}|${razorpay_payment_id}`)
      .digest('hex');
    if (expectedSig !== razorpay_signature) {
      throw new HttpError(400, 'Payment verification failed');
    }
  }

  const normalizedEmail = email.trim().toLowerCase();
  const existing = await User.findOne({ where: { email: normalizedEmail } });
  if (existing) throw new HttpError(400, 'Email is already registered');

  const passwordHash = await bcrypt.hash(password, 10);
  const user = await User.create({
    name: name.trim(),
    email: normalizedEmail,
    password_hash: passwordHash,
    role: 'individual_student',
    email_verified: true,
    must_change_password: false,
    is_active: true,
    stream: String(stream || '').trim().slice(0, 80),
    interested_role: String(interested_role || '').trim().slice(0, 80),
    college_name: String(college_name || '').trim().slice(0, 255),
    college_address: String(college_address || '').trim().slice(0, 500),
    course_details: String(course_details || '').trim().slice(0, 255),
  });

  await getSequelize().query(
    `INSERT INTO individual_students (_id, user_id, subscription_status, created_at, updated_at)
     VALUES (gen_random_uuid(), :userId, 'inactive', NOW(), NOW())`,
    { replacements: { userId: user._id } }
  );

  let discountAmount = 0;
  let totalAmount = plan.amount;
  let referralCampaign = null;
  if (referral_code) {
    const validation = await validateReferralCode(referral_code, user._id);
    if (validation.valid) {
      referralCampaign = validation.campaign;
      const discountInfo = await computeReferralDiscount(validation.campaign, plan.amount, plan_key);
      discountAmount = discountInfo.discount;
      totalAmount = discountInfo.finalAmount;
    }
  }

  const invoiceNumber = generateInvoiceNumber();
  const planRecord = await Plan.findOne({ where: { plan_key: plan.key } });

  const subscription = await Subscription.create({
    student_id: user._id,
    plan_key: plan.key,
    plan_name: plan.name,
    plan_id: planRecord?._id || null,
    access_level: plan.access_level,
    interviews_total: plan.interviews_total,
    status: 'active',
    razorpay_order_id: razorpay_order_id || null,
    razorpay_payment_id: razorpay_payment_id || null,
    amount_paid: totalAmount,
    currency: 'INR',
    gst_amount: 0,
    start_date: new Date(),
    end_date: null,
    invoices: [{
      number: invoiceNumber,
      date: new Date().toISOString(),
      amount: plan.amount,
      discount: discountAmount,
      gst: 0,
      total: totalAmount,
    }],
  });

  await PaymentTransaction.create({
    student_id: user._id,
    subscription_id: subscription._id,
    amount: totalAmount,
    currency: 'INR',
    gst_amount: 0,
    total_amount: totalAmount,
    payment_method: 'razorpay',
    payment_id: razorpay_payment_id || null,
    order_id: razorpay_order_id || null,
    status: 'completed',
    invoice_number: invoiceNumber,
    invoice_date: new Date(),
    invoice_items: [
      { description: `${plan.name} Plan - Journey Access`, amount: plan.amount, discount: discountAmount, gst: 0, total: totalAmount },
    ],
    plan_key: plan.key,
    plan_name: plan.name,
  });

  await StudentJourney.create({
    student_id: user._id,
    student_name: user.name || '',
    student_email: user.email || '',
    institution_id: null,
    journey_access_level: plan.access_level,
    current_level: 1,
    status: 'not_started',
    target_career_goal: user.interested_role || '',
  });

  let referral_result = null;
  if (referralCampaign) {
    try {
      referral_result = await applyReferralReward(referralCampaign._id, referralCampaign.owner_user_id, user._id, subscription._id, totalAmount);
    } catch (_err) {}
  }

  sendWelcomeEmail({
    to: user.email,
    name: user.name,
    planName: plan.name,
    planAmount: plan.amount,
    discountAmount,
    totalAmount,
    invoiceNumber,
    features: plan.features,
    interviewsTotal: plan.interviews_total,
  }).catch((_err) => {});

  const token = signToken(user);

  res.status(201).json({
    success: true,
    user: toSafeJSON(user),
    token,
    subscription: {
      id: subscription._id,
      plan_key: subscription.plan_key,
      plan_name: subscription.plan_name,
      access_level: subscription.access_level,
      interviews_total: subscription.interviews_total,
      status: subscription.status,
      amount_paid: subscription.amount_paid,
    },
    invoice: { number: invoiceNumber, amount: plan.amount, discount: discountAmount, gst: 0, total: totalAmount },
    referral_applied: referral_result?.applied || false,
  });
}));

// GET /api/subscription/institution/contracts — list contracts for institution or all (master_admin)
router.get('/institution/contracts', requireAuth, requireRole('admin', 'master_admin'), asyncHandler(async (req, res) => {
  const where = {};
  if (req.user.role === 'admin') {
    where.institution_id = req.user.institutionId;
  } else if (req.query.institution_id) {
    where.institution_id = req.query.institution_id;
  }
  const contracts = await InstitutionContract.findAll({
    where,
    order: [['created_at', 'DESC']],
  });
  res.json({ contracts });
}));

// POST /api/subscription/institution/contracts — provision or renew institution contract (master_admin)
router.post('/institution/contracts', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const {
    institution_id,
    plan_name,
    total_licensed_students,
    per_student_price,
    contract_amount,
    start_date,
    end_date,
    allowed_departments,
    allowed_batches,
    features,
    notes,
  } = req.body;

  if (!institution_id) throw new HttpError(400, 'institution_id is required');
  if (!total_licensed_students || total_licensed_students <= 0) {
    throw new HttpError(400, 'total_licensed_students must be greater than 0');
  }

  const contract = await InstitutionContract.create({
    institution_id,
    plan_name: plan_name || 'Institution Placement Readiness Cohort',
    total_licensed_students: parseInt(total_licensed_students),
    per_student_price: per_student_price ? parseInt(per_student_price) : 0,
    contract_amount: contract_amount ? parseInt(contract_amount) : (parseInt(total_licensed_students) * (per_student_price || 0)),
    start_date: start_date ? new Date(start_date) : new Date(),
    end_date: end_date ? new Date(end_date) : null,
    allowed_departments: allowed_departments || ['all'],
    allowed_batches: allowed_batches || [],
    features: features || {},
    notes: notes || '',
    created_by: req.user._id,
    status: 'active',
  });

  res.status(201).json({
    message: 'Institution contract created successfully.',
    contract,
  });
}));

export default router;
