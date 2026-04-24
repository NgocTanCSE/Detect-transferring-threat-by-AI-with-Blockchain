const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Wallet = sequelize.define('Wallet', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primary_key: true,
    allowNull: false,
  },
  address: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
    index: true,
  },
  label: {
    type: DataTypes.STRING(255),
    allowNull: true,
  },
  entity_type: {
    type: DataTypes.STRING(50),
    defaultValue: 'Unknown',
  },
  account_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'active',
  },
  risk_score: {
    type: DataTypes.FLOAT,
    defaultValue: 0.0,
  },
  total_transactions: {
    type: DataTypes.BIGINT,
    defaultValue: 0,
  },
  total_value_sent: {
    type: DataTypes.DECIMAL(78, 0),
    defaultValue: 0,
  },
  total_value_received: {
    type: DataTypes.DECIMAL(78, 0),
    defaultValue: 0,
  },
  chain_id: {
    type: DataTypes.STRING(50),
    defaultValue: 'ethereum',
    index: true,
  },
}, {
  tableName: 'wallets',
  timestamps: true,
  underscored: true,
});

module.exports = Wallet;
