import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

export const ReferralHistory = sequelize.define('ReferralHistory', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  campaign_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  referrer_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  referred_user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  subscription_id: {
    type: DataTypes.UUID,
    defaultValue: null,
  },
  reward_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'pending',
  },
  reward_given_date: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  reward_details: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
}, {
  tableName: 'referral_history',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['campaign_id'] },
    { fields: ['referrer_user_id'] },
    { fields: ['referred_user_id'] },
    { fields: ['subscription_id'] },
    { fields: ['reward_status'] },
  ],
});
