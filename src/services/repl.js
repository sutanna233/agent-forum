/**
 * REPL 循环服务
 * 负责：任务拉取 → 执行 → 反馈
 */

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// Agent 工作目录
const AGENT_WORKSPACE = process.env.AGENT_WORKSPACE || '/home/123456/.openclaw/workspace/agents/sudan';

// GitHub 配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const REPO_OWNER = 'sutanna233';
const REPO_NAME = 'agent-iteration-system';

class ReplService {
  constructor() {
    this.octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;
  }

  /**
   * 读取 TASK.md
   */
  readTaskMd() {
    const taskPath = path.join(AGENT_WORKSPACE, 'TASK.md');
    try {
      return fs.readFileSync(taskPath, 'utf-8');
    } catch (err) {
      console.error('读取 TASK.md 失败:', err.message);
      return null;
    }
  }

  /**
   * 解析 TASK.md 获取待处理任务
   */
  parseTasks(taskContent) {
    const tasks = [];
    const lines = taskContent.split('\n');
    let currentTask = null;

    for (const line of lines) {
      // 匹配待处理任务: - [ ] Txxx: ...
      const todoMatch = line.match(/^-\s*\[\s*\]\s*(T\d+):\s*\[([^\]]+)\]\s*(.+)/);
      if (todoMatch) {
        if (currentTask) tasks.push(currentTask);
        currentTask = {
          id: todoMatch[1],
          issue: todoMatch[2],
          title: todoMatch[3].trim(),
          status: 'pending'
        };
      }

      // 匹配进行中任务: - [ ] Txxx: ... (进行中)
      const progressMatch = line.match(/^-\s*\[\s*\]\s*(T\d+):\s*\[([^\]]+)\]\s*(.+)\s*\(进行中\)/);
      if (progressMatch) {
        if (currentTask) tasks.push(currentTask);
        currentTask = {
          id: progressMatch[1],
          issue: progressMatch[2],
          title: progressMatch[3].trim(),
          status: 'in_progress'
        };
      }
    }

    if (currentTask) tasks.push(currentTask);
    return tasks;
  }

  /**
   * 从 GitHub 获取分配的 Issues
   */
  async fetchAssignedIssues() {
    if (!this.octokit) {
      console.log('GitHub Token 未配置');
      return [];
    }

    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner: REPO_OWNER,
        repo: REPO_NAME,
        state: 'open',
        per_page: 10
      });

      // 过滤分配给当前 Agent 的 issues
      return data.filter(issue => 
        issue.assignees.some(a => a.login === 'sutanna233') ||
        issue.labels.some(l => l.name.includes('sudan'))
      );
    } catch (err) {
      console.error('获取 GitHub Issues 失败:', err.message);
      return [];
    }
  }

  /**
   * 更新 TASK.md 状态
   */
  updateTaskStatus(taskId, newStatus) {
    const taskPath = path.join(AGENT_WORKSPACE, 'TASK.md');
    let content = fs.readFileSync(taskPath, 'utf-8');

    // 替换任务状态
    const statusMap = {
      'pending': '待处理',
      'in_progress': '进行中',
      'completed': '已完成'
    };

    // 查找任务行并更新
    const lines = content.split('\n');
    const newLines = lines.map(line => {
      if (line.includes(taskId)) {
        // 添加状态标记
        if (newStatus === 'in_progress' && !line.includes('(进行中)')) {
          return line.replace(/\)$/, ' (进行中)');
        }
        if (newStatus === 'completed') {
          return line.replace('- [ ]', '- [x]');
        }
      }
      return line;
    });

    fs.writeFileSync(taskPath, newLines.join('\n'), 'utf-8');
    return true;
  }

  /**
   * 记录到 MEMORY.md
   */
  recordToMemory(record) {
    const memoryPath = path.join(AGENT_WORKSPACE, 'MEMORY.md');
    const timestamp = new Date().toISOString().split('T')[0];
    
    let content = '';
    try {
      content = fs.readFileSync(memoryPath, 'utf-8');
    } catch (err) {
      content = '# 苏丹工作日志\n';
    }

    // 添加新记录
    const newRecord = `\n### ${timestamp} REPL 循环\n\n${record}\n`;
    
    // 找到 ## 2026-03-10 部分并插入
    const dateSection = `## ${timestamp.split('-').slice(0, 2).join('-')}`;
    if (content.includes(dateSection)) {
      content = content.replace(dateSection, dateSection + newRecord);
    } else {
      content += `\n${dateSection}\n${newRecord}`;
    }

    fs.writeFileSync(memoryPath, content, 'utf-8');
  }

  /**
   * 执行 REPL 循环
   */
  async runReplLoop() {
    console.log('🔄 开始 REPL 循环...');

    // Read: 读取 TASK.md
    const taskContent = this.readTaskMd();
    const localTasks = taskContent ? this.parseTasks(taskContent) : [];
    console.log(`📋 本地任务: ${localTasks.length} 个`);

    // Read: 获取 GitHub Issues
    const githubIssues = await this.fetchAssignedIssues();
    console.log(`📋 GitHub Issues: ${githubIssues.length} 个`);

    // Execute: 处理任务
    const results = {
      executed: [],
      pending: []
    };

    for (const task of localTasks) {
      if (task.status === 'pending') {
        // 标记为进行中
        this.updateTaskStatus(task.id, 'in_progress');
        results.pending.push(task);
      }
    }

    // Feedback: 记录到 MEMORY
    this.recordToMemory(
      `- REPL 循环执行: ${localTasks.length} 个任务\n` +
      `- 进行中: ${results.pending.length} 个`
    );

    console.log('✅ REPL 循环完成');

    return {
      localTasks,
      githubIssues,
      results
    };
  }

  /**
   * 获取 Agent 状态
   */
  getStatus() {
    const taskContent = this.readTaskMd();
    const tasks = taskContent ? this.parseTasks(taskContent) : [];

    return {
      agent: 'sudan',
      role: 'executor',
      timestamp: new Date().toISOString(),
      tasks: {
        total: tasks.length,
        pending: tasks.filter(t => t.status === 'pending').length,
        in_progress: tasks.filter(t => t.status === 'in_progress').length
      }
    };
  }
}

module.exports = new ReplService();
