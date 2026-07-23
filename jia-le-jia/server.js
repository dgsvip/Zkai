const express = require('express');
const cors = require('cors');
const path = require('path');
const multer = require('multer');
const { getDb } = require('./db_wrapper');
const { initDatabase } = require('./database');
const rateLimit = require('express-rate-limit');
const http = require('http');
const { WebSocketServer } = require('ws');
const fs = require('fs');

const app = express();
const PORT = 3000;

// 中间件
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// 上传配置
const storage = multer.memoryStorage();
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// 限流
const limiter = rateLimit({ windowMs: 60 * 1000, max: 60, message: { error: '请求过于频繁，请稍后再试' } });
app.use('/api', limiter);

// 工具函数
function generateOrderNo() {
  const now = new Date();
  const y = String(now.getFullYear()).slice(2);
  const m = String(now.getMonth() + 1).padStart(2, '0');
  const d = String(now.getDate()).padStart(2, '0');
  const rand = String(Math.floor(1000 + Math.random() * 9000));
  return `FW${y}${m}${d}${rand}`;
}

function generateVerifyCode() {
  return String(Math.floor(1000 + Math.random() * 9000));
}

function matchArea(address) {
  const areas = ['磐石街道', '曹城街道', '青菏街道', '郑庄街道', '倪集街道', '庄寨镇', '普连集镇', '古营集镇', '侯集镇', '苏集镇', '孙老家镇', '阎店楼镇', '梁堤头镇', '安蔡楼镇', '大集镇', '王集镇', '楼庄镇', '韩集镇', '砖庙镇', '常乐集镇', '魏湾镇', '仵楼镇', '邵庄镇', '朱洪庙镇'];
  for (const a of areas) {
    if (address.includes(a)) return a;
  }
  return '';
}

