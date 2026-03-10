require('dotenv').config();
const express = require('express');
const routes = require('./routes');
const { initDatabase } = require('./models/db');

const app = express();
const PORT = process.env.PORT || 3000;

// 中间件
app.use(express.json());
app.use(express.static('public'));

// 初始化数据库
initDatabase();

// 路由
app.use('/api', routes);

// 首页 - 使用静态 HTML
app.get('/', (req, res) => {
  res.sendFile(__dirname + '/../public/index.html');
});

// 健康检查
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

app.listen(PORT, () => {
  console.log(`🚀 Agent Forum 运行在 http://localhost:${PORT}`);
});

module.exports = app;
