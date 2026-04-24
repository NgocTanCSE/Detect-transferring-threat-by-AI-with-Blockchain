const { Sequelize } = require('sequelize');
const { databaseUrl } = require('./env');

const sequelize = new Sequelize(databaseUrl, {
  dialect: 'postgres',
  logging: false,
  define: {
    timestamps: true,
    underscored: true,
  },
});

const connectDb = async () => {
  try {
    await sequelize.authenticate();
    console.log('PostgreSQL connected successfully via Sequelize');
  } catch (error) {
    console.error('Unable to connect to the database:', error);
    process.exit(1);
  }
};

module.exports = { sequelize, connectDb };
