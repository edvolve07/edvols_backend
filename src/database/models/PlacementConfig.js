import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

/**
 * PlacementConfig — Stores configurable scoring parameters.
 *
 * Allows admins to update weights, readiness bands, talent criteria,
 * and segmentation thresholds without code changes.
 *
 * Each row is a config version. The `active` flag marks which version
 * is currently in use.
 */
export const PlacementConfig = sequelize.define('PlacementConfig', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  config_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    defaultValue: 'default',
  },
  version: {
    type: DataTypes.STRING(20),
    allowNull: false,
  },
  competency_weights: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  readiness_bands: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  talent_criteria: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  segmentation_thresholds: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  confidence_thresholds: {
    type: DataTypes.JSONB,
    allowNull: false,
    defaultValue: {},
  },
  active: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
  created_by: {
    type: DataTypes.STRING(64),
  },
  notes: {
    type: DataTypes.TEXT,
  },
}, {
  tableName: 'placement_configs',
  indexes: [
    { fields: ['config_name', 'version'], unique: true },
    { fields: ['active'] },
  ],
});
