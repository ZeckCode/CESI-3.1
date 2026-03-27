/**
 * Messaging API service for communicating with the backend messaging module
 */

import { apiFetch, apiFetchData } from './apiFetch';

const API_BASE = '/api/messaging';

// ═══════════════════════════════════════════════════════════
// CHAT OPERATIONS
// ═══════════════════════════════════════════════════════════

export async function listChats() {
  return apiFetchData(`${API_BASE}/chats/`);
}

export async function getChatDetail(chatId) {
  return apiFetchData(`${API_BASE}/chats/${chatId}/`);
}

export async function updateChat(chatId, payload) {
  return apiFetchData(`${API_BASE}/chats/${chatId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}

export async function searchUsers(query) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  return apiFetchData(`${API_BASE}/chats/search_users/?${params.toString()}`);
}

export async function searchSections(query) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  return apiFetchData(`${API_BASE}/chats/search_sections/?${params.toString()}`);
}

export async function searchSubjects(query) {
  const params = new URLSearchParams();
  if (query) {
    params.set('q', query);
  }
  return apiFetchData(`${API_BASE}/chats/search_subjects/?${params.toString()}`);
}

export async function createIndividualChat(participantTwoId, schoolYear) {
  return apiFetchData(`${API_BASE}/chats/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_type: 'INDIVIDUAL',
      participant_two: participantTwoId,
      school_year: schoolYear,
    }),
  });
}

export async function createClassChat(sectionId, subjectId, schoolYear) {
  return apiFetchData(`${API_BASE}/chats/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_type: 'GROUP_CLASS',
      section: sectionId,
      subject: subjectId,
      school_year: schoolYear,
    }),
  });
}

export async function createProjectChat(name, schoolYear) {
  return apiFetchData(`${API_BASE}/chats/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_type: 'GROUP_PROJECT',
      name,
      school_year: schoolYear,
    }),
  });
}

export async function addMemberToChat(chatId, userId) {
  return apiFetchData(`${API_BASE}/chats/${chatId}/add_member/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function removeMemberFromChat(chatId, userId) {
  return apiFetchData(`${API_BASE}/chats/${chatId}/remove_member/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ user_id: userId }),
  });
}

export async function deleteChat(chatId) {
  const response = await apiFetch(`${API_BASE}/chats/${chatId}/`, {
    method: 'DELETE',
  });
  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to delete chat' }));
    throw new Error(error.detail || 'Failed to delete chat');
  }
  return true;
}

// ═══════════════════════════════════════════════════════════
// MESSAGE OPERATIONS
// ═══════════════════════════════════════════════════════════

export async function sendMessage(chatId, content, imageFile = null) {
  const formData = new FormData();
  formData.append('chat', chatId);
  formData.append('content', content);
  if (imageFile) {
    formData.append('image', imageFile);
  }

  const response = await apiFetch(`${API_BASE}/messages/`, {
    method: 'POST',
    body: formData,
  });

  if (!response.ok) {
    const error = await response.json().catch(() => ({ detail: 'Failed to send message' }));
    throw new Error(error.detail || 'Failed to send message');
  }

  return response.json();
}

export async function deleteMessage(messageId, reason = '') {
  return apiFetchData(`${API_BASE}/messages/${messageId}/delete_by_admin/`, {
    method: 'DELETE',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ reason }),
  });
}

export async function listMessageDeletionLogs() {
  return apiFetchData(`${API_BASE}/deletion-logs/`);
}

// ═══════════════════════════════════════════════════════════
// PROFANITY MANAGEMENT (Admin Only)
// ═══════════════════════════════════════════════════════════

export async function listProfanityWords() {
  return apiFetchData(`${API_BASE}/profanity/`);
}

export async function addProfanityWord(word, category = 'SWEAR') {
  return apiFetchData(`${API_BASE}/profanity/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ word, category, is_active: true }),
  });
}

export async function deleteProfanityWord(wordId) {
  const response = await apiFetch(`${API_BASE}/profanity/${wordId}/`, {
    method: 'DELETE',
  });
  return response.ok;
}

export async function updateProfanityWord(wordId, category, isActive) {
  return apiFetchData(`${API_BASE}/profanity/${wordId}/`, {
    method: 'PATCH',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ category, is_active: isActive }),
  });
}

// ═══════════════════════════════════════════════════════════
// FLAGGED MESSAGES (Admin Only)
// ═══════════════════════════════════════════════════════════

export async function listFlaggedMessages() {
  return apiFetchData(`${API_BASE}/flags/`);
}

export async function takeFlagAction(flagId, action, options = {}) {
  // action: 'delete', 'restrict', 'approve', 'dismiss'
  // options: { restrict_duration, is_permanent, admin_notes }
  return apiFetchData(`${API_BASE}/flags/${flagId}/take_action/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action, ...options }),
  });
}

// ═══════════════════════════════════════════════════════════
// CHAT RESTRICTIONS (Admin Only)
// ═══════════════════════════════════════════════════════════

export async function listChatRestrictions() {
  return apiFetchData(`${API_BASE}/restrictions/`);
}

export async function liftRestriction(restrictionId) {
  const response = await apiFetch(`${API_BASE}/restrictions/${restrictionId}/lift_restriction/`, {
    method: 'POST',
  });
  return response.ok;
}

// ═══════════════════════════════════════════════════════════
// CHAT REQUESTS (Safety Feature)
// ═══════════════════════════════════════════════════════════

export async function listChatRequests(status = 'PENDING') {
  const params = new URLSearchParams();
  if (status) {
    params.set('status', status);
  }
  const qs = params.toString();
  return apiFetchData(`${API_BASE}/chat-requests/${qs ? `?${qs}` : ''}`);
}

export async function createChatRequest(recipientId, firstMessage) {
  return apiFetchData(`${API_BASE}/chat-requests/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      recipient: recipientId,
      first_message: firstMessage,
    }),
  });
}

export async function respondToChatRequest(requestId, action) {
  // action: 'accept' or 'decline'
  return apiFetchData(`${API_BASE}/chat-requests/${requestId}/respond/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ action }),
  });
}

export async function getChatRequest(requestId) {
  return apiFetchData(`${API_BASE}/chat-requests/${requestId}/`);
}

// ═══════════════════════════════════════════════════════════
// MESSAGE REPORTS (Safety Feature)
// ═══════════════════════════════════════════════════════════

export async function listMessageReports(status = 'PENDING') {
  return apiFetchData(`${API_BASE}/reports/?status=${status}`);
}

export async function createMessageReport(messageId, reason, description = '') {
  // reason: 'OFFENSIVE', 'BULLYING', 'HARASSMENT', 'INAPPROPRIATE', 'SPAM', 'OTHER'
  return apiFetchData(`${API_BASE}/reports/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      message: messageId,
      reason,
      description,
    }),
  });
}

export async function reviewMessageReport(reportId, action, adminNotes = '') {
  // action: 'approve', 'dismiss', or 'delete'
  return apiFetchData(`${API_BASE}/reports/${reportId}/review/`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      action,
      admin_notes: adminNotes,
    }),
  });
}

export async function getMessageReport(reportId) {
  return apiFetchData(`${API_BASE}/reports/${reportId}/`);
}
