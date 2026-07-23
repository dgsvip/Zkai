// ============================================
// 佳乐家 · 后端服务 V5.0
// 技术栈: Node.js + Express + SQLite
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
require('dotenv').config();

// ===== 数据库初始化 =====
const DB_PATH = process.env.DB_PATH || './data/jialejia.db';
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// 创建表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, openid TEXT UNIQUE, phone TEXT NOT NULL,
    nickname TEXT, avatar TEXT, address TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, region TEXT NOT NULL, balance REAL DEFAULT 0,
    status INTEGER DEFAULT 1, busy INTEGER DEFAULT 0, credit_score INTEGER DEFAULT 100,
    rating_avg REAL DEFAULT 5.0, total_ratings INTEGER DEFAULT 0, complaint_count INTEGER DEFAULT 0,
    accept_radius INTEGER DEFAULT 10, avatar TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS merchants (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, contact TEXT NOT NULL,
    phone TEXT NOT NULL UNIQUE, password TEXT NOT NULL, qrcode TEXT,
    referral_rate REAL DEFAULT 3.0, balance REAL DEFAULT 0, status INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS service_categories (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, icon TEXT, sort_order INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS service_items (
    id INTEGER PRIMARY KEY AUTOINCREMENT, category_id INTEGER NOT NULL, name TEXT NOT NULL,
    icon TEXT, price_min REAL DEFAULT 0, price_max REAL DEFAULT 0, duration INTEGER DEFAULT 60,
    platform_rate REAL DEFAULT 10.0, technician_rate REAL DEFAULT 5.0, merchant_rate REAL DEFAULT 3.0,
    sort_score INTEGER DEFAULT 0, status INTEGER DEFAULT 1,
    FOREIGN KEY (category_id) REFERENCES service_categories(id)
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL UNIQUE,
    user_id INTEGER, technician_id INTEGER, merchant_id INTEGER,  service_item_id INTEGER,
    service_name TEXT NOT NULL, price REAL DEFAULT 0, platform_fee REAL DEFAULT 0,
    technician_income REAL DEFAULT 0, merchant_fee REAL DEFAULT 0,
    customer_name TEXT NOT NULL, customer_phone TEXT NOT NULL, customer_address TEXT NOT NULL,
    remark TEXT, technician_remark TEXT, appointment_date TEXT NOT NULL, appointment_time TEXT NOT NULL,
    image_urls TEXT, video_urls TEXT, source TEXT DEFAULT 'user',
    status TEXT DEFAULT 'pending', is_region INTEGER DEFAULT 1, region_matched TEXT,
    transfer_from INTEGER, timeout_at DATETIME, completed_at DATETIME, cancel_fee REAL DEFAULT 0,
    warranty_months INTEGER DEFAULT 0, agreement_version TEXT, is_deleted INTEGER DEFAULT 0,
    addition_amount REAL DEFAULT 0, addition_desc TEXT, addition_status TEXT DEFAULT '',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, action TEXT NOT NULL,
    description TEXT, operator TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_remarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, remark_type TEXT NOT NULL,
    content TEXT NOT NULL, created_by TEXT, visible_to TEXT DEFAULT 'all',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS order_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL UNIQUE,
    user_id INTEGER, technician_id INTEGER, rating_attitude INTEGER DEFAULT 5,
    rating_skill INTEGER DEFAULT 5, rating_punctuality INTEGER DEFAULT 5,
    comment TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS onsite_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, technician_id INTEGER,
    status TEXT NOT NULL, description TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS technician_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    order_no TEXT, image_url TEXT NOT NULL, service_name TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, technician_id INTEGER,
    reason TEXT NOT NULL, amount REAL, evidence TEXT, status TEXT DEFAULT 'pending',
    result TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL,
    target TEXT DEFAULT 'all', is_pinned INTEGER DEFAULT 0, status INTEGER DEFAULT 1,
    read_count INTEGER DEFAULT 0, publish_at DATETIME, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcement_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, announcement_id INTEGER NOT NULL,
    user_id INTEGER, technician_id INTEGER, read_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS technician_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    order_no TEXT, amount REAL NOT NULL, type TEXT NOT NULL, description TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS merchant_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL,
    order_no TEXT, amount REAL NOT NULL, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS merchant_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL,
    amount REAL NOT NULL, status TEXT DEFAULT 'pending', remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS technician_complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL, technician_id INTEGER NOT NULL,
    user_id INTEGER, content TEXT, rating INTEGER, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS technician_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    action TEXT NOT NULL, detail TEXT, ip TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, token TEXT NOT NULL,
    expires_at DATETIME NOT NULL, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, code TEXT NOT NULL,
    type TEXT DEFAULT 'login', expires_at DATETIME NOT NULL, used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, operator_id INTEGER NOT NULL, operator_name TEXT NOT NULL,
    role TEXT NOT NULL, action TEXT NOT NULL, detail TEXT, ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS data_backups (
    id INTEGER PRIMARY KEY AUTOINCREMENT, filename TEXT NOT NULL, size INTEGER DEFAULT 0,
    backup_time DATETIME DEFAULT CURRENT_TIMESTAMP, status TEXT DEFAULT 'completed',
    created_by TEXT, is_deleted INTEGER DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS user_agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, phone TEXT,
    agreement_type TEXT NOT NULL, version TEXT NOT NULL, confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT, config_key TEXT NOT NULL UNIQUE,
    config_value TEXT, updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS admins (
    id INTEGER PRIMARY KEY AUTOINCREMENT, username TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, nickname TEXT, role TEXT DEFAULT 'admin',
    status INTEGER DEFAULT 1, login_attempts INTEGER DEFAULT 0, locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// 初始化默认配置
const initConfig = () => {
  const configs = [
    ['site_name', '佳乐家'], ['contact_phone', '400-000-0000'],
    ['default_platform_rate', '10.00'], ['default_technician_rate', '5.00'],
    ['default_merchant_rate', '3.00'], ['cancel_fee', '5.00'],
    ['timeout_days', '3'], ['region_timeout_minutes', '30'],
    ['log_retention_days', '90'], ['agreement_booking_version', '1.0.0'],
    ['agreement_service_version', '1.0.0']
  ];
  const insert = db.prepare('INSERT OR IGNORE INTO site_config (config_key, config_value) VALUES (?, ?)');
  configs.forEach(([k, v]) => insert.run(k, v));
};
initConfig();

// 初始化管理员 (admin/admin123)
const adminExists = db.prepare('SELECT id FROM admins WHERE username = ?').get('admin');
if (!adminExists) {
  db.prepare("INSERT INTO admins (username, password, nickname, role) VALUES (?, ?, ?, 'super_admin')")
    .run('admin', 'admin123', '超级管理员');
}

// 初始化服务分类
const cats = db.prepare('SELECT id FROM service_categories').all();
if (cats.length === 0) {
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('空调服务', '❄️', 1);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('厨电服务', '🍳', 2);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('智能家电', '📺', 3);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('水电暖通', '💧', 4);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('环境电器', '🌬️', 5);
}

// 初始化服务项目
const items = db.prepare('SELECT id FROM service_items').all();
if (items.length === 0) {
  const services = [
    [1, '空调清洗', 80, 150, 60, '空调服务'], [1, '空调加氟', 100, 200, 45, '空调服务'], [1, '空调维修', 80, 300, 60, '空调服务'],
    [1, '空调安装', 150, 400, 120, '空调服务'], [1, '空调移机', 200, 500, 120, '空调服务'],
    [2, '油烟机清洗', 60, 120, 45, '厨电服务'], [2, '油烟机维修', 50, 200, 60, '厨电服务'], [2, '燃气灶维修', 50, 150, 45, '厨电服务'],
    [2, '消毒柜维修', 50, 150, 45, '厨电服务'], [2, '集成灶维修', 80, 250, 60, '厨电服务'],
    [3, '电视维修', 50, 200, 45, '智能家电'], [3, '冰箱维修', 60, 250, 60, '智能家电'], [3, '洗衣机维修', 50, 200, 60, '智能家电'],
    [3, '热水器维修', 60, 200, 45, '智能家电'], [3, '智能门锁安装', 80, 150, 60, '智能家电'],
    [4, '水管维修', 50, 150, 45, '水电暖通'], [4, '电路维修', 50, 200, 45, '水电暖通'], [4, '水龙头更换', 30, 80, 30, '水电暖通'],
    [4, '马桶维修', 40, 120, 45, '水电暖通'], [4, '暖气片安装', 100, 300, 120, '水电暖通'],
    [5, '空气净化器清洗', 50, 100, 30, '环境电器'], [5, '净水器维修', 60, 200, 45, '环境电器'], [5, '新风机清洗', 80, 150, 60, '环境电器'],
    [5, '除湿机维修', 50, 150, 45, '环境电器'], [5, '加湿器维修', 40, 100, 30, '环境电器']
  ];
  const ins = db.prepare('INSERT INTO service_items (category_id, name, price_min, price_max, duration, sort_score) VALUES (?, ?, ?, ?, ?, ?)');
  services.forEach(s => ins.run(s[0], s[1], s[2], s[3], s[4], 10));
}

// ===== 工具函数 =====
const JWT_SECRET = process.env.JWT_SECRET || 'jialejia_secret_key_2024';

function generateOrderNo() {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  const r = String(Math.floor(1000 + Math.random() * 9000));
  return `JLJ${ds}${r}`;
}

function auth(roles = []) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.json({ code: 401, message: '请先登录', data: null });
    try {
      const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
      req.user = decoded;
      if (roles.length && !roles.includes(decoded.role)) return res.json({ code: 403, message: '权限不足', data: null });
      next();
    } catch { return res.json({ code: 401, message: '登录已过期', data: null }); }
  };
}

function success(data = null, message = '操作成功') {
  return { code: 200, message, data, timestamp: Date.now() };
}

function error(message = '操作失败', code = 400) {
  return { code, message, data: null, timestamp: Date.now() };
}

// ===== Express 应用 =====
const app = express();
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// ===== API 路由 =====
const router = express.Router();

// ---- 用户端 ----
router.post('/user/verification-code', (req, res) => {
  const { phone } = req.body;
  if (!/^1\d{10}$/.test(phone)) return res.json(error('手机号格式不正确'));
  const code = String(Math.floor(1000 + Math.random() * 9000));
  db.prepare('INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?, ?, "login", datetime("now", "+5 minutes"))').run(phone, code);
  console.log(`[验证码] ${phone} -> ${code}`);
  res.json(success(null, '验证码已发送'));
});

router.post('/user/login', (req, res) => {
  const { phone, code } = req.body;
  if (!/^1\d{10}$/.test(phone)) return res.json(error('手机号格式不正确'));
  const vc = db.prepare("SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND type = 'login' AND used = 0 AND expires_at > datetime('now') ORDER BY id DESC LIMIT 1").get(phone, code);
  if (!vc) return res.json(error('验证码错误或已过期'));
  db.prepare('UPDATE verification_codes SET used = 1 WHERE id = ?').run(vc.id);
  let user = db.prepare('SELECT * FROM users WHERE phone = ?').get(phone);
  if (!user) {
    const r = db.prepare('INSERT INTO users (phone, nickname) VALUES (?, ?)').run(phone, `用户${phone.slice(-4)}`);
    user = { id: Number(r.lastInsertRowid), phone, nickname: `用户${phone.slice(-4)}` };
  }
  const token = jwt.sign({ id: user.id, phone: user.phone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  const expiresAt = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 19).replace('T', ' ');
  db.prepare('INSERT INTO user_sessions (phone, token, expires_at) VALUES (?, ?, ?)').run(phone, token, expiresAt);
  db.prepare("DELETE FROM user_sessions WHERE expires_at < datetime('now')").run();
  res.json(success({ token, user: { id: user.id, phone: user.phone, nickname: user.nickname, avatar: user.avatar } }));
});

router.get('/user/profile', auth(), (req, res) => {
  const user = db.prepare('SELECT id, phone, nickname, avatar, address, created_at FROM users WHERE id = ?').get(req.user.id);
  if (!user) return res.json(error('用户不存在', 404));
  res.json(success(user));
});

// ---- 服务 ----
router.get('/services/categories', (req, res) => {
  const cats = db.prepare('SELECT * FROM service_categories ORDER BY sort_order ASC').all();
  res.json(success(cats));
});

router.get('/services/items', (req, res) => {
  const { category_id } = req.query;
  let sql = 'SELECT * FROM service_items WHERE status = 1';
  const params = [];
  if (category_id) { sql += ' AND category_id = ?'; params.push(category_id); }
  sql += ' ORDER BY sort_score DESC, id ASC';
  res.json(success(db.prepare(sql).all(...params)));
});

// ---- 订单 ----
router.post('/orders', (req, res) => {
  const { service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_id } = req.body;
  if (!service_name || !customer_name || !customer_phone || !customer_address || !appointment_date || !appointment_time) return res.json(error('请填写完整信息'));
  if (!/^1\d{10}$/.test(customer_phone)) return res.json(error('手机号格式不正确'));
  const regions = ['磐石街道','曹城街道','青菏街道','郑庄街道','倪集街道','庄寨镇','普连集镇','古营集镇','侯集镇','苏集镇','孙老家镇','阎店楼镇','梁堤头镇','安蔡楼镇','大集镇','王集镇','楼庄镇','韩集镇','砖庙镇','常乐集镇','魏湾镇','仵楼镇','邵庄镇','朱洪庙镇'];
  let region_matched = null;
  for (const r of regions) { if (customer_address.includes(r)) { region_matched = r; break; } }
  const orderNo = generateOrderNo();
  const config = db.prepare("SELECT config_value FROM site_config WHERE config_key = 'region_timeout_minutes'").get();
  const timeout = parseInt(config?.config_value || 30);
  db.prepare("INSERT INTO orders (order_no, service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_id, source, is_region, region_matched, status, timeout_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'pending', datetime('now', '+' || ? || ' minutes'))").run(orderNo, service_item_id || null, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark || null, merchant_id || null, merchant_id ? 'merchant' : 'user', region_matched ? 1 : 0, region_matched, timeout);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '下单', ?, ?)").run(orderNo, `用户下单: ${customer_name}`, customer_name);
  res.json(success({ order_no: orderNo }, '下单成功'));
});

router.get('/orders', auth(), (req, res) => {
  const { status, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  let sql = 'SELECT * FROM orders WHERE is_deleted = 0';
  const params = [];
  if (req.user.role === 'user') { sql += ' AND customer_phone = ?'; params.push(req.user.phone); }
  if (status) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), offset);
  const list = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as t FROM orders WHERE is_deleted = 0').get().t;
  res.json(success({ list, total, page: parseInt(page), page_size: parseInt(page_size) }));
});

router.get('/orders/:orderNo', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  if (!order) return res.json(error('订单不存在', 404));
  const logs = db.prepare('SELECT * FROM order_logs WHERE order_no = ? ORDER BY created_at ASC').all(req.params.orderNo);
  const remarks = db.prepare('SELECT * FROM order_remarks WHERE order_no = ? ORDER BY created_at ASC').all(req.params.orderNo);
  const evaluation = db.prepare('SELECT * FROM order_evaluations WHERE order_no = ?').get(req.params.orderNo);
  const onsiteLogs = db.prepare('SELECT * FROM onsite_logs WHERE order_no = ? ORDER BY created_at ASC').all(req.params.orderNo);
  let technician = null;
  if (order.technician_id) {
    technician = db.prepare('SELECT id, name, phone, region, rating_avg, total_ratings, avatar FROM technicians WHERE id = ?').get(order.technician_id);
  }
  res.json(success({ ...order, logs, remarks, evaluation, onsiteLogs, technician }));
});

router.post('/orders/:orderNo/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  if (!order) return res.json(error('订单不存在', 404));
  if (['completed','cancelled','timeout'].includes(order.status)) return res.json(error('当前订单状态不可取消'));
  const config = db.prepare("SELECT config_value FROM site_config WHERE config_key = 'cancel_fee'").get();
  const cancelFee = parseFloat(config?.config_value || 5);
  let cancelFeeApplied = 0;
  if (order.technician_id) {
    const minutesSinceAssigned = (Date.now() - new Date(order.updated_at).getTime()) / 60000;
    if (minutesSinceAssigned <= 15) { cancelFeeApplied = cancelFee; }
    else { return res.json(error('接单已超过15分钟，不可取消，请联系客服')); }
  }
  db.prepare("UPDATE orders SET status = 'cancelled', cancel_fee = ? WHERE order_no = ?").run(cancelFeeApplied, req.params.orderNo);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '取消', '用户取消订单', ?)").run(req.params.orderNo, req.body.customer_name || '用户');
  if (cancelFeeApplied > 0 && order.technician_id) {
    db.prepare('UPDATE technicians SET balance = balance - ? WHERE id = ?').run(cancelFeeApplied, order.technician_id);
  }
  res.json(success(null, '订单已取消'));
});

