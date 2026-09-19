import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

export const ReferralSetting = sequelize.define('ReferralSetting', {
  key: {
    type: DataTypes.STRING(100),
    primaryKey: true,
  },
  value: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  description: {
    type: DataTypes.STRING(255),
    defaultValue: '',
  },
}, {
  tableName: 'referral_settings',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
});
