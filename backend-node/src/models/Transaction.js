const { DataTypes } = require('sequelize');
const { sequelize } = require('../config/database');

const Transaction = sequelize.define('Transaction', {
  id: {
    type: DataTypes.UUID,
    defaultValue: DataTypes.UUIDV4,
    primary_key: true,
    allowNull: false,
  },
  tx_hash: {
    type: DataTypes.STRING(66),
    allowNull: false,
    index: true,
  },
  from_address: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  to_address: {
    type: DataTypes.STRING(255),
    allowNull: false,
    index: true,
  },
  value: {
    type: DataTypes.DECIMAL(78, 0),
    allowNull: false,
  },
  block_number: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  timestamp: {
    type: DataTypes.DATE,
    allowNull: true,
    index: true,
  },
  status: {
    type: DataTypes.INTEGER,
    defaultValue: 1,
  },
  case_status: {
    type: DataTypes.STRING(20),
    defaultValue: 'PENDING',
  },
}, {
  tableName: 'transactions',
  timestamps: true,
  underscored: true,
});

module.exports = Transaction;