router.post('/orders/:orderNo/evaluate', (req, res) => {
  const { rating_attitude, rating_skill, rating_punctuality, comment } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.status !== 'completed') return res.json(error('只有已完成订单可以评价'));
  const existing = db.prepare('SELECT * FROM order_evaluations WHERE order_no = ?').get(req.params.orderNo);
  if (existing) return res.json(error('该订单已评价'));
  db.prepare('INSERT INTO order_evaluations (order_no, user_id, technician_id, rating_attitude, rating_skill, rating_punctuality, comment) VALUES (?, ?, ?, ?, ?, ?, ?)').run(req.params.orderNo, order.user_id, order.technician_id, rating_attitude || 5, rating_skill || 5, rating_punctuality || 5, comment || null);
  if (order.technician_id) {
    const stats = db.prepare('SELECT AVG((rating_attitude + rating_skill + rating_punctuality) / 3.0) as avg_rating, COUNT(*) as count FROM order_evaluations WHERE technician_id = ?').get(order.technician_id);
    if (stats) db.prepare('UPDATE technicians SET rating_avg = ROUND(?, 1), total_ratings = ? WHERE id = ?').run(stats.avg_rating, stats.count, order.technician_id);
  }
  res.json(success(null, '评价成功'));
});

// ---- 公告 ----
router.get('/announcements', (req, res) => {
  const { page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const list = db.prepare("SELECT id, title, target, is_pinned, read_count, created_at FROM announcements WHERE status = 1 AND (publish_at IS NULL OR publish_at <= datetime('now')) ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?").all(parseInt(page_size), offset);
  const total = db.prepare('SELECT COUNT(*) as t FROM announcements WHERE status = 1').get().t;
  res.json(success({ list, total, page: parseInt(page), page_size: parseInt(page_size) }));
});

router.get('/announcements/:id', (req, res) => {
  const ann = db.prepare('SELECT * FROM announcements WHERE id = ?').get(req.params.id);
  if (!ann) return res.json(error('公告不存在', 404));
  db.prepare('UPDATE announcements SET read_count = read_count + 1 WHERE id = ?').run(req.params.id);
  res.json(success(ann));
});

// ---- 师傅端 ----
router.post('/technician/login', (req, res) => {
  const { phone, password } = req.body;
  const tech = db.prepare('SELECT * FROM technicians WHERE phone = ?').get(phone);
  if (!tech) return res.json(error('账号不存在'));
  if (tech.status === 0) return res.json(error('账号已被禁用'));
  if (password !== tech.password) return res.json(error('密码错误'));
  const token = jwt.sign({ id: tech.id, phone: tech.phone, role: 'technician', region: tech.region }, JWT_SECRET, { expiresIn: '7d' });
  res.json(success({ token, technician: { id: tech.id, name: tech.name, phone: tech.phone, region: tech.region, balance: tech.balance, busy: tech.busy, credit_score: tech.credit_score, rating_avg: tech.rating_avg, avatar: tech.avatar, total_ratings: tech.total_ratings } }));
});

router.get('/technician/profile', auth(['technician']), (req, res) => {
  const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(req.user.id);
  if (!tech) return res.json(error('师傅不存在', 404));
  res.json(success(tech));
});

router.put('/technician/profile', auth(['technician']), (req, res) => {
  const { region, accept_radius } = req.body;
  db.prepare('UPDATE technicians SET region = COALESCE(?, region), accept_radius = COALESCE(?, accept_radius) WHERE id = ?').run(region, accept_radius, req.user.id);
  res.json(success(null, '更新成功'));
});

router.put('/technician/busy', auth(['technician']), (req, res) => {
  const { busy } = req.body;
  db.prepare('UPDATE technicians SET busy = ? WHERE id = ?').run(busy ? 1 : 0, req.user.id);
  res.json(success(null, busy ? '已切换为忙碌' : '已切换为空闲'));
});

router.get('/technician/orders', auth(['technician']), (req, res) => {
  const { type, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  const tech = db.prepare('SELECT region FROM technicians WHERE id = ?').get(req.user.id);
  let sql, params;
  switch (type) {
    case 'region':
      sql = "SELECT o.* FROM orders o WHERE o.is_deleted = 0 AND o.status = 'pending' AND o.is_region = 1 AND o.region_matched = ? ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
      params = [tech.region, parseInt(page_size), offset]; break;
    case 'pool':
      sql = "SELECT o.* FROM orders o WHERE o.is_deleted = 0 AND o.status = 'pending' AND o.is_region = 0 ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
      params = [parseInt(page_size), offset]; break;
    case 'processing':
      sql = "SELECT o.* FROM orders o WHERE o.technician_id = ? AND o.status IN ('assigned','processing') ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
      params = [req.user.id, parseInt(page_size), offset]; break;
    case 'history':
      sql = "SELECT o.* FROM orders o WHERE o.technician_id = ? AND o.status IN ('completed','cancelled','timeout') ORDER BY o.created_at DESC LIMIT ? OFFSET ?";
      params = [req.user.id, parseInt(page_size), offset]; break;
    default:
      sql = 'SELECT * FROM orders WHERE is_deleted = 0 ORDER BY created_at DESC LIMIT ? OFFSET ?';
      params = [parseInt(page_size), offset];
  }
  const list = db.prepare(sql).all(...params);
  res.json(success({ list, page: parseInt(page), page_size: parseInt(page_size) }));
});

router.post('/technician/orders/accept', auth(['technician']), (req, res) => {
  const { order_no } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.status !== 'pending') return res.json(error('订单已被接走'));
  const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(req.user.id);
  if (!tech) return res.json(error('师傅不存在', 404));
  if (tech.credit_score < 60) return res.json(error('信用分不足，无法接单'));
  const r = db.prepare("UPDATE orders SET technician_id = ?, status = 'assigned' WHERE order_no = ? AND status = 'pending'").run(req.user.id, order_no);
  if (r.changes === 0) return res.json(error('订单已被接走'));
  db.prepare('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "接单", ?, ?)').run(order_no, `师傅 ${tech.name} 已接单`, tech.name);
  res.json(success(null, '接单成功'));
});

router.post('/technician/orders/complete', auth(['technician']), (req, res) => {
  const { order_no, price, warranty_months, image_urls, technician_remark } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.technician_id !== req.user.id) return res.json(error('无权操作该订单'));
  const configs = db.prepare("SELECT config_key, config_value FROM site_config WHERE config_key IN ('default_platform_rate','default_technician_rate')").all();
  const cm = {}; configs.forEach(c => cm[c.config_key] = parseFloat(c.config_value));
  const pr = cm.default_platform_rate || 10;
  const pf = parseFloat((price * pr / 100).toFixed(2));
  const ti = parseFloat((price * (100 - pr - (cm.default_technician_rate || 5)) / 100).toFixed(2));
  const totalPrice = parseFloat(price) + parseFloat(order.addition_amount || 0);
  const totalPf = parseFloat((totalPrice * pr / 100).toFixed(2));
  db.prepare("UPDATE orders SET price = ?, platform_fee = ?, technician_income = ?, warranty_months = ?, image_urls = ?, technician_remark = COALESCE(?, technician_remark), status = 'completed', completed_at = datetime('now') WHERE order_no = ?").run(price, totalPf, ti, warranty_months || 0, image_urls ? JSON.stringify(image_urls) : null, technician_remark, order_no);
  db.prepare('UPDATE technicians SET balance = balance - ? WHERE id = ?').run(totalPf, req.user.id);
  db.prepare("INSERT INTO technician_transactions (technician_id, order_no, amount, type, description) VALUES (?, ?, ?, 'income', ?)").run(req.user.id, order_no, ti, `完工收入: ${order.service_name}`);
  db.prepare("INSERT INTO technician_transactions (technician_id, order_no, amount, type, description) VALUES (?, ?, ?, 'fee', ?)").run(req.user.id, order_no, -totalPf, `平台抽成: ${totalPf}元`);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '完工', ?, ?)").run(order_no, `完工，实收${price}元，增项${order.addition_amount || 0}元，平台抽成${totalPf}元`, req.user.name);
  // 保存图片到师傅图库
  if (image_urls && image_urls.length > 0) {
    const ins = db.prepare('INSERT INTO technician_gallery (technician_id, order_no, image_url, service_name) VALUES (?, ?, ?, ?)');
    image_urls.forEach(url => ins.run(req.user.id, order_no, url, order.service_name));
  }
  if (order.merchant_id) {
    const merch = db.prepare('SELECT referral_rate FROM merchants WHERE id = ?').get(order.merchant_id);
    const mr = (merch?.referral_rate || 3);
    const mf = parseFloat((price * mr / 100).toFixed(2));
    if (mf > 0) {
      db.prepare('UPDATE orders SET merchant_fee = ? WHERE order_no = ?').run(mf, order_no);
      db.prepare('UPDATE merchants SET balance = balance + ? WHERE id = ?').run(mf, order.merchant_id);
      db.prepare("INSERT INTO merchant_transactions (merchant_id, order_no, amount, status) VALUES (?, ?, ?, 'pending')").run(order.merchant_id, order_no, mf);
    }
  }
  res.json(success(null, '完工确认成功'));
});

