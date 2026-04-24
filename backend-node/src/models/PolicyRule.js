const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const PolicyRule = sequelize.define('PolicyRule', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primary_key: true,
    allowNull: false,
  },
  rule_name: {
    type: DataTypes.STRING(100),
    allowNull: false,
    unique: true,
  },
  description: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  min_risk_score: {
    type: DataTypes.FLOAT,
    defaultValue: 80.0,
  },
  block_blacklisted: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  block_suspended: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  notify_on_block: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  priority: {
    type: DataTypes.INTEGER,
    defaultValue: 10,
  },
  is_active: {
    type: DataTypes.BOOLEAN,
    defaultValue: true,
  },
  created_by: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
}, {
  tableName: 'policy_rules',
  timestamps: true,
  underscored: true,
});

module.exports = PolicyRule;
