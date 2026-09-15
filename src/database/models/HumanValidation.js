import { DataTypes } from 'sequelize';
import { getSequelize } from '../connection.js';

const sequelize = getSequelize();

/**
 * HumanValidation — Stores human evaluator scores alongside AI scores
 * for accuracy measurement (Section 23).
 *
 * Enables computing:
 *   - Mean Absolute Error (MAE)
 *   - Correlation coefficient
 *   - Agreement within ±5 points
 *   - Agreement within ±10 points
 *
 * Each record represents one human evaluation of one competency
 * for one student.
 */
export const HumanValidation = sequelize.define('HumanValidation', {
  _id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primaryKey: true,
  },
  student_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  session_id: {
    type: DataTypes.STRING(64),
  },
  competency: {
    type: DataTypes.STRING(50),
    allowNull: false,
  },
  ai_score: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  human_score: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  difference: {
    type: DataTypes.FLOAT,
    allowNull: false,
  },
  evaluator_id: {
    type: DataTypes.STRING(64),
    allowNull: false,
  },
  evaluator_name: {
    type: DataTypes.STRING(255),
  },
  rubric_version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '1.0',
  },
  scoring_engine_version: {
    type: DataTypes.STRING(20),
    allowNull: false,
    defaultValue: '1.0',
  },
  evaluation_date: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  notes: {
    type: DataTypes.TEXT,
  },
  institution_id: {
    type: DataTypes.STRING(64),
  },
}, {
  tableName: 'human_validations',
  indexes: [
    { fields: ['student_id'] },
    { fields: ['competency'] },
    { fields: ['evaluator_id'] },
    { fields: ['student_id', 'competency'] },
    { fields: ['evaluation_date'] },
  ],
});