router.post('/technician/orders/cancel', auth(['technician']), (req, res) => {
  const { order_no, cancel_reason } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.technician_id !== req.user.id) return res.json(error('无权操作该订单'));
  const minutesSince = (Date.now() - new Date(order.updated_at).getTime()) / 60000;
  let penalty = 2, lockHours = 0;
  if (minutesSince > 30) { penalty = 10; lockHours = 24; }
  else if (minutesSince > 5) { penalty = 5; lockHours = 4; }
  db.prepare("UPDATE orders SET status = 'cancelled', technician_id = NULL WHERE order_no = ?").run(order_no);
  db.prepare('UPDATE technicians SET credit_score = MAX(0, credit_score - ?) WHERE id = ?').run(penalty, req.user.id);
  db.prepare('INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, \'cancel\', ?, ?, \'user,admin\')').run(order_no, cancel_reason || '师傅取消', req.user.name);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '取消', ?, ?)").run(order_no, `师傅取消: ${cancel_reason || ''}，扣信用分${penalty}`, req.user.name);
  res.json(success(null, `订单已取消，信用分扣除${penalty}分`));
});

router.post('/technician/orders/transfer', auth(['technician']), (req, res) => {
  const { order_no, target_technician_id, transfer_remark } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.technician_id !== req.user.id) return res.json(error('无权操作该订单'));
  db.prepare('UPDATE orders SET transfer_from = ? WHERE order_no = ?').run(req.user.id, order_no);
  db.prepare("INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, 'transfer', ?, ?, 'technician,admin')").run(order_no, transfer_remark || '转派', req.user.name);
  db.prepare('INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, "转派", ?, ?)').run(order_no, `转派给师傅ID: ${target_technician_id}`, req.user.name);
  res.json(success(null, '转派已发起'));
});

