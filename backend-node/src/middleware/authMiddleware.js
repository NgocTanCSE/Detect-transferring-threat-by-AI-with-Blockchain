const authService = require('../services/authService');

const protect = async (req, res, next) => {
  let token;

  if (req.headers.authorization && req.headers.authorization.startsWith('Bearer')) {
    try {
      token = req.headers.authorization.split(' ')[1];
      const user = await authService.validateToken(token);

      if (!user) {
        return res.status(401).json({ detail: 'Not authorized, token failed' });
      }

      req.user = user;
      next();
    } catch (error) {
      console.error(error);
      res.status(401).json({ detail: 'Not authorized, token failed' });
    }
  }

  if (!token) {
    res.status(401).json({ detail: 'Not authorized, no token' });
  }
};

const authorize = (...roles) => {
  return (req, res, next) => {
    if (!req.user || !roles.includes(req.user.role)) {
      return res.status(403).json({ detail: `User role ${req.user?.role} is not authorized to access this route` });
    }
    next();
  };
};

module.exports = { protect, authorize };
