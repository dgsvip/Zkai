const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const jwt = require('jsonwebtoken');
const config = require('../config');
const Response = require('../utils/response');
const { smsLimiter } = require('../middleware/rateLimiter');
const auth = require('../middleware/auth');

// 发送验证码
router.post('/verification-code', smsLimiter, async (req, res, next) => {
  try {
    const { phone } = req.body;
    if (!/^1\d{10}$/.test(phone)) {
      return res.json(Response.error('手机号格式不正确'));
    }
    const code = String(Math.floor(1000 + Math.random() * 9000));
    const expiresAt = new Date(Date.now() + 5 * 60 * 1000);
    await pool.execute(
      'INSERT INTO verification_codes (phone, code, type, expires_at) VALUES (?, ?, "login", ?)',
      [phone, code, expiresAt]
    );
    // TODO: 对接短信服务商发送验证码
    console.log(`[DEV] 验证码 ${phone} -> ${code}`);
    res.json(Response.success(null, '验证码已发送'));
  } catch (err) { next(err); }
});

// 验证码登录
router.post('/login', async (req, res, next) => {
  try {
    const { phone, code } = req.body;
    if (!/^1\d{10}$/.test(phone)) {
      return res.json(Response.error('手机号格式不正确'));
    }
    const [rows] = await pool.execute(
      'SELECT * FROM verification_codes WHERE phone = ? AND code = ? AND type = "login" AND used = 0 AND expires_at > NOW() ORDER BY id DESC LIMIT 1',
      [phone, code]
    );
    if (rows.length === 0) {
      return res.json(Response.error('验证码错误或已过期'));
    }
    await pool.execute('UPDATE verification_codes SET used = 1 WHERE id = ?', [rows[0].id]);
    // 查找或创建用户
    let [users] = await pool.execute('SELECT * FROM users WHERE phone = ?', [phone]);
    let user;
    if (users.length === 0) {
      const [result] = await pool.execute(
        'INSERT INTO users (phone, nickname) VALUES (?, ?)',
        [phone, `用户${phone.slice(-4)}`]
      );
      user = { id: result.insertId, phone };
    } else {
      user = users[0];
    }
    const token = jwt.sign({ id: user.id, phone: user.phone, role: 'user' }, config.jwt.secret, { expiresIn: config.jwt.expiresIn });
    // 保存登录态
    const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await pool.execute(
      'INSERT INTO user_sessions (phone, token, expires_at) VALUES (?, ?, ?)',
      [phone, token, expiresAt]
    );
    // 清理过期登录态
    await pool.execute('DELETE FROM user_sessions WHERE expires_at < NOW()');
    res.json(Response.success({ token, user: { id: user.id, phone: user.phone, nickname: user.nickname, avatar: user.avatar } }));
  } catch (err) { next(err); }
});

// 获取用户信息
router.get('/profile', auth(), async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT id, phone, nickname, avatar, address, created_at FROM users WHERE id = ?', [req.user.id]);
    if (users.length === 0) return res.json(Response.notFound('用户不存在'));
    res.json(Response.success(users[0]));
  } catch (err) { next(err); }
});

// 更新用户信息
router.put('/profile', auth(), async (req, res, next) => {
  try {
    const { nickname, avatar, address } = req.body;
    await pool.execute('UPDATE users SET nickname = COALESCE(?, nickname), avatar = COALESCE(?, avatar), address = COALESCE(?, address) WHERE id = ?',
      [nickname, avatar, address, req.user.id]);
    res.json(Response.success(null, '更新成功'));
  } catch (err) { next(err); }
});

// 地址管理
router.get('/addresses', auth(), async (req, res, next) => {
  try {
    const [users] = await pool.execute('SELECT address FROM users WHERE id = ?', [req.user.id]);
    res.json(Response.success(users[0]?.address ? JSON.parse(users[0].address) : []));
  } catch (err) { next(err); }
});

router.post('/addresses', auth(), async (req, res, next) => {
  try {
    const { addressList } = req.body;
    await pool.execute('UPDATE users SET address = ? WHERE id = ?', [JSON.stringify(addressList), req.user.id]);
    res.json(Response.success(null, '保存成功'));
  } catch (err) { next(err); }
});

module.exports = router;