const cron = require('node-cron');
const pool = require('../config/database');
const logger = require('../utils/logger');

// 定时任务：区域单超时转抢单池（每5分钟执行）
cron.schedule('*/5 * * * *', async () => {
  try {
    const [result] = await pool.execute(
      "UPDATE orders SET is_region = 0, region_matched = NULL WHERE status = 'pending' AND is_region = 1 AND timeout_at IS NOT NULL AND timeout_at <= NOW()"
    );
    if (result.affectedRows > 0) {
      logger.info(`区域单超时转抢单池: ${result.affectedRows} 单`);
    }
  } catch (err) {
    logger.error('区域单超时任务失败:', err);
  }
});

// 定时任务：超期未完工订单自动完结（每天凌晨1点执行）
cron.schedule('0 1 * * *', async () => {
  try {
    const [result] = await pool.execute(
      "UPDATE orders SET status = 'timeout', completed_at = NOW() WHERE status IN ('assigned','processing') AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)"
    );
    if (result.affectedRows > 0) {
      await pool.execute(
        "INSERT INTO order_logs (order_no, action, description) SELECT order_no, '超期完结', '系统自动完结（超期3天）' FROM orders WHERE status = 'timeout' AND completed_at IS NOT NULL AND updated_at < DATE_SUB(NOW(), INTERVAL 1 MINUTE)"
      );
      logger.info(`超期订单自动完结: ${result.affectedRows} 单`);
    }
  } catch (err) {
    logger.error('超期自动完结任务失败:', err);
  }
});

// 定时任务：清理过期日志（每天凌晨3点执行）
cron.schedule('0 3 * * *', async () => {
  try {
    const [configs] = await pool.execute("SELECT config_value FROM site_config WHERE config_key = 'log_retention_days'");
    const days = parseInt(configs[0]?.config_value || 90);
    const [result] = await pool.execute(
      'DELETE FROM system_logs WHERE created_at < DATE_SUB(NOW(), INTERVAL ? DAY)',
      [days]
    );
    if (result.affectedRows > 0) {
      logger.info(`清理过期日志: ${result.affectedRows} 条`);
    }
  } catch (err) {
    logger.error('清理日志任务失败:', err);
  }
});

// 定时任务：清理过期验证码（每天凌晨3点执行）
cron.schedule('30 3 * * *', async () => {
  try {
    const [result] = await pool.execute('DELETE FROM verification_codes WHERE expires_at < NOW()');
    if (result.affectedRows > 0) {
      logger.info(`清理过期验证码: ${result.affectedRows} 条`);
    }
  } catch (err) {
    logger.error('清理验证码任务失败:', err);
  }
});

// 定时任务：清理过期登录态（每天凌晨4点执行）
cron.schedule('0 4 * * *', async () => {
  try {
    const [result] = await pool.execute('DELETE FROM user_sessions WHERE expires_at < NOW()');
    if (result.affectedRows > 0) {
      logger.info(`清理过期登录态: ${result.affectedRows} 条`);
    }
  } catch (err) {
    logger.error('清理登录态任务失败:', err);
  }
});

logger.info('定时任务已启动');