const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const GITHUB_OWNER = process.env.GITHUB_OWNER || 'sutanna233';
const GITHUB_REPO = process.env.GITHUB_REPO || 'agent-forum';

/**
 * 创建 GitHub Issue
 * @param {string} title - Issue 标题
 * @param {string} body - Issue 内容
 * @param {string[]} labels - 标签数组
 * @returns {Promise<object>} GitHub API 响应
 */
async function createIssue(title, body, labels = []) {
  const url = `https://api.github.com/repos/${GITHUB_OWNER}/${GITHUB_REPO}/issues`;
  
  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Authorization': `token ${GITHUB_TOKEN}`,
      'Accept': 'application/vnd.github.v3+json',
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      title,
      body,
      labels
    })
  });

  if (!response.ok) {
    const error = await response.json();
    throw new Error(`GitHub API error: ${error.message || response.statusText}`);
  }

  return await response.json();
}

/**
 * 获取 Issue 链接
 * @param {number} issueNumber - Issue 编号
 * @returns {string} Issue URL
 */
function getIssueUrl(issueNumber) {
  return `https://github.com/${GITHUB_OWNER}/${GITHUB_REPO}/issues/${issueNumber}`;
}

/**
 * 分析帖子内容是否需要创建 Issue
 * @param {object} post - 帖子对象
 * @returns {object} 分析结果 { shouldCreate: boolean, reason: string, labels: string[], title: string }
 */
function analyzePost(post) {
  const { type, title, content, author } = post;
  
  // Bug 类型直接创建 Issue
  if (type === 'bug') {
    return {
      shouldCreate: true,
      reason: 'Bug 类型帖子',
      labels: ['bug', 'from-forum'],
      title: `[Bug] ${title || content.substring(0, 50)}`
    };
  }
  
  // Feature 请求直接创建 Issue
  if (type === 'feature') {
    return {
      shouldCreate: true,
      reason: 'Feature 请求帖子',
      labels: ['enhancement', 'from-forum'],
      title: `[Feature] ${title || content.substring(0, 50)}`
    };
  }
  
  // 讨论类型：检查关键词
  const keywords = {
    'bug': ['崩溃', '错误', '崩溃', '无法', '失败', 'crash', 'error', 'bug'],
    'feature': ['功能', '建议', '需求', 'feature', 'request', '希望'],
    'improvement': ['优化', '改进', '提升', 'improve', 'optimize']
  };
  
  const lowerContent = (title + ' ' + content).toLowerCase();
  
  for (const [label, words] of Object.entries(keywords)) {
    if (words.some(w => lowerContent.includes(w.toLowerCase()))) {
      return {
        shouldCreate: true,
        reason: `包含 ${label} 关键词`,
        labels: [label, 'from-forum'],
        title: `[${label}] ${title || content.substring(0, 50)}`
      };
    }
  }
  
  // 默认不创建，除非是明确的 Issue 类型
  if (type === 'issue') {
    return {
      shouldCreate: true,
      reason: 'Issue 类型帖子',
      labels: ['from-forum'],
      title: title || content.substring(0, 50)
    };
  }
  
  return {
    shouldCreate: false,
    reason: '普通讨论帖子',
    labels: [],
    title: ''
  };
}

module.exports = {
  createIssue,
  getIssueUrl,
  analyzePost
};