function sanitize(str) {
  if (!str) return '';
  return str.replace(/[<>&"'\/]/g, c => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', '"': '&quot;', "'": '&#x27;', '/': '&#x2f;' }[c] || c));
}

function filterSensitive(str) {
  const words = ['fuck', 'shit', '傻逼', '操你妈', '草泥马'];
  let s = str || '';
  for (const w of words) {
    s = s.replace(new RegExp(w, 'gi'), '***');
  }
  return s;
}

function addLog(db, orderId, action, content, operator = 'system') {
  db.run('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)', [orderId, action, content, operator]);
}

// ─── API 路由 ───

// 获取服务分类
app.get('/api/categories', async (req, res) => {
  const db = await getDb();
  const cats = db.all('SELECT * FROM service_categories WHERE status=? ORDER BY sort_order', ['active']);
  res.json({ code: 0, data: cats });
});

// 获取服务项目
app.get('/api/service-items', async (req, res) => {
  const db = await getDb();
  const { category_id } = req.query;
  let items;
  if (category_id) {
    items = db.all('SELECT si.*, sc.name as category_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id WHERE si.category_id=? AND si.status=? ORDER BY si.sort_order', [category_id, 'active']);
  } else {
    items = db.all('SELECT si.*, sc.name as category_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id WHERE si.status=? ORDER BY si.sort_order', ['active']);
  }
  res.json({ code: 0, data: items });
});

// 获取站点配置
app.get('/api/config/:key', async (req, res) => {
  const db = await getDb();
  const row = db.get('SELECT config_value FROM site_config WHERE config_key=?', [req.params.key]);
  res.json({ code: 0, data: row ? row.config_value : '' });
});

// 获取公告列表
app.get('/api/announcements', async (req, res) => {
  const db = await getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const list = db.all('SELECT * FROM announcements WHERE is_published=1 ORDER BY is_pinned DESC, publish_time DESC LIMIT ? OFFSET ?', [limit, offset]);
  const total = db.get('SELECT COUNT(*) as c FROM announcements WHERE is_published=1');
  res.json({ code: 0, data: { list, total: total.c, page, limit } });
});

// 获取单个公告
app.get('/api/announcements/:id', async (req, res) => {
  const db = await getDb();
  const item = db.get('SELECT * FROM announcements WHERE id=?', [req.params.id]);
  res.json({ code: 0, data: item });
});

// 获取协议内容
app.get('/api/agreements', async (req, res) => {
  const db = await getDb();
  const booking = db.get("SELECT config_value FROM site_config WHERE config_key='agreement_booking'");
  const platform = db.get("SELECT config_value FROM site_config WHERE config_key='agreement_platform'");
  const bookingVer = db.get("SELECT config_value FROM site_config WHERE config_key='agreement_booking_version'");
  const platformVer = db.get("SELECT config_value FROM site_config WHERE config_key='agreement_platform_version'");
  res.json({ code: 0, data: {
    booking: booking?.config_value || '',
    platform: platform?.config_value || '',
    booking_version: bookingVer?.config_value || '',
    platform_version: platformVer?.config_value || ''
  }});
});

// 发送验证码
app.post('/api/send-code', async (req, res) => {
  const db = await getDb();
  const { phone, type } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json({ code: 1, msg: '请输入有效的手机号' });

  const recent = db.get("SELECT * FROM verification_codes WHERE phone=? AND type=? AND created_at > datetime('now','-60 seconds')", [phone, type || 'login']);
  if (recent) return res.json({ code: 1, msg: '请60秒后再试' });

  const code = generateVerifyCode();
  const expiresAt = new Date(Date.now() + 5 * 60 * 1000).toISOString();
  db.run('INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?,?,?,?)', [phone, code, type || 'login', expiresAt]);

  res.json({ code: 0, data: { code }, msg: '验证码已发送（开发模式：直接显示验证码）' });
});

// 验证验证码
app.post('/api/verify-code', async (req, res) => {
  const db = await getDb();
  const { phone, code, type } = req.body;
  if (!phone || !code) return res.json({ code: 1, msg: '参数不完整' });

  const record = db.get("SELECT * FROM verification_codes WHERE phone=? AND code=? AND type=? AND used=0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1", [phone, code, type || 'login']);
  if (!record) return res.json({ code: 1, msg: '验证码错误或已过期' });

  db.run('UPDATE verification_codes SET used=1 WHERE id=?', [record.id]);

  let user = db.get('SELECT * FROM users WHERE phone=?', [phone]);
  if (!user) {
    const info = db.run('INSERT INTO users (phone, nickname) VALUES (?,?)', [phone, phone.slice(-4)]);
    user = { id: info.lastInsertRowid, phone };
  }

  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.run('INSERT INTO user_sessions (user_type, user_id, token, phone, expires_at) VALUES (?,?,?,?,?)', ['user', user.id, token, phone, expiresAt]);

  res.json({ code: 0, data: { token, user: { id: user.id, phone, nickname: user.nickname || '' } } });
});

// 创建订单
app.post('/api/orders', async (req, res) => {
  const db = await getDb();
  const { user_name, user_phone, user_remark, service_item_id, area, address, booking_date, booking_time, agreed } = req.body;

  if (!user_name || user_name.length < 2 || user_name.length > 20) return res.json({ code: 1, msg: '姓名需2-20个字符' });
  if (!user_phone || !/^1\d{10}$/.test(user_phone)) return res.json({ code: 1, msg: '请输入有效的手机号' });
  if (!agreed) return res.json({ code: 1, msg: '请同意服务协议' });

  // 防刷检查
  const cancelThreshold = parseInt(db.get("SELECT config_value FROM site_config WHERE config_key='anti_fraud_cancel_threshold'")?.config_value || '3');
  const cancelLimitHours = parseInt(db.get("SELECT config_value FROM site_config WHERE config_key='anti_fraud_cancel_limit_hours'")?.config_value || '24');
  const maxPerHour = parseInt(db.get("SELECT config_value FROM site_config WHERE config_key='anti_fraud_max_orders_per_hour'")?.config_value || '5');
  const maxPerDay = parseInt(db.get("SELECT config_value FROM site_config WHERE config_key='anti_fraud_max_orders_per_day'")?.config_value || '20');

  const recentCancels = db.get("SELECT COUNT(*) as c FROM orders WHERE user_phone=? AND status='cancelled' AND created_at > datetime('now', ? || ' hours')", [user_phone, `-${cancelLimitHours}`]);
  if (recentCancels.c >= cancelThreshold) {
    return res.json({ code: 1, msg: `您在${cancelLimitHours}小时内取消订单已达${cancelThreshold}次，暂无法下单` });
  }

  const hourCount = db.get("SELECT COUNT(*) as c FROM orders WHERE user_phone=? AND created_at > datetime('now', '-1 hour')", [user_phone]);
  if (hourCount.c >= maxPerHour) return res.json({ code: 1, msg: '下单过于频繁，请稍后再试' });

  const dayCount = db.get("SELECT COUNT(*) as c FROM orders WHERE user_phone=? AND created_at > datetime('now', '-1 day')", [user_phone]);
  if (dayCount.c >= maxPerDay) return res.json({ code: 1, msg: '今日下单已达上限' });

  let serviceName = '', servicePrice = 0, categoryName = '';
  if (service_item_id) {
    const item = db.get('SELECT si.*, sc.name as cat_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id WHERE si.id=?', [service_item_id]);
    if (item) { serviceName = item.name; servicePrice = item.price; categoryName = item.cat_name; }
  }

  const matchedArea = area || matchArea(address || '');
  const orderNo = generateOrderNo();
  const verifyCode = generateVerifyCode();

  const orderId = db.run(`INSERT INTO orders (order_no, user_phone, user_name, user_remark, service_item_id, service_name, service_price, category_name, area, address, booking_date, booking_time, verify_code, status, source) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderNo, user_phone, sanitize(user_name), filterSensitive(sanitize(user_remark || '')),
     service_item_id || null, serviceName, servicePrice, categoryName, matchedArea, sanitize(address || ''),
     booking_date, booking_time, verifyCode, 'pending', 'user']);

  addLog(db, orderId.lastInsertRowid, 'create', `用户下单：${serviceName}`, user_name);
  if (matchedArea) {
    addLog(db, orderId.lastInsertRowid, 'match_area', `系统匹配区域：${matchedArea}`);
  } else {
    addLog(db, orderId.lastInsertRowid, 'match_area', '地址未匹配到区域，直接进入抢单池');
  }
  if (user_remark) {
    db.run('INSERT INTO order_remarks (order_id, remark_type, content, created_by) VALUES (?,?,?,?)', [orderId.lastInsertRowid, 'user', filterSensitive(sanitize(user_remark)), user_name]);
  }

  res.json({ code: 0, data: { order_no: orderNo, verify_code: verifyCode, id: orderId.lastInsertRowid }, msg: '下单成功！' });
});

// 获取订单列表（按手机号）
app.get('/api/orders', async (req, res) => {
  const db = await getDb();
  const { phone, status, page, limit: pageSize } = req.query;
  if (!phone) return res.json({ code: 1, msg: '参数不完整' });

  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE o.user_phone=? AND o.is_deleted=0';
  const params = [phone];
  if (status && status !== 'all') { where += ' AND o.status=?'; params.push(status); }

  const list = db.all(`SELECT o.*, t.name as technician_name, t.phone as technician_phone FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o ${where}`, params);

  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim } });
});

// 获取单个订单详情
app.get('/api/orders/:id', async (req, res) => {
  const db = await getDb();
  const order = db.get('SELECT o.*, t.name as technician_name, t.phone as technician_phone, t.rating_avg, t.total_ratings FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id WHERE o.id=? AND o.is_deleted=0', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });

  const logs = db.all('SELECT * FROM order_logs WHERE order_id=? ORDER BY created_at ASC', [req.params.id]);
  const remarks = db.all('SELECT * FROM order_remarks WHERE order_id=? ORDER BY created_at ASC', [req.params.id]);
  const evaluation = db.get('SELECT * FROM order_evaluations WHERE order_id=?', [req.params.id]);

  res.json({ code: 0, data: { ...order, logs, remarks, evaluation } });
});

// 提交评价
app.post('/api/orders/:id/evaluate', async (req, res) => {
  const db = await getDb();
  const { rating_attitude, rating_skill, rating_punctuality, comment } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'completed') return res.json({ code: 1, msg: '仅已完成订单可评价' });

  const existing = db.get('SELECT * FROM order_evaluations WHERE order_id=?', [req.params.id]);
  if (existing) return res.json({ code: 1, msg: '已评价过' });

  const att = Math.min(5, Math.max(1, parseInt(rating_attitude) || 5));
  const sk = Math.min(5, Math.max(1, parseInt(rating_skill) || 5));
  const pu = Math.min(5, Math.max(1, parseInt(rating_punctuality) || 5));
  const cleanComment = filterSensitive(sanitize(comment || ''));

  db.run('INSERT INTO order_evaluations (order_id, user_id, technician_id, rating_attitude, rating_skill, rating_punctuality, comment) VALUES (?,?,?,?,?,?,?)',
    [req.params.id, null, order.technician_id, att, sk, pu, cleanComment]);

  if (order.technician_id) {
    const stats = db.get('SELECT AVG((rating_attitude+rating_skill+rating_punctuality)/3.0) as avg, COUNT(*) as cnt FROM order_evaluations WHERE technician_id=?', [order.technician_id]);
    db.run('UPDATE technicians SET rating_avg=?, total_ratings=? WHERE id=?', [Number(stats.avg).toFixed(1), stats.cnt, order.technician_id]);

    const avgRating = (att + sk + pu) / 3;
    if (avgRating >= 4) {
      db.run('UPDATE technicians SET credit_score=credit_score+1 WHERE id=?', [order.technician_id]);
    } else if (avgRating <= 2) {
      db.run('UPDATE technicians SET credit_score=credit_score-2 WHERE id=?', [order.technician_id]);
    }
  }

  addLog(db, req.params.id, 'evaluate', `用户评价：态度${att}星/技术${sk}星/准时${pu}星`, order.user_name);
  res.json({ code: 0, msg: '评价成功' });
});

// 用户取消订单
app.post('/api/orders/:id/cancel', async (req, res) => {
  const db = await getDb();
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'pending') return res.json({ code: 1, msg: '当前状态不可取消' });

  const cancelFee = parseFloat(db.get("SELECT config_value FROM site_config WHERE config_key='cancel_fee'")?.config_value || '5');

  if (order.technician_id) {
    const acceptedLog = db.get("SELECT * FROM order_logs WHERE order_id=? AND action='accept' ORDER BY id DESC LIMIT 1", [req.params.id]);
    if (acceptedLog) {
      const acceptTime = new Date(acceptedLog.created_at).getTime();
      const now = Date.now();
      const diffMin = (now - acceptTime) / (1000 * 60);
      if (diffMin > 15) {
        return res.json({ code: 1, msg: '师傅接单已超过15分钟，不可取消，请联系客服' });
      }
      db.run('UPDATE orders SET status=?, cancel_type=?, cancel_reason=? WHERE id=?', ['cancelled', 'user_fee', `用户取消（接单后${Math.round(diffMin)}分钟，爽约金¥${cancelFee}）`, req.params.id]);
    }
  } else {
    db.run('UPDATE orders SET status=?, cancel_type=?, cancel_reason=? WHERE id=?', ['cancelled', 'user_free', '用户无责取消', req.params.id]);
  }

  if (order.technician_id) {
    db.run('UPDATE technicians SET is_busy=0 WHERE id=?', [order.technician_id]);
  }

  addLog(db, req.params.id, 'cancel', '用户取消订单', order.user_name);
  res.json({ code: 0, msg: '订单已取消' });
});

// 用户确认增项
app.post('/api/orders/:id/confirm-additional', async (req, res) => {
  const db = await getDb();
  const { confirm } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [req.params.id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });

  if (confirm) {
    const newPrice = order.service_price + (order.additional_amount || 0);
    db.run('UPDATE orders SET additional_status=?, service_price=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', ['confirmed', newPrice, req.params.id]);
    addLog(db, req.params.id, 'additional_confirm', `用户确认增项：${order.additional_desc}，金额${order.additional_amount}元，新总价${newPrice}元`, 'user');
    res.json({ code: 0, msg: '已确认增项' });
  } else {
    db.run('UPDATE orders SET additional_status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', ['rejected', req.params.id]);
    addLog(db, req.params.id, 'additional_reject', `用户拒绝增项：${order.additional_desc}`, 'user');
    res.json({ code: 0, msg: '已拒绝增项' });
  }
});

// ─── 师傅端 API ───

// 师傅登录
app.post('/api/technician/login', async (req, res) => {
  const db = await getDb();
  const { phone, password } = req.body;
  const tech = db.get('SELECT * FROM technicians WHERE phone=?', [phone]);
  if (!tech || tech.password !== password) return res.json({ code: 1, msg: '账号或密码错误' });
  if (tech.status !== 'active') return res.json({ code: 1, msg: '账号已被禁用' });

  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.run('INSERT INTO user_sessions (user_type, user_id, token, phone, expires_at) VALUES (?,?,?,?,?)', ['technician', tech.id, token, phone, expiresAt]);
  db.run('INSERT INTO technician_logs (technician_id, action, detail) VALUES (?,?,?)', [tech.id, 'login', '师傅登录']);

  res.json({ code: 0, data: { token, user: tech } });
});

// 获取师傅工单列表
app.get('/api/technician/orders', async (req, res) => {
  const db = await getDb();
  const { tech_id, tab, page, limit: pageSize } = req.query;
  if (!tech_id) return res.json({ code: 1, msg: '参数不完整' });

  const tech = db.get('SELECT * FROM technicians WHERE id=?', [tech_id]);
  if (!tech) return res.json({ code: 1, msg: '师傅不存在' });

  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE o.is_deleted=0';
  const params = [];

  if (tab === 'area') { where += ' AND o.area=? AND o.status=?'; params.push(tech.area, 'pending'); }
  else if (tab === 'pool') { where += ' AND o.status=?'; params.push('pending'); }
  else if (tab === 'transfer') { where += ' AND o.status=?'; params.push('transferring'); }
  else { where += ' AND (o.status=? OR o.status=?)'; params.push('pending', 'in_progress'); }

  const list = db.all(`SELECT o.*, t.name as technician_name, t.phone as technician_phone FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o ${where}`, params);

  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim, tech_area: tech.area } });
});

// 师傅接单
app.post('/api/technician/accept', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [order_id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'pending') return res.json({ code: 1, msg: '订单已被其他人接走' });

  const tech = db.get('SELECT * FROM technicians WHERE id=?', [tech_id]);
  if (!tech) return res.json({ code: 1, msg: '师傅不存在' });
  if (tech.is_busy) return res.json({ code: 1, msg: '您当前有进行中的订单' });

  db.run('UPDATE orders SET technician_id=?, status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [tech_id, 'in_progress', order_id]);
  db.run('UPDATE technicians SET is_busy=1 WHERE id=?', [tech_id]);
  addLog(db, order_id, 'accept', `师傅 ${tech.name} 接单`, tech.name);

  res.json({ code: 0, msg: '接单成功' });
});

// 师傅完工
app.post('/api/technician/complete', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id, actual_amount, warranty_months } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [order_id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });
  if (order.status !== 'in_progress') return res.json({ code: 1, msg: '当前状态不可完工' });

  const amount = parseFloat(actual_amount) || order.service_price;
  const warranty = parseInt(warranty_months) || 0;
  const platformRate = parseFloat(db.get("SELECT config_value FROM site_config WHERE config_key='platform_rate'")?.config_value || '10');
  const platformFee = Math.round(amount * platformRate / 100 * 100) / 100;
  const technicianFee = amount - platformFee;

  db.run('UPDATE orders SET status=?, actual_amount=?, warranty_months=?, platform_fee=?, technician_fee=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?',
    ['completed', amount, warranty, platformFee, technicianFee, order_id]);
  db.run('UPDATE technicians SET is_busy=0 WHERE id=?', [tech_id]);

  if (platformFee > 0) {
    const tech = db.get('SELECT * FROM technicians WHERE id=?', [tech_id]);
    db.run('UPDATE technicians SET balance=balance-? WHERE id=?', [platformFee, tech_id]);
    db.run('INSERT INTO technician_transactions (technician_id, order_id, type, amount, balance_before, balance_after, description) VALUES (?,?,?,?,?,?,?)',
      [tech_id, order_id, 'fee', -platformFee, tech.balance, tech.balance - platformFee, `平台抽成 ${platformFee}元`]);
  }

  addLog(db, order_id, 'complete', `师傅完工：实收${amount}元，质保${warranty}个月`, `师傅${tech_id}`);
  res.json({ code: 0, msg: '完工确认成功' });
});

// 师傅转派
app.post('/api/technician/transfer', async (req, res) => {
  const db = await getDb();
  const { order_id, from_tech_id, to_tech_id, remark } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [order_id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });

  const target = db.get('SELECT * FROM technicians WHERE id=?', [to_tech_id]);
  if (!target) return res.json({ code: 1, msg: '目标师傅不存在' });

  db.run('UPDATE orders SET technician_id=?, status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [to_tech_id, 'in_progress', order_id]);
  db.run('UPDATE technicians SET is_busy=0 WHERE id=?', [from_tech_id]);
  db.run('UPDATE technicians SET is_busy=1 WHERE id=?', [to_tech_id]);

  if (remark) {
    db.run('INSERT INTO order_remarks (order_id, remark_type, content, created_by) VALUES (?,?,?,?)', [order_id, 'transfer', sanitize(remark), `师傅${from_tech_id}`]);
  }
  addLog(db, order_id, 'transfer', `转派：师傅${from_tech_id} → 师傅${to_tech_id}${remark ? '，备注：' + remark : ''}`, `师傅${from_tech_id}`);
  res.json({ code: 0, msg: '转派成功' });
});

// 师傅取消订单
app.post('/api/technician/cancel', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id, reason, remark } = req.body;
  const order = db.get('SELECT * FROM orders WHERE id=? AND is_deleted=0', [order_id]);
  if (!order) return res.json({ code: 1, msg: '订单不存在' });

  const acceptedLog = db.get("SELECT * FROM order_logs WHERE order_id=? AND action='accept' ORDER BY id DESC LIMIT 1", [order_id]);
  let penalty = 2, banHours = 0;
  if (acceptedLog) {
    const diffMin = (Date.now() - new Date(acceptedLog.created_at).getTime()) / (1000 * 60);
    if (diffMin > 30) { penalty = 10; banHours = 24; }
    else if (diffMin > 5) { penalty = 5; banHours = 4; }
  }

  db.run('UPDATE orders SET status=?, cancel_reason=?, cancel_type=?, cancel_remark=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?',
    ['cancelled', reason || '师傅取消', 'technician', remark || '', order_id]);
  db.run('UPDATE technicians SET is_busy=0, credit_score=credit_score-? WHERE id=?', [penalty, tech_id]);

  const tech = db.get('SELECT * FROM technicians WHERE id=?', [tech_id]);
  db.run('INSERT INTO credit_change_records (technician_id, order_id, change_value, reason, balance_before, balance_after) VALUES (?,?,?,?,?,?)',
    [tech_id, order_id, -penalty, `取消订单扣分（${reason}）`, tech.credit_score + penalty, tech.credit_score]);

  let cancelContent = `师傅取消订单：${reason}`;
  if (remark) cancelContent += `（${remark}）`;
  if (banHours > 0) cancelContent += `，限制抢单${banHours}小时`;
  addLog(db, order_id, 'cancel', cancelContent, `师傅${tech_id}`);

  if (remark) {
    db.run('INSERT INTO order_remarks (order_id, remark_type, content, created_by) VALUES (?,?,?,?)', [order_id, 'cancel', sanitize(remark), `师傅${tech_id}`]);
  }

  res.json({ code: 0, msg: `已取消，信用分扣除${penalty}分${banHours > 0 ? `，限制抢单${banHours}小时` : ''}` });
});

// 现场状态上报
app.post('/api/technician/onsite', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id, status, content } = req.body;
  db.run('INSERT INTO onsite_logs (order_id, technician_id, status, content) VALUES (?,?,?,?)', [order_id, tech_id, status, content || '']);
  db.run('UPDATE orders SET onsite_status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [status, order_id]);
  addLog(db, order_id, 'onsite', `现场状态：${status}${content ? ' - ' + content : ''}`, `师傅${tech_id}`);
  res.json({ code: 0, msg: '上报成功' });
});

// 增项申请
app.post('/api/technician/additional', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id, desc, amount } = req.body;
  db.run('UPDATE orders SET additional_desc=?, additional_amount=?, additional_status=?, updated_at=datetime(\'now\',\'localtime\') WHERE id=?', [desc, amount, 'pending', order_id]);
  addLog(db, order_id, 'additional_request', `增项申请：${desc}，金额：${amount}元`, `师傅${tech_id}`);
  res.json({ code: 0, msg: '增项申请已提交，等待用户确认' });
});

// 师傅上传完工照片
app.post('/api/technician/upload-photos', upload.array('photos', 9), async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id } = req.body;
  if (!req.files || req.files.length === 0) return res.json({ code: 1, msg: '请上传照片' });

  const urls = [];
  const uploadDir = path.join(__dirname, 'uploads', 'photos');
  if (!fs.existsSync(uploadDir)) fs.mkdirSync(uploadDir, { recursive: true });

  for (const file of req.files) {
    const filename = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}.jpg`;
    const filepath = path.join(uploadDir, filename);
    try {
      const sharp = require('sharp');
      await sharp(file.buffer).resize(800, undefined, { fit: 'inside' }).jpeg({ quality: 80 }).toFile(filepath);
      const url = `/uploads/photos/${filename}`;
      urls.push(url);
      db.run('INSERT INTO technician_gallery (technician_id, order_id, image_url) VALUES (?,?,?)', [tech_id, order_id, url]);
    } catch (e) {
      // fallback: save raw buffer
      fs.writeFileSync(filepath, file.buffer);
      const url = `/uploads/photos/${filename}`;
      urls.push(url);
    }
  }

  if (urls.length > 0) {
    const existing = db.get('SELECT completion_photos FROM orders WHERE id=?', [order_id]);
    const photos = existing?.completion_photos ? JSON.parse(existing.completion_photos) : [];
    photos.push(...urls);
    db.run('UPDATE orders SET completion_photos=? WHERE id=?', [JSON.stringify(photos), order_id]);
  }

  res.json({ code: 0, data: { urls }, msg: `上传成功${urls.length}张` });
});

// 师傅信息
app.get('/api/technician/:id', async (req, res) => {
  const db = await getDb();
  const tech = db.get('SELECT * FROM technicians WHERE id=?', [req.params.id]);
  if (!tech) return res.json({ code: 1, msg: '师傅不存在' });
  res.json({ code: 0, data: tech });
});

// 师傅今日统计
app.get('/api/technician/:id/stats', async (req, res) => {
  const db = await getDb();
  const techId = req.params.id;
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE technician_id=? AND date(created_at)=?", [techId, today]);
  const todayCompleted = db.get("SELECT COUNT(*) as c FROM orders WHERE technician_id=? AND status='completed' AND date(created_at)=?", [techId, today]);
  const todayIncome = db.get("SELECT COALESCE(SUM(technician_fee),0) as s FROM orders WHERE technician_id=? AND status='completed' AND date(created_at)=?", [techId, today]);
  const tech = db.get('SELECT balance, credit_score, rating_avg, total_ratings FROM technicians WHERE id=?', [techId]);
  res.json({ code: 0, data: { ...tech, today_orders: todayOrders.c, today_completed: todayCompleted.c, today_income: todayIncome.s } });
});

// 师傅交易明细
app.get('/api/technician/:id/transactions', async (req, res) => {
  const db = await getDb();
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const list = db.all('SELECT * FROM technician_transactions WHERE technician_id=? ORDER BY created_at DESC LIMIT ? OFFSET ?', [req.params.id, limit, offset]);
  const total = db.get('SELECT COUNT(*) as c FROM technician_transactions WHERE technician_id=?', [req.params.id]);
  res.json({ code: 0, data: { list, total: total.c, page, limit } });
});

// 师傅图库
app.get('/api/technician/:id/gallery', async (req, res) => {
  const db = await getDb();
  const { type } = req.query;
  let items;
  if (type) items = db.all('SELECT * FROM technician_gallery WHERE technician_id=? AND service_type=? ORDER BY created_at DESC', [req.params.id, type]);
  else items = db.all('SELECT * FROM technician_gallery WHERE technician_id=? ORDER BY created_at DESC', [req.params.id]);
  res.json({ code: 0, data: items });
});

// 师傅信用分变动记录
app.get('/api/technician/:id/credit-records', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT * FROM credit_change_records WHERE technician_id=? ORDER BY created_at DESC', [req.params.id]);
  res.json({ code: 0, data: list });
});

// 师傅历史订单
app.get('/api/technician/:id/history', async (req, res) => {
  const db = await getDb();
  const { status, page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE o.technician_id=? AND o.is_deleted=0';
  const params = [req.params.id];
  if (status && status !== 'all') { where += ' AND o.status=?'; params.push(status); }
  const list = db.all(`SELECT o.*, t.name as technician_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o ${where}`, params);
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim } });
});

