const { getDb } = require('../models/db');
const { v4: uuidv4 } = require('uuid');

// 需求池相关服务

// 获取所有需求
function getRequirements(status = null) {
  const db = getDb();
  if (status) {
    return db.prepare('SELECT * FROM requirements WHERE status = ? ORDER BY created_at DESC').all(status);
  }
  return db.prepare('SELECT * FROM requirements ORDER BY created_at DESC').all();
}

// 获取单个需求
function getRequirement(id) {
  const db = getDb();
  return db.prepare('SELECT * FROM requirements WHERE id = ?').get(id);
}

// 创建需求
function createRequirement(data) {
  const db = getDb();
  const id = uuidv4();
  
  db.prepare(`
    INSERT INTO requirements (id, title, description, priority, status, requester)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run(
    id,
    data.title || '',
    data.description || '',
    data.priority || 'P2',
    data.status || 'pending',
    data.requester || 'system'
  );

  return getRequirement(id);
}

// 更新需求状态
function updateRequirementStatus(id, status) {
  const db = getDb();
  db.prepare(`
    UPDATE requirements SET status = ?, updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(status, id);
  return getRequirement(id);
}

// 评估需求（主控操作）
function evaluateRequirement(id, evaluation) {
  const db = getDb();
  db.prepare(`
    UPDATE requirements SET 
      status = ?,
      priority = ?,
      evaluator = ?,
      evaluation_notes = ?,
      updated_at = CURRENT_TIMESTAMP
    WHERE id = ?
  `).run(
    evaluation.status,  // approved, rejected, need_discussion
    evaluation.priority || 'P2',
    evaluation.evaluator || 'master',
    evaluation.notes || '',
    id
  );
  return getRequirement(id);
}

module.exports = {
  getRequirements,
  getRequirement,
  createRequirement,
  updateRequirementStatus,
  evaluateRequirement
};
