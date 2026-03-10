/**
 * REPL 循环路由
 * API 端点用于任务拉取、执行、反馈
 */

const express = require('express');
const router = express.Router();
const replService = require('../services/repl');

/**
 * GET /api/repl/status
 * 获取 Agent 状态
 */
router.get('/status', (req, res) => {
  try {
    const status = replService.getStatus();
    res.json({
      success: true,
      data: status
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * POST /api/repl/run
 * 手动触发 REPL 循环
 */
router.post('/run', async (req, res) => {
  try {
    const result = await replService.runReplLoop();
    res.json({
      success: true,
      data: result
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * GET /api/repl/tasks
 * 获取当前任务列表
 */
router.get('/tasks', (req, res) => {
  try {
    const taskContent = replService.readTaskMd();
    const tasks = replService.parseTasks(taskContent);
    res.json({
      success: true,
      data: tasks
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

/**
 * PUT /api/repl/tasks/:taskId
 * 更新任务状态
 */
router.put('/tasks/:taskId', (req, res) => {
  try {
    const { taskId } = req.params;
    const { status } = req.body;

    if (!status || !['in_progress', 'completed'].includes(status)) {
      return res.status(400).json({
        success: false,
        error: '无效的状态值'
      });
    }

    replService.updateTaskStatus(taskId, status);
    res.json({
      success: true,
      message: `任务 ${taskId} 状态已更新为 ${status}`
    });
  } catch (err) {
    res.status(500).json({
      success: false,
      error: err.message
    });
  }
});

module.exports = router;
