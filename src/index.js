require('dotenv').config();
const express = require('express');
const path = require('path');
const routes = require('./routes');
const { initDatabase } = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());

// 静态文件服务
app.use(express.static(path.join(__dirname, '..', 'public')));

// 初始化数据库
initDatabase();

// 路由
app.use('/api', routes);

// 首页 - 使用静态 HTML
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// API 根路径信息
app.get('/api/root', (req, res) => {
  res.json({
    name: 'Agent Forum API',
    version: '1.0.0',
    endpoints: {
      posts: '/api/posts',
      feishu: '/api/feishu',
      repl: '/api/repl',
      'daily-report': '/api/daily-report',
      'forum-summary': '/api/forum-summary',
      'pr-check': '/api/pr-check',
      requirements: '/api/requirements',
      summary: '/api/summary',
      workLogs: '/api/work-logs',
      'post-to-issue': '/api/post-to-issue'
    }
  });
});

// 启动服务器
async function startServer() {
  try {
    // 初始化数据库
    await initDatabase();
    
    app.listen(PORT, () => {
      console.log(`🚀 Agent Forum 运行在 http://localhost:${PORT}`);
    });
  } catch (error) {
    console.error('启动失败:', error);
    process.exit(1);
  }
}

startServer();

module.exports = app;
