import {
  ReferralCampaign,
  ReferralHistory,
  ReferralPayout,
  ReferralSetting,
  User,
  Subscription,
  IndividualStudent,
  StudentJourney,
  Op
} from '../database/index.js';

const DEFAULT_PROGRAM_SETTINGS = {
  referrer_commission_percent: 5,
  referred_discount_percent: 5,
  min_referrals_for_withdrawal: 3,
  is_active: true,
};

export async function getReferralProgramSettings() {
  try {
    const settingRow = await ReferralSetting.findOne({ where: { key: 'program_settings' } });
    if (settingRow && settingRow.value) {
      return {
        ...DEFAULT_PROGRAM_SETTINGS,
        ...settingRow.value,
      };
    }
  } catch (_e) {}
  return { ...DEFAULT_PROGRAM_SETTINGS };
}

export async function updateReferralProgramSettings(newSettings, adminUserId = null) {
  const current = await getReferralProgramSettings();
  const updated = {
    ...current,
    referrer_commission_percent: Math.max(0, Math.min(100, Number(newSettings.referrer_commission_percent ?? current.referrer_commission_percent))),
    referred_discount_percent: Math.max(0, Math.min(100, Number(newSettings.referred_discount_percent ?? current.referred_discount_percent))),
    min_referrals_for_withdrawal: Math.max(1, parseInt(newSettings.min_referrals_for_withdrawal ?? current.min_referrals_for_withdrawal, 10) || 3),
    is_active: newSettings.is_active !== undefined ? Boolean(newSettings.is_active) : current.is_active,
    updated_at: new Date(),
    updated_by: adminUserId,
  };

  await ReferralSetting.upsert({
    key: 'program_settings',
    value: updated,
    description: 'Global referral cashback, discount, and withdrawal configuration',
  });

  return updated;
}

function generateUserCode(name) {
  const base = (name || 'USER').replace(/[^A-Z]/gi, '').toUpperCase().slice(0, 4) || 'REF';
  const suffix = String(Math.floor(1000 + Math.random() * 9000));
  return `${base}${suffix}`;
}

export async function ensureUserReferralCode(userId) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user) return null;

  // IMPORTANT: Only individual students participate in the referral program.
  // Institution students ('student' role) do NOT get referral codes or access.
  if (user.role !== 'individual_student') {
    return null;
  }

  const existing = await ReferralCampaign.findOne({
    where: { owner_user_id: userId, code_type: 'user' },
  });
  if (existing) return existing.code;

  const settings = await getReferralProgramSettings();

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
    reward_value: settings.referred_discount_percent,
    reward_for_referrer: { type: 'commission_percent', value: settings.referrer_commission_percent },
    reward_for_referred: { type: 'discount_percent', value: settings.referred_discount_percent },
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

  const settings = await getReferralProgramSettings();

  return {
    valid: true,
    campaign: {
      id: campaign._id,
      name: campaign.name,
      code: campaign.code,
      reward_type: campaign.reward_type,
      reward_value: settings.referred_discount_percent || campaign.reward_value,
      reward_for_referrer: { type: 'commission_percent', value: settings.referrer_commission_percent },
      reward_for_referred: { type: 'discount_percent', value: settings.referred_discount_percent },
      plan_discounts: campaign.plan_discounts || null,
    },
  };
}

export async function computeReferralDiscount(campaign, planAmount, planKey) {
  if (!campaign || !planAmount) return { discount: 0, finalAmount: planAmount || 0 };

  const settings = await getReferralProgramSettings();
  let discountPercent = settings.referred_discount_percent || 5;

  if (campaign.plan_discounts && typeof campaign.plan_discounts === 'object' && planKey && campaign.plan_discounts[planKey]) {
    const rewardConfig = campaign.plan_discounts[planKey];
    if (rewardConfig.type === 'discount_percent') discountPercent = rewardConfig.value;
  } else if (campaign.reward_for_referred && campaign.reward_for_referred.type === 'discount_percent') {
    discountPercent = campaign.reward_for_referred.value || discountPercent;
  }

  const discount = Math.round(planAmount * (discountPercent / 100));
  return {
    discount,
    discount_percent: discountPercent,
    finalAmount: Math.max(0, planAmount - discount),
  };
}

