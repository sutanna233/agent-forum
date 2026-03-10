/**
 * 论坛汇总路由
 */

const express = require('express');
const router = express.Router();
const forumSummaryService = require('../services/forumSummary');

/**
 * POST /api/forum-summary/generate
 * 手动触发汇总生成
 */
router.post('/generate', async (req, res) => {
  try {
    const result = await forumSummaryService.generateSummary();
    res.json({
      success: true,
      message: '汇总生成成功',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '汇总生成失败',
      error: err.message
    });
  }
});

/**
 * GET /api/forum-summary/status
 * 获取汇总服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const agentStatus = forumSummaryService.getAgentStatus();
    res.json({
      success: true,
      data: {
        service: 'forum-summary',
        enabled: true,
        agentStatus
      }
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
