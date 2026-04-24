const PolicyRule = require('../models/PolicyRule');
const { Op } = require('sequelize');

class ComplianceController {
  async getPolicyRules(req, res) {
    try {
      const rules = await PolicyRule.findAll({
        order: [['priority', 'ASC'], ['created_at', 'DESC']]
      });
      res.json(rules);
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }

  async createPolicyRule(req, res) {
    try {
      const rule = await PolicyRule.create({
        ...req.body,
        created_by: req.user ? req.user.username : 'system'
      });
      res.status(201).json(rule);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async updatePolicyRule(req, res) {
    const { id } = req.params;
    try {
      const rule = await PolicyRule.findByPk(id);
      if (!rule) {
        return res.status(404).json({ error: 'Policy rule not found' });
      }
      await rule.update(req.body);
      res.json(rule);
    } catch (error) {
      res.status(400).json({ error: error.message });
    }
  }

  async deletePolicyRule(req, res) {
    const { id } = req.params;
    try {
      const rule = await PolicyRule.findByPk(id);
      if (!rule) {
        return res.status(404).json({ error: 'Policy rule not found' });
      }
      await rule.destroy();
      res.json({ message: 'Policy rule deleted' });
    } catch (error) {
      res.status(500).json({ error: error.message });
    }
  }
}

module.exports = new ComplianceController();
