-- ============================================
-- 佳乐家平台 · 数据库表结构
-- 版本: 1.0
-- ============================================

CREATE DATABASE IF NOT EXISTS jialejia CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE jialejia;

-- 用户表
CREATE TABLE users (
  id INT PRIMARY KEY AUTO_INCREMENT,
  openid VARCHAR(100) DEFAULT NULL UNIQUE,
  phone VARCHAR(20) NOT NULL,
  nickname VARCHAR(50) DEFAULT NULL,
  avatar VARCHAR(500) DEFAULT NULL,
  address TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 师傅表
CREATE TABLE technicians (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  region VARCHAR(50) NOT NULL COMMENT '所属区域',
  balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '账户余额',
  status TINYINT DEFAULT 1 COMMENT '1:启用 0:禁用',
  busy TINYINT DEFAULT 0 COMMENT '1:忙碌 0:空闲',
  credit_score INT DEFAULT 100 COMMENT '信用分',
  rating_avg DECIMAL(2,1) DEFAULT 5.0 COMMENT '平均评分',
  total_ratings INT DEFAULT 0,
  complaint_count INT DEFAULT 0,
  accept_radius INT DEFAULT 10 COMMENT '接单半径(km)',
  avatar VARCHAR(500) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_region (region)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商家表
CREATE TABLE merchants (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(100) NOT NULL,
  contact VARCHAR(50) NOT NULL,
  phone VARCHAR(20) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  qrcode VARCHAR(500) DEFAULT NULL,
  referral_rate DECIMAL(5,2) DEFAULT 0.00 COMMENT '介绍费比例(%)',
  balance DECIMAL(10,2) DEFAULT 0.00 COMMENT '介绍费余额',
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 服务分类表
CREATE TABLE service_categories (
  id INT PRIMARY KEY AUTO_INCREMENT,
  name VARCHAR(50) NOT NULL,
  icon VARCHAR(500) DEFAULT NULL,
  sort_order INT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 服务项目表
CREATE TABLE service_items (
  id INT PRIMARY KEY AUTO_INCREMENT,
  category_id INT NOT NULL,
  name VARCHAR(100) NOT NULL,
  icon VARCHAR(500) DEFAULT NULL,
  price_min DECIMAL(10,2) DEFAULT 0.00,
  price_max DECIMAL(10,2) DEFAULT 0.00,
  duration INT DEFAULT 60 COMMENT '预估时长(分钟)',
  platform_rate DECIMAL(5,2) DEFAULT 10.00 COMMENT '平台抽成%',
  technician_rate DECIMAL(5,2) DEFAULT 5.00 COMMENT '师傅抽成%',
  merchant_rate DECIMAL(5,2) DEFAULT 3.00 COMMENT '商家介绍费%',
  sort_score INT DEFAULT 0 COMMENT '排序权重',
  status TINYINT DEFAULT 1,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (category_id) REFERENCES service_categories(id),
  INDEX idx_category (category_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单主表
CREATE TABLE orders (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL UNIQUE COMMENT '订单号: JLJ+yyyyMMdd+4位随机',
  user_id INT DEFAULT NULL,
  technician_id INT DEFAULT NULL,
  merchant_id INT DEFAULT NULL,
  service_item_id INT DEFAULT NULL,
  service_name VARCHAR(100) NOT NULL,
  price DECIMAL(10,2) DEFAULT 0.00,
  platform_fee DECIMAL(10,2) DEFAULT 0.00,
  technician_income DECIMAL(10,2) DEFAULT 0.00,
  merchant_fee DECIMAL(10,2) DEFAULT 0.00,
  customer_name VARCHAR(50) NOT NULL,
  customer_phone VARCHAR(20) NOT NULL,
  customer_address VARCHAR(500) NOT NULL,
  remark TEXT DEFAULT NULL COMMENT '用户备注',
  technician_remark TEXT DEFAULT NULL COMMENT '师傅备注',
  appointment_date DATE NOT NULL,
  appointment_time VARCHAR(20) NOT NULL,
  image_urls TEXT DEFAULT NULL COMMENT '完工照片(json数组)',
  video_urls TEXT DEFAULT NULL,
  source VARCHAR(20) DEFAULT 'user' COMMENT '来源: user/merchant/self',
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/assigned/processing/completed/cancelled/timeout',
  is_region TINYINT DEFAULT 1 COMMENT '1:区域单 0:抢单池',
  region_matched VARCHAR(50) DEFAULT NULL,
  transfer_from INT DEFAULT NULL COMMENT '转派来源师傅ID',
  timeout_at DATETIME DEFAULT NULL,
  completed_at DATETIME DEFAULT NULL,
  cancel_fee DECIMAL(10,2) DEFAULT 0.00,
  warranty_months INT DEFAULT 0 COMMENT '质保期(月)',
  agreement_version VARCHAR(20) DEFAULT NULL,
  is_deleted TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  INDEX idx_order_no (order_no),
  INDEX idx_user_id (user_id),
  INDEX idx_technician_id (technician_id),
  INDEX idx_status (status),
  INDEX idx_region (region_matched),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单日志表
CREATE TABLE order_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL,
  action VARCHAR(50) NOT NULL COMMENT '下单/接单/完工/取消/转派等',
  description TEXT DEFAULT NULL,
  operator VARCHAR(100) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_no) REFERENCES orders(order_no),
  INDEX idx_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单备注表
CREATE TABLE order_remarks (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL,
  remark_type VARCHAR(20) NOT NULL COMMENT 'user/merchant/technician/transfer/cancel',
  content TEXT NOT NULL,
  created_by VARCHAR(100) DEFAULT NULL,
  visible_to VARCHAR(50) DEFAULT 'all',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_no) REFERENCES orders(order_no),
  INDEX idx_order_no (order_no)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 订单评价表
CREATE TABLE order_evaluations (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL UNIQUE,
  user_id INT DEFAULT NULL,
  technician_id INT DEFAULT NULL,
  rating_attitude TINYINT DEFAULT 5 COMMENT '服务态度 1-5',
  rating_skill TINYINT DEFAULT 5 COMMENT '技术水平 1-5',
  rating_punctuality TINYINT DEFAULT 5 COMMENT '准时度 1-5',
  comment TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_no) REFERENCES orders(order_no),
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 公告表
CREATE TABLE announcements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  title VARCHAR(200) NOT NULL,
  content TEXT NOT NULL,
  target VARCHAR(50) DEFAULT 'all' COMMENT 'all/user/technician/merchant',
  is_pinned TINYINT DEFAULT 0,
  status TINYINT DEFAULT 1,
  read_count INT DEFAULT 0,
  publish_at DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_status (status),
  INDEX idx_pinned (is_pinned)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 公告已读表
CREATE TABLE announcement_reads (
  id INT PRIMARY KEY AUTO_INCREMENT,
  announcement_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  technician_id INT DEFAULT NULL,
  read_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (announcement_id) REFERENCES announcements(id),
  UNIQUE KEY uk_read (announcement_id, user_id, technician_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 师傅余额明细表
CREATE TABLE technician_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  technician_id INT NOT NULL,
  order_no VARCHAR(30) DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  type VARCHAR(20) NOT NULL COMMENT 'income/withdraw/penalty/fee',
  description TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  INDEX idx_technician (technician_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商家介绍费明细表
CREATE TABLE merchant_transactions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  merchant_id INT NOT NULL,
  order_no VARCHAR(30) DEFAULT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/settled',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 商家提现申请表
CREATE TABLE merchant_withdrawals (
  id INT PRIMARY KEY AUTO_INCREMENT,
  merchant_id INT NOT NULL,
  amount DECIMAL(10,2) NOT NULL,
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/approved/rejected',
  remark TEXT DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (merchant_id) REFERENCES merchants(id),
  INDEX idx_merchant (merchant_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 师傅投诉/差评记录表
CREATE TABLE technician_complaints (
  id INT PRIMARY KEY AUTO_INCREMENT,
  order_no VARCHAR(30) NOT NULL,
  technician_id INT NOT NULL,
  user_id INT DEFAULT NULL,
  content TEXT DEFAULT NULL,
  rating TINYINT DEFAULT NULL,
  status VARCHAR(20) DEFAULT 'pending' COMMENT 'pending/resolved/dismissed',
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (order_no) REFERENCES orders(order_no),
  FOREIGN KEY (technician_id) REFERENCES technicians(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 师傅操作日志表
CREATE TABLE technician_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  technician_id INT NOT NULL,
  action VARCHAR(50) NOT NULL,
  detail TEXT DEFAULT NULL,
  ip VARCHAR(50) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (technician_id) REFERENCES technicians(id),
  INDEX idx_technician (technician_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户登录态表
CREATE TABLE user_sessions (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  token VARCHAR(500) NOT NULL,
  expires_at DATETIME NOT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_token (token(255))
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 验证码记录表
CREATE TABLE verification_codes (
  id INT PRIMARY KEY AUTO_INCREMENT,
  phone VARCHAR(20) NOT NULL,
  code VARCHAR(10) NOT NULL,
  type VARCHAR(20) DEFAULT 'login' COMMENT 'login/register',
  expires_at DATETIME NOT NULL,
  used TINYINT DEFAULT 0,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_phone (phone),
  INDEX idx_code (code)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 后台操作日志表
CREATE TABLE system_logs (
  id INT PRIMARY KEY AUTO_INCREMENT,
  operator_id INT NOT NULL,
  operator_name VARCHAR(50) NOT NULL,
  role VARCHAR(20) NOT NULL,
  action VARCHAR(50) NOT NULL,
  detail TEXT DEFAULT NULL,
  ip VARCHAR(50) DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_operator (operator_id),
  INDEX idx_action (action),
  INDEX idx_created_at (created_at)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 数据备份记录表
CREATE TABLE data_backups (
  id INT PRIMARY KEY AUTO_INCREMENT,
  filename VARCHAR(200) NOT NULL,
  size BIGINT DEFAULT 0,
  backup_time DATETIME DEFAULT CURRENT_TIMESTAMP,
  status VARCHAR(20) DEFAULT 'completed',
  created_by VARCHAR(50) DEFAULT NULL,
  is_deleted TINYINT DEFAULT 0
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 用户协议确认记录表
CREATE TABLE user_agreements (
  id INT PRIMARY KEY AUTO_INCREMENT,
  user_id INT DEFAULT NULL,
  phone VARCHAR(20) DEFAULT NULL,
  agreement_type VARCHAR(50) NOT NULL COMMENT 'booking/service',
  version VARCHAR(20) NOT NULL,
  confirmed_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  INDEX idx_user (user_id),
  INDEX idx_phone (phone)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 网站配置表
CREATE TABLE site_config (
  id INT PRIMARY KEY AUTO_INCREMENT,
  config_key VARCHAR(100) NOT NULL UNIQUE,
  config_value TEXT DEFAULT NULL,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  INDEX idx_key (config_key)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 管理员表
CREATE TABLE admins (
  id INT PRIMARY KEY AUTO_INCREMENT,
  username VARCHAR(50) NOT NULL UNIQUE,
  password VARCHAR(255) NOT NULL,
  nickname VARCHAR(50) DEFAULT NULL,
  role VARCHAR(20) NOT NULL DEFAULT 'admin' COMMENT 'super_admin/admin/informer/finance/customer_service',
  status TINYINT DEFAULT 1,
  login_attempts INT DEFAULT 0,
  locked_until DATETIME DEFAULT NULL,
  created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
  updated_at DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 初始化默认配置
INSERT INTO site_config (config_key, config_value) VALUES
('site_name', '佳乐家'),
('site_logo', ''),
('site_favicon', ''),
('site_share_image', ''),
('seo_title', '佳乐家 - 曹县本地生活服务平台'),
('seo_keywords', '佳乐家,曹县,家电维修,上门服务'),
('seo_description', '佳乐家是曹县本地生活服务平台，提供家电维修、水电暖通等上门服务'),
('contact_phone', '400-000-0000'),
('default_platform_rate', '10.00'),
('default_technician_rate', '5.00'),
('default_merchant_rate', '3.00'),
('cancel_fee', '5.00'),
('timeout_days', '3'),
('region_timeout_minutes', '30'),
('log_retention_days', '90');

-- 初始化默认服务分类
INSERT INTO service_categories (name, icon, sort_order) VALUES
('空调服务', 'icon-kongtiao', 1),
('厨电服务', 'icon-chudian', 2),
('智能家电', 'icon-zhineng', 3),
('水电暖通', 'icon-shuidian', 4),
('环境电器', 'icon-huanjing', 5);

-- 初始化超级管理员 (密码: admin123)
INSERT INTO admins (username, password, nickname, role) VALUES
('admin', '$2a$10$N9qo8uLOickgx2ZMRZoMyeIjZAgcfl7p92ldGxad68LJZdL17lhWy', '超级管理员', 'super_admin');