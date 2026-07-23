// ============================================
// 佳乐家 · 后端服务 V7.0
// 技术栈: Node.js + Express + SQLite
// ============================================

const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const cron = require('node-cron');
const multer = require('multer');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3000;
const DB_PATH = path.resolve(process.env.DB_PATH || './data/jialejia.db');

// ===== 数据库初始化 =====
const dbDir = path.dirname(DB_PATH);
if (!fs.existsSync(dbDir)) fs.mkdirSync(dbDir, { recursive: true });

const { DatabaseSync } = require('node:sqlite');
const db = new DatabaseSync(DB_PATH);
db.exec('PRAGMA journal_mode = WAL');
db.exec('PRAGMA foreign_keys = ON');

// 创建所有表
db.exec(`
  CREATE TABLE IF NOT EXISTS users (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL UNIQUE,
    nickname TEXT, avatar TEXT, created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_addresses (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL,
    label TEXT, region TEXT NOT NULL, address TEXT, is_default INTEGER DEFAULT 0,
    FOREIGN KEY (user_id) REFERENCES users(id)
  );
  CREATE TABLE IF NOT EXISTS technicians (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, phone TEXT NOT NULL UNIQUE,
    password TEXT NOT NULL, region TEXT NOT NULL, balance REAL DEFAULT 0,
    status INTEGER DEFAULT 1, busy INTEGER DEFAULT 0, credit_score INTEGER DEFAULT 100,
    rating_avg REAL DEFAULT 5.0, total_ratings INTEGER DEFAULT 0, complaint_count INTEGER DEFAULT 0,
    accept_radius INTEGER DEFAULT 10, avatar TEXT, wechat_userid TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
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
  CREATE TABLE IF NOT EXISTS regions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, name TEXT NOT NULL, type TEXT DEFAULT 'town'
  );
  CREATE TABLE IF NOT EXISTS orders (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_no TEXT NOT NULL UNIQUE,
    verify_code TEXT NOT NULL, user_phone TEXT NOT NULL,
    user_name TEXT, user_address TEXT, user_region TEXT, user_note TEXT,
    service_item_id INTEGER, service_name TEXT, price REAL DEFAULT 0,
    platform_fee REAL DEFAULT 0, technician_fee REAL DEFAULT 0, merchant_fee REAL DEFAULT 0,
    status TEXT DEFAULT 'pending', source TEXT DEFAULT 'user',
    appointment_date TEXT, appointment_time TEXT,
    user_id INTEGER, technician_id INTEGER, merchant_id INTEGER,
    region_matched TEXT, quality_period INTEGER DEFAULT 0,
    cancel_reason TEXT, cancel_fee REAL DEFAULT 0,
    complaint_id INTEGER DEFAULT 0, dispute_id INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    accepted_at DATETIME, completed_at DATETIME, cancelled_at DATETIME,
    FOREIGN KEY (service_item_id) REFERENCES service_items(id),
    FOREIGN KEY (user_id) REFERENCES users(id),
    FOREIGN KEY (technician_id) REFERENCES technicians(id),
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );
  CREATE TABLE IF NOT EXISTS order_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    action TEXT NOT NULL, content TEXT, operator TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS order_remarks (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    type TEXT NOT NULL, content TEXT, author TEXT, visible_to TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS order_evaluations (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL UNIQUE,
    rating_attitude INTEGER DEFAULT 5, rating_skill INTEGER DEFAULT 5,
    rating_punctuality INTEGER DEFAULT 5, comment TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS onsite_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    status TEXT NOT NULL, remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS addition_requests (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    name TEXT, amount REAL DEFAULT 0, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id)
  );
  CREATE TABLE IF NOT EXISTS technician_gallery (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    order_id INTEGER, image_url TEXT, service_type TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
  );
  CREATE TABLE IF NOT EXISTS disputes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, order_id INTEGER NOT NULL,
    technician_id INTEGER, reason TEXT, evidence TEXT,
    status TEXT DEFAULT 'pending', result TEXT, processed_by INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (order_id) REFERENCES orders(id),
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
  );
  CREATE TABLE IF NOT EXISTS technician_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    type TEXT NOT NULL, amount REAL NOT NULL, balance_before REAL, balance_after REAL,
    order_id INTEGER, remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
  );
  CREATE TABLE IF NOT EXISTS technician_complaints (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    order_id INTEGER, content TEXT, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
  );
  CREATE TABLE IF NOT EXISTS technician_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, technician_id INTEGER NOT NULL,
    action TEXT NOT NULL, detail TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (technician_id) REFERENCES technicians(id)
  );
  CREATE TABLE IF NOT EXISTS merchant_transactions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL,
    type TEXT NOT NULL, amount REAL NOT NULL, order_id INTEGER, remark TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );
  CREATE TABLE IF NOT EXISTS merchant_withdrawals (
    id INTEGER PRIMARY KEY AUTOINCREMENT, merchant_id INTEGER NOT NULL,
    amount REAL NOT NULL, status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (merchant_id) REFERENCES merchants(id)
  );
  CREATE TABLE IF NOT EXISTS announcements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, content TEXT NOT NULL,
    target TEXT DEFAULT 'all', is_top INTEGER DEFAULT 0, is_pinned INTEGER DEFAULT 0,
    status TEXT DEFAULT 'published', published_at DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS announcement_reads (
    id INTEGER PRIMARY KEY AUTOINCREMENT, announcement_id INTEGER NOT NULL,
    reader_type TEXT NOT NULL, reader_id INTEGER,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (announcement_id) REFERENCES announcements(id)
  );
  CREATE TABLE IF NOT EXISTS verification_codes (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT NOT NULL, code TEXT NOT NULL,
    type TEXT DEFAULT 'login', expires_at DATETIME, used INTEGER DEFAULT 0,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS user_sessions (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, phone TEXT NOT NULL,
    token TEXT NOT NULL, role TEXT DEFAULT 'user',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    expires_at DATETIME
  );
  CREATE TABLE IF NOT EXISTS system_logs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, operator TEXT, action TEXT NOT NULL,
    detail TEXT, ip TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS site_config (
    id INTEGER PRIMARY KEY AUTOINCREMENT, config_key TEXT NOT NULL UNIQUE, config_value TEXT
  );
  CREATE TABLE IF NOT EXISTS user_agreements (
    id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER, phone TEXT,
    agreement_type TEXT NOT NULL, version INTEGER DEFAULT 1, agreed INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS login_attempts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, phone TEXT, ip TEXT,
    success INTEGER DEFAULT 0, locked_until DATETIME,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS api_rate_limits (
    id INTEGER PRIMARY KEY AUTOINCREMENT, ip TEXT, path TEXT, request_count INTEGER DEFAULT 1,
    window_start DATETIME DEFAULT CURRENT_TIMESTAMP
  );
  CREATE TABLE IF NOT EXISTS security_alerts (
    id INTEGER PRIMARY KEY AUTOINCREMENT, type TEXT, detail TEXT,
    status TEXT DEFAULT 'pending',
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
  );
`);

// ===== 初始化数据 =====
const cats = db.prepare('SELECT id FROM service_categories').all();
if (cats.length === 0) {
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('空调服务', '❄️', 1);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('厨电服务', '🍳', 2);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('智能家电', '📺', 3);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('水电暖通', '💧', 4);
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)').run('环境电器', '🌬️', 5);
}

const items = db.prepare('SELECT id FROM service_items').all();
if (items.length === 0) {
  const services = [
    [1,'空调清洗',80,150,60],[1,'空调加氟',100,200,45],[1,'空调维修',80,300,60],
    [1,'空调安装',150,400,120],[1,'空调移机',200,500,120],
    [2,'油烟机清洗',60,120,45],[2,'油烟机维修',50,200,60],[2,'燃气灶维修',50,150,45],
    [2,'消毒柜维修',50,150,45],[2,'集成灶维修',80,250,60],
    [3,'电视维修',50,200,45],[3,'冰箱维修',60,250,60],[3,'洗衣机维修',50,200,60],
    [3,'热水器维修',60,200,45],[3,'智能门锁安装',80,150,60],
    [4,'水管维修',50,150,45],[4,'电路维修',50,200,45],[4,'水龙头更换',30,80,30],
    [4,'马桶维修',40,120,45],[4,'暖气片安装',100,300,120],
    [5,'空气净化器清洗',50,100,30],[5,'净水器维修',60,200,45],[5,'新风机清洗',80,150,60],
    [5,'除湿机维修',50,150,45],[5,'加湿器维修',40,100,30]
  ];
  const ins = db.prepare('INSERT INTO service_items (category_id, name, price_min, price_max, duration, sort_score) VALUES (?,?,?,?,?,10)');
  for (const s of services) ins.run(s[0], s[1], s[2], s[3], s[4]);
}