export async function applyReferralReward(campaignId, referrerUserId, referredUserId, subscriptionId, explicitPaidAmount = null) {
  const campaign = await ReferralCampaign.findOne({ where: { _id: campaignId } });
  if (!campaign) throw new Error('Campaign not found');

  const existing = await ReferralHistory.findOne({
    where: { campaign_id: campaignId, referred_user_id: referredUserId },
  });
  if (existing) return { alreadyApplied: true };

  const referredUser = await User.findOne({ where: { _id: referredUserId } });
  if (!referredUser) throw new Error('Referred user not found');

  // Verify referrer is an individual student
  let referrerUser = null;
  if (referrerUserId) {
    referrerUser = await User.findOne({ where: { _id: referrerUserId } });
  }

  // Determine actual paid amount
  let paidAmount = explicitPaidAmount;
  let planAmount = explicitPaidAmount;
  let planKey = '';
  if (subscriptionId) {
    const sub = await Subscription.findOne({ where: { _id: subscriptionId } });
    if (sub) {
      planAmount = sub.amount || planAmount;
      paidAmount = sub.amount_paid != null ? sub.amount_paid : (paidAmount || sub.amount);
      planKey = sub.plan_key || '';
    }
  }

  const settings = await getReferralProgramSettings();
  const commissionPercent = settings.referrer_commission_percent || 5;
  const commissionAmount = paidAmount > 0
    ? Math.round((paidAmount * (commissionPercent / 100)) * 100) / 100
    : 0;

  let referrerReward = null;
  if (referrerUser && referrerUser.role === 'individual_student') {
    referrerReward = {
      type: 'commission_cash',
      percent: commissionPercent,
      value: commissionAmount,
      description: `₹${commissionAmount.toFixed(2)} cashback (${commissionPercent}% of ₹${paidAmount})`,
    };
  }

  const referredReward = {
    type: 'discount_percent',
    value: settings.referred_discount_percent,
    description: `${settings.referred_discount_percent}% discount applied at checkout`,
  };

  await ReferralHistory.create({
    campaign_id: campaignId,
    referrer_user_id: referrerUserId || referredUserId,
    referred_user_id: referredUserId,
    subscription_id: subscriptionId,
    reward_status: 'completed',
    reward_given_date: new Date(),
    reward_details: {
      plan_key: planKey,
      plan_amount: planAmount,
      paid_amount: paidAmount,
      commission_percent: commissionPercent,
      commission_amount: commissionAmount,
      referrer_reward: referrerReward,
      referred_reward: referredReward,
    },
  });

  await campaign.update({ used_count: campaign.used_count + 1 });

  return { applied: true, referrer_reward: referrerReward, referred_reward: referredReward, commission: commissionAmount };
}

