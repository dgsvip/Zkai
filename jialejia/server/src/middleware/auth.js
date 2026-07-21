const jwt = require('jsonwebtoken');
const config = require('../config');
const Response = require('../utils/response');

const auth = (roles = []) => {
  return (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return res.status(401).json(Response.unauthorized('请先登录'));
    }
    const token = authHeader.split(' ')[1];
    try {
      const decoded = jwt.verify(token, config.jwt.secret);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) {
        return res.status(403).json(Response.forbidden('权限不足'));
      }
      next();
    } catch (err) {
      return res.status(401).json(Response.unauthorized('登录已过期，请重新登录'));
    }
  };
};

module.exports = auth;