const regions = db.prepare('SELECT id FROM regions').all();
if (regions.length === 0) {
  const names = ['磐石街道','曹城街道','青菏街道','郑庄街道','倪集街道','庄寨镇','普连集镇','古营集镇','侯集镇','苏集镇','孙老家镇','阎店楼镇','梁堤头镇','安蔡楼镇','大集镇','王集镇','楼庄镇','韩集镇','砖庙镇','常乐集镇','魏湾镇','仵楼镇','邵庄镇','朱洪庙镇'];
  const ins = db.prepare('INSERT INTO regions (name, type) VALUES (?,?)');
  names.forEach(n => ins.run(n, n.includes('街道')?'subdistrict':'town'));
}

const admin = db.prepare("SELECT id FROM site_config WHERE config_key='admin_created'").all();
if (admin.length === 0) {
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('admin_created','1')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('site_name','佳乐家')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('contact_phone','0530-1234567')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('agreement_appointment','预约协议默认内容')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('agreement_platform','平台服务协议默认内容')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('agreement_version','1')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('cancel_fee','5')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('overdue_days','3')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('region_timeout','30')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('default_platform_rate','10')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('default_technician_rate','5')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('default_merchant_rate','3')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('login_attempt_limit','5')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('code_expire_seconds','300')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('log_retention_days','90')").run();
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('export_fields','order_no,service_name,user_name,user_phone,user_address,user_region,price,platform_fee,status,appointment_date,completed_at')").run();
}

// 创建管理员账户（硬编码）
const admins = db.prepare("SELECT id FROM site_config WHERE config_key='admin_accounts'").all();
if (admins.length === 0) {
  db.prepare("INSERT INTO site_config (config_key, config_value) VALUES ('admin_accounts','1')").run();
  db.prepare('INSERT INTO users (phone, nickname) VALUES (?,?)').run('13800000000', '超级管理员');
}

// ===== 中间件 =====
const JWT_SECRET = process.env.JWT_SECRET || 'jialejia_v7_secret_key_2024';

function auth(roles) {
  return (req, res, next) => {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) return res.json({ code: 401, message: '请先登录', data: null });
    try {
      const decoded = jwt.verify(header.split(' ')[1], JWT_SECRET);
      req.user = decoded;
      if (roles && roles.length && !roles.includes(decoded.role)) return res.json({ code: 403, message: '权限不足', data: null });
      next();
    } catch (e) { return res.json({ code: 401, message: '登录已过期', data: null }); }
  };
}

function success(data, msg = '操作成功') { return { code: 200, message: msg, data, timestamp: Date.now() }; }
function fail(msg = '操作失败', code = 400) { return { code, message: msg, data: null, timestamp: Date.now() }; }

function generateOrderNo() {
  const d = new Date();
  const ds = `${d.getFullYear()}${String(d.getMonth()+1).padStart(2,'0')}${String(d.getDate()).padStart(2,'0')}`;
  return `FW${ds}${String(1000+Math.floor(Math.random()*9000))}`;
}

function generateCode() { return String(1000 + Math.floor(Math.random() * 9000)); }

// 文件上传
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.resolve(process.env.UPLOAD_DIR || './uploads');
    if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    const ext = path.extname(file.originalname);
    cb(null, `${Date.now()}-${Math.random().toString(36).slice(2,8)}${ext}`);
  }
});
const upload = multer({ storage, limits: { fileSize: 5 * 1024 * 1024 } });

// ===== 中间件：应用级别 =====
app.use(cors());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));
app.use('/uploads', express.static(path.resolve(process.env.UPLOAD_DIR || './uploads')));

// API限流
app.use('/api', (req, res, next) => {
  const ip = req.ip || req.connection.remoteAddress;
  const now = new Date();
  const windowStart = new Date(now.getTime() - 60000);
  const row = db.prepare('SELECT id, request_count FROM api_rate_limits WHERE ip=? AND path=? AND window_start>?').all(ip, req.path, windowStart.toISOString());
  if (row.length > 0) {
    if (row[0].request_count >= 60) return res.json(fail('请求过于频繁，请稍后再试', 429));
    db.prepare('UPDATE api_rate_limits SET request_count=request_count+1 WHERE id=?').run(row[0].id);
  } else {
    db.prepare('INSERT INTO api_rate_limits (ip, path, request_count) VALUES (?,?,1)').run(ip, req.path);
  }
  next();
});

// ===== 路由 =====
const router = express.Router();

// ---- 用户端 ----
router.post('/user/verification-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json(fail('请输入正确的手机号'));
  const recent = db.prepare('SELECT id FROM verification_codes WHERE phone=? AND created_at > datetime("now","-60 seconds")').all(phone);
  if (recent.length > 0) return res.json(fail('请60秒后再获取'));
  const code = generateCode();
  db.prepare('INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?,?,?,datetime("now","+5 minutes"))').run(phone, code, 'login');
  res.json(success({ code, message: '验证码已生成' }));
});

router.post('/user/login', (req, res) => {
  const { phone, code } = req.body;
  if (!phone || !code) return res.json(fail('请填写手机号和验证码'));
  // 检查锁定
  const locked = db.prepare("SELECT id FROM login_attempts WHERE phone=? AND locked_until>datetime('now') AND success=0").all(phone);
  if (locked.length > 0) return res.json(fail('账户已锁定，请5分钟后再试'));
  const vc = db.prepare('SELECT * FROM verification_codes WHERE phone=? AND code=? AND type=? AND used=0 AND expires_at>datetime("now") ORDER BY id DESC LIMIT 1').all(phone, code, 'login');
  if (vc.length === 0) {
    db.prepare('INSERT INTO login_attempts (phone, success) VALUES (?,0)').run(phone);
    // 检查失败次数
    const fails = db.prepare("SELECT count(*) as cnt FROM login_attempts WHERE phone=? AND success=0 AND created_at>datetime('now','-5 minutes')").all(phone);
    if (fails[0].cnt >= 5) db.prepare("UPDATE login_attempts SET locked_until=datetime('now','+5 minutes') WHERE phone=? AND success=0").run(phone);
    return res.json(fail('验证码错误或已过期'));
  }
  db.prepare('UPDATE verification_codes SET used=1 WHERE id=?').run(vc[0].id);
  db.prepare('INSERT INTO login_attempts (phone, success) VALUES (?,1)').run(phone);
  // 查找或创建用户
  let user = db.prepare('SELECT * FROM users WHERE phone=?').all(phone);
  if (user.length === 0) {
    db.prepare('INSERT INTO users (phone, nickname) VALUES (?,?)').run(phone, '用户' + phone.slice(-4));
    user = db.prepare('SELECT * FROM users WHERE phone=?').all(phone);
  } else { user = user; }
  const token = jwt.sign({ id: user[0].id, phone, role: 'user' }, JWT_SECRET, { expiresIn: '7d' });
  db.prepare('INSERT INTO user_sessions (user_id, phone, token, role, expires_at) VALUES (?,?,?,?,datetime("now","+7 days"))').run(user[0].id, phone, token, 'user');
  res.json(success({ token, user: user[0] }));
});

router.get('/user/profile', auth(), (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id=?').all(req.user.id);
  if (user.length === 0) return res.json(fail('用户不存在'));
  const addrs = db.prepare('SELECT * FROM user_addresses WHERE user_id=? ORDER BY is_default DESC, id DESC').all(req.user.id);
  res.json(success({ ...user[0], addresses: addrs }));
});

router.put('/user/profile', auth(), (req, res) => {
  const { nickname, avatar } = req.body;
  if (nickname) db.prepare('UPDATE users SET nickname=? WHERE id=?').run(nickname, req.user.id);
  if (avatar) db.prepare('UPDATE users SET avatar=? WHERE id=?').run(avatar, req.user.id);
  res.json(success(null, '更新成功'));
});

