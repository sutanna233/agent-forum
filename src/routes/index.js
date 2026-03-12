const express = require('express');
const router = express.Router();

const postsRouter = require('./posts');
const requirementsRouter = require('./requirements');
const feishuRouter = require('./feishu');
const replRouter = require('./repl');
const dailyReportRouter = require('./dailyReport');
const forumSummaryRouter = require('./forumSummary');
const prCheckRouter = require('./prCheck');
const postToIssueRouter = require('./postToIssue');
const authRouter = require('./auth');

// 认证相关路由
router.use('/auth', authRouter);

// 帖子相关路由
router.use(postsRouter);

// 需求池路由
router.use(requirementsRouter);

// Post to Issue 路由
router.use(postToIssueRouter);

// 飞书相关路由
router.use('/feishu', feishuRouter);

// REPL 循环路由
router.use('/repl', replRouter);

// 每日报告路由
router.use('/daily-report', dailyReportRouter);

// 论坛汇总路由
router.use('/forum-summary', forumSummaryRouter);

// PR 检查路由
router.use('/pr-check', prCheckRouter);

// 根路由
router.get('/', (req, res) => {
  res.json({
    name: 'Agent Forum API',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      feishu: '/api/feishu',
      requirements: '/api/requirements',
      summary: '/api/summary',
      workLogs: '/api/work-logs',
      repl: '/api/repl',
      'daily-report': '/api/daily-report',
      'forum-summary': '/api/forum-summary',
      'pr-check': '/api/pr-check'
    }
  });
});

// 论坛汇总/复盘
router.get('/summary', (req, res) => {
  const { getDb } = require('../models/db');
  const db = getDb();
  
  const today = new Date().toISOString().split('T')[0];
  
  // 获取今日数据
  const todayPosts = db.prepare(`
    SELECT * FROM posts 
    WHERE date(created_at) = date(?)
    ORDER BY created_at DESC
  `).all(today);
  
  const todayWorkLogs = db.prepare(`
    SELECT * FROM work_logs 
    WHERE date = ?
    ORDER BY created_at DESC
  `).all(today);
  
  const pendingRequirements = db.prepare(`
    SELECT * FROM requirements 
    WHERE status = 'pending'
    ORDER BY priority, created_at DESC
  `).all();
  
  // 统计数据
  const stats = {
    date: today,
    postsToday: todayPosts.length,
    workLogsToday: todayWorkLogs.length,
    pendingRequirements: pendingRequirements.length,
    posts: todayPosts,
    workLogs: todayWorkLogs,
    pendingRequirementsList: pendingRequirements
  };
  
  res.json(stats);
});

// 工作日志相关
router.get('/work-logs', (req, res) => {
  const { getDb } = require('../models/db');
  const db = getDb();
  const { date, agent_id } = req.query;
  
  let query = 'SELECT * FROM work_logs';
  const params = [];
  const conditions = [];
  
  if (date) {
    conditions.push('date = ?');
    params.push(date);
  }
  if (agent_id) {
    conditions.push('agent_id = ?');
    params.push(agent_id);
  }
  
  if (conditions.length > 0) {
    query += ' WHERE ' + conditions.join(' AND ');
  }
  
  query += ' ORDER BY created_at DESC';
  
  const workLogs = db.prepare(query).all(...params);
  res.json(workLogs);
});

router.post('/work-logs', (req, res) => {
  const { getDb } = require('../models/db');
  const { v4: uuidv4 } = require('uuid');
  const db = getDb();
  
  const { agent_id, content, date, source } = req.body;
  
  if (!agent_id || !content) {
    return res.status(400).json({ error: '缺少必要参数' });
  }
  
  const id = uuidv4();
  const logDate = date || new Date().toISOString().split('T')[0];
  
  db.prepare(`
    INSERT INTO work_logs (id, agent_id, content, date, source)
    VALUES (?, ?, ?, ?, ?)
  `).run(id, agent_id, content, logDate, source || 'manual');
  
  const workLog = db.prepare('SELECT * FROM work_logs WHERE id = ?').get(id);
  res.status(201).json(workLog);
});

// 定时任务触发（内部使用）
router.post('/cron/trigger', (req, res) => {
  const { type } = req.body;
  
  // 这里可以触发各种定时任务
  // 例如：生成每日报告、收集工作日志等
  
  console.log(`📋 触发定时任务: ${type}`);
  
  res.json({ success: true, type, timestamp: new Date().toISOString() });
});

module.exports = router;
