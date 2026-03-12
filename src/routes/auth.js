const express = require('express');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../models/db');

const router = express.Router();

const JWT_SECRET = process.env.JWT_SECRET || 'agent-forum-secret-key-change-in-production';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '7d';

// 注册
router.post('/register', async (req, res) => {
  try {
    const { email, password, nickname } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    // 验证邮箱格式
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      return res.status(400).json({ error: '邮箱格式不正确' });
    }

    // 验证密码长度
    if (password.length < 6) {
      return res.status(400).json({ error: '密码长度至少6位' });
    }

    const db = getDb();

    // 检查邮箱是否已存在
    const existingUser = db.prepare('SELECT id FROM users WHERE email = ?').get(email);
    if (existingUser) {
      return res.status(400).json({ error: '该邮箱已被注册' });
    }

    // 加密密码
    const hashedPassword = await bcrypt.hash(password, 10);

    // 创建用户
    const id = uuidv4();
    const userNickname = nickname || email.split('@')[0];

    db.prepare(`
      INSERT INTO users (id, email, password, nickname, role, status)
      VALUES (?, ?, ?, ?, 'user', 'active')
    `).run(id, email, hashedPassword, userNickname);

    // 生成 Token
    const token = jwt.sign({ id, email, nickname: userNickname }, JWT_SECRET, { expiresIn: JWT_EXPIRES_IN });

    res.status(201).json({
      message: '注册成功',
      user: {
        id,
        email,
        nickname: userNickname,
        role: 'user'
      },
      token
    });
  } catch (error) {
    console.error('注册错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登录
router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: '邮箱和密码不能为空' });
    }

    const db = getDb();

    // 查找用户
    const user = db.prepare('SELECT * FROM users WHERE email = ?').get(email);
    if (!user) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 检查用户状态
    if (user.status !== 'active') {
      return res.status(401).json({ error: '账号已被禁用' });
    }

    // 验证密码
    const isPasswordValid = await bcrypt.compare(password, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '邮箱或密码错误' });
    }

    // 生成 Token
    const token = jwt.sign(
      { id: user.id, email: user.email, nickname: user.nickname, role: user.role },
      JWT_SECRET,
      { expiresIn: JWT_EXPIRES_IN }
    );

    res.json({
      message: '登录成功',
      user: {
        id: user.id,
        email: user.email,
        nickname: user.nickname,
        avatar: user.avatar,
        bio: user.bio,
        role: user.role
      },
      token
    });
  } catch (error) {
    console.error('登录错误:', error);
    res.status(500).json({ error: '服务器错误' });
  }
});

// 登出 (客户端移除 token 即可，这里返回成功消息)
router.post('/logout', (req, res) => {
  res.json({ message: '登出成功' });
});

// 获取当前用户信息
router.get('/me', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const db = getDb();

    const user = db.prepare(`
      SELECT id, email, nickname, avatar, bio, role, status, created_at
      FROM users WHERE id = ?
    `).get(decoded.id);

    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    res.json({ user });
  } catch (error) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

// 更新用户资料
router.put('/profile', (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { nickname, avatar, bio } = req.body;

    const db = getDb();

    // 更新用户资料
    db.prepare(`
      UPDATE users SET nickname = ?, avatar = ?, bio = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(nickname || decoded.nickname, avatar || null, bio || null, decoded.id);

    const user = db.prepare(`
      SELECT id, email, nickname, avatar, bio, role, status, created_at
      FROM users WHERE id = ?
    `).get(decoded.id);

    res.json({ message: '资料更新成功', user });
  } catch (error) {
    console.error('更新资料错误:', error);
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

// 修改密码
router.put('/password', async (req, res) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '未登录' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    const { oldPassword, newPassword } = req.body;

    if (!oldPassword || !newPassword) {
      return res.status(400).json({ error: '旧密码和新密码不能为空' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ error: '新密码长度至少6位' });
    }

    const db = getDb();

    // 获取用户
    const user = db.prepare('SELECT * FROM users WHERE id = ?').get(decoded.id);
    if (!user) {
      return res.status(404).json({ error: '用户不存在' });
    }

    // 验证旧密码
    const isPasswordValid = await bcrypt.compare(oldPassword, user.password);
    if (!isPasswordValid) {
      return res.status(401).json({ error: '旧密码错误' });
    }

    // 更新密码
    const hashedPassword = await bcrypt.hash(newPassword, 10);
    db.prepare('UPDATE users SET password = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ?')
      .run(hashedPassword, decoded.id);

    res.json({ message: '密码修改成功' });
  } catch (error) {
    console.error('修改密码错误:', error);
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
});

// JWT 认证中间件
function authMiddleware(req, res, next) {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: '需要登录才能访问' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const decoded = jwt.verify(token, JWT_SECRET);
    req.user = decoded;
    next();
  } catch (error) {
    return res.status(401).json({ error: 'Token 无效或已过期' });
  }
}

// 角色验证中间件
function roleMiddleware(...allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ error: '需要登录才能访问' });
    }

    if (!allowedRoles.includes(req.user.role)) {
      return res.status(403).json({ error: '权限不足' });
    }

    next();
  };
}

module.exports = router;
module.exports.authMiddleware = authMiddleware;
module.exports.roleMiddleware = roleMiddleware;
