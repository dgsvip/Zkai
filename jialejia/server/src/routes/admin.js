const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Response = require('../utils/response');
const auth = require('../middleware/auth');

// 管理员登录
router.post('/login', async (req, res, next) => {
  try {
    const { username, password } = req.body;
    const [rows] = await pool.execute('SELECT * FROM admins WHERE username = ?', [username]);
    if (rows.length === 0) return res.json(Response.error('账号不存在'));
    const admin = rows[0];
    if (admin.status === 0) return res.json(Response.error('账号已被禁用'));
    if (admin.locked_until && new Date(admin.locked_until) > new Date()) {
      return res.json(Response.error('账号已被锁定，请5分钟后再试'));
    }
    if (password !== admin.password) {
      await pool.execute('UPDATE admins SET login_attempts = login_attempts + 1 WHERE id = ?', [admin.id]);
      if (admin.login_attempts >= 2) {
        await pool.execute('UPDATE admins SET locked_until = DATE_ADD(NOW(), INTERVAL 5 MINUTE), login_attempts = 0 WHERE id = ?', [admin.id]);
      }
      return res.json(Response.error('密码错误'));
    }
    await pool.execute('UPDATE admins SET login_attempts = 0, locked_until = NULL WHERE id = ?', [admin.id]);
    const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin', admin_role: admin.role }, config.jwt.secret, { expiresIn: '24h' });
    await pool.execute('INSERT INTO system_logs (operator_id, operator_name, role, action, detail, ip) VALUES (?, ?, ?, "登录", "登录后台", ?)', [admin.id, admin.nickname, admin.role, req.ip]);
    res.json(Response.success({ token, admin: { id: admin.id, username: admin.username, nickname: admin.nickname, role: admin.role } }));
  } catch (err) { next(err); }
});

// ========== 仪表盘 ==========
router.get('/dashboard', auth(['admin']), async (req, res, next) => {
  try {
    const [totalOrders] = await pool.execute('SELECT COUNT(*) as total FROM orders');
    const [todayOrders] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE DATE(created_at) = CURDATE()');
    const [todayFee] = await pool.execute('SELECT COALESCE(SUM(platform_fee), 0) as total FROM orders WHERE DATE(completed_at) = CURDATE()');
    const [onlineTechs] = await pool.execute('SELECT COUNT(*) as total FROM technicians WHERE busy = 0 AND status = 1');
    const [recentOrders] = await pool.execute('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10');
    const [pendingCount] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE status = "pending"');
    const [processingCount] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE status IN ("assigned","processing")');
    const [overdue] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE status = "assigned" AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)');
    res.json(Response.success({
      totalOrders: totalOrders[0].total,
      todayOrders: todayOrders[0].total,
      todayFee: todayFee[0].total,
      onlineTechs: onlineTechs[0].total,
      pendingCount: pendingCount[0].total,
      processingCount: processingCount[0].total,
      overdueCount: overdue[0].total,
      recentOrders
    }));
  } catch (err) { next(err); }
});

// ========== 订单管理 ==========
router.get('/orders', auth(['admin']), async (req, res, next) => {
  try {
    const { status, region, source, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let query = 'SELECT * FROM orders WHERE is_deleted = 0';
    const params = [];
    if (status) { query += ' AND status = ?'; params.push(status); }
    if (region) { query += ' AND region_matched = ?'; params.push(region); }
    if (source) { query += ' AND source = ?'; params.push(source); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const [rows] = await pool.execute(query, params);
    const [count] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE is_deleted = 0');
    res.json(Response.success({ list: rows, total: count[0].total, page: parseInt(page), page_size: parseInt(page_size) }));
  } catch (err) { next(err); }
});

// 强制转派
router.put('/orders/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { technician_id } = req.body;
    const [orders] = await pool.execute('SELECT * FROM orders WHERE id = ?', [req.params.id]);
    if (orders.length === 0) return res.json(Response.notFound('订单不存在'));
    await pool.execute('UPDATE orders SET technician_id = ?, status = "assigned" WHERE id = ?', [technician_id, req.params.id]);
    await pool.execute('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "强制转派", ?, ?)', [orders[0].order_no, `管理员强制转派给师傅ID: ${technician_id}`, req.user.username]);
    res.json(Response.success(null, '转派成功'));
  } catch (err) { next(err); }
});

