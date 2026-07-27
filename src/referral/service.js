import { ReferralCampaign, ReferralHistory, User, Subscription, IndividualStudent, StudentJourney, Op } from '../database/index.js';

const REWARD_TYPES = [
  'discount_percent',
  'flat_discount',
  'free_interviews',
  'validity_extension',
  'level_unlock',
  'premium_feature',
  'subscription_upgrade',
];

function generateUserCode(name) {
  const base = (name || 'USER').replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 4) || 'REF';
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}${suffix}`;
}

export async function ensureUserReferralCode(userId) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user) return null;

  const existing = await ReferralCampaign.findOne({
    where: { owner_user_id: userId, code_type: 'user' },
  });
  if (existing) return existing.code;

  let code;
  let attempts = 0;
  do {
    code = generateUserCode(user.name);
    attempts++;
  } while (
    attempts < 20 &&
    (await ReferralCampaign.findOne({ where: { code } }))
  );

  await ReferralCampaign.create({
    name: `${user.name || 'User'}'s Referral`,
    description: `Personal referral code for ${user.email}`,
    code,
    code_type: 'user',
    owner_user_id: userId,
    reward_type: 'discount_percent',
    reward_value: 10,
    reward_for_referrer: { type: 'free_interviews', value: 1 },
    reward_for_referred: { type: 'discount_percent', value: 10 },
    start_date: new Date(),
    expiry_date: null,
    maximum_usage: 0,
    used_count: 0,
    status: 'active',
    created_by: 'system',
  });

  return code;
}

export async function validateReferralCode(code, currentUserId) {
  if (!code || typeof code !== 'string') {
    return { valid: false, error: 'Referral code is required' };
  }

  const campaign = await ReferralCampaign.findOne({
    where: { code: code.trim().toUpperCase() },
  });

  if (!campaign) {
    return { valid: false, error: 'Invalid referral code' };
  }

  if (campaign.status !== 'active') {
    return { valid: false, error: 'This referral code is no longer active' };
  }

  if (campaign.expiry_date && new Date(campaign.expiry_date) < new Date()) {
    return { valid: false, error: 'This referral code has expired' };
  }

  if (campaign.maximum_usage > 0 && campaign.used_count >= campaign.maximum_usage) {
    return { valid: false, error: 'This referral code has reached its usage limit' };
  }

  if (currentUserId && campaign.owner_user_id === currentUserId) {
    return { valid: false, error: 'You cannot use your own referral code' };
  }

  return {
    valid: true,
    campaign: {
      id: campaign._id,
      name: campaign.name,
      code: campaign.code,
      reward_type: campaign.reward_type,
      reward_value: campaign.reward_value,
      reward_for_referrer: campaign.reward_for_referrer,
      reward_for_referred: campaign.reward_for_referred,
      plan_discounts: campaign.plan_discounts || null,
    },
  };
}

export function computeReferralDiscount(campaign, planAmount, planKey) {
  if (!campaign || !planAmount) return { discount: 0, finalAmount: planAmount || 0 };

  let rewardConfig = null;

  if (campaign.plan_discounts && typeof campaign.plan_discounts === 'object' && planKey && campaign.plan_discounts[planKey]) {
    rewardConfig = campaign.plan_discounts[planKey];
  } else {
    rewardConfig = campaign.reward_for_referred || {};
  }

  if (rewardConfig.type === 'discount_percent' && rewardConfig.value > 0) {
    const discount = Math.round(planAmount * (rewardConfig.value / 100));
    return { discount, discount_percent: rewardConfig.value, finalAmount: planAmount - discount };
  }
  if (rewardConfig.type === 'flat_discount' && rewardConfig.value > 0) {
    const discount = Math.min(rewardConfig.value, planAmount);
    return { discount, discount_flat: rewardConfig.value, finalAmount: planAmount - discount };
  }
  return { discount: 0, finalAmount: planAmount };
}

