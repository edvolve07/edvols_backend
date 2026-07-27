import { Router } from 'express';
import { requireAuth, requireRole } from '../aptitude/middleware/auth.js';
import { asyncHandler, HttpError } from '../utils/httpError.js';
import { ReferralCampaign, ReferralHistory, User, Op } from '../database/index.js';
import {
  getAdminReferralStats,
  exportReferralReport,
} from './service.js';

const router = Router();

router.get('/stats', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const stats = await getAdminReferralStats();
  res.json(stats);
}));

router.get('/campaigns', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const { search, status, page = 1, limit = 20 } = req.query;
  const where = {};

  if (status) where.status = status;
  if (search) {
    where[Op.or] = [
      { name: { [Op.iLike]: `%${search}%` } },
      { code: { [Op.iLike]: `%${search}%` } },
    ];
  }

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows: campaigns } = await ReferralCampaign.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
    raw: true,
  });

  res.json({
    campaigns,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil(count / parseInt(limit)),
  });
}));

router.get('/campaigns/:id', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const campaign = await ReferralCampaign.findOne({ where: { _id: req.params.id }, raw: true });
  if (!campaign) throw new HttpError(404, 'Campaign not found');

  const history = await ReferralHistory.findAll({
    where: { campaign_id: req.params.id },
    order: [['created_at', 'DESC']],
    raw: true,
  });

  const enrichedHistory = [];
  for (const h of history) {
    const referrer = await User.findOne({ where: { _id: h.referrer_user_id }, attributes: ['name', 'email'] });
    const referred = await User.findOne({ where: { _id: h.referred_user_id }, attributes: ['name', 'email'] });
    enrichedHistory.push({
      ...h,
      referrer_name: referrer?.name || '',
      referrer_email: referrer?.email || '',
      referred_name: referred?.name || '',
      referred_email: referred?.email || '',
    });
  }

  res.json({ campaign, history: enrichedHistory });
}));

router.post('/campaigns', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const {
    name, description, code, code_type, reward_type, reward_value,
    reward_for_referrer, reward_for_referred,
    start_date, expiry_date, maximum_usage, status,
  } = req.body || {};

  if (!name || !code) throw new HttpError(400, 'Name and code are required');

  const normalizedCode = code.trim().toUpperCase();
  const existing = await ReferralCampaign.findOne({ where: { code: normalizedCode } });
  if (existing) throw new HttpError(409, 'A campaign with this code already exists');

  const campaign = await ReferralCampaign.create({
    name,
    description: description || '',
    code: normalizedCode,
    code_type: code_type || 'campaign',
    owner_user_id: null,
    reward_type: reward_type || 'discount_percent',
    reward_value: reward_value || 0,
    reward_for_referrer: reward_for_referrer || {},
    reward_for_referred: reward_for_referred || {},
    plan_discounts: req.body.plan_discounts || null,
    start_date: start_date || new Date(),
    expiry_date: expiry_date || null,
    maximum_usage: maximum_usage || 0,
    used_count: 0,
    status: status || 'active',
    created_by: req.user._id,
  });

  res.status(201).json({ campaign });
}));

router.put('/campaigns/:id', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const campaign = await ReferralCampaign.findOne({ where: { _id: req.params.id } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');

  const {
    name, description, code, reward_type, reward_value,
    reward_for_referrer, reward_for_referred, plan_discounts,
    start_date, expiry_date, maximum_usage, status,
  } = req.body || {};

  if (code && code.toUpperCase() !== campaign.code) {
    const normalizedCode = code.trim().toUpperCase();
    const existing = await ReferralCampaign.findOne({ where: { code: normalizedCode } });
    if (existing) throw new HttpError(409, 'A campaign with this code already exists');
    campaign.code = normalizedCode;
  }

  if (name !== undefined) campaign.name = name;
  if (description !== undefined) campaign.description = description;
  if (reward_type !== undefined) campaign.reward_type = reward_type;
  if (reward_value !== undefined) campaign.reward_value = reward_value;
  if (reward_for_referrer !== undefined) campaign.reward_for_referrer = reward_for_referrer;
  if (reward_for_referred !== undefined) campaign.reward_for_referred = reward_for_referred;
  if (plan_discounts !== undefined) campaign.plan_discounts = plan_discounts;
  if (start_date !== undefined) campaign.start_date = start_date;
  if (expiry_date !== undefined) campaign.expiry_date = expiry_date;
  if (maximum_usage !== undefined) campaign.maximum_usage = maximum_usage;
  if (status !== undefined) campaign.status = status;

  await campaign.save();
  res.json({ campaign });
}));

router.delete('/campaigns/:id', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const campaign = await ReferralCampaign.findOne({ where: { _id: req.params.id } });
  if (!campaign) throw new HttpError(404, 'Campaign not found');

  if (campaign.code_type === 'user') {
    throw new HttpError(400, 'Cannot delete a user referral code');
  }

  const historyCount = await ReferralHistory.count({ where: { campaign_id: req.params.id } });
  if (historyCount > 0) {
    await campaign.update({ status: 'disabled' });
    return res.json({ message: 'Campaign disabled (has existing referrals)' });
  }

  await campaign.destroy();
  res.json({ message: 'Campaign deleted' });
}));

router.get('/export', requireAuth, requireRole('master_admin'), asyncHandler(async (req, res) => {
  const rows = await exportReferralReport();
  res.json({ rows });
}));

export default router;
