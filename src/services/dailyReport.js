/**
 * 每日工作报告服务
 * 功能：
 * - 每日凌晨自动生成工作报告
 * - 汇总当日完成的Issue和PR
 * - 统计各Agent工作状态
 * - 发送到Telegram通知
 */

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// 配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;

const REPO_OWNER = 'sutanna233';
const AGENT_WORKSPACE = process.env.AGENT_WORKSPACE || '/home/123456/.openclaw/workspace/agents/sudan';

class DailyReportService {
  constructor() {
    this.octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;
  }

  /**
   * 获取日期范围内的Issue
   */
  async getIssuesInRange(startDate, endDate, state = 'all') {
    if (!this.octokit) {
      console.log('GitHub Token 未配置');
      return [];
    }

    try {
      const { data } = await this.octokit.issues.listForRepo({
        owner: REPO_OWNER,
        repo: 'agent-iteration-system',
        state: state,
        per_page: 100,
        since: startDate,
        until: endDate
      });
      return data;
    } catch (err) {
      console.error('获取Issues失败:', err.message);
      return [];
    }
  }

  /**
   * 获取日期范围内的PR
   */
  async getPullRequestsInRange(startDate, endDate, state = 'all') {
    if (!this.octokit) {
      console.log('GitHub Token 未配置');
      return [];
    }

    try {
      const { data } = await this.octokit.pulls.list({
        owner: REPO_OWNER,
        repo: 'agent-forum',
        state: state,
        per_page: 100
      });

      // 过滤日期范围
      return data.filter(pr => {
        const created = new Date(pr.created_at);
        return created >= startDate && created <= endDate;
      });
    } catch (err) {
      console.error('获取PRs失败:', err.message);
      return [];
    }
  }

  /**
   * 获取各Agent的工作状态
   */
  async getAgentWorkStatus() {
    const agents = ['sudan', 'taizi']; // 可以从配置读取
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
   * 解析TASK.md
   */
  parseTaskMd(content) {
    const tasks = [];
    const lines = content.split('\n');

    for (const line of lines) {
      // 匹配已完成: - [x] Txxx: ...
      const doneMatch = line.match(/^-\s*\[x\]\s*(T\d+):\s*(\[.+\])\s*(.+)/);
      if (doneMatch) {
        tasks.push({
          id: doneMatch[1],
          issue: doneMatch[2],
          title: doneMatch[3].trim(),
          completed: true,
          status: '已完成'
        });
      }

      // 匹配待处理: - [ ] Txxx: ...
      const todoMatch = line.match(/^-\s*\[\s*\]\s*(T\d+):\s*(\[.+\])\s*(.+)/);
      if (todoMatch) {
        const status = line.includes('(进行中)') ? '进行中' : '待处理';
        tasks.push({
          id: todoMatch[1],
          issue: todoMatch[2],
          title: todoMatch[3].trim(),
          completed: false,
          status
        });
      }
    }

    return tasks;
  }

  /**
   * 格式化报告
   */
  formatReport(data) {
    const { date, issues, prs, agentStatus } = data;
    
    let report = `📊 *每日工作报告 - ${date}*\n\n`;
    
    // Issue 统计
    const closedIssues = issues.filter(i => i.state === 'closed');
    const openIssues = issues.filter(i => i.state === 'open');
    
    report += `*Issue 统计*\n`;
    report += `• 新增: ${issues.length}\n`;
    report += `• 已关闭: ${closedIssues.length}\n`;
    report += `• 进行中: ${openIssues.length}\n\n`;

    // PR 统计
    const mergedPRs = prs.filter(pr => pr.merged);
    const openPRs = prs.filter(pr => pr.state === 'open');
    
    report += `*PR 统计*\n`;
    report += `• 新增: ${prs.length}\n`;
    report += `• 已合并: ${mergedPRs.length}\n`;
    report += `• 待合并: ${openPRs.length}\n\n`;

    // Agent 状态
    report += `*Agent 工作状态*\n`;
    for (const [agent, status] of Object.entries(agentStatus)) {
      report += `• ${agent}: ${status.completed}/${status.total} 完成`;
      if (status.inProgress > 0) report += ` (进行中: ${status.inProgress})`;
      report += '\n';
    }

    report += `\n---\n*自动生成于 ${new Date().toLocaleString('zh-CN', { timeZone: 'Asia/Shanghai' })}*`;
    
    return report;
  }

  /**
   * 发送到Telegram
   */
  async sendToTelegram(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log('Telegram 配置未完成，跳过发送');
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      const result = await response.json();
      if (result.ok) {
        console.log('✅ 报告已发送到Telegram');
        return true;
      } else {
        console.error('Telegram发送失败:', result.description);
        return false;
      }
    } catch (err) {
      console.error('Telegram发送错误:', err.message);
      return false;
    }
  }

  /**
   * 生成并发送每日报告
   */
  async generateDailyReport() {
    console.log('📊 开始生成每日工作报告...');

    const now = new Date();
    const today = now.toISOString().split('T')[0];
    
    // 获取昨日数据
    const yesterday = new Date(now);
    yesterday.setDate(yesterday.getDate() - 1);
    const startDate = yesterday.toISOString();
    const endDate = now.toISOString();

    // 并行获取数据
    const [issues, prs, agentStatus] = await Promise.all([
      this.getIssuesInRange(startDate, endDate),
      this.getPullRequestsInRange(startDate, endDate),
      this.getAgentWorkStatus()
    ]);

    // 格式化报告
    const reportData = {
      date: today,
      issues,
      prs,
      agentStatus
    };

    const report = this.formatReport(reportData);
    console.log('\n' + report);

    // 发送到Telegram
    await this.sendToTelegram(report);

    // 保存到文件
    const reportPath = path.join(AGENT_WORKSPACE, 'reports');
    if (!fs.existsSync(reportPath)) {
      fs.mkdirSync(reportPath, { recursive: true });
    }
    
    const filePath = path.join(reportPath, `daily-report-${today}.md`);
    fs.writeFileSync(filePath, report, 'utf-8');
    console.log(`\n📁 报告已保存: ${filePath}`);

    return reportData;
  }

  /**
   * Cron 触发生成报告
   */
  async runCronJob() {
    const hour = new Date().getHours();
    // 每日0点执行
    if (hour !== 0) {
      console.log('⏰ 非执行时间，跳过');
      return;
    }
    
    await this.generateDailyReport();
  }
}

module.exports = new DailyReportService();