// 师傅收入明细
app.get('/api/technician/:id/income', async (req, res) => {
  const db = await getDb();
  const list = db.all("SELECT * FROM technician_transactions WHERE technician_id=? AND type='income' ORDER BY created_at DESC LIMIT 100", [req.params.id]);
  const totalIncome = db.get("SELECT COALESCE(SUM(amount),0) as s FROM technician_transactions WHERE technician_id=? AND type='income'", [req.params.id]);
  const monthIncome = db.get("SELECT COALESCE(SUM(amount),0) as s FROM technician_transactions WHERE technician_id=? AND type='income' AND strftime('%Y-%m', created_at)=strftime('%Y-%m', 'now')", [req.params.id]);
  res.json({ code: 0, data: { list, total: totalIncome.s, month: monthIncome.s } });
});

// 师傅争议申诉
app.post('/api/technician/dispute', async (req, res) => {
  const db = await getDb();
  const { order_id, tech_id, reason, evidence } = req.body;
  db.run('INSERT INTO disputes (order_id, technician_id, reason, evidence) VALUES (?,?,?,?)', [order_id, tech_id, reason, evidence || '']);
  addLog(db, order_id, 'dispute', `发起争议申诉：${reason}`, `师傅${tech_id}`);
  res.json({ code: 0, msg: '申诉已提交，等待审核' });
});

