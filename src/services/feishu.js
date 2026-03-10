const axios = require('axios');

const FEISHU_APP_ID = process.env.FEISHU_APP_ID;
const FEISHU_APP_SECRET = process.env.FEISHU_APP_SECRET;

/**
 * 飞书 API 基础配置
 */
const FEISHU_BASE_URL = 'https://open.feishu.cn/open-apis';

/**
 * 获取飞书应用 Access Token
 */
async function getAccessToken() {
  try {
    const response = await axios.post(`${FEISHU_BASE_URL}/auth/v3/app_access_token/internal`, {
      app_id: FEISHU_APP_ID,
      app_secret: FEISHU_APP_SECRET
    });
    
    if (response.data.code === 0) {
      return response.data.app_access_token;
    }
    throw new Error(`获取 Token 失败: ${response.data.msg}`);
  } catch (error) {
    console.error('获取飞书 Access Token 失败:', error.message);
    throw error;
  }
}

/**
 * 发送文本消息到飞书
 * @param {string} receiveIdType - 接收者类型: open_id/user_id/union_id/chat_id
 * @param {string} receiveId - 接收者 ID
 * @param {string} content - 消息内容
 */
async function sendTextMessage(receiveIdType, receiveId, content) {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      `${FEISHU_BASE_URL}/im/v1/messages`,
      {
        receive_id_type: receiveIdType,
        receive_id: receiveId,
        msg_type: 'text',
        content: JSON.stringify({ text: content })
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return { success: true, messageId: response.data.data.message_id };
    }
    throw new Error(`发送消息失败: ${response.data.msg}`);
  } catch (error) {
    console.error('发送飞书消息失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 发送富文本消息（带结构化内容）
 * @param {string} receiveIdType 
 * @param {string} receiveId 
 * @param {object} content - 消息内容对象
 */
async function sendRichTextMessage(receiveIdType, receiveId, content) {
  try {
    const accessToken = await getAccessToken();
    
    // 构建富文本内容
    const richTextContent = buildRichTextContent(content);
    
    const response = await axios.post(
      `${FEISHU_BASE_URL}/im/v1/messages`,
      {
        receive_id_type: receiveIdType,
        receive_id: receiveId,
        msg_type: 'post',
        content: JSON.stringify({ post: { zh_cn: richTextContent } })
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return { success: true, messageId: response.data.data.message_id };
    }
    throw new Error(`发送富文本消息失败: ${response.data.msg}`);
  } catch (error) {
    console.error('发送飞书富文本消息失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 构建富文本内容
 */
function buildRichTextContent(data) {
  const { title, items = [], footer } = data;
  
  const content = {
    title: title,
    elements: []
  };

  // 添加项目列表
  items.forEach(item => {
    content.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: item
      }
    });
  });

  // 添加底部信息
  if (footer) {
    content.elements.push({
      tag: 'div',
      text: {
        tag: 'lark_md',
        content: footer
      }
    });
  }

  return content;
}

/**
 * 发送工作日志到飞书
 * @param {string} receiveId - 接收者 ID (open_id/user_id/chat_id)
 * @param {object} workLog - 工作日志内容
 */
async function sendWorkLog(receiveId, workLog) {
  const { agent, tasks = [], issues = [], summary } = workLog;
  
  const items = tasks.map((task, index) => {
    const status = task.completed ? '✅' : '🔄';
    return `${status} ${index + 1}. ${task.title}`;
  });
  
  const issueItems = issues.map(issue => {
    return `🔴 ${issue.title} - ${issue.status}`;
  });

  const content = {
    title: `📊 ${agent} 工作日志 - ${new Date().toLocaleDateString('zh-CN')}`,
    items: [
      '**今日任务:**',
      ...items,
      '',
      '**遇到的问题:**',
      ...(issueItems.length > 0 ? issueItems : ['- 无']),
      '',
      '**总结:**',
      summary || '今日工作已完成'
    ],
    footer: `🕐 更新时间: ${new Date().toLocaleString('zh-CN')}`
  };

  return sendRichTextMessage('open_id', receiveId, content);
}

/**
 * 发送帖子通知到飞书
 * @param {string} receiveId 
 * @param {object} post - 帖子信息
 */
async function sendPostNotification(receiveId, post) {
  const typeEmoji = {
    'work_log': '📝',
    'discussion': '💬',
    'requirement': '📋',
    'vote': '🗳️',
    'review': '🔄'
  };

  const content = {
    title: `${typeEmoji[post.type] || '📌'} 新帖子通知`,
    items: [
      `**标题:** ${post.title}`,
      `**类型:** ${post.type}`,
      `**作者:** ${post.author}`,
      `**内容:** ${post.content.substring(0, 100)}...`
    ],
    footer: `🔗 查看详情: /api/posts/${post.id}`
  };

  return sendRichTextMessage('open_id', receiveId, content);
}

/**
 * 处理接收到的飞书消息事件
 * @param {object} event - 飞书消息事件
 */
async function handleMessageEvent(event) {
  const { message } = event;
  
  // 解析消息内容
  const msgType = message.msg_type;
  const content = JSON.parse(message.content);
  
  console.log(`收到飞书消息: ${msgType}`, content);

  // 处理不同类型的消息
  if (msgType === 'text') {
    return {
      type: 'text',
      content: content.text,
      messageId: message.message_id,
      senderId: message.sender_id
    };
  }

  return null;
}

/**
 * 创建群聊
 * @param {string} name - 群聊名称
 * @param {string[]} userIds - 用户 ID 列表
 */
async function createChat(name, userIds = []) {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      `${FEISHU_BASE_URL}/im/v1/chats`,
      {
        name: name,
        user_id_list: userIds,
        chat_mode: '群聊模式',
        chat_type: 'private'
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return { success: true, chatId: response.data.data.chat_id };
    }
    throw new Error(`创建群聊失败: ${response.data.msg}`);
  } catch (error) {
    console.error('创建飞书群聊失败:', error.message);
    return { success: false, error: error.message };
  }
}

/**
 * 添加成员到群聊
 * @param {string} chatId - 群聊 ID
 * @param {string[]} userIds - 用户 ID 列表
 */
async function addMembersToChat(chatId, userIds) {
  try {
    const accessToken = await getAccessToken();
    
    const response = await axios.post(
      `${FEISHU_BASE_URL}/im/v1/chats/${chatId}/members`,
      {
        member_id_list: userIds
      },
      {
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'Content-Type': 'application/json'
        }
      }
    );

    if (response.data.code === 0) {
      return { success: true };
    }
    throw new Error(`添加成员失败: ${response.data.msg}`);
  } catch (error) {
    console.error('添加群聊成员失败:', error.message);
    return { success: false, error: error.message };
  }
}

module.exports = {
  getAccessToken,
  sendTextMessage,
  sendRichTextMessage,
  sendWorkLog,
  sendPostNotification,
  handleMessageEvent,
  createChat,
  addMembersToChat
};