router.post('/technician/orders/self', auth(['technician']), (req, res) => {
  const { service_name, customer_name, customer_phone, customer_address, price, remark } = req.body;
  if (!service_name || !customer_name || !customer_phone || !customer_address) return res.json(error('请填写完整信息'));
  const orderNo = generateOrderNo();
  const config = db.prepare("SELECT config_value FROM site_config WHERE config_key = 'default_platform_rate'").get();
  const pr = parseFloat(config?.config_value || 10);
  const pf = parseFloat((price * pr / 100).toFixed(2));
  db.prepare("INSERT INTO orders (order_no, technician_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, price, platform_fee, technician_remark, source, status, is_region, completed_at) VALUES (?, ?, ?, ?, ?, ?, date('now'), time('now'), ?, ?, ?, 'self', 'completed', 0, datetime('now'))").run(orderNo, req.user.id, service_name, customer_name, customer_phone, customer_address, price || 0, pf, remark || null);
  db.prepare('UPDATE technicians SET balance = balance - ? WHERE id = ?').run(pf, req.user.id);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '自建', '师傅自建单', ?)").run(orderNo, req.user.name);
  res.json(success({ order_no: orderNo }, '自建单创建成功'));
});

router.get('/technician/statistics', auth(['technician']), (req, res) => {
  const todayOrders = db.prepare("SELECT COUNT(*) as total, SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) as completed FROM orders WHERE technician_id = ? AND DATE(created_at) = date('now')").get(req.user.id);
  const todayIncome = db.prepare("SELECT COALESCE(SUM(technician_income), 0) as income FROM orders WHERE technician_id = ? AND status = 'completed' AND DATE(completed_at) = date('now')").get(req.user.id);
  const tech = db.prepare('SELECT balance, credit_score, rating_avg, total_ratings FROM technicians WHERE id = ?').get(req.user.id);
  res.json(success({ ...todayOrders, income: todayIncome.income, ...tech }));
});