// 地址管理
router.post('/user/addresses', auth(), (req, res) => {
  const { label, region, address, is_default } = req.body;
  if (is_default) db.prepare('UPDATE user_addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  db.prepare('INSERT INTO user_addresses (user_id, label, region, address, is_default) VALUES (?,?,?,?,?)').run(req.user.id, label||'', region, address||'', is_default?1:0);
  res.json(success(null, '添加成功'));
});

router.put('/user/addresses/:id', auth(), (req, res) => {
  const { label, region, address, is_default } = req.body;
  if (is_default) db.prepare('UPDATE user_addresses SET is_default=0 WHERE user_id=?').run(req.user.id);
  db.prepare('UPDATE user_addresses SET label=?, region=?, address=?, is_default=? WHERE id=? AND user_id=?').run(label||'', region, address||'', is_default?1:0, req.params.id, req.user.id);
  res.json(success(null, '更新成功'));
});

router.delete('/user/addresses/:id', auth(), (req, res) => {
  db.prepare('DELETE FROM user_addresses WHERE id=? AND user_id=?').run(req.params.id, req.user.id);
  res.json(success(null, '删除成功'));
});

// ---- 服务分类/项目 ----
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

// ---- 公告 ----
router.get('/announcements', (req, res) => {
  const page = parseInt(req.query.page) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  const total = db.prepare('SELECT count(*) as cnt FROM announcements WHERE status="published"').all()[0].cnt;
  const list = db.prepare('SELECT id,title,is_top,is_pinned,published_at,created_at FROM announcements WHERE status="published" ORDER BY is_top DESC, is_pinned DESC, created_at DESC LIMIT ? OFFSET ?').all(limit, offset);
  res.json(success({ list, total, page, totalPages: Math.ceil(total/limit) }));
});

router.get('/announcements/:id', (req, res) => {
  const a = db.prepare('SELECT * FROM announcements WHERE id=?').all(req.params.id);
  if (a.length === 0) return res.json(fail('公告不存在'));
  res.json(success(a[0]));
});

// ---- 订单 ----
router.post('/orders', (req, res) => {
  const { user_name, user_phone, user_region, user_address, user_note, service_item_id, appointment_date, appointment_time } = req.body;
  if (!user_name || !user_phone || !user_region || !service_item_id || !appointment_date || !appointment_time) return res.json(fail('请填写完整信息'));
  if (!/^1\d{10}$/.test(user_phone)) return res.json(fail('请输入正确的手机号'));
  const item = db.prepare('SELECT * FROM service_items WHERE id=? AND status=1').all(service_item_id);
  if (item.length === 0) return res.json(fail('服务项目不存在'));
  const orderNo = generateOrderNo();
  const verifyCode = generateCode();
  // 匹配区域
  const regionMatch = db.prepare('SELECT name FROM regions WHERE instr(?,name)>0 LIMIT 1').all(user_region);
  const regionMatched = regionMatch.length > 0 ? regionMatch[0].name : null;
  const r = db.prepare(`INSERT INTO orders (order_no, verify_code, user_phone, user_name, user_address, user_region, user_note, service_item_id, service_name, price, platform_fee, technician_fee, merchant_fee, status, source, appointment_date, appointment_time, region_matched)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    orderNo, verifyCode, user_phone, user_name, user_address||'', user_region, user_note||'',
    service_item_id, item[0].name, item[0].price_min, item[0].platform_rate, item[0].technician_rate, item[0].merchant_rate,
    regionMatched ? 'pending' : 'bidding', 'user',
    appointment_date, appointment_time, regionMatched
  );
  const orderId = Number(r.lastInsertRowid);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(orderId, 'created', '用户下单', '系统');
  if (regionMatched) {
    db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(orderId, 'region_matched', `匹配区域: ${regionMatched}`, '系统');
  } else {
    db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(orderId, 'bidding', '未匹配到区域，进入抢单池', '系统');
  }
  res.json(success({ order_no: orderNo, verify_code: verifyCode }, '下单成功'));
});

router.get('/orders', (req, res) => {
  const { phone, code } = req.query;
  if (!phone || !code) return res.json(fail('请提供手机号和验证码'));
  const vc = db.prepare("SELECT * FROM verification_codes WHERE phone=? AND code=? AND type='order_query' AND used=0 AND expires_at>datetime('now') ORDER BY id DESC LIMIT 1").all(phone, code);
  if (vc.length === 0) return res.json(fail('验证码错误或已过期'));
  db.prepare('UPDATE verification_codes SET used=1 WHERE id=?').run(vc[0].id);
  const { status, page: p } = req.query;
  const page = parseInt(p) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM orders WHERE user_phone=?';
  const params = [phone];
  if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const orders = db.prepare(sql).all(...params);
  const total = db.prepare(status && status !== 'all' ? 'SELECT count(*) as cnt FROM orders WHERE user_phone=? AND status=?' : 'SELECT count(*) as cnt FROM orders WHERE user_phone=?').all(...(status && status !== 'all' ? [phone, status] : [phone]))[0].cnt;
  res.json(success({ list: orders, total, page, totalPages: Math.ceil(total/limit) }));
});

router.get('/orders/:orderNo', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no=?').all(req.params.orderNo);
  if (order.length === 0) return res.json(fail('订单不存在'));
  const logs = db.prepare('SELECT * FROM order_logs WHERE order_id=? ORDER BY created_at ASC').all(order[0].id);
  const remarks = db.prepare('SELECT * FROM order_remarks WHERE order_id=? ORDER BY created_at DESC').all(order[0].id);
  const evalData = db.prepare('SELECT * FROM order_evaluations WHERE order_id=?').all(order[0].id);
  const tech = order[0].technician_id ? db.prepare('SELECT id,name,phone,rating_avg,total_ratings,avatar FROM technicians WHERE id=?').all(order[0].technician_id) : [];
  res.json(success({ ...order[0], logs, remarks, evaluation: evalData[0]||null, technician: tech[0]||null }));
});

router.post('/orders/:orderNo/cancel', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no=?').all(req.params.orderNo);
  if (order.length === 0) return res.json(fail('订单不存在'));
  if (order[0].status !== 'pending' && order[0].status !== 'bidding') return res.json(fail('当前状态不可取消'));
  const { reason } = req.body;
  db.prepare('UPDATE orders SET status=?, cancelled_at=datetime("now"), cancel_reason=? WHERE id=?').run('cancelled', reason||'用户取消', order[0].id);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'cancelled', reason||'用户取消', '用户');
  res.json(success(null, '已取消'));
});

router.post('/orders/:orderNo/evaluate', (req, res) => {
  const order = db.prepare('SELECT * FROM orders WHERE order_no=?').all(req.params.orderNo);
  if (order.length === 0) return res.json(fail('订单不存在'));
  if (order[0].status !== 'completed') return res.json(fail('仅已完成订单可评价'));
  const { rating_attitude, rating_skill, rating_punctuality, comment } = req.body;
  db.prepare('INSERT OR REPLACE INTO order_evaluations (order_id, rating_attitude, rating_skill, rating_punctuality, comment) VALUES (?,?,?,?,?)').run(order[0].id, rating_attitude||5, rating_skill||5, rating_punctuality||5, comment||'');
  // 更新师傅评分
  if (order[0].technician_id) {
    const stats = db.prepare('SELECT avg((rating_attitude+rating_skill+rating_punctuality)/3.0) as avg_r, count(*) as cnt FROM order_evaluations WHERE order_id IN (SELECT id FROM orders WHERE technician_id=?)').all(order[0].technician_id);
    if (stats[0].cnt > 0) {
      db.prepare('UPDATE technicians SET rating_avg=?, total_ratings=? WHERE id=?').run(Number(stats[0].avg_r).toFixed(1), stats[0].cnt, order[0].technician_id);
    }
  }
  res.json(success(null, '评价成功'));
});

// 查询订单验证码
router.post('/orders/query-code', (req, res) => {
  const { phone } = req.body;
  if (!phone || !/^1\d{10}$/.test(phone)) return res.json(fail('请输入正确的手机号'));
  const recent = db.prepare("SELECT id FROM verification_codes WHERE phone=? AND type='order_query' AND created_at > datetime('now','-60 seconds')").all(phone);
  if (recent.length > 0) return res.json(fail('请60秒后再获取'));
  const code = generateCode();
  db.prepare("INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?,?,'order_query',datetime('now','+5 minutes'))").run(phone, code);
  res.json(success({ code, message: '验证码已生成' }));
});

// ---- 师傅端 ----
router.post('/technician/login', (req, res) => {
  const { phone, password } = req.body;
  if (!phone || !password) return res.json(fail('请填写账号和密码'));
  const tech = db.prepare('SELECT * FROM technicians WHERE phone=? AND password=?').all(phone, password);
  if (tech.length === 0) {
    db.prepare('INSERT INTO login_attempts (phone, success) VALUES (?,0)').run(phone);
    return res.json(fail('账号或密码错误'));
  }
  db.prepare('INSERT INTO login_attempts (phone, success) VALUES (?,1)').run(phone);
  const token = jwt.sign({ id: tech[0].id, phone, role: 'technician' }, JWT_SECRET, { expiresIn: '7d' });
  db.prepare('INSERT INTO user_sessions (user_id, phone, token, role, expires_at) VALUES (?,?,?,?,datetime("now","+7 days"))').run(tech[0].id, phone, token, 'technician');
  db.prepare('INSERT INTO technician_logs (technician_id, action, detail) VALUES (?,?,?)').run(tech[0].id, 'login', '登录系统');
  res.json(success({ token, user: tech[0] }));
});

router.get('/technician/profile', auth(['technician']), (req, res) => {
  const tech = db.prepare('SELECT * FROM technicians WHERE id=?').all(req.user.id);
  if (tech.length === 0) return res.json(fail('师傅不存在'));
  // 今日统计
  const todayOrders = db.prepare("SELECT count(*) as cnt FROM orders WHERE technician_id=? AND date(created_at)=date('now')").all(req.user.id)[0].cnt;
  const todayDone = db.prepare("SELECT count(*) as cnt FROM orders WHERE technician_id=? AND status='completed' AND date(completed_at)=date('now')").all(req.user.id)[0].cnt;
  const todayIncome = db.prepare("SELECT coalesce(sum(price),0) as total FROM orders WHERE technician_id=? AND status='completed' AND date(completed_at)=date('now')").all(req.user.id)[0].total;
  res.json(success({ ...tech[0], todayOrders, todayDone, todayIncome }));
});

router.put('/technician/profile', auth(['technician']), (req, res) => {
  const { name, avatar, accept_radius, busy } = req.body;
  if (name !== undefined) db.prepare('UPDATE technicians SET name=? WHERE id=?').run(name, req.user.id);
  if (avatar !== undefined) db.prepare('UPDATE technicians SET avatar=? WHERE id=?').run(avatar, req.user.id);
  if (accept_radius !== undefined) db.prepare('UPDATE technicians SET accept_radius=? WHERE id=?').run(accept_radius, req.user.id);
  if (busy !== undefined) db.prepare('UPDATE technicians SET busy=? WHERE id=?').run(busy?1:0, req.user.id);
  res.json(success(null, '更新成功'));
});

// 师傅工单
router.get('/technician/orders', auth(['technician']), (req, res) => {
  const tech = db.prepare('SELECT * FROM technicians WHERE id=?').all(req.user.id);
  const { tab } = req.query;
  let orders = [];
  if (tab === 'region') {
    orders = db.prepare("SELECT * FROM orders WHERE status='pending' AND region_matched=? AND region_matched IS NOT NULL ORDER BY created_at DESC").all(tech[0].region);
  } else if (tab === 'bidding') {
    orders = db.prepare("SELECT * FROM orders WHERE status='bidding' ORDER BY created_at DESC").all();
  } else if (tab === 'transfer') {
    orders = db.prepare("SELECT * FROM orders WHERE status='transferring' ORDER BY created_at DESC").all();
  } else {
    orders = db.prepare("SELECT * FROM orders WHERE (status='pending' AND region_matched=?) OR status='bidding' OR status='transferring' ORDER BY created_at DESC").all(tech[0].region);
  }
  res.json(success(orders));
});

// 师傅进行中订单
router.get('/technician/active-orders', auth(['technician']), (req, res) => {
  const orders = db.prepare("SELECT * FROM orders WHERE technician_id=? AND status IN ('accepted','in_progress') ORDER BY accepted_at DESC").all(req.user.id);
  res.json(success(orders));
});

// 师傅接单
router.post('/technician/orders/accept', auth(['technician']), (req, res) => {
  const { order_no } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND status IN ('pending','bidding')").all(order_no);
  if (order.length === 0) return res.json(fail('订单不存在或已被接走'));
  const tech = db.prepare('SELECT * FROM technicians WHERE id=?').all(req.user.id);
  if (tech[0].busy) return res.json(fail('您已设置为忙碌状态'));
  db.prepare("UPDATE orders SET status='accepted', technician_id=?, accepted_at=datetime('now') WHERE id=?").run(req.user.id, order[0].id);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'accepted', `师傅 ${tech[0].name} 已接单`, '系统');
  db.prepare('INSERT INTO technician_logs (technician_id, action, detail) VALUES (?,?,?)').run(req.user.id, 'accept_order', `接单: ${order_no}`);
  res.json(success(null, '接单成功'));
});

// 师傅完工
router.post('/technician/orders/complete', auth(['technician']), (req, res) => {
  const { order_no, price, quality_period, images } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND technician_id=? AND status='accepted'").all(order_no, req.user.id);
  if (order.length === 0) return res.json(fail('订单不存在或状态错误'));
  const actualPrice = price || order[0].price;
  const platformRate = order[0].platform_fee || 10;
  const platformFee = Math.round(actualPrice * platformRate / 100);
  db.prepare('UPDATE orders SET status=?, price=?, platform_fee=?, quality_period=?, completed_at=datetime("now") WHERE id=?').run('completed', actualPrice, platformFee, quality_period||0, order[0].id);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'completed', `完工，实收¥${actualPrice}，抽成¥${platformFee}`, '系统');
  // 扣师傅余额
  db.prepare('UPDATE technicians SET balance=balance-? WHERE id=?').run(platformFee, req.user.id);
  db.prepare('INSERT INTO technician_transactions (technician_id, type, amount, balance_before, balance_after, order_id, remark) VALUES (?,?,?, (SELECT balance+? FROM technicians WHERE id=?), (SELECT balance FROM technicians WHERE id=?), ?, ?)').run(req.user.id, 'platform_fee', -platformFee, platformFee, req.user.id, order[0].id, '平台抽成');
  // 保存图片
  if (images && Array.isArray(images)) {
    const ins = db.prepare('INSERT INTO technician_gallery (technician_id, order_id, image_url, service_type) VALUES (?,?,?,?)');
    for (const img of images) ins.run(req.user.id, order[0].id, img, order[0].service_name);
  }
  res.json(success(null, '完工确认成功'));
});

// 师傅转派
router.post('/technician/orders/transfer', auth(['technician']), (req, res) => {
  const { order_no, target_technician_id, remark } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND technician_id=? AND status='accepted'").all(order_no, req.user.id);
  if (order.length === 0) return res.json(fail('订单不存在或状态错误'));
  db.prepare("UPDATE orders SET status='transferring', technician_id=? WHERE id=?").run(target_technician_id, order[0].id);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'transfer', `转派给师傅ID:${target_technician_id}，备注:${remark||''}`, '系统');
  db.prepare('INSERT INTO order_remarks (order_id, type, content, author, visible_to) VALUES (?,?,?,?,?)').run(order[0].id, 'transfer', remark||'', `师傅ID:${req.user.id}`, 'technician,admin');
  res.json(success(null, '转派成功'));
});

// 师傅取消
router.post('/technician/orders/cancel', auth(['technician']), (req, res) => {
  const { order_no, reason } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND technician_id=? AND status IN ('accepted','in_progress')").all(order_no, req.user.id);
  if (order.length === 0) return res.json(fail('订单不存在或状态错误'));
  if (!reason) return res.json(fail('请填写取消原因'));
  // 计算扣分
  const acceptedAt = new Date(order[0].accepted_at);
  const now = new Date();
  const diffMin = (now - acceptedAt) / 60000;
  let deductScore = 2;
  let penalty = '';
  if (diffMin > 30) { deductScore = 10; penalty = '，限制抢单24小时'; }
  else if (diffMin > 5) { deductScore = 5; penalty = '，限制抢单4小时'; }
  db.prepare('UPDATE technicians SET credit_score=MAX(0,credit_score-?) WHERE id=?').run(deductScore, req.user.id);
  db.prepare("UPDATE orders SET status='cancelled', cancel_reason=?, cancelled_at=datetime('now') WHERE id=?").run(reason, order[0].id);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'cancelled', `师傅取消: ${reason}，扣信用分${deductScore}分${penalty}`, '系统');
  db.prepare('INSERT INTO order_remarks (order_id, type, content, author, visible_to) VALUES (?,?,?,?,?)').run(order[0].id, 'cancel', reason, `师傅ID:${req.user.id}`, 'user,admin');
  db.prepare('INSERT INTO technician_logs (technician_id, action, detail) VALUES (?,?,?)').run(req.user.id, 'cancel_order', `取消订单: ${order_no}，原因: ${reason}，扣分: ${deductScore}`);
  res.json(success(null, `已取消，扣信用分${deductScore}分${penalty}`));
});

// 现场状态
router.post('/technician/orders/onsite', auth(['technician']), (req, res) => {
  const { order_no, status, remark } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND technician_id=? AND status='accepted'").all(order_no, req.user.id);
  if (order.length === 0) return res.json(fail('订单不存在或状态错误'));
  db.prepare('INSERT INTO onsite_logs (order_id, status, remark) VALUES (?,?,?)').run(order[0].id, status, remark||'');
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'onsite', `现场状态: ${status}，备注: ${remark||''}`, '系统');
  db.prepare('INSERT INTO order_remarks (order_id, type, content, author, visible_to) VALUES (?,?,?,?,?)').run(order[0].id, 'onsite', `现场状态: ${status}${remark?' - '+remark:''}`, `师傅ID:${req.user.id}`, 'user,admin');
  res.json(success(null, '已上报'));
});

// 增项申请
router.post('/technician/orders/addition', auth(['technician']), (req, res) => {
  const { order_no, name, amount } = req.body;
  const order = db.prepare("SELECT * FROM orders WHERE order_no=? AND technician_id=? AND status='accepted'").all(order_no, req.user.id);
  if (order.length === 0) return res.json(fail('订单不存在或状态错误'));
  db.prepare('INSERT INTO addition_requests (order_id, name, amount) VALUES (?,?,?)').run(order[0].id, name||'增项', amount||0);
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'addition_requested', `增项申请: ${name||''} ¥${amount||0}`, '系统');
  res.json(success(null, '增项申请已提交，等待用户确认'));
});

// 确认增项
router.post('/orders/:orderNo/addition/confirm', (req, res) => {
  const { confirm } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE order_no=?').all(req.params.orderNo);
  if (order.length === 0) return res.json(fail('订单不存在'));
  const add = db.prepare("SELECT * FROM addition_requests WHERE order_id=? AND status='pending' ORDER BY id DESC LIMIT 1").all(order[0].id);
  if (add.length === 0) return res.json(fail('没有待确认的增项'));
  if (confirm) {
    db.prepare("UPDATE addition_requests SET status='approved' WHERE id=?").run(add[0].id);
    db.prepare('UPDATE orders SET price=price+? WHERE id=?').run(add[0].amount, order[0].id);
    db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'addition_approved', `增项已确认: ¥${add[0].amount}`, '用户');
  } else {
    db.prepare("UPDATE addition_requests SET status='rejected' WHERE id=?").run(add[0].id);
    db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(order[0].id, 'addition_rejected', '增项已拒绝', '用户');
  }
  res.json(success(null, confirm ? '增项已确认' : '增项已拒绝'));
});

// 师傅统计
router.get('/technician/statistics', auth(['technician']), (req, res) => {
  const monthStart = new Date(); monthStart.setDate(1); monthStart.setHours(0,0,0,0);
  const monthIncome = db.prepare("SELECT coalesce(sum(price),0) as total FROM orders WHERE technician_id=? AND status='completed' AND completed_at>=?").all(req.user.id, monthStart.toISOString())[0].total;
  const totalIncome = db.prepare("SELECT coalesce(sum(price),0) as total FROM orders WHERE technician_id=? AND status='completed'").all(req.user.id)[0].total;
  const totalOrders = db.prepare("SELECT count(*) as cnt FROM orders WHERE technician_id=?").all(req.user.id)[0].cnt;
  const weekData = db.prepare("SELECT date(completed_at) as day, coalesce(sum(price),0) as income FROM orders WHERE technician_id=? AND status='completed' AND completed_at>=datetime('now','-7 days') GROUP BY day ORDER BY day").all(req.user.id);
  res.json(success({ monthIncome, totalIncome, totalOrders, weekData }));
});

// 师傅余额明细
router.get('/technician/balance', auth(['technician']), (req, res) => {
  const txns = db.prepare('SELECT * FROM technician_transactions WHERE technician_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json(success(txns));
});

// 师傅图库
router.get('/technician/gallery', auth(['technician']), (req, res) => {
  const imgs = db.prepare('SELECT * FROM technician_gallery WHERE technician_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(imgs));
});

// 师傅争议
router.get('/technician/disputes', auth(['technician']), (req, res) => {
  const list = db.prepare('SELECT * FROM disputes WHERE technician_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(list));
});

router.post('/technician/disputes', auth(['technician']), (req, res) => {
  const { order_id, reason, evidence } = req.body;
  db.prepare('INSERT INTO disputes (order_id, technician_id, reason, evidence) VALUES (?,?,?,?)').run(order_id, req.user.id, reason, evidence||'');
  db.prepare("UPDATE orders SET dispute_id=(SELECT id FROM disputes WHERE order_id=? ORDER BY id DESC LIMIT 1), status='disputed' WHERE id=?").run(order_id, order_id);
  res.json(success(null, '申诉已提交'));
});

// 师傅历史订单
router.get('/technician/history', auth(['technician']), (req, res) => {
  const { status, page: p } = req.query;
  const page = parseInt(p) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  let sql = "SELECT * FROM orders WHERE technician_id=? AND status NOT IN ('pending','bidding','accepted','in_progress')";
  const params = [req.user.id];
  if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const orders = db.prepare(sql).all(...params);
  const total = db.prepare('SELECT count(*) as cnt FROM orders WHERE technician_id=?').all(req.user.id)[0].cnt;
  res.json(success({ list: orders, total, page, totalPages: Math.ceil(total/limit) }));
});

// ---- 商家端 ----
router.post('/merchant/login', (req, res) => {
  const { phone, password } = req.body;
  const mer = db.prepare('SELECT * FROM merchants WHERE phone=? AND password=?').all(phone, password);
  if (mer.length === 0) return res.json(fail('账号或密码错误'));
  const token = jwt.sign({ id: mer[0].id, phone, role: 'merchant' }, JWT_SECRET, { expiresIn: '7d' });
  res.json(success({ token, user: mer[0] }));
});

router.get('/merchant/statistics', auth(['merchant']), (req, res) => {
  const totalOrders = db.prepare('SELECT count(*) as cnt FROM orders WHERE merchant_id=?').all(req.user.id)[0].cnt;
  const totalIncome = db.prepare('SELECT coalesce(sum(merchant_fee),0) as total FROM orders WHERE merchant_id=? AND status="completed"').all(req.user.id)[0].total;
  const monthIncome = db.prepare("SELECT coalesce(sum(merchant_fee),0) as total FROM orders WHERE merchant_id=? AND status='completed' AND completed_at>=datetime('now','-30 days')").all(req.user.id)[0].total;
  const balance = db.prepare('SELECT balance FROM merchants WHERE id=?').all(req.user.id)[0].balance;
  res.json(success({ totalOrders, totalIncome, monthIncome, balance }));
});

router.get('/merchant/orders', auth(['merchant']), (req, res) => {
  const orders = db.prepare('SELECT * FROM orders WHERE merchant_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(orders));
});

router.post('/merchant/orders', auth(['merchant']), (req, res) => {
  const { user_name, user_phone, user_region, user_address, service_item_id, appointment_date, appointment_time, remark, merchant_remark } = req.body;
  if (!user_name || !user_phone || !user_region || !service_item_id || !appointment_date || !appointment_time) return res.json(fail('请填写完整信息'));
  const item = db.prepare('SELECT * FROM service_items WHERE id=? AND status=1').all(service_item_id);
  if (item.length === 0) return res.json(fail('服务项目不存在'));
  const orderNo = generateOrderNo();
  const verifyCode = generateCode();
  const regionMatch = db.prepare('SELECT name FROM regions WHERE instr(?,name)>0 LIMIT 1').all(user_region);
  const regionMatched = regionMatch.length > 0 ? regionMatch[0].name : null;
  db.prepare(`INSERT INTO orders (order_no, verify_code, user_phone, user_name, user_address, user_region, user_note, service_item_id, service_name, price, platform_fee, technician_fee, merchant_fee, status, source, appointment_date, appointment_time, region_matched, merchant_id)
    VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)`).run(
    orderNo, verifyCode, user_phone, user_name, user_address||'', user_region, remark||'',
    service_item_id, item[0].name, item[0].price_min, item[0].platform_rate, item[0].technician_rate, item[0].merchant_rate,
    regionMatched?'pending':'bidding', 'merchant', appointment_date, appointment_time, regionMatched, req.user.id
  );
  if (merchant_remark) {
    db.prepare('INSERT INTO order_remarks (order_id, type, content, author, visible_to) VALUES ((SELECT id FROM orders WHERE order_no=?),?,?,?,?)').run(orderNo, 'merchant', merchant_remark, `商家ID:${req.user.id}`, 'technician,admin');
  }
  res.json(success({ order_no: orderNo, verify_code: verifyCode }, '代报成功'));
});

router.get('/merchant/income', auth(['merchant']), (req, res) => {
  const txns = db.prepare('SELECT * FROM merchant_transactions WHERE merchant_id=? ORDER BY created_at DESC LIMIT 100').all(req.user.id);
  res.json(success(txns));
});

router.post('/merchant/withdraw', auth(['merchant']), (req, res) => {
  const { amount } = req.body;
  const mer = db.prepare('SELECT * FROM merchants WHERE id=?').all(req.user.id);
  if (mer[0].balance < amount) return res.json(fail('余额不足'));
  db.prepare('INSERT INTO merchant_withdrawals (merchant_id, amount) VALUES (?,?)').run(req.user.id, amount);
  res.json(success(null, '提现申请已提交'));
});

router.get('/merchant/withdraws', auth(['merchant']), (req, res) => {
  const list = db.prepare('SELECT * FROM merchant_withdrawals WHERE merchant_id=? ORDER BY created_at DESC').all(req.user.id);
  res.json(success(list));
});

// ---- 后台管理 ----
router.post('/admin/login', (req, res) => {
  const { username, password } = req.body;
  if (username === 'admin' && password === 'admin123') {
    const token = jwt.sign({ id: 1, username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json(success({ token, user: { username, role: 'admin' } }));
  }
  // 也可以从数据库验证
  const user = db.prepare('SELECT * FROM users WHERE phone=?').all(username);
  if (user.length > 0) {
    const token = jwt.sign({ id: user[0].id, phone: username, role: 'admin' }, JWT_SECRET, { expiresIn: '7d' });
    return res.json(success({ token, user: { ...user[0], role: 'admin' } }));
  }
  res.json(fail('账号或密码错误'));
});

router.get('/admin/dashboard', auth(['admin']), (req, res) => {
  const totalOrders = db.prepare('SELECT count(*) as cnt FROM orders').all()[0].cnt;
  const todayOrders = db.prepare("SELECT count(*) as cnt FROM orders WHERE date(created_at)=date('now')").all()[0].cnt;
  const todayFee = db.prepare("SELECT coalesce(sum(platform_fee),0) as total FROM orders WHERE status='completed' AND date(completed_at)=date('now')").all()[0].total;
  const onlineTechs = db.prepare("SELECT count(*) as cnt FROM technicians WHERE status=1 AND busy=0").all()[0].cnt;
  const overdue = db.prepare("SELECT count(*) as cnt FROM orders WHERE status='accepted' AND julianday('now')-julianday(accepted_at)>(SELECT coalesce(config_value,3) FROM site_config WHERE config_key='overdue_days')").all()[0].cnt;
  const recentOrders = db.prepare('SELECT * FROM orders ORDER BY created_at DESC LIMIT 10').all();
  res.json(success({ totalOrders, todayOrders, todayFee, onlineTechs, overdue, recentOrders }));
});

router.get('/admin/orders', auth(['admin']), (req, res) => {
  const { status, region, source, start_date, end_date, page: p, deleted } = req.query;
  const page = parseInt(p) || 1;
  const limit = 20;
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM orders WHERE 1=1';
  const params = [];
  if (deleted === '1') { sql += ' AND status="deleted"'; }
  else { sql += ' AND status!="deleted"'; }
  if (status && status !== 'all') { sql += ' AND status=?'; params.push(status); }
  if (region) { sql += ' AND user_region LIKE ?'; params.push(`%${region}%`); }
  if (source) { sql += ' AND source=?'; params.push(source); }
  if (start_date) { sql += ' AND date(created_at)>=?'; params.push(start_date); }
  if (end_date) { sql += ' AND date(created_at)<=?'; params.push(end_date); }
  const countSql = sql.replace('SELECT *', 'SELECT count(*) as cnt');
  const total = db.prepare(countSql).all(...params)[0].cnt;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const orders = db.prepare(sql).all(...params);
  res.json(success({ list: orders, total, page, totalPages: Math.ceil(total/limit) }));
});

router.put('/admin/orders/:id', auth(['admin']), (req, res) => {
  const { status, technician_id, cancel_reason } = req.body;
  const order = db.prepare('SELECT * FROM orders WHERE id=?').all(req.params.id);
  if (order.length === 0) return res.json(fail('订单不存在'));
  if (status === 'deleted') {
    db.prepare("UPDATE orders SET status='deleted' WHERE id=?").run(req.params.id);
  } else {
    if (status) db.prepare('UPDATE orders SET status=? WHERE id=?').run(status, req.params.id);
    if (technician_id) db.prepare('UPDATE orders SET technician_id=? WHERE id=?').run(technician_id, req.params.id);
    if (cancel_reason) db.prepare('UPDATE orders SET cancel_reason=? WHERE id=?').run(cancel_reason, req.params.id);
  }
  db.prepare('INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,?,?,?)').run(req.params.id, 'admin_update', `管理员更新: ${JSON.stringify(req.body)}`, req.user.username||'admin');
  db.prepare("INSERT INTO system_logs (operator, action, detail, ip) VALUES (?,?,?,?)").run(req.user.username||'admin', 'update_order', `订单ID:${req.params.id}`, req.ip);
  res.json(success(null, '更新成功'));
});

router.post('/admin/orders/restore/:id', auth(['admin']), (req, res) => {
  db.prepare("UPDATE orders SET status='pending' WHERE id=? AND status='deleted'").run(req.params.id);
  res.json(success(null, '已恢复'));
});

router.get('/admin/technicians', auth(['admin']), (req, res) => {
  const { region, status, search } = req.query;
  let sql = 'SELECT * FROM technicians WHERE 1=1';
  const params = [];
  if (region) { sql += ' AND region LIKE ?'; params.push(`%${region}%`); }
  if (status) { sql += ' AND status=?'; params.push(status); }
  if (search) { sql += ' AND (name LIKE ? OR phone LIKE ?)'; params.push(`%${search}%`, `%${search}%`); }
  sql += ' ORDER BY id DESC';
  res.json(success(db.prepare(sql).all(...params)));
});

router.post('/admin/technicians', auth(['admin']), (req, res) => {
  const { name, phone, password, region } = req.body;
  if (!name || !phone || !password || !region) return res.json(fail('请填写完整信息'));
  db.prepare('INSERT INTO technicians (name, phone, password, region) VALUES (?,?,?,?)').run(name, phone, password, region);
  db.prepare("INSERT INTO system_logs (operator, action, detail, ip) VALUES (?,?,?,?)").run(req.user.username||'admin', 'create_technician', `添加师傅: ${name}`, req.ip);
  res.json(success(null, '添加成功'));
});

router.put('/admin/technicians/:id', auth(['admin']), (req, res) => {
  const { name, phone, region, status, credit_score, balance, wechat_userid } = req.body;
  if (name !== undefined) db.prepare('UPDATE technicians SET name=? WHERE id=?').run(name, req.params.id);
  if (phone !== undefined) db.prepare('UPDATE technicians SET phone=? WHERE id=?').run(phone, req.params.id);
  if (region !== undefined) db.prepare('UPDATE technicians SET region=? WHERE id=?').run(region, req.params.id);
  if (status !== undefined) db.prepare('UPDATE technicians SET status=? WHERE id=?').run(status, req.params.id);
  if (credit_score !== undefined) db.prepare('UPDATE technicians SET credit_score=? WHERE id=?').run(credit_score, req.params.id);
  if (balance !== undefined) db.prepare('UPDATE technicians SET balance=? WHERE id=?').run(balance, req.params.id);
  if (wechat_userid !== undefined) db.prepare('UPDATE technicians SET wechat_userid=? WHERE id=?').run(wechat_userid, req.params.id);
  res.json(success(null, '更新成功'));
});

router.get('/admin/technicians/:id', auth(['admin']), (req, res) => {
  const tech = db.prepare('SELECT * FROM technicians WHERE id=?').all(req.params.id);
  if (tech.length === 0) return res.json(fail('师傅不存在'));
  const logs = db.prepare('SELECT * FROM technician_logs WHERE technician_id=? ORDER BY created_at DESC LIMIT 50').all(req.params.id);
  const complaints = db.prepare('SELECT * FROM technician_complaints WHERE technician_id=? ORDER BY created_at DESC').all(req.params.id);
  const disputes = db.prepare('SELECT * FROM disputes WHERE technician_id=? ORDER BY created_at DESC').all(req.params.id);
  const history = db.prepare("SELECT * FROM orders WHERE technician_id=? AND status NOT IN ('pending','bidding') ORDER BY created_at DESC LIMIT 20").all(req.params.id);
  res.json(success({ ...tech[0], logs, complaints, disputes, history }));
});

router.get('/admin/merchants', auth(['admin']), (req, res) => {
  res.json(success(db.prepare('SELECT * FROM merchants ORDER BY id DESC').all()));
});

router.post('/admin/merchants', auth(['admin']), (req, res) => {
  const { name, contact, phone, password, referral_rate } = req.body;
  if (!name || !contact || !phone || !password) return res.json(fail('请填写完整信息'));
  db.prepare('INSERT INTO merchants (name, contact, phone, password, referral_rate) VALUES (?,?,?,?,?)').run(name, contact, phone, password, referral_rate||3);
  res.json(success(null, '添加成功'));
});

router.put('/admin/merchants/:id', auth(['admin']), (req, res) => {
  const { name, contact, phone, status, referral_rate, balance } = req.body;
  if (name !== undefined) db.prepare('UPDATE merchants SET name=? WHERE id=?').run(name, req.params.id);
  if (contact !== undefined) db.prepare('UPDATE merchants SET contact=? WHERE id=?').run(contact, req.params.id);
  if (phone !== undefined) db.prepare('UPDATE merchants SET phone=? WHERE id=?').run(phone, req.params.id);
  if (status !== undefined) db.prepare('UPDATE merchants SET status=? WHERE id=?').run(status, req.params.id);
  if (referral_rate !== undefined) db.prepare('UPDATE merchants SET referral_rate=? WHERE id=?').run(referral_rate, req.params.id);
  if (balance !== undefined) db.prepare('UPDATE merchants SET balance=? WHERE id=?').run(balance, req.params.id);
  res.json(success(null, '更新成功'));
});

router.post('/admin/merchants/withdraw/:id', auth(['admin']), (req, res) => {
  db.prepare("UPDATE merchant_withdrawals SET status='completed' WHERE id=?").run(req.params.id);
  res.json(success(null, '已结算'));
});

router.get('/admin/services', auth(['admin']), (req, res) => {
  const categories = db.prepare('SELECT * FROM service_categories ORDER BY sort_order').all();
  const items = db.prepare('SELECT * FROM service_items ORDER BY sort_score DESC, id ASC').all();
  res.json(success({ categories, items }));
});

router.post('/admin/services', auth(['admin']), (req, res) => {
  const { category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score } = req.body;
  const r = db.prepare('INSERT INTO service_items (category_id, name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score) VALUES (?,?,?,?,?,?,?,?,?)').run(category_id, name, price_min||0, price_max||0, duration||60, platform_rate||10, technician_rate||5, merchant_rate||3, sort_score||0);
  res.json(success({ id: Number(r.lastInsertRowid) }, '添加成功'));
});

router.put('/admin/services/:id', auth(['admin']), (req, res) => {
  const { name, price_min, price_max, duration, platform_rate, technician_rate, merchant_rate, sort_score, status } = req.body;
  const sets = []; const vals = [];
  if (name !== undefined) { sets.push('name=?'); vals.push(name); }
  if (price_min !== undefined) { sets.push('price_min=?'); vals.push(price_min); }
  if (price_max !== undefined) { sets.push('price_max=?'); vals.push(price_max); }
  if (duration !== undefined) { sets.push('duration=?'); vals.push(duration); }
  if (platform_rate !== undefined) { sets.push('platform_rate=?'); vals.push(platform_rate); }
  if (technician_rate !== undefined) { sets.push('technician_rate=?'); vals.push(technician_rate); }
  if (merchant_rate !== undefined) { sets.push('merchant_rate=?'); vals.push(merchant_rate); }
  if (sort_score !== undefined) { sets.push('sort_score=?'); vals.push(sort_score); }
  if (status !== undefined) { sets.push('status=?'); vals.push(status); }
  if (sets.length > 0) { vals.push(req.params.id); db.prepare(`UPDATE service_items SET ${sets.join(',')} WHERE id=?`).run(...vals); }
  res.json(success(null, '更新成功'));
});

router.post('/admin/categories', auth(['admin']), (req, res) => {
  const { name, icon, sort_order } = req.body;
  db.prepare('INSERT INTO service_categories (name, icon, sort_order) VALUES (?,?,?)').run(name, icon, sort_order||0);
  res.json(success(null, '添加成功'));
});

router.put('/admin/categories/:id', auth(['admin']), (req, res) => {
  const { name, icon, sort_order } = req.body;
  if (name) db.prepare('UPDATE service_categories SET name=? WHERE id=?').run(name, req.params.id);
  if (icon) db.prepare('UPDATE service_categories SET icon=? WHERE id=?').run(icon, req.params.id);
  if (sort_order !== undefined) db.prepare('UPDATE service_categories SET sort_order=? WHERE id=?').run(sort_order, req.params.id);
  res.json(success(null, '更新成功'));
});

router.delete('/admin/categories/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM service_categories WHERE id=?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

router.get('/admin/announcements', auth(['admin']), (req, res) => {
  const list = db.prepare('SELECT * FROM announcements ORDER BY created_at DESC').all();
  res.json(success(list));
});

router.post('/admin/announcements', auth(['admin']), (req, res) => {
  const { title, content, target, is_top, is_pinned } = req.body;
  db.prepare('INSERT INTO announcements (title, content, target, is_top, is_pinned, published_at) VALUES (?,?,?,?,?,datetime("now"))').run(title, content, target||'all', is_top?1:0, is_pinned?1:0);
  res.json(success(null, '发布成功'));
});

router.put('/admin/announcements/:id', auth(['admin']), (req, res) => {
  const { title, content, is_top, is_pinned, status } = req.body;
  if (title) db.prepare('UPDATE announcements SET title=? WHERE id=?').run(title, req.params.id);
  if (content) db.prepare('UPDATE announcements SET content=? WHERE id=?').run(content, req.params.id);
  if (is_top !== undefined) db.prepare('UPDATE announcements SET is_top=? WHERE id=?').run(is_top?1:0, req.params.id);
  if (is_pinned !== undefined) db.prepare('UPDATE announcements SET is_pinned=? WHERE id=?').run(is_pinned?1:0, req.params.id);
  if (status) db.prepare('UPDATE announcements SET status=? WHERE id=?').run(status, req.params.id);
  res.json(success(null, '更新成功'));
});

router.get('/admin/disputes', auth(['admin']), (req, res) => {
  const list = db.prepare('SELECT d.*, o.order_no, t.name as tech_name FROM disputes d LEFT JOIN orders o ON d.order_id=o.id LEFT JOIN technicians t ON d.technician_id=t.id ORDER BY d.created_at DESC').all();
  res.json(success(list));
});

router.post('/admin/disputes/:id/review', auth(['admin']), (req, res) => {
  const { result, processed_by } = req.body;
  db.prepare("UPDATE disputes SET status='processed', result=?, processed_by=? WHERE id=?").run(result, processed_by||req.user.id, req.params.id);
  res.json(success(null, '已处理'));
});

router.get('/admin/dashboard/realtime', auth(['admin']), (req, res) => {
  const todayOrders = db.prepare("SELECT count(*) as cnt FROM orders WHERE date(created_at)=date('now')").all()[0].cnt;
  const todayIncome = db.prepare("SELECT coalesce(sum(price),0) as total FROM orders WHERE status='completed' AND date(completed_at)=date('now')").all()[0].total;
  const onlineTechs = db.prepare("SELECT count(*) as cnt FROM technicians WHERE status=1 AND busy=0").all()[0].cnt;
  const activeOrders = db.prepare("SELECT count(*) as cnt FROM orders WHERE status IN ('accepted','in_progress')").all()[0].cnt;
  const todayFee = db.prepare("SELECT coalesce(sum(platform_fee),0) as total FROM orders WHERE status='completed' AND date(completed_at)=date('now')").all()[0].total;
  const pendingComplaints = db.prepare("SELECT count(*) as cnt FROM technician_complaints WHERE status='pending'").all()[0].cnt;
  const pendingDisputes = db.prepare("SELECT count(*) as cnt FROM disputes WHERE status='pending'").all()[0].cnt;
  // 7天趋势
  const trend = db.prepare("SELECT date(created_at) as day, count(*) as cnt FROM orders WHERE created_at>=datetime('now','-7 days') GROUP BY day ORDER BY day").all();
  // 服务占比
  const servicePie = db.prepare("SELECT s.name, count(*) as cnt FROM orders o JOIN service_items si ON o.service_item_id=si.id JOIN service_categories s ON si.category_id=s.id GROUP BY s.name").all();
  // 师傅排行
  const topTechs = db.prepare("SELECT t.id, t.name, t.avatar, count(*) as cnt FROM orders o JOIN technicians t ON o.technician_id=t.id WHERE o.status='completed' GROUP BY t.id ORDER BY cnt DESC LIMIT 10").all();
  res.json(success({ todayOrders, todayIncome, onlineTechs, activeOrders, todayFee, pendingComplaints, pendingDisputes, trend, servicePie, topTechs }));
});

router.get('/admin/system/settings', auth(['admin']), (req, res) => {
  const configs = db.prepare('SELECT * FROM site_config').all();
  const map = {};
  configs.forEach(c => map[c.config_key] = c.config_value);
  res.json(success(map));
});

router.put('/admin/system/settings', auth(['admin']), (req, res) => {
  const allowed = ['site_name', 'contact_phone', 'agreement_appointment', 'agreement_platform', 'cancel_fee', 'overdue_days', 'region_timeout', 'default_platform_rate', 'default_technician_rate', 'default_merchant_rate', 'login_attempt_limit', 'code_expire_seconds', 'log_retention_days', 'export_fields'];
  for (const key of allowed) {
    if (req.body[key] !== undefined) {
      db.prepare('INSERT OR REPLACE INTO site_config (config_key, config_value) VALUES (?,?)').run(key, String(req.body[key]));
    }
  }
  // 协议版本号+1
  if (req.body.agreement_appointment || req.body.agreement_platform) {
    const ver = db.prepare("SELECT config_value FROM site_config WHERE config_key='agreement_version'").all();
    const newVer = parseInt(ver[0]?.config_value || '1') + 1;
    db.prepare("UPDATE site_config SET config_value=? WHERE config_key='agreement_version'").run(String(newVer));
  }
  db.prepare("INSERT INTO system_logs (operator, action, detail, ip) VALUES (?,?,?,?)").run(req.user.username||'admin', 'update_settings', '修改系统设置', req.ip);
  res.json(success(null, '保存成功'));
});

router.get('/admin/system/logs', auth(['admin']), (req, res) => {
  const { operator, action, start_date, end_date, page: p } = req.query;
  const page = parseInt(p) || 1;
  const limit = 50;
  const offset = (page - 1) * limit;
  let sql = 'SELECT * FROM system_logs WHERE 1=1';
  const params = [];
  if (operator) { sql += ' AND operator LIKE ?'; params.push(`%${operator}%`); }
  if (action) { sql += ' AND action=?'; params.push(action); }
  if (start_date) { sql += ' AND date(created_at)>=?'; params.push(start_date); }
  if (end_date) { sql += ' AND date(created_at)<=?'; params.push(end_date); }
  const total = db.prepare(sql.replace('SELECT *', 'SELECT count(*) as cnt')).all(...params)[0].cnt;
  sql += ' ORDER BY created_at DESC LIMIT ? OFFSET ?';
  params.push(limit, offset);
  const logs = db.prepare(sql).all(...params);
  res.json(success({ list: logs, total, page, totalPages: Math.ceil(total/limit) }));
});

// 区域管理
router.get('/admin/regions', auth(['admin']), (req, res) => {
  res.json(success(db.prepare('SELECT * FROM regions ORDER BY type, name').all()));
});

router.post('/admin/regions', auth(['admin']), (req, res) => {
  const { name, type } = req.body;
  db.prepare('INSERT INTO regions (name, type) VALUES (?,?)').run(name, type||'town');
  res.json(success(null, '添加成功'));
});

router.put('/admin/regions/:id', auth(['admin']), (req, res) => {
  const { name, type } = req.body;
  if (name) db.prepare('UPDATE regions SET name=? WHERE id=?').run(name, req.params.id);
  if (type) db.prepare('UPDATE regions SET type=? WHERE id=?').run(type, req.params.id);
  res.json(success(null, '更新成功'));
});

router.delete('/admin/regions/:id', auth(['admin']), (req, res) => {
  db.prepare('DELETE FROM regions WHERE id=?').run(req.params.id);
  res.json(success(null, '删除成功'));
});

// 文件上传
router.post('/upload', auth(), upload.single('file'), (req, res) => {
  if (!req.file) return res.json(fail('请选择文件'));
  res.json(success({ url: '/uploads/' + req.file.filename }));
});

// 健康检查
router.get('/health', (req, res) => res.json(success({ status: 'ok', time: new Date().toISOString() })));

// 挂载路由
app.use('/api/v1', router);

// ===== 定时任务 =====
// 区域单超时转抢单池（每5分钟检查）
cron.schedule('*/5 * * * *', () => {
  const timeout = parseInt(db.prepare("SELECT config_value FROM site_config WHERE config_key='region_timeout'").all()[0]?.config_value || '30');
  const rows = db.prepare(`SELECT id FROM orders WHERE status='pending' AND region_matched IS NOT NULL AND julianday('now')-julianday(created_at)*24*60>=?`).all(timeout);
  for (const row of rows) {
    db.prepare("UPDATE orders SET status='bidding', region_matched=NULL WHERE id=?").run(row.id);
    db.prepare("INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,'bidding','区域单超时，转入抢单池','系统')").run(row.id);
  }
});

// 超期订单自动完结（每天凌晨2点）
cron.schedule('0 2 * * *', () => {
  const overdueDays = parseInt(db.prepare("SELECT config_value FROM site_config WHERE config_key='overdue_days'").all()[0]?.config_value || '3');
  const rows = db.prepare(`SELECT id, technician_id FROM orders WHERE status='accepted' AND julianday('now')-julianday(accepted_at)>=?`).all(overdueDays);
  for (const row of rows) {
    db.prepare("UPDATE orders SET status='overdue_closed', completed_at=datetime('now') WHERE id=?").run(row.id);
    db.prepare("INSERT INTO order_logs (order_id, action, content, operator) VALUES (?,'overdue_closed','超期自动完结','系统')").run(row.id);
    if (row.technician_id) {
      db.prepare('UPDATE technicians SET credit_score=MAX(0,credit_score-5) WHERE id=?').run(row.technician_id);
    }
  }
});

// 日志清理（每天凌晨3点）
cron.schedule('0 3 * * *', () => {
  const days = parseInt(db.prepare("SELECT config_value FROM site_config WHERE config_key='log_retention_days'").all()[0]?.config_value || '90');
  db.prepare(`DELETE FROM system_logs WHERE created_at<datetime('now','-${days} days')`).run();
  db.prepare(`DELETE FROM login_attempts WHERE created_at<datetime('now','-7 days')`).run();
  db.prepare(`DELETE FROM api_rate_limits WHERE created_at<datetime('now','-1 days')`).run();
});

// ===== 启动 =====
app.listen(PORT, () => {
  console.log(`========================================`);
  console.log(`  佳乐家 V7.0 服务已启动`);
  console.log(`  🚀 http://localhost:${PORT}`);
  console.log(`  📁 数据库: ${DB_PATH}`);
  console.log(`  ⏰ 定时任务: 已启动`);
  console.log(`========================================`);
});