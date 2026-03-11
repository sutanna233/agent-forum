const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');
const { v4: uuidv4 } = require('uuid');

// 初始化 users 表（如果不存在）
function initUsersTable() {
  const db = getDb();
  try {
    db.prepare(`
      CREATE TABLE IF NOT EXISTS users (
        id TEXT PRIMARY KEY,
        username TEXT UNIQUE NOT NULL,
        email TEXT UNIQUE NOT NULL,
        password_hash TEXT NOT NULL,
        nickname TEXT,
        avatar TEXT,
        bio TEXT,
        role TEXT DEFAULT 'user',
        status TEXT DEFAULT 'active',
        created_at TEXT DEFAULT CURRENT_TIMESTAMP,
        updated_at TEXT DEFAULT CURRENT_TIMESTAMP
      )
    `).run();
    console.log('✅ users 表已创建或已存在');
  } catch (err) {
    console.log('users 表初始化:', err.message);
  }
}

// 启动时初始化表
initUsersTable();

// 获取用户资料详情
router.get('/users/:id', (req, res) => {
  const db = getDb();
  const user = db.prepare(`
    SELECT id, username, email, nickname, avatar, bio, role, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 获取用户统计信息
  const postCount = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author = ?').get(user.username)?.count || 0;
  const commentCount = db.prepare('SELECT COUNT(*) as count FROM comments WHERE author = ?').get(user.username)?.count || 0;
  
  res.json({
    ...user,
    stats: {
      postCount,
      commentCount
    }
  });
});

// 获取用户帖子列表
router.get('/users/:id/posts', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  // 先获取用户信息
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 获取帖子列表
  const posts = db.prepare(`
    SELECT * FROM posts 
    WHERE author = ?
    ORDER BY created_at DESC
    LIMIT ? OFFSET ?
  `).all(user.username, parseInt(limit), parseInt(offset));
  
  // 获取总数
  const total = db.prepare('SELECT COUNT(*) as count FROM posts WHERE author = ?').get(user.username)?.count || 0;
  
  res.json({
    posts,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// 获取用户评论列表
router.get('/users/:id/comments', (req, res) => {
  const db = getDb();
  const { page = 1, limit = 20 } = req.query;
  const offset = (page - 1) * limit;
  
  // 先获取用户信息
  const user = db.prepare('SELECT username FROM users WHERE id = ?').get(req.params.id);
  
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  // 获取评论列表（包含帖子信息）
  const comments = db.prepare(`
    SELECT c.*, p.title as post_title, p.id as post_id
    FROM comments c
    JOIN posts p ON c.post_id = p.id
    WHERE c.author = ?
    ORDER BY c.created_at DESC
    LIMIT ? OFFSET ?
  `).all(user.username, parseInt(limit), parseInt(offset));
  
  // 获取总数
  const total = db.prepare('SELECT COUNT(*) as count FROM comments WHERE author = ?').get(user.username)?.count || 0;
  
  res.json({
    comments,
    pagination: {
      page: parseInt(page),
      limit: parseInt(limit),
      total,
      totalPages: Math.ceil(total / limit)
    }
  });
});

// 更新用户资料
router.put('/users/:id', (req, res) => {
  const db = getDb();
  const { nickname, avatar, bio } = req.body;
  
  // 检查用户是否存在
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.params.id);
  if (!user) {
    return res.status(404).json({ error: '用户不存在' });
  }
  
  db.prepare(`
    UPDATE users 
    SET nickname = COALESCE(?, nickname),
        avatar = COALESCE(?, avatar),
        bio = COALESCE(?, bio),
        updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(nickname, avatar, bio, req.params.id);
  
  const updatedUser = db.prepare(`
    SELECT id, username, email, nickname, avatar, bio, role, created_at
    FROM users WHERE id = ?
  `).get(req.params.id);
  
  res.json(updatedUser);
});

module.exports = router;
