const express = require('express');
const router = express.Router();
const pool = require('../config/database');
const Response = require('../utils/response');

// 获取服务分类列表
router.get('/categories', async (_req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_categories ORDER BY sort_order ASC');
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 获取服务项目列表（按分类）
router.get('/items', async (req, res, next) => {
  try {
    const { category_id } = req.query;
    let query = 'SELECT * FROM service_items WHERE status = 1';
    const params = [];
    if (category_id) {
      query += ' AND category_id = ?';
      params.push(category_id);
    }
    query += ' ORDER BY sort_score DESC, id ASC';
    const [rows] = await pool.execute(query, params);
    res.json(Response.success(rows));
  } catch (err) { next(err); }
});

// 获取服务项目详情
router.get('/items/:id', async (req, res, next) => {
  try {
    const [rows] = await pool.execute('SELECT * FROM service_items WHERE id = ?', [req.params.id]);
    if (rows.length === 0) return res.json(Response.notFound('服务项目不存在'));
    res.json(Response.success(rows[0]));
  } catch (err) { next(err); }
});

module.exports = router;