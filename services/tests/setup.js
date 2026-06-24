// Test setup file for Jest
process.env.NODE_ENV = 'test';
process.env.DATABASE_URL = process.env.DATABASE_URL || 'postgresql://blockchain:test@localhost:5432/blockchain_test';
process.env.REDIS_URL = process.env.REDIS_URL || 'redis://localhost:6379/1';
process.env.JWT_SECRET_KEY = process.env.JWT_SECRET_KEY || 'test-secret-key-for-testing-only';
process.env.RABBITMQ_URL = process.env.RABBITMQ_URL || 'amqp://admin:admin123@localhost:5672';