// 差评申诉
app.post('/api/technician/appeal-complaint', async (req, res) => {
  const db = await getDb();
  const { complaint_id, tech_id, reason, evidence } = req.body;
  db.run('UPDATE technician_complaints SET appeal_reason=?, appeal_evidence=?, appeal_status=? WHERE id=? AND technician_id=?',
    [reason, evidence || '', 'pending', complaint_id, tech_id]);
  res.json({ code: 0, msg: '差评申诉已提交' });
});

// 信用分申诉
app.post('/api/technician/appeal-credit', async (req, res) => {
  const db = await getDb();
  const { credit_change_id, tech_id, reason, evidence } = req.body;
  const record = db.get('SELECT * FROM credit_change_records WHERE id=?', [credit_change_id]);
  db.run('INSERT INTO credit_appeals (technician_id, order_id, credit_change_id, change_value, reason, evidence) VALUES (?,?,?,?,?,?)',
    [tech_id, record?.order_id, credit_change_id, record?.change_value || 0, reason, evidence || '']);
  res.json({ code: 0, msg: '信用分申诉已提交' });
});

// 师傅忙碌开关
app.post('/api/technician/toggle-busy', async (req, res) => {
  const db = await getDb();
  const { tech_id, is_busy } = req.body;
  db.run('UPDATE technicians SET is_busy=? WHERE id=?', [is_busy ? 1 : 0, tech_id]);
  res.json({ code: 0, msg: is_busy ? '已暂停接单' : '已恢复接单' });
});

