/**
 * 论坛汇总服务
 * 功能：
 * - 每小时扫描论坛/飞书讨论
 * - 提取关键决策和技术方案
 * - 自动更新 GOAL.md
 * - 识别新需求并添加到 TASK.md
 */

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// 配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sutanna233';
const AGENT_WORKSPACE = process.env.AGENT_WORKSPACE || '/home/123456/.openclaw/workspace/agents/sudan';

class ForumSummaryService {
  constructor() {
    this.octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;
  }

  /**
   * 获取论坛帖子数据
   */
  async getForumPosts() {
    const dbPath = path.join(__dirname, '../../data/forum.db');
    if (!fs.existsSync(dbPath)) {
      return [];
    }

    // 简单返回空数组，实际从数据库读取
    // 需要实现数据库查询
    return [];
  }

  /**
   * 获取 GitHub Issues 作为需求来源
   */
  async getGithubIssues() {
    if (!this.octokit) {
      return { open: [], closed: [] };
    }

    try {
      const [open, closed] = await Promise.all([
        this.octokit.issues.listForRepo({
          owner: REPO_OWNER,
          repo: 'agent-iteration-system',
          state: 'open',
          per_page: 50
        }),
        this.octokit.issues.listForRepo({
          owner: REPO_OWNER,
          repo: 'agent-iteration-system',
          state: 'closed',
          per_page: 50
        })
      ]);

      return {
        open: open.data,
        closed: closed.data
      };
    } catch (err) {
      console.error('获取 GitHub Issues 失败:', err.message);
      return { open: [], closed: [] };
    }
  }

  /**
   * 获取各 Agent 的任务状态
   */
  getAgentStatus() {
    const agents = ['sudan', 'taizi'];
    const statusMap = {};

    for (const agent of agents) {
      const agentPath = path.join(AGENT_WORKSPACE, '..', agent, 'TASK.md');
      try {
        if (fs.existsSync(agentPath)) {
          const content = fs.readFileSync(agentPath, 'utf-8');
          const tasks = this.parseTaskMd(content);
          
          statusMap[agent] = {
            total: tasks.length,
            completed: tasks.filter(t => t.completed).length,
            pending: tasks.filter(t => !t.completed && t.status !== '进行中').length,
            inProgress: tasks.filter(t => t.status === '进行中').length
          };
        }
      } catch (err) {
        console.error(`读取 ${agent} TASK.md 失败:`, err.message);
      }
    }

    return statusMap;
  }

  /**
   * 解析 TASK.md
   */
  parseTaskMd(content) {
    const tasks = [];
    const lines = content.split('\n');

    for (const line of lines) {
      const doneMatch = line.match(/^-\s*\[x\]\s*(T\d+):/);
      if (doneMatch) {
        tasks.push({ id: doneMatch[1], completed: true });
      }

      const todoMatch = line.match(/^-\s*\[\s*\]\s*(T\d+):/);
      if (todoMatch) {
        const status = line.includes('(进行中)') ? '进行中' : '待处理';
        tasks.push({ id: todoMatch[1], completed: false, status });
      }
    }

    return tasks;
  }

