import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

/**
 * ScoringVersion — Tracks scoring engine versions and their configurations.
 *
 * Each version stores the exact formula parameters used at that point in time.
 * Old student reports remain reproducible because they reference the version
 * that was active when they were calculated.
 */
export const ScoringVersion = sequelize.define('ScoringVersion', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    unique: true,
  },
  name: {
    type: DataTypes.STRING(200),
  },
  competency_weights: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  readiness_bands: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  talent_criteria: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  segmentation_thresholds: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  confidence_thresholds: {
    type: DataTypes.JSONB,
    allowNull: false,
  },
  rubric_config: {
    type: DataTypes.JSONB,
    defaultValue: {},
  },
  activated_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  deactivated_at: {
    type: DataTypes.DATE,
  },
  activated_by: {
    type: DataTypes.STRING(64),
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'scoring_versions',
  indexes: [
    { fields: ['version'], unique: true },
  ],
});
