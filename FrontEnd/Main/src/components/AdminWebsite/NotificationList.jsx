import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/NotificationList.css';

const READ_OVERRIDES_PREFIX = 'reminder-read-overrides:';

const normalizeReminderPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const getReadOverrides = (reminderType) => {
  try {
    const raw = localStorage.getItem(`${READ_OVERRIDES_PREFIX}${reminderType}`);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Number.isFinite) : []);
  } catch {
    return new Set();
  }
};

const saveReadOverride = (reminderType, reminderId) => {
  const overrides = getReadOverrides(reminderType);
  overrides.add(Number(reminderId));
  localStorage.setItem(`${READ_OVERRIDES_PREFIX}${reminderType}`, JSON.stringify(Array.from(overrides)));
};

const applyReadOverrides = (reminderType, reminders) => {
  const overrides = getReadOverrides(reminderType);
  if (overrides.size === 0) return reminders;
  return reminders.map((r) => (overrides.has(Number(r.id)) ? { ...r, is_read: true } : r));
};

const parseErrorDetail = async (res) => {
  try {
    const data = await res.json();
    return String(data?.detail || data?.message || '').trim();
  } catch {
    return '';
  }
};

const formatReminderParagraphs = (message) => {
  const text = String(message || '').trim();
  if (!text) return ['New notification'];

  const byLineBreak = text
    .split(/\n+/)
    .map((line) => line.trim())
    .filter(Boolean);

  if (byLineBreak.length > 1) {
    return byLineBreak;
  }

  // Fallback for old single-line reminders: split into sentences for readability.
  const bySentence = text
    .split(/(?<=[.!?])\s+/)
    .map((line) => line.trim())
    .filter(Boolean);

  return bySentence.length > 1 ? bySentence : [text];
};

const notifyReminderChanged = () => {
  window.dispatchEvent(new Event('reminders-changed'));
};

