const User = require('../models/User');
const Wallet = require('../models/Wallet');
const Transaction = require('../models/Transaction');
const authService = require('../services/authService');
const { Op } = require('sequelize');
const crypto = require('crypto');

class AuthController {
  async login(req, res) {
    const { username, password } = req.body;

    try {
      const user = await User.findOne({
        where: {
          [Op.or]: [
            { username: username.toLowerCase() },
            { email: username.toLowerCase() }
          ]
        }
      });

      if (!user || !(await authService.comparePassword(password, user.password_hash))) {
        return res.status(401).json({ detail: 'Incorrect username or password' });
      }

      if (!user.is_active) {
        return res.status(403).json({ detail: 'User account is disabled' });
      }

      const token = authService.generateToken(user);
      
      // Update last login
      user.last_login_at = new Date();
      await user.save();

      res.json({
        access_token: token,
        token_type: 'bearer',
        expires_in: 86400 // 24 hours
      });
    } catch (error) {
      console.error('Login error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }

  async register(req, res) {
    const { username, email, password, wallet_address } = req.body;

    try {
      // Check if username/email exists
      const existing = await User.findOne({
        where: {
          [Op.or]: [
            { username: username.toLowerCase() },
            { email: email.toLowerCase() }
          ]
        }
      });

      if (existing) {
        return res.status(400).json({ detail: 'Username or email already registered' });
      }

      const hashedPassword = await authService.hashPassword(password);
      
      // If wallet not provided, generate a unique one
      let finalWalletAddress = wallet_address ? wallet_address.toLowerCase() : `0x${crypto.randomBytes(20).toString('hex')}`;

      const newUser = await User.create({
        username: username.toLowerCase(),
        email: email.toLowerCase(),
        password_hash: hashedPassword,
        wallet_address: finalWalletAddress,
        role: 'user',
        is_active: true
      });

      // Ensure wallet profile exists
      let wallet = await Wallet.findOne({ where: { address: finalWalletAddress } });
      if (!wallet) {
        wallet = await Wallet.create({
          address: finalWalletAddress,
          label: `${username} wallet`,
          entity_type: 'User',
          account_status: 'active',
          risk_score: 0.0,
          total_transactions: 1,
          total_value_received: '10000000000000000000', // 10 ETH
        });
      }

      // Add welcome transaction
      await Transaction.create({
        tx_hash: `0x${crypto.randomBytes(32).toString('hex')}`,
        from_address: '0x0000000000000000000000000000000000000000',
        to_address: finalWalletAddress,
        value: '10000000000000000000', // 10 ETH
        block_number: 1000000,
        timestamp: new Date(),
        status: 1,
        case_status: 'PENDING'
      });

      res.status(201).json({
        id: newUser.id,
        username: newUser.username,
        email: newUser.email,
        role: newUser.role,
        wallet_address: newUser.wallet_address,
        is_active: newUser.is_active,
        created_at: newUser.created_at
      });
    } catch (error) {
      console.error('Registration error:', error);
      res.status(500).json({ detail: 'Internal server error' });
    }
  }

  async me(req, res) {
    // This assumes an auth middleware has already attached the user to the request
    if (!req.user) {
      return res.status(401).json({ detail: 'Not authenticated' });
    }

    res.json({
      id: req.user.id,
      username: req.user.username,
      email: req.user.email,
      role: req.user.role,
      wallet_address: req.user.wallet_address,
      warning_count: req.user.warning_count,
      is_active: req.user.is_active,
      created_at: req.user.created_at
    });
  }
}

module.exports = new AuthController();
