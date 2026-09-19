import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

export const InstitutionContract = sequelize.define('InstitutionContract', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  institution_id: {
    type: DataTypes.UUID,
    allowNull: false,
  },
  plan_name: {
    type: DataTypes.STRING(255),
    allowNull: false,
    defaultValue: 'Institution Placement Readiness Cohort',
  },
  total_licensed_students: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 100,
  },
  enrolled_students_count: {
    type: DataTypes.INTEGER,
    defaultValue: 0,
  },
  per_student_price: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  contract_amount: {
    type: DataTypes.INTEGER,
    allowNull: false,
    defaultValue: 0,
  },
  currency: {
    type: DataTypes.STRING(10),
    defaultValue: 'INR',
  },
  start_date: {
    type: DataTypes.DATE,
    allowNull: false,
    defaultValue: DataTypes.NOW,
  },
  end_date: {
    type: DataTypes.DATE,
    allowNull: true,
  },
  allowed_departments: {
    type: DataTypes.JSONB,
    defaultValue: ['all'],
  },
  allowed_batches: {
    type: DataTypes.JSONB,
    defaultValue: [],
  },
  features: {
    type: DataTypes.JSONB,
    defaultValue: {
      custom_assessments: true,
      placement_analytics: true,
      batch_analytics: true,
      student_risk_tracking: true,
      department_comparison: true,
      institution_branding: true,
      export_reports: true,
      hod_dashboard: true,
    },
  },
  status: {
    type: DataTypes.STRING(30),
    defaultValue: 'active', // 'active' | 'expired' | 'pending_renewal'
  },
  notes: {
    type: DataTypes.TEXT,
    defaultValue: '',
  },
  created_by: {
    type: DataTypes.UUID,
    allowNull: true,
  },
}, {
  tableName: 'institution_contracts',
  timestamps: true,
  indexes: [
    { fields: ['institution_id'] },
    { fields: ['status'] },
  ],
});
