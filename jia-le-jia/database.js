const { getDb, DB_PATH } = require('./db_wrapper');

async function initDatabase() {
  const db = await getDb();
  console.log('📦 初始化数据库...');

  // ─── 核心业务表 ───
  db.exec(`
    CREATE TABLE IF NOT EXISTS users (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT UNIQUE NOT NULL,
      nickname TEXT DEFAULT '',
      avatar TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS technicians (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT DEFAULT '123456',
      area TEXT DEFAULT '',
      balance REAL DEFAULT 0,
      credit_score INTEGER DEFAULT 100,
      rating_avg REAL DEFAULT 5.0,
      total_ratings INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      is_busy INTEGER DEFAULT 0,
      wechat_userid TEXT DEFAULT '',
      work_radius INTEGER DEFAULT 10,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS merchants (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      contact TEXT NOT NULL,
      phone TEXT UNIQUE NOT NULL,
      password TEXT DEFAULT '123456',
      referral_rate REAL DEFAULT 5.0,
      balance REAL DEFAULT 0,
      status TEXT DEFAULT 'active',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS service_categories (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      name TEXT NOT NULL,
      icon TEXT DEFAULT '',
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active'
    );

    CREATE TABLE IF NOT EXISTS service_items (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      category_id INTEGER NOT NULL,
      name TEXT NOT NULL,
      price REAL DEFAULT 0,
      price_range TEXT DEFAULT '',
      estimated_duration INTEGER DEFAULT 60,
      platform_rate REAL DEFAULT 10.0,
      technician_rate REAL DEFAULT 5.0,
      merchant_rate REAL DEFAULT 5.0,
      rating_avg REAL DEFAULT 5.0,
      sort_order INTEGER DEFAULT 0,
      status TEXT DEFAULT 'active',
      FOREIGN KEY (category_id) REFERENCES service_categories(id)
    );

    CREATE TABLE IF NOT EXISTS orders (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_no TEXT UNIQUE NOT NULL,
      user_phone TEXT NOT NULL,
      user_name TEXT NOT NULL,
      user_remark TEXT DEFAULT '',
      service_item_id INTEGER,
      service_name TEXT DEFAULT '',
      service_price REAL DEFAULT 0,
      category_name TEXT DEFAULT '',
      area TEXT DEFAULT '',
      address TEXT DEFAULT '',
      booking_date TEXT DEFAULT '',
      booking_time TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      source TEXT DEFAULT 'user',
      merchant_id INTEGER DEFAULT NULL,
      technician_id INTEGER DEFAULT NULL,
      verify_code TEXT DEFAULT '',
      cancel_reason TEXT DEFAULT '',
      cancel_type TEXT DEFAULT '',
      cancel_remark TEXT DEFAULT '',
      actual_amount REAL DEFAULT NULL,
      warranty_months INTEGER DEFAULT 0,
      completion_photos TEXT DEFAULT '',
      platform_fee REAL DEFAULT 0,
      technician_fee REAL DEFAULT 0,
      merchant_fee REAL DEFAULT 0,
      additional_amount REAL DEFAULT 0,
      additional_desc TEXT DEFAULT '',
      additional_status TEXT DEFAULT '',
      onsite_status TEXT DEFAULT '',
      is_read INTEGER DEFAULT 0,
      is_deleted INTEGER DEFAULT 0,
      deleted_at TEXT DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS order_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      content TEXT DEFAULT '',
      operator TEXT DEFAULT 'system',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS order_remarks (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      remark_type TEXT NOT NULL,
      content TEXT NOT NULL,
      created_by TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS order_evaluations (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER UNIQUE NOT NULL,
      user_id INTEGER,
      technician_id INTEGER,
      rating_attitude INTEGER DEFAULT 5,
      rating_skill INTEGER DEFAULT 5,
      rating_punctuality INTEGER DEFAULT 5,
      comment TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS technician_gallery (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      order_id INTEGER,
      image_url TEXT NOT NULL,
      service_type TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS disputes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      reason TEXT NOT NULL,
      evidence TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      result TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      handled_at DATETIME DEFAULT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS onsite_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      technician_id INTEGER,
      status TEXT NOT NULL,
      content TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (order_id) REFERENCES orders(id)
    );

    CREATE TABLE IF NOT EXISTS technician_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      order_id INTEGER,
      type TEXT NOT NULL,
      amount REAL NOT NULL,
      balance_before REAL DEFAULT 0,
      balance_after REAL DEFAULT 0,
      description TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS technician_complaints (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      order_id INTEGER NOT NULL,
      technician_id INTEGER NOT NULL,
      user_id INTEGER,
      complaint_type TEXT DEFAULT 'bad_review',
      content TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      appeal_reason TEXT DEFAULT '',
      appeal_evidence TEXT DEFAULT '',
      appeal_status TEXT DEFAULT '',
      appeal_result TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      handled_at DATETIME DEFAULT NULL,
      FOREIGN KEY (order_id) REFERENCES orders(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS technician_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS credit_change_records (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      order_id INTEGER,
      change_value INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      balance_before INTEGER DEFAULT 100,
      balance_after INTEGER DEFAULT 100,
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS credit_appeals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      technician_id INTEGER NOT NULL,
      order_id INTEGER,
      credit_change_id INTEGER,
      change_value INTEGER DEFAULT 0,
      reason TEXT NOT NULL,
      evidence TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      result TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      handled_at DATETIME DEFAULT NULL,
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS merchant_transactions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      order_id INTEGER,
      amount REAL NOT NULL,
      type TEXT DEFAULT 'referral',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );

    CREATE TABLE IF NOT EXISTS merchant_withdrawals (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      merchant_id INTEGER NOT NULL,
      amount REAL NOT NULL,
      status TEXT DEFAULT 'pending',
      remark TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      handled_at DATETIME DEFAULT NULL,
      FOREIGN KEY (merchant_id) REFERENCES merchants(id)
    );

    CREATE TABLE IF NOT EXISTS login_attempts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      identifier TEXT NOT NULL,
      ip_address TEXT DEFAULT '',
      attempt_type TEXT DEFAULT 'login',
      success INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS api_rate_limits (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      ip_address TEXT NOT NULL,
      path TEXT DEFAULT '',
      request_count INTEGER DEFAULT 1,
      window_start DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS security_alerts (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      alert_type TEXT NOT NULL,
      detail TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      handled_at DATETIME DEFAULT NULL
    );

    CREATE TABLE IF NOT EXISTS blacklist (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_id INTEGER DEFAULT NULL,
      technician_id INTEGER DEFAULT NULL,
      target_type TEXT NOT NULL,
      target_id INTEGER NOT NULL,
      reason TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (user_id) REFERENCES users(id),
      FOREIGN KEY (technician_id) REFERENCES technicians(id)
    );

    CREATE TABLE IF NOT EXISTS announcements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      title TEXT NOT NULL,
      content TEXT NOT NULL,
      target TEXT DEFAULT 'all',
      is_pinned INTEGER DEFAULT 0,
      is_published INTEGER DEFAULT 0,
      publish_time DATETIME DEFAULT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS announcement_reads (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      announcement_id INTEGER NOT NULL,
      reader_type TEXT NOT NULL,
      reader_id INTEGER NOT NULL,
      read_at DATETIME DEFAULT (datetime('now','localtime')),
      FOREIGN KEY (announcement_id) REFERENCES announcements(id)
    );

    CREATE TABLE IF NOT EXISTS user_sessions (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_type TEXT NOT NULL,
      user_id INTEGER NOT NULL,
      token TEXT UNIQUE NOT NULL,
      phone TEXT DEFAULT '',
      expires_at DATETIME NOT NULL,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS verification_codes (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      phone TEXT NOT NULL,
      code TEXT NOT NULL,
      type TEXT DEFAULT 'login',
      expires_at DATETIME NOT NULL,
      used INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS system_logs (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      operator TEXT DEFAULT '',
      operator_type TEXT DEFAULT '',
      action TEXT NOT NULL,
      detail TEXT DEFAULT '',
      ip_address TEXT DEFAULT '',
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS user_agreements (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      user_phone TEXT NOT NULL,
      agreement_type TEXT NOT NULL,
      version TEXT NOT NULL,
      agreed INTEGER DEFAULT 0,
      created_at DATETIME DEFAULT (datetime('now','localtime'))
    );

    CREATE TABLE IF NOT EXISTS site_config (
      id INTEGER PRIMARY KEY AUTOINCREMENT,
      config_key TEXT UNIQUE NOT NULL,
      config_value TEXT DEFAULT '',
      updated_at DATETIME DEFAULT (datetime('now','localtime'))
    );
  `);

  // 检查是否需要初始化默认数据
  const catCount = db.get('SELECT COUNT(*) as c FROM service_categories');
  if (catCount.c === 0) {
    console.log('🌱 初始化默认数据...');
    db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)', ['空调服务', '❄️', 1]);
    db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)', ['厨电服务', '🍳', 2]);
    db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)', ['智能家电', '📺', 3]);
    db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)', ['水电暖通', '💧', 4]);
    db.run('INSERT INTO service_categories (name, icon, sort_order) VALUES (?, ?, ?)', ['环境电器', '🌬️', 5]);

    const items = [
      [1, '空调清洗', 99, '99-199', 45, 10, 5, 5],
      [1, '空调维修', 150, '150-500', 60, 10, 5, 5],
      [1, '空调加氟', 120, '120-300', 30, 10, 5, 5],
      [1, '空调安装', 200, '200-800', 120, 10, 5, 5],
      [2, '油烟机清洗', 80, '80-150', 45, 10, 5, 5],
      [2, '灶具维修', 100, '100-300', 60, 10, 5, 5],
      [2, '热水器维修', 120, '120-400', 60, 10, 5, 5],
      [2, '消毒柜维修', 100, '100-250', 45, 10, 5, 5],
      [3, '洗衣机维修', 120, '120-400', 60, 10, 5, 5],
      [3, '冰箱维修', 150, '150-500', 60, 10, 5, 5],
      [3, '电视维修', 100, '100-300', 45, 10, 5, 5],
      [3, '智能门锁安装', 80, '80-200', 30, 10, 5, 5],
      [4, '水管维修', 80, '80-200', 45, 10, 5, 5],
      [4, '电路维修', 100, '100-300', 60, 10, 5, 5],
      [4, '暖气维修', 120, '120-400', 60, 10, 5, 5],
      [4, '下水道疏通', 80, '80-200', 30, 10, 5, 5],
      [5, '空气净化器清洗', 80, '80-150', 30, 10, 5, 5],
      [5, '除湿机维修', 100, '100-300', 45, 10, 5, 5],
      [5, '新风系统清洗', 150, '150-400', 60, 10, 5, 5],
    ];
    for (const item of items) {
      db.run('INSERT INTO service_items (category_id, name, price, price_range, estimated_duration, platform_rate, technician_rate, merchant_rate) VALUES (?,?,?,?,?,?,?,?)', item);
    }

    // 默认配置
    const configs = [
      ['admin_password', 'admin123'],
      ['admin_account', 'admin'],
      ['site_name', '佳乐家家电服务'],
      ['service_phone', '0530-1234567'],
      ['agreement_booking', '预约协议V1.0\n\n一、服务说明\n1.1 用户通过本平台预约家电服务，平台将根据用户需求匹配合适的师傅。\n1.2 预约成功后，用户将收到订单编号和验证码，可用于查询订单状态。\n\n二、取消规则\n2.1 师傅接单前，用户可无责取消订单。\n2.2 师傅接单后15分钟内取消，需支付爽约金5元。\n2.3 师傅接单后超过15分钟，用户不可取消，需联系客服处理。\n\n三、服务保障\n3.1 平台对师傅服务质量进行监督，如有问题可联系客服投诉。\n3.2 完工后提供质保期服务，具体以订单确认为准。'],
      ['agreement_platform', '平台服务协议V1.0\n\n一、平台说明\n佳乐家家电服务平台（以下简称"平台"）为用户提供家电服务预约信息撮合服务。\n\n二、用户须知\n2.1 用户需提供真实有效的联系方式和服务地址。\n2.2 用户应遵守平台规则，不得恶意下单或虚假预约。\n2.3 平台对用户信息严格保密，未经授权不得向第三方披露。\n\n三、服务流程\n3.1 用户提交预约 → 系统匹配师傅 → 师傅接单 → 上门服务 → 完工确认\n3.2 用户可在订单完成后对服务进行评价。\n\n四、免责声明\n4.1 平台仅提供信息撮合服务，不对师傅的具体服务行为承担责任。\n4.2 如因不可抗力导致服务无法按时进行，平台不承担违约责任。'],
      ['agreement_booking_version', 'V1.0'],
      ['agreement_platform_version', 'V1.0'],
      ['cancel_fee', '5'],
      ['overtime_days', '3'],
      ['pool_timeout', '30'],
      ['login_max_attempts', '5'],
      ['verify_code_ttl', '5'],
      ['rate_limit_per_min', '60'],
      ['log_retention_days', '90'],
      ['export_fields', '["order_no","service_name","user_name","user_phone","address","area","service_price","platform_fee","status","booking_date","booking_time","created_at"]'],
      ['platform_rate', '10'],
      ['anti_fraud_cancel_threshold', '3'],
      ['anti_fraud_cancel_limit_hours', '24'],
      ['anti_fraud_cancel_rate', '30'],
      ['anti_fraud_max_orders_per_hour', '5'],
      ['anti_fraud_max_orders_per_day', '20'],
      ['anti_fraud_max_ip_orders_per_hour', '10'],
      ['anti_fraud_max_ip_orders_per_day', '50'],
    ];
    for (const [k, v] of configs) {
      db.run('INSERT INTO site_config (config_key, config_value) VALUES (?, ?)', [k, v]);
    }

    // 测试师傅
    const areas = ['磐石街道', '曹城街道', '青菏街道', '郑庄街道', '倪集街道', '庄寨镇', '普连集镇', '古营集镇', '侯集镇', '苏集镇', '孙老家镇', '阎店楼镇', '梁堤头镇', '安蔡楼镇', '大集镇', '王集镇', '楼庄镇', '韩集镇', '砖庙镇', '常乐集镇', '魏湾镇', '仵楼镇', '邵庄镇', '朱洪庙镇'];
    for (let i = 0; i < Math.min(areas.length, 10); i++) {
      db.run('INSERT INTO technicians (name, phone, password, area, balance, credit_score) VALUES (?, ?, ?, ?, ?, ?)',
        [`师傅${i+1}`, `1380000${String(i+1).padStart(4, '0')}`, '123456', areas[i], 100 + i * 10, 100 - i * 2]);
    }

    // 测试商家
    db.run('INSERT INTO merchants (name, contact, phone, password, referral_rate, balance) VALUES (?, ?, ?, ?, ?, ?)',
      ['曹县家电城', '张经理', '13900001111', '123456', 5.0, 500]);
    db.run('INSERT INTO merchants (name, contact, phone, password, referral_rate, balance) VALUES (?, ?, ?, ?, ?, ?)',
      ['诚信家电维修', '李老板', '13900002222', '123456', 3.0, 200]);
  }

  console.log('✅ 数据库初始化完成');
  return db;
}

if (require.main === module) {
  initDatabase().then(() => {
    console.log('数据库路径:', DB_PATH);
    process.exit(0);
  }).catch(e => {
    console.error('数据库初始化失败:', e);
    process.exit(1);
  });
}

module.exports = { initDatabase };