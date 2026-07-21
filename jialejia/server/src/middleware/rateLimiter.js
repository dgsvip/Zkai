const rateLimit = require('express-rate-limit');

const generalLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  message: { code: 429, message: '请求过于频繁，请稍后再试', timestamp: Date.now() }
});

const smsLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 3,
  message: { code: 429, message: '验证码获取过于频繁，请1分钟后再试', timestamp: Date.now() }
});

module.exports = { generalLimiter, smsLimiter };