router.get('/technician/balance', auth(['technician']), (req, res) => {
  const rows = db.prepare('SELECT * FROM technician_transactions WHERE technician_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(success(rows));
});

// 现场状态上报
router.post('/technician/orders/onsite', auth(['technician']), (req, res) => {
  const { order_no, status: onsiteStatus, description } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.technician_id !== req.user.id) return res.json(error('无权操作'));
  db.prepare('INSERT INTO onsite_logs (order_no, technician_id, status, description) VALUES (?, ?, ?, ?)').run(order_no, req.user.id, onsiteStatus, description || '');
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '现场状态', ?, ?)").run(order_no, `状态: ${onsiteStatus} - ${description || ''}`, req.user.name);
  if (onsiteStatus === '改约') {
    // 改约时更新订单时间
  }
  res.json(success(null, '状态已上报'));
});

// 增项申请
router.post('/technician/orders/addition', auth(['technician']), (req, res) => {
  const { order_no, amount, description } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(order_no);
  if (!order) return res.json(error('订单不存在', 404));
  if (order.technician_id !== req.user.id) return res.json(error('无权操作'));
  db.prepare("UPDATE orders SET addition_amount = ?, addition_desc = ?, addition_status = 'pending' WHERE order_no = ?").run(amount, description || '', order_no);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '增项申请', ?, ?)").run(order_no, `增项: ${description}，金额: ${amount}元`, req.user.name);
  // TODO: 推送用户端确认
  res.json(success(null, '增项申请已发送，等待用户确认'));
});

// 确认增项（用户端调用）
router.post('/orders/:orderNo/addition/confirm', (req, res) => {
  const { confirm } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no = ?').get(req.params.orderNo);
  if (!order) return res.json(error('订单不存在', 404));
  if (confirm) {
    db.prepare("UPDATE orders SET addition_status = 'confirmed', price = price + addition_amount WHERE order_no = ?").run(req.params.orderNo);
    db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '增项确认', ?, '用户')").run(req.params.orderNo, `用户确认增项: ${order.addition_desc}，加价${order.addition_amount}元`);
  } else {
    db.prepare("UPDATE orders SET addition_status = 'rejected' WHERE order_no = ?").run(req.params.orderNo);
    db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '增项拒绝', '用户拒绝增项', '用户')").run(req.params.orderNo);
  }
  res.json(success(null, confirm ? '增项已确认' : '已拒绝增项'));
});

// 师傅图库
router.get('/technician/gallery', auth(['technician']), (req, res) => {
  const rows = db.prepare('SELECT * FROM technician_gallery WHERE technician_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(rows));
});

// 争议申诉
router.get('/technician/disputes', auth(['technician']), (req, res) => {
  const rows = db.prepare('SELECT * FROM disputes WHERE technician_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(rows));
});

router.post('/technician/disputes', auth(['technician']), (req, res) => {
  const { order_no, reason, amount, evidence } = req.body;
  db.prepare('INSERT INTO disputes (order_no, technician_id, reason, amount, evidence) VALUES (?, ?, ?, ?, ?)').run(order_no, req.user.id, reason, amount || 0, evidence || null);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '发起争议', ?, ?)").run(order_no, `争议: ${reason}`, req.user.name);
  res.json(success(null, '争议申诉已提交'));
});

// ---- 商家端 ----
router.post('/merchant/login', (req, res) => {
  const { phone, password } = req.body;
  const merch = db.prepare('SELECT * FROM merchants WHERE phone = ?').get(phone);
  if (!merch) return res.json(error('账号不存在'));
  if (merch.status === 0) return res.json(error('账号已被禁用'));
  if (password !== merch.password) return res.json(error('密码错误'));
  const token = jwt.sign({ id: merch.id, phone: merch.phone, role: 'merchant' }, JWT_SECRET, { expiresIn: '7d' });
  res.json(success({ token, merchant: { id: merch.id, name: merch.name, contact: merch.contact, phone: merch.phone, referral_rate: merch.referral_rate, balance: merch.balance, created_at: merch.created_at } }));
});

router.get('/merchant/statistics', auth(['merchant']), (req, res) => {
  const orders = db.prepare('SELECT COUNT(*) as total, COALESCE(SUM(merchant_fee), 0) as total_fee FROM orders WHERE merchant_id = ?').get(req.user.id);
  const monthOrders = db.prepare("SELECT COUNT(*) as month_total, COALESCE(SUM(merchant_fee), 0) as month_fee FROM orders WHERE merchant_id = ? AND strftime('%Y', created_at) = strftime('%Y', 'now') AND strftime('%m', created_at) = strftime('%m', 'now')").get(req.user.id);
  res.json(success({ ...orders, ...monthOrders }));
});

router.post('/merchant/orders', auth(['merchant']), (req, res) => {
  const { service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, merchant_remark } = req.body;
  if (!service_name || !customer_name || !customer_phone || !customer_address) return res.json(error('请填写完整信息'));
  const orderNo = generateOrderNo();
  const config = db.prepare("SELECT config_value FROM site_config WHERE config_key = 'region_timeout_minutes'").get();
  const timeout = parseInt(config?.config_value || 30);
  db.prepare("INSERT INTO orders (order_no, merchant_id, service_item_id, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark, source, status, timeout_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'merchant', 'pending', datetime('now', '+' || ? || ' minutes'))").run(orderNo, req.user.id, service_item_id || null, service_name, customer_name, customer_phone, customer_address, appointment_date, appointment_time, remark || null, timeout);
  if (merchant_remark) {
    db.prepare("INSERT INTO order_remarks (order_no, remark_type, content, created_by, visible_to) VALUES (?, 'merchant', ?, ?, 'technician,admin')").run(orderNo, merchant_remark, req.user.name);
  }
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '代报单', ?, ?)").run(orderNo, `商家代报: ${customer_name}`, req.user.name);
  res.json(success({ order_no: orderNo }, '代报单提交成功'));
});

