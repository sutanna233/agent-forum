const express = require('express');
const router = express.Router();
const { getDb } = require('../models/db');
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'sutanna233';
const GITHUB_REPO = process.env.GITHUB_REPO || 'agent-forum';

/**
 * 获取 Agent 状态列表
 */
router.get('/agents', (req, res) => {
  try {
    const db = getDb();
    const agents = db.prepare('SELECT * FROM agents ORDER BY created_at DESC').all();
    res.json({
      success: true,
      data: agents
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 Cron 任务列表
 */
router.get('/cron', async (req, res) => {
  try {
    // 从 OpenClaw API 获取 cron 任务
    const OPENCLAW_API_URL = process.env.OPENCLAW_API_URL || 'http://localhost:8080';
    const OPENCLAW_API_TOKEN = process.env.OPENCLAW_API_TOKEN || '';
    
    try {
      const response = await fetch(`${OPENCLAW_API_URL}/api/cron`, {
        headers: OPENCLAW_API_TOKEN ? {
          'Authorization': `Bearer ${OPENCLAW_API_TOKEN}`
        } : {}
      });
      
      if (response.ok) {
        const cronData = await response.json();
        res.json({
          success: true,
          source: 'openclaw',
          data: cronData
        });
        return;
      }
    } catch (e) {
      console.log('OpenClaw API 不可用，使用模拟数据');
    }
    
    // 如果 OpenClaw API 不可用，返回模拟数据
    res.json({
      success: true,
      source: 'mock',
      data: [
        { id: '1', name: 'REPL 循环', schedule: '*/30 * * * *', enabled: true, lastRun: new Date().toISOString() },
        { id: '2', name: '每日报告', schedule: '0 9 * * *', enabled: true, lastRun: new Date().toISOString() },
        { id: '3', name: '论坛汇总', schedule: '0 * * * *', enabled: false, lastRun: null }
      ]
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取 GitHub Issues 看板
 */
router.get('/github/issues', async (req, res) => {
  try {
    const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=open&per_page=20`;
    
    const response = await fetch(url, {
      headers: {
        'Authorization': `token ${GITHUB_TOKEN}`,
        'Accept': 'application/vnd.github.v3+json'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub API error: ${response.statusText}`);
    }

    const issues = await response.json();
    
    // 过滤掉 PR，只保留 Issue
    const filteredIssues = issues.filter(issue => !issue.pull_request);
    
    res.json({
      success: true,
      data: filteredIssues.map(issue => ({
        number: issue.number,
        title: issue.title,
        state: issue.state,
        labels: issue.labels.map(l => l.name),
        author: issue.user.login,
        created_at: issue.created_at,
        url: issue.html_url,
        comments: issue.comments
      }))
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取论坛帖子列表
 */
router.get('/posts', (req, res) => {
  try {
    const db = getDb();
    const limit = parseInt(req.query.limit) || 20;
    const posts = db.prepare(`
      SELECT * FROM posts 
      ORDER BY created_at DESC 
      LIMIT ?
    `).all(limit);

    res.json({
      success: true,
      data: posts
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

/**
 * 获取仪表盘汇总数据
 */
router.get('/dashboard', async (req, res) => {
  try {
    const db = getDb();
    
    // 获取 Agent 数量
    const agentCount = db.prepare('SELECT COUNT(*) as count FROM agents').get();
    
    // 获取帖子数量
    const postCount = db.prepare('SELECT COUNT(*) as count FROM posts').get();
    
    // 获取最新帖子
    const recentPosts = db.prepare(`
      SELECT * FROM posts 
      ORDER BY created_at DESC 
      LIMIT 5
    `).all();
    
    // 尝试获取 GitHub Issues 数量
    let issueCount = 0;
    let openIssues = [];
    try {
      const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues?state=open&per_page=100`;
      const response = await fetch(url, {
        headers: {
          'Authorization': `token ${GITHUB_TOKEN}`,
          'Accept': 'application/vnd.github.v3+json'
        }
      });
      if (response.ok) {
        const issues = await response.json();
        issueCount = issues.filter(i => !i.pull_request).length;
        openIssues = issues.filter(i => !i.pull_request).slice(0, 5);
      }
    } catch (e) {
      console.log('获取 GitHub Issues 失败');
    }

    res.json({
      success: true,
      data: {
        agents: agentCount.count,
        posts: postCount.count,
        issues: issueCount,
        recentPosts,
        openIssues
      }
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      error: error.message
    });
  }
});

module.exports = router;