export async function getUserReferralWallet(userId) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user || user.role !== 'individual_student') {
    return {
      can_access: false,
      total_earned: 0,
      available_balance: 0,
      total_withdrawn: 0,
      pending_payout: 0,
      paid_referrals_count: 0,
      min_referrals_required: 3,
      can_withdraw: false,
      referrals_needed: 3,
      payout_history: [],
    };
  }

  const settings = await getReferralProgramSettings();
  const minRequired = settings.min_referrals_for_withdrawal || 3;

  // Find all referrals made by this user
  const history = await ReferralHistory.findAll({
    where: { referrer_user_id: userId, reward_status: 'completed' },
    order: [['created_at', 'DESC']],
  });

  let totalEarned = 0;
  let paidReferralsCount = 0;

  for (const h of history) {
    const comm = Number(h.reward_details?.commission_amount || 0);
    if (comm > 0 || h.subscription_id) {
      paidReferralsCount++;
      totalEarned += comm;
    }
  }

  totalEarned = Math.round(totalEarned * 100) / 100;

  // Find all payout requests by this user
  let payouts = [];
  try {
    payouts = await ReferralPayout.findAll({
      where: { user_id: userId },
      order: [['created_at', 'DESC']],
    });
  } catch (_e) {}

  const completedPayouts = payouts.filter(p => p.status === 'completed');
  const pendingPayouts = payouts.filter(p => p.status === 'pending');

  const totalWithdrawn = Math.round(completedPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100) / 100;
  const pendingAmount = Math.round(pendingPayouts.reduce((sum, p) => sum + Number(p.amount || 0), 0) * 100) / 100;

  const availableBalance = Math.max(0, Math.round((totalEarned - totalWithdrawn - pendingAmount) * 100) / 100);

  const canWithdraw = paidReferralsCount >= minRequired && availableBalance > 0 && pendingPayouts.length === 0;
  const referralsNeeded = Math.max(0, minRequired - paidReferralsCount);

  return {
    can_access: true,
    total_earned: totalEarned,
    available_balance: availableBalance,
    total_withdrawn: totalWithdrawn,
    pending_payout: pendingAmount,
    paid_referrals_count: paidReferralsCount,
    min_referrals_required: minRequired,
    can_withdraw: canWithdraw,
    referrals_needed: referralsNeeded,
    has_pending_payout: pendingPayouts.length > 0,
    commission_percent: settings.referrer_commission_percent,
    discount_percent: settings.referred_discount_percent,
    payout_history: payouts.map(p => ({
      id: p._id,
      amount: p.amount,
      upi_id: p.upi_id,
      status: p.status,
      utr_number: p.utr_number,
      created_at: p.created_at,
      processed_at: p.processed_at,
    })),
  };
}

export async function requestReferralPayout(userId, { upi_id, amount }) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user || user.role !== 'individual_student') {
    throw new Error('Only individual students are eligible for referral payouts.');
  }

  const wallet = await getUserReferralWallet(userId);

  if (wallet.paid_referrals_count < wallet.min_referrals_required) {
    throw new Error(
      `You need at least ${wallet.min_referrals_required} successful paid referrals to unlock UPI withdrawals. You currently have ${wallet.paid_referrals_count}.`
    );
  }

  if (wallet.has_pending_payout) {
    throw new Error('You already have a pending withdrawal request under review. Please wait until it is processed.');
  }

  const reqAmount = amount ? Math.round(Number(amount) * 100) / 100 : wallet.available_balance;
  if (isNaN(reqAmount) || reqAmount <= 0) {
    throw new Error('Invalid withdrawal amount.');
  }

  if (reqAmount > wallet.available_balance) {
    throw new Error(`Requested amount ₹${reqAmount} exceeds available balance ₹${wallet.available_balance}.`);
  }

  const cleanUpi = String(upi_id || '').trim();
  if (!cleanUpi || !cleanUpi.includes('@') || cleanUpi.length < 5) {
    throw new Error('Please provide a valid UPI ID (e.g. mobile@upi or username@bank).');
  }

  const payout = await ReferralPayout.create({
    user_id: userId,
    amount: reqAmount,
    upi_id: cleanUpi,
    status: 'pending',
  });

  return {
    success: true,
    payout: {
      id: payout._id,
      amount: payout.amount,
      upi_id: payout.upi_id,
      status: payout.status,
      created_at: payout.created_at,
    },
    message: `Withdrawal request for ₹${reqAmount} submitted successfully! Admin will transfer to ${cleanUpi}.`,
  };
}

export async function getUserReferralStats(userId) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user || user.role !== 'individual_student') {
    return {
      code: null,
      total_referrals: 0,
      successful_referrals: 0,
      pending_referrals: 0,
      rewards_earned: [],
      wallet: null,
    };
  }

  const campaign = await ReferralCampaign.findOne({
    where: { owner_user_id: userId, code_type: 'user' },
  });

  const wallet = await getUserReferralWallet(userId);

  if (!campaign) {
    return {
      code: null,
      total_referrals: 0,
      successful_referrals: 0,
      pending_referrals: 0,
      rewards_earned: [],
      wallet,
    };
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
    wallet,
  };
}

