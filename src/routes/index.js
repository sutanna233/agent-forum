const express = require('express');
const router = express.Router();

const postsRouter = require('./posts');
const feishuRouter = require('./feishu');
const replRouter = require('./repl');
const dailyReportRouter = require('./dailyReport');

// 帖子相关路由
router.use(postsRouter);

// 飞书相关路由
router.use('/feishu', feishuRouter);

// REPL 循环路由
router.use('/repl', replRouter);

// 每日报告路由
router.use('/daily-report', dailyReportRouter);

// 根路由
router.get('/', (req, res) => {
  res.json({
    name: 'Agent Forum API',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      feishu: '/api/feishu'
    }
  });
});

module.exports = router;
