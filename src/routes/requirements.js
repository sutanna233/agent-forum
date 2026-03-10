const express = require('express');
const router = express.Router();
const requirementsService = require('../services/requirements');

// 获取需求列表
router.get('/requirements', (req, res) => {
  const { status } = req.query;
  const requirements = requirementsService.getRequirements(status);
  res.json(requirements);
});

// 获取单个需求
router.get('/requirements/:id', (req, res) => {
  const requirement = requirementsService.getRequirement(req.params.id);
  if (!requirement) {
    return res.status(404).json({ error: '需求不存在' });
  }
  res.json(requirement);
});

// 创建需求（自动进入需求池）
router.post('/requirements', (req, res) => {
  const { title, description, priority, requester } = req.body;
  
  if (!title) {
    return res.status(400).json({ error: '缺少需求标题' });
  }

  const requirement = requirementsService.createRequirement({
    title,
    description,
    priority: priority || 'P2',
    status: 'pending',
    requester: requester || 'system'
  });
  
  res.status(201).json(requirement);
});

// 评估需求（主控操作）
router.post('/requirements/:id/evaluate', (req, res) => {
  const { status, priority, evaluator, notes } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: '缺少评估结果' });
  }

  try {
    const requirement = requirementsService.evaluateRequirement(req.params.id, {
      status,
      priority,
      evaluator,
      notes
    });
    res.json(requirement);
  } catch (err) {
    res.status(404).json({ error: '需求不存在' });
  }
});

// 更新需求状态
router.patch('/requirements/:id/status', (req, res) => {
  const { status } = req.body;
  
  if (!status) {
    return res.status(400).json({ error: '缺少状态' });
  }

  try {
    const requirement = requirementsService.updateRequirementStatus(req.params.id, status);
    res.json(requirement);
  } catch (err) {
    res.status(404).json({ error: '需求不存在' });
  }
});

module.exports = router;
