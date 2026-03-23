import { API_BASE_URL } from '../config/api.js';

const API_URL = `${API_BASE_URL}/api/messaging`;

// ===== CHAT MANAGEMENT =====

export const listChats = async () => {
  const response = await fetch(`${API_URL}/chats/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch chats');
  return response.json();
};

export const createChat = async (chatData) => {
  const response = await fetch(`${API_URL}/chats/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatData),
  });
  if (!response.ok) throw new Error('Failed to create chat');
  return response.json();
};

export const getChatDetail = async (chatId) => {
  const response = await fetch(`${API_URL}/chats/${chatId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch chat details');
  return response.json();
};

export const updateChat = async (chatId, chatData) => {
  const response = await fetch(`${API_URL}/chats/${chatId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(chatData),
  });
  if (!response.ok) throw new Error('Failed to update chat');
  return response.json();
};

export const addChatMember = async (chatId, userId) => {
  const response = await fetch(`${API_URL}/chats/${chatId}/add_member/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error('Failed to add member');
  return response.json();
};

export const removeChatMember = async (chatId, userId) => {
  const response = await fetch(`${API_URL}/chats/${chatId}/remove_member/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ user_id: userId }),
  });
  if (!response.ok) throw new Error('Failed to remove member');
  return response.json();
};

// ===== MESSAGE MANAGEMENT =====

export const listMessages = async (chatId, pageSize = 50) => {
  const response = await fetch(`${API_URL}/messages/?chat=${chatId}&page_size=${pageSize}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch messages');
  return response.json();
};

export const sendMessage = async (messageData) => {
  const response = await fetch(`${API_URL}/messages/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
    },
    body: messageData, // FormData for image upload support
  });
  if (!response.ok) throw new Error('Failed to send message');
  return response.json();
};

export const deleteMessageByAdmin = async (messageId) => {
  const response = await fetch(`${API_URL}/messages/${messageId}/delete_by_admin/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({ reason: 'Admin removal' }),
  });
  if (!response.ok) throw new Error('Failed to delete message');
  return response.json();
};

// ===== PROFANITY MANAGEMENT (Admin only) =====

export const listProfanityWords = async () => {
  const response = await fetch(`${API_URL}/profanity/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch profanity words');
  return response.json();
};

export const addProfanityWord = async (wordData) => {
  const response = await fetch(`${API_URL}/profanity/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wordData),
  });
  if (!response.ok) throw new Error('Failed to add profanity word');
  return response.json();
};

export const updateProfanityWord = async (wordId, wordData) => {
  const response = await fetch(`${API_URL}/profanity/${wordId}/`, {
    method: 'PATCH',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(wordData),
  });
  if (!response.ok) throw new Error('Failed to update profanity word');
  return response.json();
};

export const deleteProfanityWord = async (wordId) => {
  const response = await fetch(`${API_URL}/profanity/${wordId}/`, {
    method: 'DELETE',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to delete profanity word');
};

// ===== MESSAGE FLAGS (Admin only) =====

export const listMessageFlags = async () => {
  const response = await fetch(`${API_URL}/flags/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch message flags');
  return response.json();
};

export const takeActionOnFlag = async (flagId, actionData) => {
  const response = await fetch(`${API_URL}/flags/${flagId}/take_action/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(actionData),
  });
  if (!response.ok) throw new Error('Failed to take action on flag');
  return response.json();
};

// ===== CHAT RESTRICTIONS (Admin only) =====

export const listChatRestrictions = async () => {
  const response = await fetch(`${API_URL}/restrictions/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch restrictions');
  return response.json();
};

export const createChatRestriction = async (restrictionData) => {
  const response = await fetch(`${API_URL}/restrictions/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(restrictionData),
  });
  if (!response.ok) throw new Error('Failed to create restriction');
  return response.json();
};

export const liftChatRestriction = async (restrictionId) => {
  const response = await fetch(`${API_URL}/restrictions/${restrictionId}/lift_restriction/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to lift restriction');
  return response.json();
};

// ===== CHAT REQUESTS (New Safety Feature) =====

export const listChatRequests = async (filter = 'pending') => {
  // filter: 'pending', 'all', or specific status
  const params = new URLSearchParams();
  if (filter !== 'all') {
    params.append('status', filter);
  }
  const response = await fetch(`${API_URL}/chat-requests/?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch chat requests');
  return response.json();
};

export const createChatRequest = async (recipientId, firstMessage) => {
  const response = await fetch(`${API_URL}/chat-requests/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      recipient: recipientId,
      first_message: firstMessage,
    }),
  });
  if (!response.ok) throw new Error('Failed to create chat request');
  return response.json();
};

export const respondToChatRequest = async (requestId, action, adminNotes = '') => {
  // action: 'accept' or 'decline'
  const response = await fetch(`${API_URL}/chat-requests/${requestId}/respond/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: action,
      admin_notes: adminNotes,
    }),
  });
  if (!response.ok) throw new Error('Failed to respond to chat request');
  return response.json();
};

export const getChatRequest = async (requestId) => {
  const response = await fetch(`${API_URL}/chat-requests/${requestId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch chat request');
  return response.json();
};

// ===== MESSAGE REPORTS (New Safety Feature) =====

export const listMessageReports = async (filter = 'pending') => {
  // filter: 'pending', 'all', etc.
  const params = new URLSearchParams();
  if (filter !== 'all') {
    params.append('status', filter);
  }
  const response = await fetch(`${API_URL}/reports/?${params.toString()}`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch message reports');
  return response.json();
};

export const createMessageReport = async (messageId, reason, description = '') => {
  // reason: 'OFFENSIVE', 'BULLYING', 'HARASSMENT', 'INAPPROPRIATE', 'SPAM', 'OTHER'
  const response = await fetch(`${API_URL}/reports/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      message: messageId,
      reason: reason,
      description: description,
    }),
  });
  if (!response.ok) throw new Error('Failed to create message report');
  return response.json();
};

export const reviewMessageReport = async (reportId, action, adminNotes = '') => {
  // action: 'approve', 'dismiss', or 'delete' (delete removes the message)
  const response = await fetch(`${API_URL}/reports/${reportId}/review/`, {
    method: 'POST',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      action: action,
      admin_notes: adminNotes,
    }),
  });
  if (!response.ok) throw new Error('Failed to review message report');
  return response.json();
};

export const getMessageReport = async (reportId) => {
  const response = await fetch(`${API_URL}/reports/${reportId}/`, {
    method: 'GET',
    headers: {
      'Authorization': `Token ${localStorage.getItem('authToken')}`,
      'Content-Type': 'application/json',
    },
  });
  if (!response.ok) throw new Error('Failed to fetch message report');
  return response.json();
};
