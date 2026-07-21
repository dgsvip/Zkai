const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const Response = require('../utils/response');
const { generateOrderNo } = require('../utils/orderNo');
const auth = require('../middleware/auth');

// 创建订单
router.post('/', async (req, res, next) => {
  try {
    const { service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_id } = req.body;
    if (!service_name || !customer_name || !customer_phone || !customer_address || !appointment_date || !appointment_time) {
      return res.json(Response.error('请填写完整信息'));
    }
    if (!/^1\d{10}$/.test(customer_phone)) {
      return res.json(Response.error('手机号格式不正确'));
    }
    // 地址匹配区域
    const [configs] = await pool.execute('SELECT config_value FROM site_config WHERE config_key = "region_timeout_minutes"');
    const regionTimeout = parseInt(configs[0]?.config_value || 30);

    const regions = ['磐石街道','曹城街道','青菏街道','郑庄街道','倪集街道','庄寨镇','普连集镇','古营集镇','侯集镇','苏集镇','孙老家镇','阎店楼镇','梁堤头镇','安蔡楼镇','大集镇','王集镇','楼庄镇','韩集镇','砖庙镇','常乐集镇','魏湾镇','仵楼镇','邵庄镇','朱洪庙镇'];
    let region_matched = null;
    for (const r of regions) {
      if (customer_address.includes(r)) {
        region_matched = r;
        break;
      }
    }
    const orderNo = generateOrderNo();
    const [result] = await pool.execute(
      `INSERT INTO orders (order_no, service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_id, source, is_region, region_matched, status, timeout_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [orderNo, service_item_id || null, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark || null, merchant_id || null, merchant_id ? 'merchant' : 'user', region_matched ? 1 : 0, region_matched, region_matched ? 'pending' : 'pending', regionTimeout]
    );
    // 记录日志
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "下单", ?, ?)',
      [orderNo, `用户下单: ${customer_name}`, customer_name]);
    res.json(Response.success({ order_no: orderNo }, '下单成功'));
  } catch (err) { next(err); }
});

// 获取订单列表
router.get('/', auth(), async (req, res, next) => {
  try {
    const { status, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let query = 'SELECT * FROM orders WHERE is_deleted = 0';
    const params = [];
    // 如果是用户端，按用户手机号查询
    if (req.user.role === 'user') {
      query += ' AND customer_phone = ?';
      params.push(req.user.phone);
    }
    if (status) {
      query += ' AND status = ?';
      params.push(status);
    }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const [rows] = await pool.execute(query, params);
    const [countResult] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE is_deleted = 0', []);
    res.json(Response.success({ list: rows, total: countResult[0].total, page: parseInt(page), page_size: parseInt(page_size) }));
  } catch (err) { next(err); }
});

// 获取订单详情
router.get('/:orderNo', async (req, res, next) => {
  try {
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [req.params.orderNo]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    // 附加工单信息
    const [logs] = await pool.execute('SELECT * FROM order_logs WHERE order_no = ? ORDER BY created_at ASC', [req.params.orderNo]);
    const [remarks] = await pool.execute('SELECT * FROM order_remarks WHERE order_no = ? ORDER BY created_at ASC', [req.params.orderNo]);
    const [evaluations] = await pool.execute('SELECT * FROM order_evaluations WHERE order_no = ?', [req.params.orderNo]);
    let technician = null;
    if (order.technician_id) {
      const [techs] = await pool.execute('SELECT id, name, phone, region, rating_avg, total_ratings, avatar FROM technicians WHERE id = ?', [order.technician_id]);
      technician = techs[0] || null;
    }
    res.json(Response.success({ ...order, logs, remarks, evaluation: evaluations[0] || null, technician }));
  } catch (err) { next(err); }
});

// 用户取消订单
router.post('/:orderNo/cancel', async (req, res, next) => {
  try {
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [req.params.orderNo]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (['completed', 'cancelled', 'timeout'].includes(order.status)) {
      return res.json(Response.error('当前订单状态不可取消'));
    }
    // 获取取消规则
    const [configs] = await pool.execute('SELECT config_value FROM site_config WHERE config_key = "cancel_fee"');
    const cancelFee = parseFloat(configs[0]?.config_value || 5);
    let cancelFeeApplied = 0;
    if (order.technician_id) {
      // 接单后15分钟内
      const assignedAt = order.updated_at;
      const minutesSinceAssigned = (Date.now() - new Date(assignedAt).getTime()) / 60000;
      if (minutesSinceAssigned <= 15) {
        cancelFeeApplied = cancelFee;
      } else {
        return res.json(Response.error('接单已超过15分钟，不可取消，请联系客服'));
      }
    }
    await pool.execute('UPDATE orders SET status = "cancelled", cancel_fee = ? WHERE order_no = ?', [cancelFeeApplied, req.params.orderNo]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "取消", "用户取消订单", ?)', [req.params.orderNo, req.body.customer_name || '用户']);
    if (cancelFeeApplied > 0) {
      // 扣除爽约金
      await pool.execute('UPDATE technicians SET balance = balance - ? WHERE id = ?', [cancelFeeApplied, order.technician_id]);
    }
    res.json(Response.success(null, '订单已取消'));
  } catch (err) { next(err); }
});

// 获取订单时间线
router.get('/:orderNo/timeline', async (req, res, next) => {
  try {
    const [logs] = await pool.execute('SELECT * FROM order_logs WHERE order_no = ? ORDER BY created_at ASC', [req.params.orderNo]);
    res.json(Response.success(logs));
  } catch (err) { next(err); }
});

// 提交评价
router.post('/:orderNo/evaluate', async (req, res, next) => {
  try {
    const { rating_attitude, rating_skill, rating_punctuality, comment } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [req.params.orderNo]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (order.status !== 'completed') return res.json(Response.error('只有已完成订单可以评价'));
    const [existing] = await pool.execute('SELECT * FROM order_evaluations WHERE order_no = ?', [req.params.orderNo]);
    if (existing.length > 0) return res.json(Response.error('该订单已评价'));
    await pool.execute(
      'INSERT INTO order_evaluations (order_no, user_id, technician_id, rating_attitude, rating_skill, rating_punctuality, comment) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.params.orderNo, order.user_id, order.technician_id, rating_attitude || 5, rating_skill || 5, rating_punctuality || 5, comment || null]
    );
    if (order.technician_id) {
      const [stats] = await pool.execute('SELECT AVG((rating_attitude + rating_skill + rating_punctuality) / 3) as avg_rating, COUNT(*) as count FROM order_evaluations WHERE technician_id = ?', [order.technician_id]);
      if (stats.length > 0) {
        await pool.execute('UPDATE technicians SET rating_avg = ?, total_ratings = ? WHERE id = ?', [Math.round(stats[0].avg_rating * 10) / 10, stats[0].count, order.technician_id]);
      }
    }
    res.json(Response.success(null, '评价成功'));
  } catch (err) { next(err); }
});

module.exports = router;