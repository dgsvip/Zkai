const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

// 商家登录
router.post('/login', async (req, res, next) => {
  try {
    const { phone, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM merchants WHERE phone = ?', [phone]);
    if (rows.length === 0) return res.json(Response.error('账号不存在'));
    const merchant = rows[0];
    if (merchant.status === 0) return res.json(Response.error('账号已被禁用'));
    if (password !== merchant.password) return res.json(Response.error('密码错误'));
    const token = jwt.sign({ id: merchant.id, phone: merchant.phone, role: 'merchant' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    res.json(Response.success({ token, merchant: { id: merchant.id, name: merchant.name, contact: merchant.contact, phone: merchant.phone, referral_rate: merchant.referral_rate, balance: merchant.balance } }));
  } catch (err) { next(err); }
});

// 获取商家信息
router.get('/profile', auth(['merchant']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM merchants WHERE id = ?', [req.user.id]);
    if (rows.length === 0) return res.json(Response.notFound('商家不存在'));
    res.json(Response.success(rows[0]));
  } catch (err) { next(err); }
});

// 推广数据统计
router.get('/statistics', auth(['merchant']), async (req, res, next) => {
  try {
    const [orders] = await pool.execute('SELECT COUNT(*) as total, COALESCE(SUM(merchant_fee), 0) as total_fee FROM orders WHERE merchant_id = ?', [req.user.id]);
    const [monthOrders] = await pool.execute('SELECT COUNT(*) as month_total, COALESCE(SUM(merchant_fee), 0) as month_fee FROM orders WHERE merchant_id = ? AND YEAR(created_at) = YEAR(CURDATE()) AND MONTH(created_at) = MONTH(CURDATE())', [req.user.id]);
    res.json(Response.success({ ...orders[0], ...monthOrders[0] }));
  } catch (err) { next(err); }
});

// 代报单
router.post('/orders', auth(['merchant']), async (req, res, next) => {
  try {
    const { service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_remark } = req.body;
    if (!service_name || !customer_name || !customer_phone || !customer_address) {
      return res.json(Response.error('请填写完整信息'));
    }
    const orderNo = require('../utils/orderNo').generateOrderNo();
    const [configs] = await pool.execute('SELECT config_value FROM site_config WHERE config_key = "region_timeout_minutes"');
    const regionTimeout = parseInt(configs[0]?.config_value || 30);
    await pool.execute(
      `INSERT INTO orders (order_no, merchant_id, service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, source, status, timeout_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, "merchant", "pending", DATE_ADD(NOW(), INTERVAL ? MINUTE))`,
      [orderNo, req.user.id, service_item_id || null, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark || null, regionTimeout]
    );
    if (merchant_remark) {
      await pool.execute('INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, "merchant", ?, ?, "technician,admin")',
        [orderNo, merchant_remark, req.user.name]);
    }
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "代报单", ?, ?)', [orderNo, `商家代报: ${customer_name}`, req.user.name]);
    res.json(Response.success({ order_no: orderNo }, '代报单提交成功'));
  } catch (err) { next(err); }
});

// 代报历史记录
router.get('/orders', auth(['merchant']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 收益中心
router.get('/income', auth(['merchant']), async (req, res, next) => {
  try {
    const [total] = await pool.execute('SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(CASE WHEN status = "settled" THEN amount ELSE 0 END), 0) as settled, COALESCE(SUM(CASE WHEN status = "pending" THEN amount ELSE 0 END), 0) as pending FROM merchant_transactions WHERE merchant_id = ?', [req.user.id]);
    const [merchant] = await pool.execute('SELECT balance FROM merchants WHERE id = ?', [req.user.id]);
    res.json(Response.success({ ...total[0], balance: merchant[0]?.balance || 0 }));
  } catch (err) { next(err); }
});

// 介绍费明细
router.get('/income/detail', auth(['merchant']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM merchant_transactions WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50', [req.user.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 申请提现
router.post('/withdraw', auth(['merchant']), async (req, res, next) => {
  try {
    const { amount } = req.body;
    const [merchants] = await pool.execute('SELECT balance FROM merchants WHERE id = ?', [req.user.id]);
    if (merchants.length === 0) return res.json(Response.notFound('商家不存在'));
    if (merchants[0].balance < amount) return res.json(Response.error('余额不足'));
    await pool.execute('INSERT INTO merchant_withdrawals (merchant_id, amount) VALUES (?, ?)', [req.user.id, amount]);
    res.json(Response.success(null, '提现申请已提交，等待审核'));
  } catch (err) { next(err); }
});

// 提现记录
router.get('/withdraws', auth(['merchant']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM merchant_withdrawals WHERE merchant_id = ? ORDER BY created_at DESC', [req.user.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

module.exports = router;