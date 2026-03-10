const express = require('express');
const router = express.Router();
const feishuService = require('../services/feishu');

/**
 * POST /api/feishu/send
 * 发送飞书消息
 * Body: { receiveIdType, receiveId, content }
 */
router.post('/send', async (req, res) => {
  try {
    const { receiveIdType, receiveId, content } = req.body;
    
    if (!receiveId || !content) {
      return res.status(400).json({ error: '缺少必要参数: receiveId, content' });
    }

    const result = await feishuService.sendTextMessage(
      receiveIdType || 'open_id',
      receiveId,
      content
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/send-rich-text
 * 发送富文本消息
 * Body: { receiveId, title, items, footer }
 */
router.post('/send-rich-text', async (req, res) => {
  try {
    const { receiveId, title, items, footer } = req.body;
    
    if (!receiveId || !title) {
      return res.status(400).json({ error: '缺少必要参数: receiveId, title' });
    }

    const result = await feishuService.sendRichTextMessage(
      'open_id',
      receiveId,
      { title, items, footer }
    );

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/work-log
 * 发送工作日志
 * Body: { receiveId, agent, tasks, issues, summary }
 */
router.post('/work-log', async (req, res) => {
  try {
    const { receiveId, agent, tasks, issues, summary } = req.body;
    
    if (!receiveId) {
      return res.status(400).json({ error: '缺少必要参数: receiveId' });
    }

    const result = await feishuService.sendWorkLog(receiveId, {
      agent: agent || 'Agent',
      tasks,
      issues,
      summary
    });

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/post-notification
 * 发送帖子通知
 * Body: { receiveId, post }
 */
router.post('/post-notification', async (req, res) => {
  try {
    const { receiveId, post } = req.body;
    
    if (!receiveId || !post) {
      return res.status(400).json({ error: '缺少必要参数: receiveId, post' });
    }

    const result = await feishuService.sendPostNotification(receiveId, post);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/webhook
 * 飞书 Webhook 回调接口
 * 用于接收飞书消息事件
 */
router.post('/webhook', async (req, res) => {
  try {
    const { type, event } = req.body;
    
    // 处理验证请求
    if (type === 'url_verification') {
      return res.json({ challenge: req.body.challenge });
    }

    // 处理消息事件
    if (type === 'im.message' && event?.message) {
      const message = await feishuService.handleMessageEvent(event);
      
      if (message) {
        // 可以在这里添加自定义处理逻辑
        console.log('处理消息:', message);
      }
    }

    res.json({ success: true });
  } catch (error) {
    console.error('处理飞书 Webhook 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/chat
 * 创建飞书群聊
 * Body: { name, userIds }
 */
router.post('/chat', async (req, res) => {
  try {
    const { name, userIds } = req.body;
    
    if (!name) {
      return res.status(400).json({ error: '缺少必要参数: name' });
    }

    const result = await feishuService.createChat(name, userIds || []);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/feishu/chat/:chatId/members
 * 添加成员到群聊
 * Body: { userIds }
 */
router.post('/chat/:chatId/members', async (req, res) => {
  try {
    const { chatId } = req.params;
    const { userIds } = req.body;
    
    if (!userIds || userIds.length === 0) {
      return res.status(400).json({ error: '缺少必要参数: userIds' });
    }

    const result = await feishuService.addMembersToChat(chatId, userIds);

    res.json(result);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/feishu/token
 * 获取 Access Token (用于测试)
 */
router.get('/token', async (req, res) => {
  try {
    const token = await feishuService.getAccessToken();
    res.json({ token });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
