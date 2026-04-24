const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { jwtSecretKey } = require('../config/env');
const User = require('../models/User');

class AuthService {
  async hashPassword(password) {
    const salt = await bcrypt.genSalt(10);
    return bcrypt.hash(password, salt);
  }

  async comparePassword(password, hashedPassword) {
    return bcrypt.compare(password, hashedPassword);
  }

  generateToken(user) {
    const payload = {
      sub: user.id,
      username: user.username,
      role: user.role,
    };
    
    return jwt.sign(payload, jwtSecretKey, { expiresIn: '24h' });
  }

  async validateToken(token) {
    try {
      const decoded = jwt.verify(token, jwtSecretKey);
      const user = await User.findByPk(decoded.sub);
      if (!user || !user.is_active) return null;
      return user;
    } catch (error) {
      return null;
    }
  }
}

module.exports = new AuthService();