router.get('/merchant/orders', auth(['merchant']), (req, res) => {
  const rows = db.prepare('SELECT * FROM orders WHERE merchant_id = ? ORDER BY created_at DESC LIMIT 50').all(req.user.id);
  res.json(success(rows));
});

router.get('/merchant/income', auth(['merchant']), (req, res) => {
  const total = db.prepare("SELECT COALESCE(SUM(amount), 0) as total, COALESCE(SUM(CASE WHEN status = 'settled' THEN amount ELSE 0 END), 0) as settled, COALESCE(SUM(CASE WHEN status = 'pending' THEN amount ELSE 0 END), 0) as pending FROM merchant_transactions WHERE merchant_id = ?").get(req.user.id);
  const merch = db.prepare('SELECT balance FROM merchants WHERE id = ?').get(req.user.id);
  res.json(success({ ...total, balance: merch?.balance || 0 }));
});

router.post('/merchant/withdraw', auth(['merchant']), (req, res) => {
  const { amount } = req.body;
  const merch = db.prepare('SELECT balance FROM merchants WHERE id = ?').get(req.user.id);
  if (!merch) return res.json(error('商家不存在', 404));
  if (merch.balance < amount) return res.json(error('余额不足'));
  db.prepare('INSERT INTO merchant_withdrawals (merchant_id, amount) VALUES (?, ?)').run(req.user.id, amount);
  res.json(success(null, '提现申请已提交，等待审核'));
});

router.get('/merchant/withdraws', auth(['merchant']), (req, res) => {
  const rows = db.prepare('SELECT * FROM merchant_withdrawals WHERE merchant_id = ? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(rows));
});

// ---- 后台管理 ----
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  const admin = db.prepare('SELECT * FROM admins WHERE username = ?').get(username);
  if (!admin) return res.json(error('账号不存在'));
  if (admin.status === 0) return res.json(error('账号已被禁用'));
  if (admin.locked_until && new Date(admin.locked_until) > new Date()) return res.json(error('账号已被锁定，请5分钟后再试'));
  if (password !== admin.password) {
    const attempts = (admin.login_attempts || 0) + 1;
    if (attempts >= 3) {
      db.prepare("UPDATE admins SET login_attempts = 0, locked_until = datetime('now', '+5 minutes') WHERE id = ?").run(admin.id);
      return res.json(error('密码错误3次，账号已锁定5分钟'));
    }
    db.prepare('UPDATE admins SET login_attempts = ? WHERE id = ?').run(attempts, admin.id);
    return res.json(error('密码错误'));
  }
  db.prepare('UPDATE admins SET login_attempts = 0, locked_until = NULL WHERE id = ?').run(admin.id);
  const token = jwt.sign({ id: admin.id, username: admin.username, role: 'admin', admin_role: admin.role }, JWT_SECRET, { expiresIn: '24h' });
  db.prepare("INSERT INTO system_logs (operator_id, operator_name, role, action, detail, ip) VALUES (?, ?, ?, 'login', '登录后台', ?)").run(admin.id, admin.nickname, admin.role, req.ip);
  res.json(success({ token, admin: { id: admin.id, username: admin.username, nickname: admin.nickname, role: admin.role } }));
});

router.get('/admin/dashboard', auth(['admin']), (req, res) => {
  const totalOrders = db.prepare('SELECT COUNT(*) as t FROM orders').get().t;
  const todayOrders = db.prepare("SELECT COUNT(*) as t FROM orders WHERE DATE(created_at) = date('now')").get().t;
  const todayFee = db.prepare("SELECT COALESCE(SUM(platform_fee), 0) as t FROM orders WHERE DATE(completed_at) = date('now')").get().t;
  const onlineTechs = db.prepare('SELECT COUNT(*) as t FROM technicians WHERE busy = 0 AND status = 1').get().t;
  const pendingCount = db.prepare("SELECT COUNT(*) as t FROM orders WHERE status = 'pending'").get().t;
  const processingCount = db.prepare("SELECT COUNT(*) as t FROM orders WHERE status IN ('assigned','processing')").get().t;
  const overdue = db.prepare("SELECT COUNT(*) as t FROM orders WHERE status = 'assigned' AND created_at < datetime('now', '-3 days')").get().t;
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10').all();
  const pendingDisputes = db.prepare("SELECT COUNT(*) as t FROM disputes WHERE status = 'pending'").get().t;
  res.json(success({ totalOrders, todayOrders, todayFee, onlineTechs, pendingCount, processingCount, overdueCount: overdue, pendingDisputes, recentOrders }));
});

router.get('/admin/orders', auth(['admin']), (req, res) => {
  const { status, region, source, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  let sql = 'SELECT * FROM orders WHERE is_deleted = 0';
  const params = [];
  if (status) { sql += ' AND status = ?'; params.push(status); }
  if (region) { sql += ' AND region_matched = ?'; params.push(region); }
  if (source) { sql += ' AND source = ?'; params.push(source); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), offset);
  const list = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as t FROM orders WHERE is_deleted = 0').get().t;
  res.json(success({ list, total, page: parseInt(page), page_size: parseInt(page_size) }));
});

router.put('/admin/orders/:id', auth(['admin']), (req, res) => {
  const { technician_id } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id = ?').get(req.params.id);
  if (!order) return res.json(error('订单不存在', 404));
  db.prepare("UPDATE orders SET technician_id = ?, status = 'assigned' WHERE id = ?").run(technician_id, req.params.id);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '强制转派', ?, ?)").run(order.order_no, `管理员强制转派给师傅ID: ${technician_id}`, req.user.username);
  res.json(success(null, '转派成功'));
});

