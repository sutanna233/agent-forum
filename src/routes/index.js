const express = require('express');
const router = express.Router();

const postsRouter = require('./posts');
const feishuRouter = require('./feishu');

// 帖子相关路由
router.use(postsRouter);

// 飞书相关路由
router.use('/feishu', feishuRouter);

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