export async function getUserReferralHistory(userId) {
  const user = await User.findOne({ where: { _id: userId } });
  if (!user || user.role !== 'individual_student') {
    return [];
  }

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

export async function getAdminPayoutRequests({ status, page = 1, limit = 20 }) {
  const where = {};
  if (status) where.status = status;

  const offset = (parseInt(page) - 1) * parseInt(limit);
  const { count, rows } = await ReferralPayout.findAndCountAll({
    where,
    order: [['created_at', 'DESC']],
    limit: parseInt(limit),
    offset,
  });

  const results = [];
  for (const p of rows) {
    const user = await User.findOne({
      where: { _id: p.user_id },
      attributes: ['_id', 'name', 'email', 'phone', 'role'],
    });

    results.push({
      id: p._id,
      user_id: p.user_id,
      user_name: user?.name || 'Student',
      user_email: user?.email || '',
      user_phone: user?.phone || '',
      amount: p.amount,
      upi_id: p.upi_id,
      status: p.status,
      admin_notes: p.admin_notes,
      utr_number: p.utr_number,
      created_at: p.created_at,
      processed_at: p.processed_at,
    });
  }

  return {
    requests: results,
    total: count,
    page: parseInt(page),
    limit: parseInt(limit),
    total_pages: Math.ceil(count / parseInt(limit)),
  };
}

export async function processAdminPayoutRequest(payoutId, adminUserId, { status, utr_number, admin_notes }) {
  const payout = await ReferralPayout.findOne({ where: { _id: payoutId } });
  if (!payout) throw new Error('Payout request not found');

  if (payout.status !== 'pending') {
    throw new Error(`This payout request is already marked as ${payout.status}.`);
  }

  if (status !== 'completed' && status !== 'rejected') {
    throw new Error('Status must be either completed or rejected');
  }

  await payout.update({
    status,
    utr_number: utr_number || null,
    admin_notes: admin_notes || '',
    processed_at: new Date(),
    processed_by: adminUserId,
  });

  return {
    success: true,
    payout: {
      id: payout._id,
      status: payout.status,
      utr_number: payout.utr_number,
      processed_at: payout.processed_at,
    },
  };
}

export async function getAdminReferralStats() {
  const campaigns = await ReferralCampaign.findAll();
  const history = await ReferralHistory.findAll();
  const payouts = await ReferralPayout.findAll();
  const settings = await getReferralProgramSettings();

  const totalCampaigns = campaigns.length;
  const totalCodes = campaigns.length;
  const activeCodes = campaigns.filter(c => c.status === 'active').length;
  const expiredCodes = campaigns.filter(c => c.expiry_date && new Date(c.expiry_date) < new Date()).length;
  const pendingRewards = history.filter(h => h.reward_status === 'pending').length;
  const successfulReferrals = history.filter(h => h.reward_status === 'completed').length;
  const totalUsedCount = campaigns.reduce((sum, c) => sum + c.used_count, 0);

  const totalCommissionsEarned = history.reduce((sum, h) => sum + Number(h.reward_details?.commission_amount || 0), 0);
  const totalPayoutsDistributed = payouts.filter(p => p.status === 'completed').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingPayoutsTotal = payouts.filter(p => p.status === 'pending').reduce((sum, p) => sum + Number(p.amount || 0), 0);
  const pendingPayoutsCount = payouts.filter(p => p.status === 'pending').length;

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
    settings,
    total_commissions_earned: Math.round(totalCommissionsEarned * 100) / 100,
    total_payouts_distributed: Math.round(totalPayoutsDistributed * 100) / 100,
    pending_payouts_total: Math.round(pendingPayoutsTotal * 100) / 100,
    pending_payouts_count: pendingPayoutsCount,
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
      plan: h.reward_details?.plan_key || '',
      paid_amount: h.reward_details?.paid_amount || 0,
      commission_amount: h.reward_details?.commission_amount || 0,
      reward_status: h.reward_status,
      reward_given_date: h.reward_given_date,
      created_at: h.created_at,
    });
  }

  return rows;
}
