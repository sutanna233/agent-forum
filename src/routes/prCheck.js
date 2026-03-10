/**
 * PR 检查路由
 */

const express = require('express');
const router = express.Router();
const prCheckService = require('../services/prCheck');

/**
 * POST /api/pr-check/run
 * 手动触发 PR 检查
 */
router.post('/run', async (req, res) => {
  try {
    const result = await prCheckService.checkAndMerge();
    res.json({
      success: true,
      message: 'PR 检查完成',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: 'PR 检查失败',
      error: err.message
    });
  }
});

/**
 * GET /api/pr-check/status
 * 获取 PR 检查服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const openPRs = await prCheckService.getOpenPRs('agent-iteration-system');
    res.json({
      success: true,
      data: {
        service: 'pr-check',
        enabled: !!prCheckService.octokit,
        openPRCount: openPRs.length,
        repos: ['agent-iteration-system', 'agent-forum']
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
