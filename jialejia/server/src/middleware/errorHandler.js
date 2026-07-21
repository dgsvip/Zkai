const logger = require('../utils/logger');
const Response = require('../utils/response');

const errorHandler = (err, req, res, _next) => {
  logger.error('Unhandled Error:', {
    message: err.message,
    stack: err.stack,
    url: req.originalUrl,
    method: req.method,
    ip: req.ip
  });
  res.status(err.status || 500).json(
    Response.serverError(err.message || '服务器内部错误')
  );
};

const notFoundHandler = (req, res) => {
  res.status(404).json(Response.notFound(`接口 ${req.method} ${req.originalUrl} 不存在`));
};

module.exports = { errorHandler, notFoundHandler };