const { getDb } = require('../models/db');
const { createIssue, getIssueUrl, analyzePost } = require('./github');

/**
 * 处理单个帖子，转为 GitHub Issue
 * @param {string} postId - 帖子 ID
 * @returns {Promise<object>} 处理结果
 */
async function processPost(postId) {
  const db = getDb();
  const post = db.prepare('SELECT * FROM posts WHERE id = ?').get(postId);
  
  if (!post) {
    return { success: false, error: '帖子不存在' };
  }
  
  // 检查是否已经处理过
  if (post.github_issue_url) {
    return { success: false, error: '帖子已创建过 Issue', issueUrl: post.github_issue_url };
  }
  
  // 分析帖子
  const analysis = analyzePost(post);
  
  if (!analysis.shouldCreate) {
    return { success: false, reason: analysis.reason };
  }
  
  // 构建 Issue 内容
  const issueBody = `
## 论坛帖子

- **作者**: ${post.author}
- **类型**: ${post.type}
- **发布时间**: ${post.created_at}
- **帖子链接**: (需要在论坛中查看)

### 内容

${post.content}

---

*此 Issue 由论坛自动创建*
`.trim();
  
  try {
    // 创建 GitHub Issue
    const issue = await createIssue(analysis.title, issueBody, analysis.labels);
    
    // 更新帖子记录
    db.prepare(`
      UPDATE posts 
      SET github_issue_url = ?, github_issue_number = ?, updated_at = CURRENT_TIMESTAMP
      WHERE id = ?
    `).run(issue.html_url, issue.number, postId);
    
    return {
      success: true,
      issueNumber: issue.number,
      issueUrl: issue.html_url,
      reason: analysis.reason
    };
  } catch (error) {
    return { success: false, error: error.message };
  }
}

/**
 * 处理所有未处理的帖子
 * @returns {Promise<object[]>} 处理结果数组
 */
async function processAllPosts() {
  const db = getDb();
  const posts = db.prepare(`
    SELECT * FROM posts 
    WHERE github_issue_url IS NULL 
    ORDER BY created_at DESC
  `).all();
  
  const results = [];
  
  for (const post of posts) {
    const result = await processPost(post.id);
    results.push({
      postId: post.id,
      ...result
    });
  }
  
  return results;
}

/**
 * 获取帖子关联的 GitHub Issue
 * @param {string} postId - 帖子 ID
 * @returns {object|null} Issue 信息
 */
function getPostIssue(postId) {
  const db = getDb();
  const post = db.prepare('SELECT github_issue_url, github_issue_number FROM posts WHERE id = ?').get(postId);
  
  if (!post || !post.github_issue_url) {
    return null;
  }
  
  return {
    url: post.github_issue_url,
    number: post.github_issue_number
  };
}

/**
 * 为帖子添加回复通知
 * @param {string} postId - 帖子 ID
 * @param {string} issueUrl - Issue 链接
 * @returns {object} 评论对象
 */
function addPostNotification(postId, issueUrl) {
  const db = getDb();
  const { v4: uuidv4 } = require('uuid');
  
  const commentId = uuidv4();
  const notificationContent = `✅ 已自动创建 GitHub Issue：${issueUrl}`;
  
  db.prepare(`
    INSERT INTO comments (id, post_id, content, author)
    VALUES (?, ?, ?, ?)
  `).run(commentId, postId, notificationContent, 'system');
  
  return {
    id: commentId,
    post_id: postId,
    content: notificationContent,
    author: 'system'
  };
}

module.exports = {
  processPost,
  processAllPosts,
  getPostIssue,
  addPostNotification
};
