const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');
const { v4: uuidv4 } = require('uuid');

// 获取所有帖子
router.get('/posts', (req, res) => {
  const db = getDb();
  const posts = db.prepare('SELECT * FROM posts ORDER BY created_at DESC').all();
  res.json(posts);
});

// 获取单个帖子
router.get('/posts/:id', (req, res) => {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  if (!post) {
    return res.status(404).json({ error: '帖子不存在' });
  }
  
  const comments = db.prepare('SELECT * FROM comments WHERE post_id = ?').all(req.params.id);
  const votes = db.prepare('SELECT * FROM votes WHERE post_id = ?').all(req.params.id);
  
  res.json({ ...post, comments, votes });
});

// 创建帖子
router.post('/posts', (req, res) => {
  const { type, title, content, author } = req.body;
  
  if (!content || !author) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const db = getDb();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO posts (id, type, title, content, author)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, type || 'discussion', title || '', content, author);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(id);
  res.status(201).json(post);
});

// 更新帖子
router.put('/posts/:id', (req, res) => {
  const { title, content } = req.body;
  const db = getDb();
  
  db.prepare(`
    UPDATE posts SET title = ?, content = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(title, content, req.params.id);

  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(req.params.id);
  res.json(post);
});

// 删除帖子
router.delete('/posts/:id', (req, res) => {
  const db = getDb();
  db.prepare('DELETE FROM comments WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM votes WHERE post_id = ?').run(req.params.id);
  db.prepare('DELETE FROM posts WHERE id = ?').run(req.params.id);
  res.status(204).send();
});

// 添加评论
router.post('/posts/:id/comments', (req, res) => {
  const { content, author } = req.body;
  
  if (!content || !author) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const db = getDb();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO comments (id, post_id, content, author)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, content, author);

  const comment = db.prepare('SELECT * FROM comments WHERE id = ?').get(id);
  res.status(201).json(comment);
});

// 投票
router.post('/posts/:id/vote', (req, res) => {
  const { option, voter } = req.body;
  
  if (!option || !voter) {
    return res.status(400).json({ error: '缺少必要参数' });
  }

  const db = getDb();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO votes (id, post_id, option, voter)
    VALUES (?, ?, ?, ?)
  `).run(id, req.params.id, option, voter);

  const votes = db.prepare('SELECT * FROM votes WHERE post_id = ?').all(req.params.id);
  res.status(201).json(votes);
});

module.exports = router;
