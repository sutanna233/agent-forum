/**
 * 每日报告路由
 */

const express = require('express');
const router = express.Router();
const dailyReportService = require('../services/dailyReport');

/**
 * POST /api/daily-report/generate
 * 手动触发报告生成
 */
router.post('/generate', async (req, res) => {
  try {
    const result = await dailyReportService.generateDailyReport();
    res.json({
      success: true,
      message: '报告生成成功',
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      message: '报告生成失败',
      error: err.message
    });
  }
});

/**
 * GET /api/daily-report/status
 * 获取报告服务状态
 */
router.get('/status', async (req, res) => {
  try {
    const agentStatus = await dailyReportService.getAgentWorkStatus();
    res.json({
      success: true,
      data: {
        service: 'daily-report',
        enabled: !!process.env.GITHUB_TOKEN,
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