router.get('/admin/technicians', auth(['admin']), (req, res) => {
  const { region, status, page = 1, page_size = 20 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  let sql = 'SELECT * FROM technicians WHERE 1=1';
  const params = [];
  if (region) { sql += ' AND region = ?'; params.push(region); }
  if (status !== undefined) { sql += ' AND status = ?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), offset);
  const list = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT COUNT(*) as t FROM technicians').get().t;
  res.json(success({ list, total, page: parseInt(page), page_size: parseInt(page_size) }));
});

router.post('/admin/technicians', auth(['admin']), (req, res) => {
  const { name, phone, password, region } = req.body;
  db.prepare('INSERT INTO technicians (name, phone, password, region) VALUES (?, ?, ?, ?)').run(name, phone, password, region);
  res.json(success(null, '添加成功'));
});

router.put('/admin/technicians/:id', auth(['admin']), (req, res) => {
  const { name, phone, region, status, balance, credit_score } = req.body;
  db.prepare('UPDATE technicians SET name = COALESCE(?, name), phone = COALESCE(?, phone), region = COALESCE(?, region), status = COALESCE(?, status), balance = COALESCE(?, balance), credit_score = COALESCE(?, credit_score) WHERE id = ?').run(name, phone, region, status, balance, credit_score, req.params.id);
  res.json(success(null, '更新成功'));
});

router.get('/admin/technicians/:id', auth(['admin']), (req, res) => {
  const tech = db.prepare('SELECT * FROM technicians WHERE id = ?').get(req.params.id);
  if (!tech) return res.json(error('师傅不存在', 404));
  const orders = db.prepare('SELECT * FROM orders WHERE technician_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
  const transactions = db.prepare('SELECT * FROM technician_transactions WHERE technician_id = ? ORDER BY created_at DESC LIMIT 20').all(req.params.id);
  const complaints = db.prepare('SELECT * FROM technician_complaints WHERE technician_id = ? ORDER BY created_at DESC').all(req.params.id);
  const disputes = db.prepare('SELECT * FROM disputes WHERE technician_id = ? ORDER BY created_at DESC').all(req.params.id);
  const logs = db.prepare('SELECT * FROM technician_logs WHERE technician_id = ? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  res.json(success({ ...tech, orders, transactions, complaints, disputes, logs }));
});

router.get('/admin/merchants', auth(['admin']), (req, res) => {
  const rows = db.prepare('SELECT * FROM merchants ORDER BY created_at DESC').all();
  res.json(success(rows));
});

router.post('/admin/merchants', auth(['admin']), (req, res) => {
  const { name, contact, phone, password, referral_rate } = req.body;
  db.prepare('INSERT INTO merchants (name, contact, phone, password, referral_rate) VALUES (?, ?, ?, ?, ?)').run(name, contact, phone, password, referral_rate || 3);
  res.json(success(null, '添加成功'));
});

router.put('/admin/merchants/:id', auth(['admin']), (req, res) => {
  const { name, contact, phone, referral_rate, status } = req.body;
  db.prepare('UPDATE merchants SET name = COALESCE(?, name), contact = COALESCE(?, contact), phone = COALESCE(?, phone), referral_rate = COALESCE(?, referral_rate), status = COALESCE(?, status) WHERE id = ?').run(name, contact, phone, referral_rate, status, req.params.id);
  res.json(success(null, '更新成功'));
});

router.post('/admin/merchants/withdraw/:id', auth(['admin']), (req, res) => {
  const { status } = req.body;
  const withdraw = db.prepare('SELECT * FROM merchant_withdrawals WHERE id = ?').get(req.params.id);
  if (!withdraw) return res.json(error('提现申请不存在', 404));
  if (status === 'approved') {
    db.prepare('UPDATE merchants SET balance = balance - ? WHERE id = ?').run(withdraw.amount, withdraw.merchant_id);
    db.prepare("UPDATE merchant_transactions SET status = 'settled' WHERE merchant_id = ? AND status = 'pending'").run(withdraw.merchant_id);
  }
  db.prepare('UPDATE merchant_withdrawals SET status = ? WHERE id = ?').run(status, req.params.id);
  res.json(success(null, status === 'approved' ? '已审核通过' : '已驳回'));
});

router.get('/admin/services', auth(['admin']), (req, res) => {
  const categories = db.prepare('SELECT * FROM service_categories ORDER BY sort_order').all();
  const items = db.prepare('SELECT * FROM service_items ORDER BY sort_score DESC').all();
  res.json(success({ categories, items }));
});

router.post('/admin/services', auth(['admin']), (req, res) => {
  const { category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score } = req.body;
  const r = db.prepare('INSERT INTO service_items (category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)').run(category_id, name, price_min || 0, price_max || 0, duration || 60, platform_rate || 10, technician_rate || 5, merchant_rate || 3, sort_score || 0);
  res.json(success({ id: Number(r.lastInsertRowid) }, '添加成功'));
});

router.put('/admin/services/:id', auth(['admin']), (req, res) => {
  const { name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score, status } = req.body;
  db.prepare('UPDATE service_items SET name = COALESCE(?, name), price_min = COALESCE(?, price_min), price_max = COALESCE(?, price_max), duration = COALESCE(?, duration), platform_rate = COALESCE(?, platform_rate), technician_rate = COALESCE(?, technician_rate), merchant_rate = COALESCE(?, merchant_rate), sort_score = COALESCE(?, sort_score), status = COALESCE(?, status) WHERE id = ?').run(name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score, status, req.params.id);
  res.json(success(null, '更新成功'));
});

router.get('/admin/announcements', auth(['admin']), (req, res) => {
  const rows = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(success(rows));
});

router.post('/admin/announcements', auth(['admin']), (req, res) => {
  const { title, content, target, is_pinned, publish_at } = req.body;
  db.prepare('INSERT INTO announcements (title, content, target, is_pinned, publish_at) VALUES (?, ?, ?, ?, ?)').run(title, content, target || 'all', is_pinned || 0, publish_at || null);
  res.json(success(null, '发布成功'));
});

router.put('/admin/announcements/:id', auth(['admin']), (req, res) => {
  const { title, content, target, is_pinned, status } = req.body;
  db.prepare('UPDATE announcements SET title = COALESCE(?, title), content = COALESCE(?, content), target = COALESCE(?, target), is_pinned = COALESCE(?, is_pinned), status = COALESCE(?, status) WHERE id = ?').run(title, content, target, is_pinned, status, req.params.id);
  res.json(success(null, '更新成功'));
});

router.get('/admin/system/settings', auth(['admin']), (req, res) => {
  const rows = db.prepare('SELECT * FROM site_config').all();
  const settings = {}; rows.forEach(r => settings[r.config_key] = r.config_value);
  res.json(success(settings));
});

router.put('/admin/system/settings', auth(['admin']), (req, res) => {
  const settings = req.body;
  const upsert = db.prepare("INSERT INTO site_config (config_key, config_value) VALUES (?, ?) ON CONFLICT(config_key) DO UPDATE SET config_value = ?, updated_at = datetime('now')");
  for (const [key, value] of Object.entries(settings)) {
    upsert.run(key, String(value), String(value));
  }
  res.json(success(null, '保存成功'));
});

router.get('/admin/system/logs', auth(['admin']), (req, res) => {
  const { action, operator_id, page = 1, page_size = 50 } = req.query;
  const offset = (parseInt(page) - 1) * parseInt(page_size);
  let sql = 'SELECT * FROM system_logs WHERE 1=1';
  const params = [];
  if (action) { sql += ' AND action = ?'; params.push(action); }
  if (operator_id) { sql += ' AND operator_id = ?'; params.push(operator_id); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(parseInt(page_size), offset);
  const rows = db.prepare(sql).all(...params);
  res.json(success(rows));
});

// 争议申诉管理
router.get('/admin/disputes', auth(['admin']), (req, res) => {
  const rows = db.prepare('SELECT d.*, t.name as technician_name, o.service_name FROM disputes d LEFT JOIN technicians t ON d.technician_id = t.id LEFT JOIN orders o ON d.order_no = o.order_no ORDER BY d.created_at DESC').all();
  res.json(success(rows));
});

router.post('/admin/disputes/:id/review', auth(['admin']), (req, res) => {
  const { status, result } = req.body;
  const dispute = db.prepare('SELECT * FROM disputes WHERE id = ?').get(req.params.id);
  if (!dispute) return res.json(error('争议不存在', 404));
  db.prepare('UPDATE disputes SET status = ?, result = ?, updated_at = datetime(\'now\') WHERE id = ?').run(status, result || '', req.params.id);
  db.prepare("INSERT INTO order_logs (order_no, action, description, operator) VALUES (?, '争议处理', ?, ?)").run(dispute.order_no, `争议处理结果: ${result || status}`, req.user.username);
  res.json(success(null, '处理完成'));
});

// 实时数据（数据大屏）
router.get('/admin/dashboard/realtime', auth(['admin']), (req, res) => {
  const todayOrders = db.prepare("SELECT COUNT(*) as total, COALESCE(SUM(platform_fee), 0) as fee FROM orders WHERE DATE(created_at) = date('now')").get();
  const onlineTechs = db.prepare('SELECT COUNT(*) as total FROM technicians WHERE busy = 0 AND status = 1').get().total;
  const processing = db.prepare("SELECT COUNT(*) as total FROM orders WHERE status IN ('assigned','processing')").get().total;
  const overdue = db.prepare("SELECT COUNT(*) as total FROM orders WHERE status = 'assigned' AND created_at < datetime('now', '-3 days')").get().total;
  const pendingComplaints = db.prepare("SELECT COUNT(*) as total FROM technician_complaints WHERE status = 'pending'").get().total;
  const pendingDisputes = db.prepare("SELECT COUNT(*) as total FROM disputes WHERE status = 'pending'").get().total;
  const categoryStats = db.prepare("SELECT s.name, COUNT(*) as count FROM orders o JOIN service_items si ON o.service_item_id = si.id JOIN service_categories s ON si.category_id = s.id WHERE o.status = 'completed' GROUP BY s.name").all();
  const topTechnicians = db.prepare("SELECT t.id, t.name, t.avatar, COUNT(*) as order_count FROM orders o JOIN technicians t ON o.technician_id = t.id WHERE o.status = 'completed' AND DATE(o.completed_at) = date('now') GROUP BY t.id ORDER BY order_count DESC LIMIT 10").all();
  const regionStats = db.prepare("SELECT region_matched, COUNT(*) as count FROM orders WHERE DATE(created_at) = date('now') AND region_matched IS NOT NULL GROUP BY region_matched").all();
  res.json(success({ todayOrders, onlineTechs, processingCount: processing, overdueCount: overdue, pendingComplaints, pendingDisputes, categoryStats, topTechnicians, regionStats }));
});

// ===== 定时任务 =====
cron.schedule('*/5 * * * *', () => {
  const r = db.prepare("UPDATE orders SET is_region = 0, region_matched = NULL WHERE status = 'pending' AND is_region = 1 AND timeout_at IS NOT NULL AND timeout_at <= datetime('now')").run();
  if (r.changes > 0) console.log(`[定时] 区域单超时转抢单池: ${r.changes} 单`);
});

cron.schedule('0 1 * * *', () => {
  const r = db.prepare("UPDATE orders SET status = 'timeout', completed_at = datetime('now') WHERE status IN ('assigned','processing') AND created_at < datetime('now', '-3 days')").run();
  if (r.changes > 0) {
    const orders = db.prepare("SELECT order_no FROM orders WHERE status = 'timeout' AND completed_at IS NOT NULL AND updated_at < datetime('now', '-1 minutes')").all();
    const ins = db.prepare("INSERT INTO order_logs (order_no, action, description) VALUES (?, '超期完结', '系统自动完结（超期3天）')");
    orders.forEach(o => ins.run(o.order_no));
    console.log(`[定时] 超期订单自动完结: ${r.changes} 单`);
  }
});

cron.schedule('0 3 * * *', () => {
  const config = db.prepare("SELECT config_value FROM site_config WHERE config_key = 'log_retention_days'").get();
  const days = parseInt(config?.config_value || 90);
  const r = db.prepare(`DELETE FROM system_logs WHERE created_at < datetime('now', '-${days} days')`).run();
  if (r.changes > 0) console.log(`[定时] 清理过期日志: ${r.changes} 条`);
  db.prepare("DELETE FROM verification_codes WHERE expires_at < datetime('now')").run();
  db.prepare("DELETE FROM user_sessions WHERE expires_at < datetime('now')").run();
});

// ===== 静态文件服务 =====
app.use('/api/v1', router);

// 前端页面路由
const htmlFiles = [
  '/', '/index.html', '/user/booking.html', '/user/orders.html', '/user/profile.html',
  '/technician/index.html', '/technician/ongoing.html', '/technician/profile.html',
  '/merchant/promote.html', '/merchant/proxy.html', '/merchant/profile.html',
  '/admin/login.html', '/admin/dashboard.html', '/admin/orders.html',
  '/admin/technicians.html', '/admin/merchants.html', '/admin/services.html',
  '/admin/announcements.html', '/admin/dataview.html', '/admin/settings.html'
];

// 健康检查
app.get('/api/health', (req, res) => {
  res.json({ code: 200, message: 'OK', timestamp: Date.now() });
});

// ===== 启动 =====
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  佳乐家 V5.0 服务已启动`);
  console.log(`  🚀 http://localhost:${PORT}`);
  console.log(`  📁 数据库: ${DB_PATH}`);
  console.log(`  ⏰ 定时任务: 已启动`);
  console.log(`========================================`);
});