// 获取所有师傅列表
app.get('/api/technician/list', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT id, name, phone, area, rating_avg, total_ratings, credit_score, is_busy FROM technicians WHERE status=? ORDER BY rating_avg DESC', ['active']);
  res.json({ code: 0, data: list });
});

// ─── 商家端 API ───

// 商家登录
app.post('/api/merchant/login', async (req, res) => {
  const db = await getDb();
  const { phone, password } = req.body;
  const merch = db.get('SELECT * FROM merchants WHERE phone=?', [phone]);
  if (!merch || merch.password !== password) return res.json({ code: 1, msg: '账号或密码错误' });
  if (merch.status !== 'active') return res.json({ code: 1, msg: '账号已被禁用' });

  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString();
  db.run('INSERT INTO user_sessions (user_type, user_id, token, phone, expires_at) VALUES (?,?,?,?,?)', ['merchant', merch.id, token, phone, expiresAt]);
  res.json({ code: 0, data: { token, user: merch } });
});

// 创建代报订单
app.post('/api/merchant/orders', async (req, res) => {
  const db = await getDb();
  const { merchant_id, user_name, user_phone, service_item_id, area, address, booking_date, booking_time, remark, merchant_remark } = req.body;

  const orderNo = generateOrderNo();
  const verifyCode = generateVerifyCode();
  let serviceName = '', servicePrice = 0, categoryName = '';
  if (service_item_id) {
    const item = db.get('SELECT si.*, sc.name as cat_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id WHERE si.id=?', [service_item_id]);
    if (item) { serviceName = item.name; servicePrice = item.price; categoryName = item.cat_name; }
  }
  const matchedArea = area || matchArea(address || '');

  const orderId = db.run(`INSERT INTO orders (order_no, user_phone, user_name, user_remark, service_item_id, service_name, service_price, category_name, area, address, booking_date, booking_time, verify_code, status, source, merchant_id) VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`,
    [orderNo, user_phone, sanitize(user_name), sanitize(remark || ''), service_item_id || null, serviceName, servicePrice, categoryName, matchedArea, sanitize(address || ''), booking_date, booking_time, verifyCode, 'pending', 'merchant', merchant_id || null]);

  if (merchant_remark) {
    db.run('INSERT INTO order_remarks (order_id, remark_type, content, created_by) VALUES (?,?,?,?)', [orderId.lastInsertRowid, 'merchant', sanitize(merchant_remark), `商家${merchant_id}`]);
  }
  addLog(db, orderId.lastInsertRowid, 'create', `商家代报：${serviceName}`, `商家${merchant_id}`);
  res.json({ code: 0, data: { order_no: orderNo, verify_code: verifyCode, id: orderId.lastInsertRowid }, msg: '代报成功' });
});

// 商家订单列表
app.get('/api/merchant/orders', async (req, res) => {
  const db = await getDb();
  const { merchant_id, page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  const list = db.all('SELECT o.*, t.name as tech_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id WHERE o.merchant_id=? AND o.is_deleted=0 ORDER BY o.created_at DESC LIMIT ? OFFSET ?', [merchant_id, lim, offset]);
  const total = db.get('SELECT COUNT(*) as c FROM orders WHERE merchant_id=? AND is_deleted=0', [merchant_id]);
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim } });
});

// 商家信息
app.get('/api/merchant/:id', async (req, res) => {
  const db = await getDb();
  const merch = db.get('SELECT * FROM merchants WHERE id=?', [req.params.id]);
  if (!merch) return res.json({ code: 1, msg: '商家不存在' });
  res.json({ code: 0, data: merch });
});

// 商家推广数据
app.get('/api/merchant/:id/promotion-stats', async (req, res) => {
  const db = await getDb();
  const totalOrders = db.get('SELECT COUNT(*) as c FROM orders WHERE merchant_id=? AND is_deleted=0', [req.params.id]);
  const completedOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE merchant_id=? AND status='completed'", [req.params.id]);
  const totalAmount = db.get("SELECT COALESCE(SUM(technician_fee),0) as s FROM orders WHERE merchant_id=? AND status='completed'", [req.params.id]);
  const totalReferral = db.get("SELECT COALESCE(SUM(amount),0) as s FROM merchant_transactions WHERE merchant_id=?", [req.params.id]);
  res.json({ code: 0, data: { total_orders: totalOrders.c, completed_orders: completedOrders.c, total_amount: totalAmount.s, total_referral: totalReferral.s } });
});

// 商家介绍费明细
app.get('/api/merchant/:id/transactions', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT * FROM merchant_transactions WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100', [req.params.id]);
  res.json({ code: 0, data: list });
});

// 商家提现申请
app.post('/api/merchant/withdraw', async (req, res) => {
  const db = await getDb();
  const { merchant_id, amount } = req.body;
  const merch = db.get('SELECT * FROM merchants WHERE id=?', [merchant_id]);
  if (!merch) return res.json({ code: 1, msg: '商家不存在' });
  if (merch.balance < amount) return res.json({ code: 1, msg: '余额不足' });
  db.run('UPDATE merchants SET balance=balance-? WHERE id=?', [amount, merchant_id]);
  db.run('INSERT INTO merchant_withdrawals (merchant_id, amount, status) VALUES (?,?,?)', [merchant_id, amount, 'pending']);
  res.json({ code: 0, msg: '提现申请已提交，等待审核' });
});

// 商家结算记录
app.get('/api/merchant/:id/settlements', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT * FROM merchant_withdrawals WHERE merchant_id=? ORDER BY created_at DESC', [req.params.id]);
  res.json({ code: 0, data: list });
});

// ─── 后台管理 API ───

// 管理员登录
app.post('/api/admin/login', async (req, res) => {
  const db = await getDb();
  const { account, password } = req.body;
  const adminAccount = db.get("SELECT config_value FROM site_config WHERE config_key='admin_account'")?.config_value;
  const adminPassword = db.get("SELECT config_value FROM site_config WHERE config_key='admin_password'")?.config_value;

  if (account !== adminAccount || password !== adminPassword) {
    db.run('INSERT INTO system_logs (operator, action, detail, ip_address) VALUES (?,?,?,?)', [account, 'login_failed', '后台登录失败', req.ip]);
    return res.json({ code: 1, msg: '账号或密码错误' });
  }

  const { v4: uuidv4 } = require('uuid');
  const token = uuidv4();
  const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();
  db.run('INSERT INTO user_sessions (user_type, user_id, token, phone, expires_at) VALUES (?,?,?,?,?)', ['admin', 0, token, account, expiresAt]);
  db.run('INSERT INTO system_logs (operator, action, detail, ip_address) VALUES (?,?,?,?)', [account, 'login', '后台登录成功', req.ip]);
  res.json({ code: 0, data: { token, user: { account } } });
});