// 回收站
router.get('/orders/trash', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM orders WHERE is_deleted = 1 ORDER BY updated_at DESC');
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 恢复订单
router.post('/orders/trash/restore', auth(['admin']), async (req, res, next) => {
  try {
    const { ids } = req.body;
    await pool.execute(`UPDATE orders SET is_deleted = 0 WHERE id IN (${ids.join(',')})`);
    res.json(Response.success(null, '恢复成功'));
  } catch (err) { next(err); }
});

// 彻底删除
router.delete('/orders/trash', auth(['admin']), async (req, res, next) => {
  try {
    const { ids } = req.body;
    await pool.execute(`DELETE FROM orders WHERE id IN (${ids.join(',')})`);
    res.json(Response.success(null, '删除成功'));
  } catch (err) { next(err); }
});

// ========== 师傅管理 ==========
router.get('/technicians', auth(['admin']), async (req, res, next) => {
  try {
    const { region, status, page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let query = 'SELECT * FROM technicians WHERE 1=1';
    const params = [];
    if (region) { query += ' AND region = ?'; params.push(region); }
    if (status !== undefined) { query += ' AND status = ?'; params.push(status); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const [rows] = await pool.execute(query, params);
    const [count] = await pool.execute('SELECT COUNT(*) as total FROM technicians');
    res.json(Response.success({ list: rows, total: count[0].total, page: parseInt(page), page_size: parseInt(page_size) }));
  } catch (err) { next(err); }
});

router.post('/technicians', auth(['admin']), async (req, res, next) => {
  try {
    const { name, phone, password, region } = req.body;
    await pool.execute('INSERT INTO technicians (name, phone, password, region) VALUES (?, ?, ?, ?)', [name, phone, password, region]);
    res.json(Response.success(null, '添加成功'));
  } catch (err) { next(err); }
});

router.put('/technicians/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { name, phone, region, status, balance, credit_score } = req.body;
    await pool.execute(
      'UPDATE technicians SET name = COALESCE(?, name), phone = COALESCE(?, phone), region = COALESCE(?, region), status = COALESCE(?, status), balance = COALESCE(?, balance), credit_score = COALESCE(?, credit_score) WHERE id = ?',
      [name, phone, region, status, balance, credit_score, req.params.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// 师傅详情
router.get('/technicians/:id', auth(['admin']), async (req, res, next) => {
  try {
    const [techs] = await pool.execute('SELECT * FROM technicians WHERE id = ?', [req.params.id]);
    if (techs.length === 0) return res.json(Response.notFound('师傅不存在'));
    const [orders] = await pool.execute('SELECT * FROM orders WHERE technician_id = ? ORDER BY created_at DESC LIMIT 20', [req.params.id]);
    const [transactions] = await pool.execute('SELECT * FROM technician_transactions WHERE technician_id = ? ORDER BY created_at DESC LIMIT 20', [req.params.id]);
    const [complaints] = await pool.execute('SELECT * FROM technician_complaints WHERE technician_id = ? ORDER BY created_at DESC', [req.params.id]);
    res.json(Response.success({ ...techs[0], orders, transactions, complaints }));
  } catch (err) { next(err); }
});

// ========== 商家管理 ==========
router.get('/merchants', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM merchants ORDER BY created_at DESC');
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

router.post('/merchants', auth(['admin']), async (req, res, next) => {
  try {
    const { name, contact, phone, password, referral_rate } = req.body;
    await pool.execute('INSERT INTO merchants (name, contact, phone, password, referral_rate) VALUES (?, ?, ?, ?, ?)', [name, contact, phone, password, referral_rate || 3]);
    res.json(Response.success(null, '添加成功'));
  } catch (err) { next(err); }
});

router.put('/merchants/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { name, contact, phone, referral_rate, status } = req.body;
    await pool.execute(
      'UPDATE merchants SET name = COALESCE(?, name), contact = COALESCE(?, contact), phone = COALESCE(?, phone), referral_rate = COALESCE(?, referral_rate), status = COALESCE(?, status) WHERE id = ?',
      [name, contact, phone, referral_rate, status, req.params.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// 商家提现审核
router.post('/merchants/withdraw/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { status } = req.body;
    const [withdraws] = await pool.execute('SELECT * FROM merchant_withdrawals WHERE id = ?', [req.params.id]);
    if (withdraws.length === 0) return res.json(Response.notFound('提现申请不存在'));
    if (status === 'approved') {
      await pool.execute('UPDATE merchants SET balance = balance - ? WHERE id = ?', [withdraws[0].amount, withdraws[0].merchant_id]);
      await pool.execute('UPDATE merchant_transactions SET status = "settled" WHERE merchant_id = ? AND status = "pending"', [withdraws[0].merchant_id]);
    }
    await pool.execute('UPDATE merchant_withdrawals SET status = ? WHERE id = ?', [status, req.params.id]);
    res.json(Response.success(null, status === 'approved' ? '已审核通过' : '已驳回'));
  } catch (err) { next(err); }
});

// ========== 服务管理 ==========
router.get('/services', auth(['admin']), async (req, res, next) => {
  try {
    const [categories] = await pool.execute('SELECT * FROM service_categories ORDER BY sort_order');
    const [items] = await pool.execute('SELECT * FROM service_items ORDER BY sort_score DESC');
    res.json(Response.success({ categories, items }));
  } catch (err) { next(err); }
});

router.post('/services', auth(['admin']), async (req, res, next) => {
  try {
    const { category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score } = req.body;
    const [result] = await pool.execute(
      'INSERT INTO service_items (category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
      [category_id, name, price_min || 0, price_max || 0, duration || 60, platform_rate || 10, technician_rate || 5, merchant_rate || 3, sort_score || 0]);
    res.json(Response.success({ id: result.insertId }, '添加成功'));
  } catch (err) { next(err); }
});

router.put('/services/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score, status } = req.body;
    await pool.execute(
      'UPDATE service_items SET name = COALESCE(?, name), price_min = COALESCE(?, price_min), price_max = COALESCE(?, price_max), duration = COALESCE(?, duration), platform_rate = COALESCE(?, platform_rate), technician_rate = COALESCE(?, technician_rate), merchant_rate = COALESCE(?, merchant_rate), sort_score = COALESCE(?, sort_score), status = COALESCE(?, status) WHERE id = ?',
      [name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score, status, req.params.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// ========== 公告管理 ==========
router.get('/announcements', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM announcements ORDER BY created_at DESC');
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

router.post('/announcements', auth(['admin']), async (req, res, next) => {
  try {
    const { title, content, target, is_pinned, publish_at } = req.body;
    await pool.execute(
      'INSERT INTO announcements (title, content, target, is_pinned, publish_at) VALUES (?, ?, ?, ?, ?)',
      [title, content, target || 'all', is_pinned || 0, publish_at || null]);
    res.json(Response.success(null, '发布成功'));
  } catch (err) { next(err); }
});

router.put('/announcements/:id', auth(['admin']), async (req, res, next) => {
  try {
    const { title, content, target, is_pinned, status } = req.body;
    await pool.execute(
      'UPDATE announcements SET title = COALESCE(?, title), content = COALESCE(?, content), target = COALESCE(?, target), is_pinned = COALESCE(?, is_pinned), status = COALESCE(?, status) WHERE id = ?',
      [title, content, target, is_pinned, status, req.params.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// 公告已读回执
router.get('/announcements/:id/reads', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute(
      'SELECT ar.*, t.name as technician_name, u.nickname as user_name FROM announcement_reads ar LEFT JOIN technicians t ON ar.technician_id = t.id LEFT JOIN users u ON ar.user_id = u.id WHERE ar.announcement_id = ?',
      [req.params.id]);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// ========== 系统设置 ==========
router.get('/system/settings', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM site_config');
    const settings = {};
    rows.forEach(r => settings[r.config_key] = r.config_value);
    res.json(Response.success(settings));
  } catch (err) { next(err); }
});

router.put('/system/settings', auth(['admin']), async (req, res, next) => {
  try {
    const settings = req.body;
    for (const [key, value] of Object.entries(settings)) {
      await pool.execute('INSERT INTO site_config (config_key, config_value) VALUES (?, ?) ON DUPLICATE KEY UPDATE config_value = ?', [key, String(value), String(value)]);
    }
    res.json(Response.success(null, '保存成功'));
  } catch (err) { next(err); }
});

// ========== 数据备份 ==========
router.post('/system/backup', auth(['admin']), async (req, res, next) => {
  try {
    const filename = `jialejia_backup_${new Date().toISOString().slice(0, 10)}.sql`;
    await pool.execute('INSERT INTO data_backups (filename, size, created_by) VALUES (?, 0, ?)', [filename, req.user.username]);
    res.json(Response.success(null, '备份任务已创建'));
  } catch (err) { next(err); }
});

router.get('/system/backups', auth(['admin']), async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM data_backups WHERE is_deleted = 0 ORDER BY backup_time DESC');
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// ========== 操作日志 ==========
router.get('/system/logs', auth(['admin']), async (req, res, next) => {
  try {
    const { action, operator_id, page = 1, page_size = 50 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    let query = 'SELECT * FROM system_logs WHERE 1=1';
    const params = [];
    if (action) { query += ' AND action = ?'; params.push(action); }
    if (operator_id) { query += ' AND operator_id = ?'; params.push(operator_id); }
    query += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
    params.push(parseInt(page_size), offset);
    const [rows] = await pool.execute(query, params);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// ========== 数据大屏数据 ==========
router.get('/dashboard/realtime', auth(['admin']), async (req, res, next) => {
  try {
    const [todayOrders] = await pool.execute('SELECT COUNT(*) as total, COALESCE(SUM(platform_fee), 0) as fee FROM orders WHERE DATE(created_at) = CURDATE()');
    const [onlineTechs] = await pool.execute('SELECT COUNT(*) as total FROM technicians WHERE busy = 0 AND status = 1');
    const [processing] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE status IN ("assigned","processing")');
    const [overdue] = await pool.execute('SELECT COUNT(*) as total FROM orders WHERE status = "assigned" AND created_at < DATE_SUB(NOW(), INTERVAL 3 DAY)');
    const [pendingComplaints] = await pool.execute('SELECT COUNT(*) as total FROM technician_complaints WHERE status = "pending"');
    const [categoryStats] = await pool.execute('SELECT s.name, COUNT(*) as count FROM orders o JOIN service_items si ON o.service_item_id = si.id JOIN service_categories s ON si.category_id = s.id WHERE o.status = "completed" GROUP BY s.name');
    const [topTechnicians] = await pool.execute('SELECT t.id, t.name, t.avatar, COUNT(*) as order_count FROM orders o JOIN technicians t ON o.technician_id = t.id WHERE o.status = "completed" AND DATE(o.completed_at) = CURDATE() GROUP BY t.id ORDER BY order_count DESC LIMIT 10');
    const [regionStats] = await pool.execute('SELECT region_matched, COUNT(*) as count FROM orders WHERE DATE(created_at) = CURDATE() AND region_matched IS NOT NULL GROUP BY region_matched');
    res.json(Response.success({
      todayOrders: todayOrders[0],
      onlineTechs: onlineTechs[0].total,
      processingCount: processing[0].total,
      overdueCount: overdue[0].total,
      pendingComplaints: pendingComplaints[0].total,
      categoryStats,
      topTechnicians,
      regionStats
    }));
  } catch (err) { next(err); }
});

module.exports = router;