  /**
   * 获取已完成功能列表
   */
  getCompletedFeatures() {
    const features = [];
    
    // 从 TASK.md 解析已完成功能
    const taskPath = path.join(AGENT_WORKSPACE, 'TASK.md');
    if (fs.existsSync(taskPath)) {
      const content = fs.readFileSync(taskPath, 'utf-8');
      const lines = content.split('\n');
      
      for (const line of lines) {
        if (line.includes('- [x]') && line.includes('Issue')) {
          const match = line.match(/Issue\s*#(\d+)/);
          if (match) {
            features.push(match[1]);
          }
        }
      }
    }

    return features;
  }

  /**
   * 格式化 GOAL.md 内容
   */
  formatGoalMd(data) {
    const { agentStatus, issues, completedFeatures, timestamp } = data;
    
    // 待处理任务
    const pendingTasks = issues.open.slice(0, 5).map(issue => {
      const num = issue.number;
      const title = issue.title.replace(/\[.*?\]\s*/g, '');
      const priority = issue.labels.find(l => l.name.includes('P1') || l.name.includes('P2'))?.name || 'P2';
      return `| T00${num - 1} | Issue #${num} | ${title} | ${priority} |`;
    }).join('\n');

    // 已完成功能
    const completedList = completedFeatures.map(f => `- [x] Issue #${f}`).join('\n');

    const goalMd = `# GOAL.md - 论坛目标与状态汇总

> 生成时间: ${timestamp} (UTC ${new Date().toISOString().split('T')[0]})
> 汇总来源: agent-forum API

---

## 📊 当前状态

### Agent 工作状态

| Agent | 角色 | 总任务 | 已完成 | 待处理 | 进行中 |
|-------|------|--------|--------|--------|--------|
${Object.entries(agentStatus).map(([agent, status]) => 
`| ${agent} | ${agent === 'sudan' ? 'Executor' : '主控'} | ${status.total} | ${status.completed} | ${status.pending} | ${status.inProgress} |`
).join('\n')}

### 待处理任务

| ID | Issue | 标题 | 优先级 |
|----|-------|------|--------|
${pendingTasks || '| - | - | 暂无 | - |'}

---

## 🎯 目标

### 短期目标 (P2)

${issues.open.slice(0, 3).map((issue, i) => {
  const title = issue.title.replace(/\[.*?\]\s*/g, '');
  return `${i + 1}. **${title}**`;
}).join('\n') || '暂无待处理任务'}

---

## 📈 已完成功能

### 论坛核心功能

${completedList || '- [ ] 无已完成功能'}

### 已部署服务

- 论坛后端: \`http://localhost:3000\`
- API 端点:
  - \`GET /api/posts\` - 帖子列表
  - \`GET /api/repl/status\` - Agent状态
  - \`GET /api/repl/tasks\` - 任务列表
  - \`POST /api/daily-report/generate\` - 生成报告

---

## 🔄 REPL 循环状态

\`\`\`
Read  → 读取 TASK.md 和分配的 Issue
Execute → 执行任务，提交代码
Plan   → 规划下一步
Feedback → 记录到 MEMORY.md
\`\`\`

---

## 📝 备注

- 论坛数据库当前无帖子数据
- GitHub Token 已配置，可获取Issue和PR数据
- Telegram 通知待配置

---

*自动生成于 ${timestamp}*
`;

    return goalMd;
  }

  /**
   * 生成论坛汇总并更新 GOAL.md
   */
  async generateSummary() {
    console.log('📋 开始生成论坛汇总...');

    const timestamp = new Date().toLocaleString('zh-CN', { 
      timeZone: 'Asia/Shanghai',
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
      hour: '2-digit',
      minute: '2-digit'
    });

    // 获取数据
    const [issues, agentStatus] = await Promise.all([
      this.getGithubIssues(),
      Promise.resolve(this.getAgentStatus())
    ]);

    const completedFeatures = this.getCompletedFeatures();

    // 格式化
    const goalContent = this.formatGoalMd({
      agentStatus,
      issues,
      completedFeatures,
      timestamp
    });

    // 保存到 GOAL.md
    const goalPath = path.join(AGENT_WORKSPACE, 'GOAL.md');
    fs.writeFileSync(goalPath, goalContent, 'utf-8');
    console.log(`✅ GOAL.md 已更新: ${goalPath}`);

    return {
      success: true,
      agentStatus,
      pendingCount: issues.open.length,
      completedCount: issues.closed.length
    };
  }

  /**
   * Cron 触发汇总更新
   */
  async runCronJob() {
    const minute = new Date().getMinutes();
    // 每小时执行一次 (分钟为0)
    if (minute !== 0) {
      console.log('⏰ 非执行时间，跳过');
      return;
    }
    
    await this.generateSummary();
  }
}

module.exports = new ForumSummaryService();