// 仪表盘数据
app.get('/api/admin/dashboard', async (req, res) => {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const totalOrders = db.get('SELECT COUNT(*) as c FROM orders WHERE is_deleted=0');
  const todayOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=? AND is_deleted=0", [today]);
  const todayFee = db.get("SELECT COALESCE(SUM(platform_fee),0) as s FROM orders WHERE date(created_at)=? AND status='completed'", [today]);
  const onlineTechs = db.get("SELECT COUNT(*) as c FROM technicians WHERE status='active' AND is_busy=1");
  const pendingOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='pending' AND is_deleted=0");
  const overdueOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress' AND julianday('now')-julianday(booking_date) > 3 AND is_deleted=0");

  const trend = [];
  for (let i = 6; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const count = db.get("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=?", [d]);
    trend.push({ date: d, count: count.c });
  }

  const latestOrders = db.all('SELECT o.*, t.name as tech_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id WHERE o.is_deleted=0 ORDER BY o.created_at DESC LIMIT 10');

  res.json({ code: 0, data: { total_orders: totalOrders.c, today_orders: todayOrders.c, today_fee: todayFee.s, online_techs: onlineTechs.c, pending_orders: pendingOrders.c, overdue_orders: overdueOrders.c, trend, latest_orders: latestOrders } });
});

// 订单管理（后台）
app.get('/api/admin/orders', async (req, res) => {
  const db = await getDb();
  const { status, area, source, start_date, end_date, page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE o.is_deleted=0';
  const params = [];
  if (status && status !== 'all') { where += ' AND o.status=?'; params.push(status); }
  if (area) { where += ' AND o.area=?'; params.push(area); }
  if (source) { where += ' AND o.source=?'; params.push(source); }
  if (start_date) { where += ' AND o.created_at>=?'; params.push(start_date); }
  if (end_date) { where += ' AND o.created_at<=?'; params.push(end_date + ' 23:59:59'); }

  const list = db.all(`SELECT o.*, t.name as tech_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id ${where} ORDER BY o.created_at DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM orders o ${where}`, params);
  const stats = {
    all: db.get('SELECT COUNT(*) as c FROM orders WHERE is_deleted=0').c,
    pending: db.get("SELECT COUNT(*) as c FROM orders WHERE status='pending' AND is_deleted=0").c,
    in_progress: db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress' AND is_deleted=0").c,
    completed: db.get("SELECT COUNT(*) as c FROM orders WHERE status='completed' AND is_deleted=0").c,
    cancelled: db.get("SELECT COUNT(*) as c FROM orders WHERE status='cancelled' AND is_deleted=0").c,
    overdue: db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress' AND julianday('now')-julianday(booking_date) > 3 AND is_deleted=0").c
  };
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim, stats } });
});

// 软删除订单
app.post('/api/admin/orders/:id/delete', async (req, res) => {
  const db = await getDb();
  db.run("UPDATE orders SET is_deleted=1, deleted_at=datetime('now','localtime') WHERE id=?", [req.params.id]);
  db.run('INSERT INTO system_logs (operator, action, detail, ip_address) VALUES (?,?,?,?)', ['admin', 'delete_order', `删除订单#${req.params.id}`, req.ip]);
  res.json({ code: 0, msg: '已移入回收站' });
});

// 恢复订单
app.post('/api/admin/orders/:id/restore', async (req, res) => {
  const db = await getDb();
  db.run('UPDATE orders SET is_deleted=0, deleted_at=NULL WHERE id=?', [req.params.id]);
  res.json({ code: 0, msg: '已恢复' });
});

// 回收站
app.get('/api/admin/trash', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT o.*, t.name as tech_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id WHERE o.is_deleted=1 ORDER BY o.deleted_at DESC LIMIT 100');
  res.json({ code: 0, data: list });
});

// 师傅管理
app.get('/api/admin/technicians', async (req, res) => {
  const db = await getDb();
  const { area, status, search, page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE 1=1';
  const params = [];
  if (area) { where += ' AND area=?'; params.push(area); }
  if (status) { where += ' AND status=?'; params.push(status); }
  if (search) { where += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  const list = db.all(`SELECT * FROM technicians ${where} ORDER BY id DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM technicians ${where}`, params);
  const stats = {
    total: db.get('SELECT COUNT(*) as c FROM technicians').c,
    online: db.get("SELECT COUNT(*) as c FROM technicians WHERE status='active' AND is_busy=1").c,
    active: db.get("SELECT COUNT(*) as c FROM technicians WHERE status='active'").c,
  };
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim, stats } });
});

// 更新师傅
app.post('/api/admin/technicians/:id', async (req, res) => {
  const db = await getDb();
  const { name, phone, area, status, wechat_userid } = req.body;
  db.run('UPDATE technicians SET name=?, phone=?, area=?, status=?, wechat_userid=? WHERE id=?', [name, phone, area, status, wechat_userid || '', req.params.id]);
  db.run('INSERT INTO system_logs (operator, action, detail, ip_address) VALUES (?,?,?,?)', ['admin', 'update_technician', `更新师傅#${req.params.id}信息`, req.ip]);
  res.json({ code: 0, msg: '更新成功' });
});

// 调整师傅余额
app.post('/api/admin/technicians/:id/balance', async (req, res) => {
  const db = await getDb();
  const { amount, reason } = req.body;
  const tech = db.get('SELECT * FROM technicians WHERE id=?', [req.params.id]);
  db.run('UPDATE technicians SET balance=balance+? WHERE id=?', [amount, req.params.id]);
  db.run('INSERT INTO technician_transactions (technician_id, order_id, type, amount, balance_before, balance_after, description) VALUES (?,?,?,?,?,?,?)',
    [req.params.id, null, 'adjust', amount, tech.balance, tech.balance + amount, reason || '后台调整']);
  db.run('INSERT INTO system_logs (operator, action, detail, ip_address) VALUES (?,?,?,?)', ['admin', 'adjust_balance', `调整师傅#${req.params.id}余额：${amount}元，原因：${reason}`, req.ip]);
  res.json({ code: 0, msg: '调整成功' });
});

// 商家管理
app.get('/api/admin/merchants', async (req, res) => {
  const db = await getDb();
  const { page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  const list = db.all('SELECT * FROM merchants ORDER BY id DESC LIMIT ? OFFSET ?', [lim, offset]);
  const total = db.get('SELECT COUNT(*) as c FROM merchants');
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim } });
});

// 商家提现审核
app.get('/api/admin/merchant-withdrawals', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT mw.*, m.name as merchant_name, m.phone as merchant_phone FROM merchant_withdrawals mw LEFT JOIN merchants m ON mw.merchant_id=m.id ORDER BY mw.created_at DESC');
  res.json({ code: 0, data: list });
});

app.post('/api/admin/merchant-withdrawals/:id', async (req, res) => {
  const db = await getDb();
  const { status, remark } = req.body;
  db.run('UPDATE merchant_withdrawals SET status=?, remark=?, handled_at=datetime(\'now\',\'localtime\') WHERE id=?', [status, remark || '', req.params.id]);
  res.json({ code: 0, msg: '处理成功' });
});

// 服务管理
app.get('/api/admin/service-categories', async (req, res) => {
  const db = await getDb();
  const cats = db.all('SELECT * FROM service_categories ORDER BY sort_order');
  res.json({ code: 0, data: cats });
});

