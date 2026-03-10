/**
 * PR 检查与自动合并服务
 * 功能：
 * - 每2小时扫描所有 open PR
 * - 检查 CI 测试状态
 * - 通过测试的 PR 自动合并
 * - 失败的 PR 标记并通知
 * - 更新 TASK.md 标记完成
 */

const fs = require('fs');
const path = require('path');
const { Octokit } = require('@octokit/rest');

// 配置
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_CHAT_ID = process.env.TELEGRAM_CHAT_ID;
const AGENT_WORKSPACE = process.env.AGENT_WORKSPACE || '/home/123456/.openclaw/workspace/agents/sudan';

const REPO_OWNER = 'sutanna233';
const REPOS = ['agent-iteration-system', 'agent-forum'];

class PRCheckService {
  constructor() {
    this.octokit = GITHUB_TOKEN ? new Octokit({ auth: GITHUB_TOKEN }) : null;
  }

  /**
   * 获取仓库的所有 open PR
   */
  async getOpenPRs(repo) {
    if (!this.octokit) {
      console.log('GitHub Token 未配置');
      return [];
    }

    try {
      const { data } = await this.octokit.pulls.list({
        owner: REPO_OWNER,
        repo: repo,
        state: 'open',
        per_page: 50
      });
      return data;
    } catch (err) {
      console.error(`获取 ${repo} PRs 失败:`, err.message);
      return [];
    }
  }

  /**
   * 检查 PR 的 CI 状态
   */
  async checkCIPStatus(repo, prNumber) {
    if (!this.octokit) {
      return { success: true, message: 'CI 检查跳过 (未配置 Token)' };
    }

    try {
      // 获取 PR 的 commit SHA
      const { data: pr } = await this.octokit.pulls.get({
        owner: REPO_OWNER,
        repo: repo,
        pull_number: prNumber
      });

      // 尝试获取 check runs (GitHub Apps / Actions)
      let ciSuccess = true;
      try {
        const { data: checkRuns } = await this.octokit.checks.listForRef({
          owner: REPO_OWNER,
          repo: repo,
          ref: pr.head.sha
        });

        if (checkRuns.check_runs && checkRuns.check_runs.length > 0) {
          ciSuccess = checkRuns.check_runs.every(run => 
            run.conclusion === 'success' || run.conclusion === 'skipped'
          );
        }
      } catch (e) {
        // 如果没有 check runs，尝试获取 commit status
        console.log('  Check runs 不可用，尝试 commit status...');
      }

      // 获取 commit status 作为备用
      try {
        const { data: statuses } = await this.octokit.repos.listStatusesForRef({
          owner: REPO_OWNER,
          repo: repo,
          ref: pr.head.sha
        });

        if (statuses.length > 0) {
          const latestStatus = statuses[0];
          ciSuccess = latestStatus.state === 'success';
        }
      } catch (e) {
        console.log('  Commit status 不可用');
      }

      return {
        success: ciSuccess,
        state: ciSuccess ? 'success' : 'pending',
        message: ciSuccess ? 'CI 通过' : '等待 CI 或 CI 失败'
      };
    } catch (err) {
      console.error(`检查 CI 状态失败:`, err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * 自动合并 PR
   */
  async mergePR(repo, prNumber) {
    if (!this.octokit) {
      return { success: false, message: 'GitHub Token 未配置' };
    }

    try {
      // 检查是否允许合并
      const { data: pr } = await this.octokit.pulls.get({
        owner: REPO_OWNER,
        repo: repo,
        pull_number: prNumber
      });

      if (!pr.mergeable) {
        return { success: false, message: 'PR 不可合并' };
      }

      // 执行合并
      await this.octokit.pulls.merge({
        owner: REPO_OWNER,
        repo: repo,
        pull_number: prNumber,
        merge_method: 'squash'
      });

      console.log(`✅ PR #${prNumber} 已合并`);
      return { success: true, message: '合并成功' };
    } catch (err) {
      console.error(`合并 PR 失败:`, err.message);
      return { success: false, message: err.message };
    }
  }

  /**
   * 发送到 Telegram 通知
   */
  async sendNotification(message) {
    if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_CHAT_ID) {
      console.log('Telegram 配置未完成，跳过通知');
      return false;
    }

    try {
      const response = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/sendMessage`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          chat_id: TELEGRAM_CHAT_ID,
          text: message,
          parse_mode: 'Markdown'
        })
      });

      const result = await response.json();
      return result.ok;
    } catch (err) {
      console.error('Telegram 通知失败:', err.message);
      return false;
    }
  }

  /**
   * 更新 TASK.md
   */
  updateTaskForPR(repo, prNumber, merged) {
    // 查找关联的 Task ID
    const taskPath = path.join(AGENT_WORKSPACE, 'TASK.md');
    if (!fs.existsSync(taskPath)) return;

    const content = fs.readFileSync(taskPath, 'utf-8');
    
    // 查找 PR 关联的 Issue (从 PR 标题或描述中提取)
    // 这里简单处理：查找包含 PR 编号的任务
    const lines = content.split('\n');
    let updated = false;

    const newLines = lines.map(line => {
      // 查找 PR 相关任务
      if (line.includes(`#${prNumber}`) || line.includes(`PR #${prNumber}`)) {
        if (merged && line.includes('- [ ]')) {
          updated = true;
          return line.replace('- [ ]', '- [x]');
        }
      }
      return line;
    });

    if (updated) {
      fs.writeFileSync(taskPath, newLines.join('\n'), 'utf-8');
      console.log('✅ TASK.md 已更新');
    }
  }

  /**
   * 执行 PR 检查与合并
   */
  async checkAndMerge() {
    console.log('🔍 开始 PR 检查...');

    const results = {
      checked: 0,
      merged: 0,
      failed: 0,
      skipped: []
    };

    for (const repo of REPOS) {
      console.log(`\n📦 检查仓库: ${repo}`);
      
      const prs = await this.getOpenPRs(repo);
      
      for (const pr of prs) {
        results.checked++;
        const prInfo = `#${pr.number} - ${pr.title}`;
        console.log(`\n  检查 PR ${prInfo}`);

        // 检查 CI 状态
        const ciStatus = await this.checkCIPStatus(repo, pr.number);
        console.log(`    CI 状态: ${ciStatus.message}`);

        if (ciStatus.success) {
          // 自动合并
          const mergeResult = await this.mergePR(repo, pr.number);
          if (mergeResult.success) {
            results.merged++;
            await this.sendNotification(`✅ PR 合并成功: ${repo} ${prInfo}`);
            this.updateTaskForPR(repo, pr.number, true);
          } else {
            results.skipped.push(`${repo} ${prInfo}: ${mergeResult.message}`);
          }
        } else {
          results.failed++;
          results.skipped.push(`${repo} ${prInfo}: ${ciStatus.message}`);
        }
      }
    }

    // 汇总报告
    const summary = `
🔍 PR 检查完成

📊 统计:
- 已检查: ${results.checked}
- 已合并: ${results.merged}
- 等待 CI: ${results.failed}
- 跳过: ${results.skipped.length}
`;
    console.log(summary);

    return results;
  }

  /**
   * Cron 定时执行
   */
  async runCronJob() {
    const hour = new Date().getHours();
    // 每2小时执行一次 (偶数小时)
    if (hour % 2 !== 0) {
      console.log('⏰ 非执行时间，跳过');
      return;
    }

    await this.checkAndMerge();
  }
}

module.exports = new PRCheckService();
