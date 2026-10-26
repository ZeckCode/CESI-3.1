import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../TeacherWebsiteCSS/TeacherReminders.css";

const normalizeReminderPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

export default function TeacherReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [markingId, setMarkingId] = useState(null);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const query =
        activeFilter === "all"
          ? "/api/reminders/?type=PERFORMANCE"
          : `/api/reminders/?type=PERFORMANCE&is_read=${activeFilter === "read" ? "true" : "false"}`;

      const res = await apiFetch(query);

      if (!res.ok) throw new Error("Failed to load reminders");

      const data = await res.json();
      setReminders(normalizeReminderPayload(data));
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
      let res = await apiFetch(`/api/reminders/mark-read/${id}/`, {
        method: "POST",
      });

      if (!res.ok && res.status === 404) {
        // Backward compatibility for older backend route.
        res = await apiFetch(`/api/reminders/${id}/read/`, {
          method: "POST",
        });
      }

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

  return (
    <main className="teacher-reminders-main">
      <section className="tr-section">
        <div className="tr-header">
          <div>
            <h2 className="tr-title">Performance Reminders</h2>
            <p className="tr-subtitle">Track student performance alerts and follow-ups</p>
          </div>

          <div className="tr-unread-badge">
            <Bell size={18} />
            <span>{unreadCount} unread</span>
          </div>
        </div>

        <div className="tr-filters">
          <button
            className={activeFilter === "all" ? "tr-filter active" : "tr-filter"}
            onClick={() => setActiveFilter("all")}
          >
            All
          </button>
          <button
            className={activeFilter === "unread" ? "tr-filter active" : "tr-filter"}
            onClick={() => setActiveFilter("unread")}
          >
            Unread
          </button>
          <button
            className={activeFilter === "read" ? "tr-filter active" : "tr-filter"}
            onClick={() => setActiveFilter("read")}
          >
            Read
          </button>
        </div>

        {loading ? (
          <div className="tr-empty">Loading reminders...</div>
        ) : reminders.length === 0 ? (
          <div className="tr-empty">No performance reminders found.</div>
        ) : (
          <div className="tr-list">
            {reminders.map((reminder) => (
              <div
                key={reminder.id}
                className={`tr-card ${reminder.is_read ? "read" : "unread"}`}
              >
                <div className="tr-card-top">
                  <div className="tr-type-icon">
                    {reminder.is_read ? <CheckCircle size={18} /> : <AlertCircle size={18} />}
                  </div>

                  <div className="tr-content">
                    <div className="tr-card-header">
                      <h3>{reminder.title}</h3>
                      <span className={`tr-status ${reminder.is_read ? "read" : "unread"}`}>
                        {reminder.is_read ? "Read" : "Unread"}
                      </span>
                    </div>

                    <p className="tr-message">{reminder.message}</p>

                    <div className="tr-meta">
                      <span>{reminder.recipient_name || "—"}</span>
                      <span>•</span>
                      <span>
                        {reminder.created_at
                          ? new Date(reminder.created_at).toLocaleString()
                          : "—"}
                      </span>
                    </div>
                  </div>
                </div>

                {!reminder.is_read && (
                  <div className="tr-actions">
                    <button
                      className="tr-mark-btn"
                      onClick={() => markAsRead(reminder.id)}
                      disabled={markingId === reminder.id}
                    >
                      <Clock size={16} />
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