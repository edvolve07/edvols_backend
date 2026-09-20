import { Router } from 'express';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import {
  ensureUserReferralCode,
  validateReferralCode,
  computeReferralDiscount,
  getUserReferralStats,
  getUserReferralHistory,
  getUserReferralWallet,
  requestReferralPayout,
  getReferralProgramSettings,
} from './service.js';

const router = Router();

// Restricted EXCLUSIVELY to individual students (institution students cannot access)
router.get('/my', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const code = await ensureUserReferralCode(req.user._id);
  const stats = await getUserReferralStats(req.user._id);
  const wallet = stats.wallet || await getUserReferralWallet(req.user._id);

  const referralLink = `https://app.edvols.in/signup?ref=${code}`;

  res.json({
    code,
    referral_link: referralLink,
    total_referrals: stats.total_referrals,
    successful_referrals: stats.successful_referrals,
    pending_referrals: stats.pending_referrals,
    rewards_earned: stats.rewards_earned,
    wallet,
  });
}));

router.get('/wallet', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const wallet = await getUserReferralWallet(req.user._id);
  res.json(wallet);
}));

router.post('/payout-request', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const { upi_id, amount } = req.body || {};
  if (!upi_id) throw new HttpError(400, 'UPI ID is required');

  try {
    const result = await requestReferralPayout(req.user._id, { upi_id, amount });
    res.json(result);
  } catch (err) {
    throw new HttpError(400, err.message);
  }
}));

router.get('/history', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const history = await getUserReferralHistory(req.user._id);
  res.json({ history });
}));

router.get('/program-info', asyncHandler(async (_req, res) => {
  const settings = await getReferralProgramSettings();
  res.json({
    referrer_commission_percent: settings.referrer_commission_percent,
    referred_discount_percent: settings.referred_discount_percent,
    min_referrals_for_withdrawal: settings.min_referrals_for_withdrawal,
    is_active: settings.is_active,
  });
}));

router.post('/validate', requireAuth, asyncHandler(async (req, res) => {
  const { code } = req.body || {};
  if (!code) throw new HttpError(400, 'Referral code is required');

  const result = await validateReferralCode(code, req.user?._id);
  if (!result.valid) throw new HttpError(400, result.error);

  res.json(result);
}));

router.get('/validate-public', asyncHandler(async (req, res) => {
  const { code, plan_amount, plan_key } = req.query || {};
  if (!code) throw new HttpError(400, 'Referral code is required');

  const result = await validateReferralCode(code, null);
  if (!result.valid) throw new HttpError(400, result.error);

  if (plan_amount) {
    const discountInfo = await computeReferralDiscount(result.campaign, parseInt(plan_amount), plan_key);
    result.discount = discountInfo;
  }

  res.json(result);
}));

export default router;
