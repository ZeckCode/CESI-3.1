import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { getToken } from "../Auth/auth";
import "../StudentWebsiteCSS/StudentReminders.css";

const API_BASE = "";

const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
};

export default function StudentReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [markingId, setMarkingId] = useState(null);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const query =
        activeFilter === "all"
          ? "/api/reminders/"
          : `/api/reminders/?type=${activeFilter}`;

      const res = await fetch(`${API_BASE}${query}`, {
        credentials: "include",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error("Failed to load reminders");

      const data = await res.json();
      setReminders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading reminders:", err);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, [activeFilter]);

  const unreadCount = useMemo(
    () => reminders.filter((r) => !r.is_read).length,
    [reminders]
  );

  const markAsRead = async (id) => {
    setMarkingId(id);
    try {
      const res = await fetch(`${API_BASE}/api/reminders/${id}/read/`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
      });

      if (!res.ok) throw new Error("Failed to mark as read");

      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_read: true } : r))
      );
    } catch (err) {
      console.error("Error marking reminder as read:", err);
    } finally {
      setMarkingId(null);
    }
  };

  const iconForType = (type) => {
    if (type === "PAYMENT") return <AlertCircle size={18} />;
    if (type === "PERFORMANCE") return <Clock size={18} />;
    return <Bell size={18} />;
  };

  return (
    <main className="student-reminders-main">
      <section className="sr-section">
        <div className="sr-header">
          <div>
            <h2 className="sr-title">Notifications</h2>
            <p className="sr-subtitle">View reminders and important updates</p>
          </div>

          <div className="sr-unread-badge">
            <Bell size={18} />
            <span>{unreadCount} unread</span>
          </div>
        </div>

        <div className="sr-filters">
          <button
            className={activeFilter === "all" ? "sr-filter active" : "sr-filter"}
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          <button
            className={activeFilter === "PAYMENT" ? "sr-filter active" : "sr-filter"}
            onClick={() => setActiveFilter("PAYMENT")}
          >
            Payment
          </button>
          
          <button
            className={activeFilter === "PERFORMANCE" ? "sr-filter active" : "sr-filter"}
            onClick={() => setActiveFilter("PERFORMANCE")}
          >
            Performance
          </button>
        </div>

        {loading ? (
          <div className="sr-empty">Loading reminders...</div>
        ) : reminders.length === 0 ? (
          <div className="sr-empty">No reminders found.</div>
        ) : (
          <div className="sr-list">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`sr-card ${reminder.is_read ? "read" : "unread"}`}
              >
                <div className="sr-card-top">
                  <div className="sr-type-icon">{iconForType(reminder.reminder_type)}</div>
                  <div className="sr-content">
                    <div className="sr-card-header">
                      <h3>{reminder.title}</h3>
                      <span className={`sr-status ${reminder.is_read ? "read" : "unread"}`}>
                        {reminder.is_read ? "Read" : "Unread"}
                      </span>
                    </div>

                    <p className="sr-message">{reminder.message}</p>

                    <div className="sr-meta">
                      <span>{reminder.reminder_type}</span>
                      <span>•</span>
                      <span>
                        {new Date(reminder.created_at).toLocaleString()}
                      </span>
                    </div>
                  </div>
                </div>

                {!reminder.is_read && (
                  <div className="sr-actions">
                    <button
                      className="sr-mark-btn"
                      onClick={() => markAsRead(reminder.id)}
                      disabled={markingId === reminder.id}
                    >
                      <CheckCircle size={16} />
                      {markingId === reminder.id ? "Marking..." : "Mark as Read"}
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}