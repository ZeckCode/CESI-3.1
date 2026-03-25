import React, { useState, useEffect } from 'react';
import { X, Trash2, CheckCircle, Clock, AlertCircle } from 'lucide-react';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/NotificationList.css';

const NotificationList = ({ onClose, unreadCount, onNavigate }) => {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);

  useEffect(() => {
    loadNotifications();
  }, []);

  const loadNotifications = async () => {
    try {
      setLoading(true);
      setError('');
      const res = await apiFetch('/api/reminders/?type=PAYMENT');
      if (res.ok) {
        const data = await res.json();
        setReminders(Array.isArray(data) ? data : []);
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
      const res = await apiFetch(`/api/reminders/${reminderId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ is_read: true }),
      });

      if (res.ok) {
        setReminders(reminders.map(r =>
          r.id === reminderId ? { ...r, is_read: true } : r
        ));
      }
    } catch (err) {
      console.error('Error marking notification as read:', err);
    }
  };

  const handleDelete = async (reminderId) => {
    try {
      const res = await apiFetch(`/api/reminders/${reminderId}/`, {
        method: 'DELETE',
      });

      if (res.ok || res.status === 204) {
        setReminders(reminders.filter(r => r.id !== reminderId));
      }
    } catch (err) {
      console.error('Error deleting notification:', err);
    }
  };

  const handleNotificationClick = (reminder) => {
    if (onNavigate) {
      onNavigate('payment-reminders', reminder);
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
            {unreadCount > 0 && (
              <span className="notification-badge">{unreadCount > 99 ? '99+' : unreadCount}</span>
            )}
          </div>
          <button
            className="notification-close-btn"
            onClick={onClose}
            title="Close"
            type="button"
          >
            <X size={20} />
          </button>
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
                            {reminder.student_name || 'Payment Reminder'}
                          </div>
                          <div className="notification-item-text">
                            {reminder.message || 'Payment reminder pending'}
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
                            {reminder.student_name || 'Payment Reminder'}
                          </div>
                          <div className="notification-item-text">
                            {reminder.message || 'Payment reminder sent'}
                          </div>
                          <div className="notification-item-time">
                            {reminder.created_at && formatDate(reminder.created_at)}
                          </div>
                        </div>
                      </div>
                      <div className="notification-item-actions">
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