export async function applyReferralReward(campaignId, referrerUserId, referredUserId, subscriptionId) {
  const campaign = await ReferralCampaign.findOne({ where: { _id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  const existing = await ReferralHistory.findOne({
    where: { campaign_id: campaignId, referred_user_id: referredUserId },
  });
  if (existing) return { alreadyApplied: true };

  const referredUser = await User.findOne({ where: { _id: referredUserId } });
  if (!referredUser) throw new Error('Referred user not found');

  const referredProfile = await IndividualStudent.findOne({ where: { user_id: referredUserId } });

  let referrerReward = null;
  let referredReward = null;

  const referredRewardConfig = campaign.reward_for_referred || {};
  if (referredRewardConfig.type && referredProfile) {
    referredReward = await executeReward(referredRewardConfig, referredUser, referredProfile, subscriptionId);
  }

  const referrerRewardConfig = campaign.reward_for_referrer || {};
  if (referrerRewardConfig.type && referrerUserId) {
    const referrerProfile = await IndividualStudent.findOne({ where: { user_id: referrerUserId } });
    if (referrerProfile) {
      referrerReward = await executeReward(referrerRewardConfig, referredUser, referrerProfile, subscriptionId);
    }
  }

  await ReferralHistory.create({
    campaign_id: campaignId,
    referrer_user_id: referrerUserId || referredUserId,
    referred_user_id: referredUserId,
    subscription_id: subscriptionId,
    reward_status: 'completed',
    reward_given_date: new Date(),
    reward_details: {
      referrer_reward: referrerReward,
      referred_reward: referredReward,
    },
  });

  await campaign.update({ used_count: campaign.used_count + 1 });

  return { applied: true, referrer_reward: referrerReward, referred_reward: referredReward };
}

async function executeReward(rewardConfig, targetUser, targetProfile, subscriptionId) {
  const { type, value } = rewardConfig;
  if (!type) return null;

  switch (type) {
    case 'free_interviews': {
      const sub = await Subscription.findOne({
        where: { student_id: targetUser._id, status: 'active' },
        order: [['created_at', 'DESC']],
      });
      if (sub) {
        await sub.update({ interviews_total: sub.interviews_total + (value || 1) });
      }
      return { type, value: value || 1, description: `+${value || 1} interview credits` };
    }

    case 'validity_extension': {
      const sub = await Subscription.findOne({
        where: { student_id: targetUser._id, status: 'active' },
        order: [['created_at', 'DESC']],
      });
      if (sub && sub.end_date) {
        const newEnd = new Date(sub.end_date);
        newEnd.setDate(newEnd.getDate() + (value || 15));
        await sub.update({ end_date: newEnd });
      } else if (sub) {
        const newEnd = new Date();
        newEnd.setDate(newEnd.getDate() + (value || 15));
        await sub.update({ end_date: newEnd });
      }
      return { type, value: value || 15, description: `+${value || 15} days validity` };
    }

    case 'level_unlock': {
      const journey = await StudentJourney.findOne({ where: { student_id: targetUser._id } });
      if (journey) {
        const newLevel = Math.min((journey.journey_access_level || 1) + 1, 6);
        await journey.update({ journey_access_level: newLevel });
      }
      return { type, value: 1, description: 'Next level unlocked' };
    }

    case 'subscription_upgrade': {
      const sub = await Subscription.findOne({
        where: { student_id: targetUser._id, status: 'active' },
        order: [['created_at', 'DESC']],
      });
      if (sub) {
        const newLevel = Math.min((sub.access_level || 1) + 1, 6);
        await sub.update({ access_level: newLevel });
        const journey = await StudentJourney.findOne({ where: { student_id: targetUser._id } });
        if (journey) {
          await journey.update({ journey_access_level: newLevel });
        }
      }
      return { type, value: 1, description: 'Subscription upgraded' };
    }

    case 'discount_percent':
    case 'flat_discount':
    case 'premium_feature':
    default:
      return { type, value: value || 0, description: `Reward: ${type}` };
  }
}

export async function getUserReferralStats(userId) {
  const campaign = await ReferralCampaign.findOne({
    where: { owner_user_id: userId, code_type: 'user' },
  });

  if (!campaign) {
    return { code: null, total_referrals: 0, successful_referrals: 0, pending_referrals: 0, rewards_earned: [] };
  }

  const history = await ReferralHistory.findAll({
    where: { referrer_user_id: userId },
    order: [['created_at', 'DESC']],
  });

  const successful = history.filter(h => h.reward_status === 'completed');
  const pending = history.filter(h => h.reward_status === 'pending');

  return {
    code: campaign.code,
    campaign_id: campaign._id,
    total_referrals: history.length,
    successful_referrals: successful.length,
    pending_referrals: pending.length,
    rewards_earned: successful.map(h => h.reward_details?.referrer_reward).filter(Boolean),
  };
}

export async function getUserReferralHistory(userId) {
  const history = await ReferralHistory.findAll({
    where: {
      [Op.or]: [
        { referrer_user_id: userId },
        { referred_user_id: userId },
      ],
    },
    order: [['created_at', 'DESC']],
  });

  const results = [];
  for (const h of history) {
    const referrer = await User.findOne({ where: { _id: h.referrer_user_id }, attributes: ['_id', 'name', 'email'] });
    const referred = await User.findOne({ where: { _id: h.referred_user_id }, attributes: ['_id', 'name', 'email'] });
    const campaign = await ReferralCampaign.findOne({ where: { _id: h.campaign_id }, attributes: ['_id', 'name', 'code'] });

    results.push({
      id: h._id,
      campaign_name: campaign?.name || '',
      campaign_code: campaign?.code || '',
      referrer_name: referrer?.name || '',
      referrer_email: referrer?.email || '',
      referred_name: referred?.name || '',
      referred_email: referred?.email || '',
      reward_status: h.reward_status,
      reward_details: h.reward_details,
      reward_given_date: h.reward_given_date,
      created_at: h.created_at,
      is_referrer: h.referrer_user_id === userId,
    });
  }

  return results;
}

export async function getAdminReferralStats() {
  const campaigns = await ReferralCampaign.findAll();
  const history = await ReferralHistory.findAll();

  const totalCampaigns = campaigns.length;
  const totalCodes = campaigns.length;
  const activeCodes = campaigns.filter(c => c.status === 'active').length;
  const expiredCodes = campaigns.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length;
  const pendingRewards = history.filter(h => h.reward_status === 'pending').length;
  const successfulReferrals = history.filter(h => h.reward_status === 'completed').length;
  const totalUsedCount = campaigns.reduce((sum, c) => sum + c.used_count, 0);

  const topCampaign = campaigns.reduce((top, c) => (c.used_count > (top?.used_count || 0) ? c : top), null);

  const referrerCounts = {};
  for (const h of history) {
    if (h.reward_status === 'completed') {
      referrerCounts[h.referrer_user_id] = (referrerCounts[h.referrer_user_id] || 0) + 1;
    }
  }
  const topReferrerIds = Object.entries(referrerCounts)
    .sort(([, a], [, b]) => b - a)
    .slice(0, 5)
    .map(([id]) => id);

  const topReferrers = [];
  for (const uid of topReferrerIds) {
    const u = await User.findOne({ where: { _id: uid }, attributes: ['_id', 'name', 'email'] });
    topReferrers.push({ ...u?.toJSON(), referral_count: referrerCounts[uid] });
  }

  const conversionRate = totalUsedCount > 0 ? ((successfulReferrals / totalUsedCount) * 100).toFixed(1) : '0.0';

  return {
    total_campaigns: totalCampaigns,
    total_codes: totalCodes,
    active_codes: activeCodes,
    expired_codes: expiredCodes,
    pending_rewards: pendingRewards,
    successful_referrals: successfulReferrals,
    total_used_count: totalUsedCount,
    top_campaign: topCampaign ? { name: topCampaign.name, code: topCampaign.code, used_count: topCampaign.used_count } : null,
    top_referrers: topReferrers,
    conversion_rate: conversionRate,
  };
}

export async function exportReferralReport() {
  const history = await ReferralHistory.findAll({
    order: [['created_at', 'DESC']],
  });

  const rows = [];
  for (const h of history) {
    const referrer = await User.findOne({ where: { _id: h.referrer_user_id }, attributes: ['name', 'email'] });
    const referred = await User.findOne({ where: { _id: h.referred_user_id }, attributes: ['name', 'email'] });
    const campaign = await ReferralCampaign.findOne({ where: { _id: h.campaign_id }, attributes: ['name', 'code'] });

    rows.push({
      campaign: campaign?.name || '',
      code: campaign?.code || '',
      referrer_name: referrer?.name || '',
      referrer_email: referrer?.email || '',
      referred_name: referred?.name || '',
      referred_email: referred?.email || '',
      reward_status: h.reward_status,
      reward_given_date: h.reward_given_date,
      created_at: h.created_at,
    });
  }

  return rows;
}
