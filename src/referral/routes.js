import { Router } from 'express';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import {
  ensureUserReferralCode,
  validateReferralCode,
  computeReferralDiscount,
  getUserReferralStats,
  getUserReferralHistory,
} from './service.js';

const router = Router();

router.get('/my', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const code = await ensureUserReferralCode(req.user._id);
  const stats = await getUserReferralStats(req.user._id);

  const referralLink = `https://edvols.in/signup?ref=${code}`;

  res.json({
    code,
    referral_link: referralLink,
    total_referrals: stats.total_referrals,
    successful_referrals: stats.successful_referrals,
    pending_referrals: stats.pending_referrals,
    rewards_earned: stats.rewards_earned,
  });
}));

router.get('/history', requireAuth, requireRole('individual_student'), asyncHandler(async (req, res) => {
  const history = await getUserReferralHistory(req.user._id);
  res.json({ history });
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
    const discountInfo = computeReferralDiscount(result.campaign, parseInt(plan_amount), plan_key);
    result.discount = discountInfo;
  }

  res.json(result);
}));

export default router;