app.post('/api/admin/service-categories', async (req, res) => {
  const db = await getDb();
  const { name, icon, sort_order } = req.body;
  db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?,?,?)', [name, icon || '', sort_order || 0]);
  res.json({ code: 0, msg: '添加成功' });
});

app.put('/api/admin/service-categories/:id', async (req, res) => {
  const db = await getDb();
  const { name, icon, sort_order } = req.body;
  db.run('UPDATE service_categories SET name=?, icon=?, sort_order=? WHERE id=?', [name, icon, sort_order, req.params.id]);
  res.json({ code: 0, msg: '更新成功' });
});

app.delete('/api/admin/service-categories/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM service_categories WHERE id=?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

app.get('/api/admin/service-items', async (req, res) => {
  const db = await getDb();
  const { category_id } = req.query;
  let items;
  if (category_id) items = db.all('SELECT si.*, sc.name as category_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id WHERE si.category_id=? ORDER BY si.sort_order', [category_id]);
  else items = db.all('SELECT si.*, sc.name as category_name FROM service_items si LEFT JOIN service_categories sc ON si.category_id=sc.id ORDER BY si.sort_order');
  res.json({ code: 0, data: items });
});

app.post('/api/admin/service-items', async (req, res) => {
  const db = await getDb();
  const { category_id, name, price, price_range, estimated_duration, platform_rate, technician_rate, merchant_rate } = req.body;
  db.run('INSERT INTO service_items (category_id, name, price, price_range, estimated_duration, platform_rate, technician_rate, merchant_rate, sort_order) VALUES (?,?,?,?,?,?,?,?,?)',
    [category_id, name, price || 0, price_range || '', estimated_duration || 60, platform_rate || 10, technician_rate || 5, merchant_rate || 5, 0]);
  res.json({ code: 0, msg: '添加成功' });
});

app.put('/api/admin/service-items/:id', async (req, res) => {
  const db = await getDb();
  const { name, price, price_range, status } = req.body;
  db.run('UPDATE service_items SET name=?, price=?, price_range=?, status=? WHERE id=?', [name, price, price_range, status, req.params.id]);
  res.json({ code: 0, msg: '更新成功' });
});

app.delete('/api/admin/service-items/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM service_items WHERE id=?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

// 公告管理
app.get('/api/admin/announcements', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT * FROM announcements ORDER BY is_pinned DESC, created_at DESC');
  res.json({ code: 0, data: list });
});

app.post('/api/admin/announcements', async (req, res) => {
  const db = await getDb();
  const { title, content, target, is_pinned, publish_time } = req.body;
  db.run('INSERT INTO announcements (title, content, target, is_pinned, is_published, publish_time) VALUES (?,?,?,?,?,?)',
    [title, content, target || 'all', is_pinned ? 1 : 0, 1, publish_time || new Date().toISOString()]);
  res.json({ code: 0, msg: '发布成功' });
});

app.put('/api/admin/announcements/:id', async (req, res) => {
  const db = await getDb();
  const { title, content, is_pinned } = req.body;
  db.run('UPDATE announcements SET title=?, content=?, is_pinned=? WHERE id=?', [title, content, is_pinned ? 1 : 0, req.params.id]);
  res.json({ code: 0, msg: '更新成功' });
});

app.delete('/api/admin/announcements/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM announcements WHERE id=?', [req.params.id]);
  res.json({ code: 0, msg: '删除成功' });
});

// 系统设置
app.get('/api/admin/settings', async (req, res) => {
  const db = await getDb();
  const configs = db.all('SELECT * FROM site_config');
  const result = {};
  for (const c of configs) result[c.config_key] = c.config_value;
  res.json({ code: 0, data: result });
});

app.post('/api/admin/settings', async (req, res) => {
  const db = await getDb();
  const settings = req.body;
  const txn = db.transaction((items) => {
    for (const [key, value] of Object.entries(items)) {
      db.run('INSERT OR REPLACE INTO site_config (config_key, config_value, updated_at) VALUES (?,?,datetime(\'now\',\'localtime\'))', [key, String(value)]);
    }
  });
  txn(settings);
  res.json({ code: 0, msg: '保存成功' });
});

// 系统日志
app.get('/api/admin/logs', async (req, res) => {
  const db = await getDb();
  const { operator, action, start_date, end_date, page, limit: pageSize } = req.query;
  const p = parseInt(page) || 1;
  const lim = parseInt(pageSize) || 20;
  const offset = (p - 1) * lim;
  let where = 'WHERE 1=1';
  const params = [];
  if (operator) { where += ' AND operator LIKE ?'; params.push(`%${operator}%`); }
  if (action) { where += ' AND action LIKE ?'; params.push(`%${action}%`); }
  if (start_date) { where += ' AND created_at>=?'; params.push(start_date); }
  if (end_date) { where += ' AND created_at<=?'; params.push(end_date + ' 23:59:59'); }
  const list = db.all(`SELECT * FROM system_logs ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`, [...params, lim, offset]);
  const total = db.get(`SELECT COUNT(*) as c FROM system_logs ${where}`, params);
  res.json({ code: 0, data: { list, total: total.c, page: p, limit: lim } });
});

// 数据大屏
app.get('/api/admin/dataview', async (req, res) => {
  const db = await getDb();
  const today = new Date().toISOString().slice(0, 10);
  const todayOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=?", [today]);
  const todayAmount = db.get("SELECT COALESCE(SUM(actual_amount),0) as s FROM orders WHERE date(created_at)=? AND status='completed'", [today]);
  const onlineTechs = db.get("SELECT COUNT(*) as c FROM technicians WHERE status='active'");
  const activeOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress'");
  const todayFee = db.get("SELECT COALESCE(SUM(platform_fee),0) as s FROM orders WHERE date(created_at)=? AND status='completed'", [today]);

  const trend = [];
  for (let i = 29; i >= 0; i--) {
    const d = new Date(Date.now() - i * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    const count = db.get("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=?", [d]);
    trend.push({ date: d, count: count.c });
  }

  const categoryStats = db.all("SELECT category_name, COUNT(*) as c FROM orders WHERE is_deleted=0 GROUP BY category_name");
  const areaStats = db.all("SELECT area, COUNT(*) as c FROM orders WHERE is_deleted=0 AND area!='' GROUP BY area ORDER BY c DESC");
  const techRank = db.all("SELECT t.id, t.name, t.rating_avg, COUNT(o.id) as order_count FROM technicians t LEFT JOIN orders o ON t.id=o.technician_id AND o.status='completed' GROUP BY t.id ORDER BY order_count DESC LIMIT 10");
  const overdueCount = db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress' AND julianday('now')-julianday(booking_date) > 3");
  const pendingDisputes = db.get("SELECT COUNT(*) as c FROM disputes WHERE status='pending'");
  const pendingComplaints = db.get("SELECT COUNT(*) as c FROM technician_complaints WHERE appeal_status='pending'");
  const pendingCreditAppeals = db.get("SELECT COUNT(*) as c FROM credit_appeals WHERE status='pending'");

  res.json({ code: 0, data: { today_orders: todayOrders.c, today_amount: todayAmount.s, online_techs: onlineTechs.c, active_orders: activeOrders.c, today_fee: todayFee.s, trend, category_stats: categoryStats, area_stats: areaStats, tech_rank: techRank, alerts: { overdue: overdueCount.c, disputes: pendingDisputes.c, complaints: pendingComplaints.c, credit_appeals: pendingCreditAppeals.c } } });
});

// 黑名单
app.get('/api/blacklist', async (req, res) => {
  const db = await getDb();
  const { user_id, technician_id } = req.query;
  let list;
  if (user_id) list = db.all('SELECT b.*, t.name as target_name FROM blacklist b LEFT JOIN technicians t ON b.target_type="technician" AND b.target_id=t.id WHERE b.user_id=?', [user_id]);
  else if (technician_id) list = db.all('SELECT b.*, u.nickname as target_name FROM blacklist b LEFT JOIN users u ON b.target_type="user" AND b.target_id=u.id WHERE b.technician_id=?', [technician_id]);
  else list = [];
  res.json({ code: 0, data: list });
});

app.post('/api/blacklist', async (req, res) => {
  const db = await getDb();
  const { user_id, technician_id, target_type, target_id, reason } = req.body;
  const existing = db.get('SELECT * FROM blacklist WHERE target_type=? AND target_id=? AND (user_id=? OR technician_id=?)', [target_type, target_id, user_id || 0, technician_id || 0]);
  if (existing) return res.json({ code: 1, msg: '已在黑名单中' });
  db.run('INSERT INTO blacklist (user_id, technician_id, target_type, target_id, reason) VALUES (?,?,?,?,?)', [user_id || null, technician_id || null, target_type, target_id, reason || '']);
  res.json({ code: 0, msg: '已拉黑' });
});

app.delete('/api/blacklist/:id', async (req, res) => {
  const db = await getDb();
  db.run('DELETE FROM blacklist WHERE id=?', [req.params.id]);
  res.json({ code: 0, msg: '已移除黑名单' });
});

// 争议申诉管理
app.get('/api/admin/disputes', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT d.*, o.order_no, t.name as tech_name FROM disputes d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN technicians t ON d.technician_id=t.id ORDER BY d.created_at DESC');
  res.json({ code: 0, data: list });
});