const NotificationList = ({
  onClose,
  unreadCount,
  onNavigate,
  reminderType = 'PAYMENT',
  targetMenuId,
  onUnreadCountChange,
}) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [markingAllAsRead, setMarkingAllAsRead] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, [reminderType]);

  useEffect(() => {
    if (typeof onUnreadCountChange === 'function') {
      onUnreadCountChange(reminders.filter((r) => !r.is_read).length);
    }
  }, [reminders, onUnreadCountChange]);

  const resolveTargetMenu = () => {
    if (targetMenuId) return targetMenuId;
    if (reminderType === 'PERFORMANCE') return 'reminders';
    if (reminderType === 'PAYMENT') return 'reminders';
    return 'reminders';
  };

  const markReminderRead = async (reminderId) => {
    const attempts = [
      { url: `/api/reminders/mark-read/${reminderId}/`, method: 'POST' },
      { url: `/api/reminders/mark-read/${reminderId}/`, method: 'PATCH' },
      { url: `/api/reminders/${reminderId}/read/`, method: 'POST' },
      { url: `/api/reminders/${reminderId}/read/`, method: 'PATCH' },
    ];

    let lastError = '';

    for (const attempt of attempts) {
      const res = await apiFetch(attempt.url, { method: attempt.method });

      if (res.ok) {
        return { ok: true, detail: '' };
      }

      const detail = await parseErrorDetail(res);
      const detailLower = detail.toLowerCase();

      if (detailLower.includes('reminder not found')) {
        return { ok: true, detail, notFound: true };
      }

      // Method not allowed means endpoint exists but expects a different verb.
      if (res.status === 405 || res.status === 404) {
        continue;
      }

      lastError = detail || `Request failed with status ${res.status}`;
    }

    return { ok: false, detail: lastError || 'Failed to mark notification as read' };
  };

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch(`/api/reminders/?type=${reminderType}`);
      if (res.ok) {
        const data = await res.json();
        const serverReminders = normalizeReminderPayload(data);
        setReminders(applyReadOverrides(reminderType, serverReminders));
      } else {
        setError('Failed to load notifications');
      }
    } catch (err) {
      console.error('Error loading notifications:', err);
      setError('Error loading notifications');
    } finally {
      setLoading(false);
    }
  };

  const handleMarkAsRead = async (reminderId) => {
    try {
      const result = await markReminderRead(reminderId);

      if (result.ok) {
        saveReadOverride(reminderType, reminderId);
        setReminders((prev) => prev.map((r) =>
          r.id === reminderId ? { ...r, is_read: true } : r
        ));
        notifyReminderChanged();
        loadNotifications();
      } else {
        setError(result.detail || 'Failed to mark notification as read');
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
      setError('Failed to mark notification as read');
    }
  };

  const handleDelete = async (reminderId) => {
    try {
      const res = await apiFetch(`/api/reminders/${reminderId}/`, {
        method: 'DELETE',
      });

      if (res.ok || res.status === 204) {
        setReminders(reminders.filter(r => r.id !== reminderId));
        notifyReminderChanged();
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleMarkAllAsRead = async () => {
    const unreadIds = reminders.filter(r => !r.is_read).map(r => r.id);
    
    if (unreadIds.length === 0) {
      alert('All notifications are already marked as read.');
      return;
    }

    setMarkingAllAsRead(true);
    try {
      const results = await Promise.all(
        unreadIds.map(async (id) => {
          const result = await markReminderRead(id);
          return { id, ok: result.ok, detail: result.detail || '' };
        })
      );

      results.forEach((row) => {
        if (row.ok || row.detail.toLowerCase().includes('reminder not found')) {
          saveReadOverride(reminderType, row.id);
        }
      });

      const failedCount = results.filter((r) => !r.ok).length;
      if (failedCount > 0) {
        setError(`Failed to mark ${failedCount} notification(s) as read.`);
      }

      // Always refresh from API so persisted server state drives the UI.
      notifyReminderChanged();
      loadNotifications();
    } catch (err) {
      console.error('Error marking all as read:', err);
      setError('Failed to mark all notifications as read.');
    } finally {
      setMarkingAllAsRead(false);
    }
  };

  const handleNotificationClick = (reminder) => {
    if (onNavigate) {
      onNavigate(resolveTargetMenu(), reminder);
    }
    onClose();
  };

  const unreadNotifications = reminders.filter(r => !r.is_read);
  const readNotifications = reminders.filter(r => r.is_read);

  return (
    <div className="notification-overlay" onClick={onClose}>
      <div className={`notification-panel ${isExpanded ? 'expanded' : ''}`} onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="notification-header">
          <div className="notification-title-section">
            <h3 className="notification-title">Notifications</h3>
            {unreadNotifications.length > 0 && (
              <span className="notification-badge">{unreadNotifications.length > 99 ? '99+' : unreadNotifications.length}</span>
            )}
          </div>
          <div className="notification-header-actions">
            {unreadNotifications.length > 0 && (
              <button
                className="notification-mark-all-btn"
                onClick={handleMarkAllAsRead}
                disabled={markingAllAsRead}
                title="Mark all as read"
                type="button"
              >
                {markingAllAsRead ? 'Marking...' : 'Mark all read'}
              </button>
            )}
            <button
              className="notification-close-btn"
              onClick={onClose}
              title="Close"
              type="button"
            >
              <X size={20} />
            </button>
          </div>
        </div>

        {/* Content */}
        <div className="notification-content">
          {loading ? (
            <div className="notification-loading">
              <div className="loader" />
              <p>Loading notifications...</p>
            </div>
          ) : error ? (
            <div className="notification-error">
              <AlertCircle size={32} />
              <p>{error}</p>
              <button className="notification-retry-btn" onClick={loadNotifications}>
                Retry
              </button>
            </div>
          ) : reminders.length === 0 ? (
            <div className="notification-empty">
              <CheckCircle size={40} />
              <p>No notifications</p>
            </div>
          ) : (
            <>
              {/* Unread Notifications */}
              {unreadNotifications.length > 0 && (
                <div className="notification-group">
                  <h4 className="notification-group-title">New</h4>
                  {unreadNotifications.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="notification-item unread"
                      onClick={() => handleNotificationClick(reminder)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="notification-item-left">
                        <div className="notification-dot" />
                        <div className="notification-item-content">
                          <div className="notification-item-title">
                            <span className="notification-read-check" aria-hidden="true">
                              <CheckCircle size={14} />
                            </span>
                            {reminder.title || reminder.student_name || 'Notification'}
                          </div>
                          <div className="notification-item-text">
                            {formatReminderParagraphs(reminder.message).map((paragraph, index) => (
                              <p key={`${reminder.id}-unread-${index}`}>{paragraph}</p>
                            ))}
                          </div>
                          <div className="notification-item-time">
                            {reminder.created_at && formatDate(reminder.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="notification-item-actions">
                        <button
                          className="notification-check-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleMarkAsRead(reminder.id);
                          }}
                          title="Mark as read"
                          type="button"
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          className="notification-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(reminder.id);
                          }}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {/* Read Notifications */}
              {readNotifications.length > 0 && (
                <div className="notification-group">
                  <h4 className="notification-group-title">Earlier</h4>
                  {readNotifications.map((reminder) => (
                    <div
                      key={reminder.id}
                      className="notification-item read"
                      onClick={() => handleNotificationClick(reminder)}
                      role="button"
                      tabIndex={0}
                    >
                      <div className="notification-item-left">
                        <div className="notification-item-content">
                          <div className="notification-item-title">
                            {reminder.title || reminder.student_name || 'Notification'}
                          </div>
                          <div className="notification-item-text">
                            {formatReminderParagraphs(reminder.message || 'Notification sent').map((paragraph, index) => (
                              <p key={`${reminder.id}-read-${index}`}>{paragraph}</p>
                            ))}
                          </div>
                          <div className="notification-item-time">
                            {reminder.created_at && formatDate(reminder.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="notification-item-actions">
                        <button
                          className="notification-check-btn is-read"
                          title="Already read"
                          type="button"
                          disabled
                        >
                          <CheckCircle size={18} />
                        </button>
                        <button
                          className="notification-delete-btn"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleDelete(reminder.id);
                          }}
                          title="Delete"
                          type="button"
                        >
                          <Trash2 size={18} />
                        </button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Footer */}
        {reminders.length > 0 && (
          <div className="notification-footer">
            <a href="#" className="notification-view-all" onClick={(e) => {
              e.preventDefault();
              setIsExpanded(!isExpanded);
            }}>
              {isExpanded ? '← Collapse' : 'View All Reminders →'}
            </a>
          </div>
        )}
      </div>
    </div>
  );
};

const formatDate = (dateString) => {
  if (!dateString) return '';
  const date = new Date(dateString);
  const now = new Date();
  const diff = now - date;
  const minutes = Math.floor(diff / 60000);
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(diff / 86400000);

  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  if (hours < 24) return `${hours}h ago`;
  if (days < 7) return `${days}d ago`;

  return date.toLocaleDateString();
};

export default NotificationList;
