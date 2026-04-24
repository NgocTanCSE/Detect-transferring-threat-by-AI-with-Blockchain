const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Alert = sequelize.define('Alert', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primary_key: true,
    allowNull: false,
  },
  wallet_address: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  alert_type: {
    type: DataTypes.STRING(100),
    allowNull: false,
  },
  severity: {
    type: DataTypes.STRING(20),
    defaultValue: 'LOW', // LOW, MEDIUM, HIGH, CRITICAL
  },
  message: {
    type: DataTypes.TEXT,
    allowNull: true,
  },
  risk_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  detected_at: {
    type: DataTypes.DATE,
    defaultValue: DataTypes.NOW,
  },
  acknowledged: {
    type: DataTypes.BOOLEAN,
    defaultValue: false,
  },
}, {
  tableName: 'alerts',
  timestamps: true,
  underscored: true,
});

module.exports = Alert;
