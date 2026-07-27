import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

export const ReferralCampaign = sequelize.define('ReferralCampaign', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  name: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  description: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  code: {
    type: DataTypes.STRING(50),
    allowNull: false,
    unique: true,
  },
  code_type: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'campaign',
  },
  owner_user_id: {
    type: DataTypes.UUID,
    defaultValue: null,
  },
  reward_type: {
    type: DataTypes.STRING(50),
    allowNull: false,
    defaultValue: 'discount_percent',
  },
  reward_value: {
    type: DataTypes.FLOAT,
    defaultValue: 0,
  },
  reward_for_referrer: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  reward_for_referred: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  plan_discounts: {
    type: DataTypes.JSONB,
    defaultValue: null,
  },
  start_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  expiry_date: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  maximum_usage: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  used_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
  },
  created_by: {
    type: DataTypes.STRING(64),
    defaultValue: '',
  },
}, {
  tableName: 'referral_campaigns',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['code'], unique: true },
    { fields: ['owner_user_id'] },
    { fields: ['status'] },
  ],
});
