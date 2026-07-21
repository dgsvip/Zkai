const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

// 师傅登录
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM technicians WHERE phone = ?', [phone]);
    if (rows.length === 0) return res.json(Response.error('账号不存在'));
    const tech = rows[0];
    if (tech.status === 0) return res.json(Response.error('账号已被禁用'));
    // 简单密码校验（生产环境应使用bcrypt）
    if (password !== tech.password) return res.json(Response.error('密码错误'));
    const token = jwt.sign({ id: tech.id, phone: tech.phone, role: 'technician', region: tech.region }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json(Response.success({ token, technician: { id: tech.id, name: tech.name, phone: tech.phone, region: tech.region, balance: tech.balance, busy: tech.busy, credit_score: tech.credit_score, rating_avg: tech.rating_avg, avatar: tech.avatar } }));
  } catch (err) { next(err); }
});

// 获取师傅信息
router.get('/profile', auth(['technician']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM technicians WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.json(Response.notFound('师傅不存在'));
    res.json(Response.success(rows[0]));
  } catch (err) { next(err); }
});

// 更新师傅信息
router.put('/profile', auth(['technician']), async (req, res, next) => {
  try {
    const { region, accept_radius } = req.body;
    await pool.execute('UPDATE technicians SET region = COALESCE(?, region), accept_radius = COALESCE(?, accept_radius) WHERE id = ?', [region, accept_radius, req.user.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// 切换忙碌状态
router.put('/busy', auth(['technician']), async (req, res, next) => {
  try {
    const { busy } = req.body;
    await pool.execute('UPDATE technicians SET busy = ? WHERE id = ?', [busy ? 1 : 0, req.user.id]);
    res.json(Response.success(null, busy ? '已切换为忙碌' : '已切换为空闲'));
  } catch (err) { next(err); }
});

// 获取工单列表
router.get('/orders', auth(['technician']), async (req, res, next) => {
  try {
    const { type, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    // 获取师傅区域信息
    const [techs] = await pool.execute('SELECT region FROM technicians WHERE id = ?', [req.user.id]);
    const region = techs[0]?.region;
    let query, params;
    switch (type) {
      case 'region': // 区域单
        query = 'SELECT o.*, t.name as technician_name FROM orders o LEFT JOIN technicians t ON o.technician_id = t.id WHERE o.is_deleted = 0 AND o.status = "pending" AND o.is_region = 1 AND o.region_matched = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params = [region, parseInt(page_size), offset];
        break;
      case 'pool': // 抢单池
        query = 'SELECT o.* FROM orders o WHERE o.is_deleted = 0 AND o.status = "pending" AND o.is_region = 0 ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params = [parseInt(page_size), offset];
        break;
      case 'processing': // 进行中
        query = 'SELECT o.*, t.name as technician_name FROM orders o LEFT JOIN technicians t ON o.technician_id = t.id WHERE o.technician_id = ? AND o.status IN ("assigned", "processing") ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params = [req.user.id, parseInt(page_size), offset];
        break;
      case 'history': // 历史
        query = 'SELECT o.*, t.name as technician_name FROM orders o LEFT JOIN technicians t ON o.technician_id = t.id WHERE o.technician_id = ? AND o.status IN ("completed", "cancelled", "timeout") ORDER BY o.created_at DESC LIMIT ? OFFSET ?';
        params = [req.user.id, parseInt(page_size), offset];
        break;
      default: // 全部
        query = 'SELECT * FROM orders WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
        params = [parseInt(page_size), offset];
    }
    const [rows] = await pool.execute(query, params);
    res.json(Response.success({ list: rows, page: parseInt(page), page_size: parseInt(page_size) }));
  } catch (err) { next(err); }
});

// 接单/抢单
router.post('/orders/accept', auth(['technician']), async (req, res, next) => {
  try {
    const { order_no } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [order_no]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (order.status !== 'pending') return res.json(Response.error('订单已被接走'));
    // 检查余额
    const [techs] = await pool.execute('SELECT * FROM technicians WHERE id = ?', [req.user.id]);
    if (techs.length === 0) return res.json(Response.notFound('师傅不存在'));
    const tech = techs[0];
    // 检查信用分
    if (tech.credit_score < 60) return res.json(Response.error('信用分不足，无法接单'));
    await pool.execute('UPDATE orders SET technician_id = ?, status = "assigned" WHERE order_no = ? AND status = "pending"', [req.user.id, order_no]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "接单", ?, ?)', [order_no, `师傅 ${tech.name} 已接单`, tech.name]);
    res.json(Response.success(null, '接单成功'));
  } catch (err) { next(err); }
});

// 完工
router.post('/orders/complete', auth(['technician']), async (req, res, next) => {
  try {
    const { order_no, price, warranty_months, image_urls, technician_remark } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [order_no]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (order.technician_id !== req.user.id) return res.json(Response.error('无权操作该订单'));
    // 获取抽成比例
    const [configs] = await pool.execute('SELECT config_key, config_value FROM site_config WHERE config_key IN ("default_platform_rate", "default_technician_rate")');
    const configMap = {};
    configs.forEach(c => configMap[c.config_key] = parseFloat(c.config_value));
    const platformRate = configMap.default_platform_rate || 10;
    const technicianRate = configMap.default_technician_rate || 5;
    const platformFee = parseFloat((price * platformRate / 100).toFixed(2));
    const technicianIncome = parseFloat((price * (100 - platformRate - technicianRate) / 100).toFixed(2));
    await pool.execute(
      'UPDATE orders SET price = ?, platform_fee = ?, technician_income = ?, warranty_months = ?, image_urls = ?, technician_remark = COALESCE(?, technician_remark), status = "completed", completed_at = NOW() WHERE order_no = ?',
      [price, platformFee, technicianIncome, warranty_months || 0, image_urls ? JSON.stringify(image_urls) : null, technician_remark, order_no]
    );
    // 扣师傅余额（平台抽成）
    await pool.execute('UPDATE technicians SET balance = balance - ? WHERE id = ?', [platformFee, req.user.id]);
    // 记录师傅收入
    await pool.execute('INSERT INTO technician_transactions (technician_id, order_no, amount, type, description) VALUES (?, ?, ?, "income", ?)', [req.user.id, order_no, technicianIncome, `完工收入: ${order.service_name}`]);
    // 记录平台抽成
    await pool.execute('INSERT INTO technician_transactions (technician_id, order_no, amount, type, description) VALUES (?, ?, ?, "fee", ?)', [req.user.id, order_no, -platformFee, `平台抽成: ${platformFee}元`]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "完工", ?, ?)', [order_no, `完工，实收${price}元，平台抽成${platformFee}元`, req.user.name]);
    // 商家介绍费（如有）
    if (order.merchant_id) {
      const [merchants] = await pool.execute('SELECT referral_rate FROM merchants WHERE id = ?', [order.merchant_id]);
      const merchantRate = merchants[0]?.referral_rate || 3;
      const merchantFee = parseFloat((price * merchantRate / 100).toFixed(2));
      if (merchantFee > 0) {
        await pool.execute('UPDATE orders SET merchant_fee = ? WHERE order_no = ?', [merchantFee, order_no]);
        await pool.execute('UPDATE merchants SET balance = balance + ? WHERE id = ?', [merchantFee, order.merchant_id]);
        await pool.execute('INSERT INTO merchant_transactions (merchant_id, order_no, amount, status) VALUES (?, ?, ?, "pending")', [order.merchant_id, order_no, merchantFee]);
      }
    }
    res.json(Response.success(null, '完工确认成功'));
  } catch (err) { next(err); }
});

// 发起转派
router.post('/orders/transfer', auth(['technician']), async (req, res, next) => {
  try {
    const { order_no, target_technician_id, transfer_remark } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [order_no]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (order.technician_id !== req.user.id) return res.json(Response.error('无权操作该订单'));
    await pool.execute('UPDATE orders SET transfer_from = ?, status = "assigned" WHERE order_no = ?', [req.user.id, order_no]);
    // 记录转派备注
    await pool.execute('INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, "transfer", ?, ?, "technician,admin")',
      [order_no, transfer_remark || '转派', req.user.name]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "转派", ?, ?)', [order_no, `转派给师傅ID: ${target_technician_id}`, req.user.name]);
    // TODO: 通知被转派师傅
    res.json(Response.success(null, '转派已发起'));
  } catch (err) { next(err); }
});

// 接受/拒绝转派
router.post('/orders/transfer/respond', auth(['technician']), async (req, res, next) => {
  try {
    const { order_no, accept } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [order_no]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    if (accept) {
      await pool.execute('UPDATE orders SET technician_id = ?, transfer_from = NULL WHERE order_no = ?', [req.user.id, order_no]);
      await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "接受转派", "接受转派", ?)', [order_no, req.user.name]);
    } else {
      await pool.execute('UPDATE orders SET transfer_from = NULL WHERE order_no = ?', [order_no]);
      await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "拒绝转派", "拒绝转派", ?)', [order_no, req.user.name]);
    }
    res.json(Response.success(null, accept ? '已接受转派' : '已拒绝转派'));
  } catch (err) { next(err); }
});

// 取消订单
router.post('/orders/cancel', auth(['technician']), async (req, res, next) => {
  try {
    const { order_no, cancel_reason } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE order_no = ?', [order_no]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    const order = orders[0];
    if (order.technician_id !== req.user.id) return res.json(Response.error('无权操作该订单'));
    // 计算取消惩罚
    const minutesSinceAssigned = (Date.now() - new Date(order.updated_at).getTime()) / 60000;
    let penalty = 2;
    let lockHours = 0;
    if (minutesSinceAssigned > 30) { penalty = 10; lockHours = 24; }
    else if (minutesSinceAssigned > 5) { penalty = 5; lockHours = 4; }
    await pool.execute('UPDATE orders SET status = "cancelled", technician_id = NULL WHERE order_no = ?', [order_no]);
    await pool.execute('UPDATE technicians SET credit_score = GREATEST(0, credit_score - ?) WHERE id = ?', [penalty, req.user.id]);
    // 记录取消备注
    await pool.execute('INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, "cancel", ?, ?, "user,admin")',
      [order_no, cancel_reason || '师傅取消', req.user.name]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "取消", ?, ?)', [order_no, `师傅取消: ${cancel_reason || ''}，扣信用分${penalty}`, req.user.name]);
    res.json(Response.success(null, `订单已取消，信用分扣除${penalty}分`));
  } catch (err) { next(err); }
});

// 创建自建单
router.post('/orders/self', auth(['technician']), async (req, res, next) => {
  try {
    const { service_name, customer_name, customer_phone, customer_address, price, remark } = req.body;
    if (!service_name || !customer_name || !customer_phone || !customer_address) {
      return res.json(Response.error('请填写完整信息'));
    }
    const orderNo = generateOrderNo();
    const [configs] = await pool.execute('SELECT config_value FROM site_config WHERE config_key = "default_platform_rate"');
    const platformRate = parseFloat(configs[0]?.config_value || 10);
    const platformFee = parseFloat((price * platformRate / 100).toFixed(2));
    await pool.execute(
      `INSERT INTO orders (order_no, technician_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, price, platform_fee, technician_remark, source, status, is_region, completed_at)
       VALUES (?, ?, ?, ?, ?, ?, CURDATE(), NOW(), ?, ?, ?, "self", "completed", 0, NOW())`,
      [orderNo, req.user.id, service_name, customer_name, customer_phone, customer_address, price || 0, platformFee, remark || null]
    );
    await pool.execute('UPDATE technicians SET balance = balance - ? WHERE id = ?', [platformFee, req.user.id]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "自建", "师傅自建单", ?)', [orderNo, req.user.name]);
    res.json(Response.success({ order_no: orderNo }, '自建单创建成功'));
  } catch (err) { next(err); }
});

// 获取今日统计/收入
router.get('/statistics', auth(['technician']), async (req, res, next) => {
  try {
    const [todayOrders] = await pool.execute(
      'SELECT COUNT(*) as total, SUM(CASE WHEN status = "completed" THEN 1 ELSE 0 END) as completed FROM orders WHERE technician_id = ? AND DATE(created_at) = CURDATE()',
      [req.user.id]);
    const [todayIncome] = await pool.execute(
      'SELECT COALESCE(SUM(technician_income), 0) as income FROM orders WHERE technician_id = ? AND status = "completed" AND DATE(completed_at) = CURDATE()',
      [req.user.id]);
    const [techs] = await pool.execute('SELECT balance, credit_score, rating_avg FROM technicians WHERE id = ?', [req.user.id]);
    res.json(Response.success({ ...todayOrders[0], income: todayIncome[0].income, ...techs[0] }));
  } catch (err) { next(err); }
});

// 获取余额明细
router.get('/balance', auth(['technician']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM technician_transactions WHERE technician_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 获取投诉/差评记录
router.get('/complaints', auth(['technician']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM technician_complaints WHERE technician_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

module.exports = router;