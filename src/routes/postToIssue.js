const express = require('express');
const router = express.Router();
const postToIssueService = require('../services/postToIssue');

/**
 * POST /api/posts/:id/to-issue
 * 将指定帖子转换为 GitHub Issue
 * Body: 无需参数
 */
router.post('/posts/:id/to-issue', async (req, res) => {
  try {
    const postId = req.params.id;
    const result = await postToIssueService.processPost(postId);
    
    if (result.success) {
      // 添加帖子回复通知
      postToIssueService.addPostNotification(postId, result.issueUrl);
      
      res.json({
        success: true,
        message: '成功创建 GitHub Issue',
        issueNumber: result.issueNumber,
        issueUrl: result.issueUrl
      });
    } else {
      res.status(400).json({
        success: false,
        error: result.error || result.reason
      });
    }
  } catch (error) {
    console.error('转换帖子为 Issue 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * POST /api/posts/to-issue-all
 * 将所有未处理的帖子转换为 GitHub Issue
 */
router.post('/posts/to-issue-all', async (req, res) => {
  try {
    const results = await postToIssueService.processAllPosts();
    
    const successCount = results.filter(r => r.success).length;
    const failCount = results.filter(r => !r.success).length;
    
    res.json({
      total: results.length,
      success: successCount,
      failed: failCount,
      results
    });
  } catch (error) {
    console.error('批量转换帖子为 Issue 失败:', error);
    res.status(500).json({ error: error.message });
  }
});

/**
 * GET /api/posts/:id/issue
 * 获取帖子关联的 GitHub Issue
 */
router.get('/posts/:id/issue', (req, res) => {
  try {
    const postId = req.params.id;
    const issue = postToIssueService.getPostIssue(postId);
    
    if (!issue) {
      return res.status(404).json({ error: '帖子未关联 Issue' });
    }
    
    res.json(issue);
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

module.exports = router;
