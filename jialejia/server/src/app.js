const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const morgan = require('morgan');
const config = require('./config');
const logger = require('./utils/logger');

// 启动定时任务
require('./cron/tasks');
const { errorHandler, notFoundHandler } = require('./middleware/errorHandler');
const { generalLimiter } = require('./middleware/rateLimiter');

const app = express();

// Middleware
app.use(helmet());
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(morgan('combined', { stream: { write: msg => logger.info(msg.trim()) } }));
app.use('/api', generalLimiter);

// Routes
app.use('/api/v1/user', require('./routes/user'));
app.use('/api/v1/technician', require('./routes/technician'));
app.use('/api/v1/merchant', require('./routes/merchant'));
app.use('/api/v1/admin', require('./routes/admin'));
app.use('/api/v1/services', require('./routes/service'));
app.use('/api/v1/orders', require('./routes/order'));
app.use('/api/v1/announcements', require('./routes/announcement'));

// Health check
app.get('/api/health', (_req, res) => {
  res.json({ code: 200, message: 'OK', timestamp: Date.now() });
});

// Error handling
app.use(notFoundHandler);
app.use(errorHandler);

// Start server
app.listen(config.port, () => {
  logger.info(`佳乐家服务已启动，端口: ${config.port}, 环境: ${config.nodeEnv}`);
  console.log(`🚀 佳乐家服务启动成功！端口: ${config.port}`);
});

module.exports = app;