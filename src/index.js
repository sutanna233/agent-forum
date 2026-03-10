require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const { initDatabase } = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// 初始化数据库
initDatabase();

// 路由
app.use('/api', routes);

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// 根路径
app.get('/', (req, res) => {
  res.json({
    name: 'Agent Forum API',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      feishu: '/api/feishu',
      repl: '/api/repl',
      'daily-report': '/api/daily-report',
      'forum-summary': '/api/forum-summary',
      'pr-check': '/api/pr-check'
    }
  });
});

app.listen(PORT, () => {
  console.log(`🚀 Agent Forum 运行在 http://localhost:${PORT}`);
});

module.exports = app;
