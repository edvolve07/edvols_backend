import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

export const ReferralPayout = sequelize.define('ReferralPayout', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  user_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  amount: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  upi_id: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  status: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: 'pending', // 'pending', 'completed', 'rejected'
  },
  admin_notes: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  utr_number: {
    type: DataTypes.STRING(100),
    defaultValue: null,
  },
  processed_at: {
    type: DataTypes.DATE,
    defaultValue: null,
  },
  processed_by: {
    type: DataTypes.UUID,
    defaultValue: null,
  },
}, {
  tableName: 'referral_payouts',
  timestamps: true,
  createdAt: 'created_at',
  updatedAt: 'updated_at',
  indexes: [
    { fields: ['user_id'] },
    { fields: ['status'] },
    { fields: ['created_at'] },
  ],
});