app.post('/api/admin/disputes/:id', async (req, res) => {
  const db = await getDb();
  const { status, result } = req.body;
  db.run('UPDATE disputes SET status=?, result=?, handled_at=datetime(\'now\',\'localtime\') WHERE id=?', [status, result || '', req.params.id]);
  res.json({ code: 0, msg: '处理成功' });
});

// 差评申诉管理
app.get('/api/admin/complaints', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT tc.*, o.order_no, t.name as tech_name FROM technician_complaints tc LEFT JOIN orders o ON tc.order_id=o.id LEFT JOIN technicians t ON tc.technician_id=t.id ORDER BY tc.created_at DESC');
  res.json({ code: 0, data: list });
});

app.post('/api/admin/complaints/:id', async (req, res) => {
  const db = await getDb();
  const { status, result } = req.body;
  db.run('UPDATE technician_complaints SET appeal_status=?, appeal_result=?, handled_at=datetime(\'now\',\'localtime\') WHERE id=?', [status, result || '', req.params.id]);
  res.json({ code: 0, msg: '处理成功' });
});

// 信用分申诉管理
app.get('/api/admin/credit-appeals', async (req, res) => {
  const db = await getDb();
  const list = db.all('SELECT ca.*, t.name as tech_name, o.order_no FROM credit_appeals ca LEFT JOIN technicians t ON ca.technician_id=t.id LEFT JOIN orders o ON ca.order_id=o.id ORDER BY ca.created_at DESC');
  res.json({ code: 0, data: list });
});

app.post('/api/admin/credit-appeals/:id', async (req, res) => {
  const db = await getDb();
  const { status, result } = req.body;
  db.run('UPDATE credit_appeals SET status=?, result=?, handled_at=datetime(\'now\',\'localtime\') WHERE id=?', [status, result || '', req.params.id]);
  if (status === 'approved') {
    const appeal = db.get('SELECT * FROM credit_appeals WHERE id=?', [req.params.id]);
    if (appeal) db.run('UPDATE technicians SET credit_score=credit_score+? WHERE id=?', [Math.abs(appeal.change_value), appeal.technician_id]);
  }
  res.json({ code: 0, msg: '处理成功' });
});

// 导出Excel
app.get('/api/admin/export-orders', async (req, res) => {
  const db = await getDb();
  const { status, area, start_date, end_date } = req.query;
  let where = 'WHERE o.is_deleted=0';
  const params = [];
  if (status && status !== 'all') { where += ' AND o.status=?'; params.push(status); }
  if (area) { where += ' AND o.area=?'; params.push(area); }
  if (start_date) { where += ' AND o.created_at>=?'; params.push(start_date); }
  if (end_date) { where += ' AND o.created_at<=?'; params.push(end_date + ' 23:59:59'); }

  const list = db.all(`SELECT o.order_no, o.service_name, o.user_name, o.user_phone, o.address, o.area, o.service_price, o.platform_fee, o.status, o.booking_date, o.booking_time, o.created_at, t.name as tech_name FROM orders o LEFT JOIN technicians t ON o.technician_id=t.id ${where} ORDER BY o.created_at DESC`, params);

  const statusMap = { 'pending': '待接单', 'in_progress': '进行中', 'completed': '已完成', 'cancelled': '已取消' };
  const headers = ['订单号', '服务名称', '用户姓名', '联系电话', '服务地址', '所属区域', '服务金额', '平台抽成', '订单状态', '预约日期', '预约时间', '创建时间', '接单师傅'];
  let csv = headers.join(',') + '\n';
  for (const row of list) {
    csv += `"${row.order_no}","${row.service_name}","${row.user_name}","${row.user_phone}","${row.address}","${row.area}","${row.service_price}","${row.platform_fee}","${statusMap[row.status] || row.status}","${row.booking_date}","${row.booking_time}","${row.created_at}","${row.tech_name || ''}"\n`;
  }

  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename=orders.csv');
  res.send('\uFEFF' + csv);
});

// ─── 启动服务 ───
async function start() {
  await initDatabase();
  console.log('✅ 数据库就绪');

  const server = http.createServer(app);

  // WebSocket for data dashboard
  const wss = new WebSocketServer({ server, path: '/ws' });
  wss.on('connection', (ws) => {
    console.log('📊 数据大屏已连接');
    ws.send(JSON.stringify({ type: 'connected', msg: '实时数据连接已建立' }));

    const interval = setInterval(async () => {
      try {
        const db = await getDb();
        const today = new Date().toISOString().slice(0, 10);
        const todayOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE date(created_at)=?", [today]);
        const todayAmount = db.get("SELECT COALESCE(SUM(actual_amount),0) as s FROM orders WHERE date(created_at)=? AND status='completed'", [today]);
        const onlineTechs = db.get("SELECT COUNT(*) as c FROM technicians WHERE status='active'");
        const activeOrders = db.get("SELECT COUNT(*) as c FROM orders WHERE status='in_progress'");
        const todayFee = db.get("SELECT COALESCE(SUM(platform_fee),0) as s FROM orders WHERE date(created_at)=? AND status='completed'", [today]);

        ws.send(JSON.stringify({ type: 'realtime', data: { today_orders: todayOrders.c, today_amount: todayAmount.s, online_techs: onlineTechs.c, active_orders: activeOrders.c, today_fee: todayFee.s, time: new Date().toLocaleString('zh-CN') } }));
      } catch (e) { /* ignore */ }
    }, 3000);

    ws.on('close', () => { clearInterval(interval); });
  });

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`\n🚀 佳乐家家电服务平台启动成功！`);
    console.log(`📡 服务地址: http://localhost:${PORT}`);
    console.log(`👤 用户端: http://localhost:${PORT}/user/booking.html`);
    console.log(`🔧 师傅端: http://localhost:${PORT}/technician/orders.html`);
    console.log(`🏪 商家端: http://localhost:${PORT}/merchant/promotion.html`);
    console.log(`🖥️ 后台管理: http://localhost:${PORT}/admin/login.html`);
    console.log(`📊 数据大屏: http://localhost:${PORT}/admin/dataview.html`);
    console.log(`📡 WebSocket: ws://localhost:${PORT}/ws`);
  });
}

start().catch(e => {
  console.error('启动失败:', e);
  process.exit(1);
});