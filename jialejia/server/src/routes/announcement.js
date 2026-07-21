const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const Response = require('../utils/response');

// 获取公告列表
router.get('/', async (req, res, next) => {
  try {
    const { page = 1, page_size = 20 } = req.query;
    const offset = (parseInt(page) - 1) * parseInt(page_size);
    const [rows] = await pool.execute(
      'SELECT id, title, target, is_pinned, read_count, created_at FROM announcements WHERE status = 1 AND (publish_at IS NULL OR publish_at <= NOW()) ORDER BY is_pinned DESC, created_at DESC LIMIT ? OFFSET ?',
      [parseInt(page_size), offset]);
    const [count] = await pool.execute('SELECT COUNT(*) as total FROM announcements WHERE status = 1');
    res.json(Response.success({ list: rows, total: count[0].total, page: parseInt(page), page_size: parseInt(page_size) }));
  } catch (err) { next(err); }
});

// 获取公告详情
router.get('/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM announcements WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.json(Response.notFound('公告不存在'));
    await pool.execute('UPDATE announcements SET read_count = read_count + 1 WHERE id = ?', [req.params.id]);
    res.json(Response.success(rows[0]));
  } catch (err) { next(err); }
});

// 标记已读
router.post('/:id/read', async (req, res, next) => {
  try {
    const { user_id, technician_id } = req.body;
    const [existing] = await pool.execute('SELECT * FROM announcement_reads WHERE announcement_id = ? AND (user_id = ? OR technician_id = ?)', [req.params.id, user_id || 0, technician_id || 0]);
    if (existing.length === 0) {
      await pool.execute('INSERT INTO announcement_reads (announcement_id, user_id, technician_id) VALUES (?, ?, ?)', [req.params.id, user_id || null, technician_id || null]);
    }
    res.json(Response.success(null, '已标记已读'));
  } catch (err) { next(err); }
});

module.exports = router;