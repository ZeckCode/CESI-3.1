import React, { useEffect, useMemo, useState } from "react";
import { Bell, CheckCircle, Clock, AlertCircle } from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import "../TeacherWebsiteCSS/TeacherReminders.css";

const READ_OVERRIDES_KEY = "reminder-read-overrides:PERFORMANCE";

const normalizeReminderPayload = (payload) => {
  if (Array.isArray(payload)) return payload;
  if (payload && Array.isArray(payload.results)) return payload.results;
  return [];
};

const getReadOverrides = () => {
  try {
    const raw = localStorage.getItem(READ_OVERRIDES_KEY);
    const parsed = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(parsed) ? parsed.map((id) => Number(id)).filter(Number.isFinite) : []);
  } catch {
    return new Set();
  }
};

const saveReadOverride = (id) => {
  const overrides = getReadOverrides();
  overrides.add(Number(id));
  localStorage.setItem(READ_OVERRIDES_KEY, JSON.stringify(Array.from(overrides)));
};

const applyReadOverrides = (reminders) => {
  const overrides = getReadOverrides();
  if (overrides.size === 0) return reminders;
  return reminders.map((r) => (overrides.has(Number(r.id)) ? { ...r, is_read: true } : r));
};

const parseErrorDetail = async (res) => {
  try {
    const data = await res.json();
    return String(data?.detail || data?.message || "").trim();
  } catch {
    return "";
  }
};

const notifyReminderChanged = () => {
  window.dispatchEvent(new Event("reminders-changed"));
};

const markReminderRead = async (id) => {
  const attempts = [
    { url: `/api/reminders/mark-read/${id}/`, method: "POST" },
    { url: `/api/reminders/mark-read/${id}/`, method: "PATCH" },
    { url: `/api/reminders/${id}/read/`, method: "POST" },
    { url: `/api/reminders/${id}/read/`, method: "PATCH" },
  ];

  let lastError = "";

  for (const attempt of attempts) {
    const res = await apiFetch(attempt.url, { method: attempt.method });

    if (res.ok) return { ok: true, detail: "" };

    const detail = await parseErrorDetail(res);
    const detailLower = detail.toLowerCase();

    if (detailLower.includes("reminder not found")) {
      return { ok: true, detail };
    }

    if (res.status === 404 || res.status === 405) {
      continue;
    }

    lastError = detail || `Request failed with status ${res.status}`;
  }

  return { ok: false, detail: lastError || "Failed to mark as read" };
};

export default function TeacherReminders() {
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [activeFilter, setActiveFilter] = useState("all");
  const [markingId, setMarkingId] = useState(null);
  const [errorToast, setErrorToast] = useState("");

  useEffect(() => {
    if (!errorToast) return undefined;
    const timeoutId = window.setTimeout(() => setErrorToast(""), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [errorToast]);

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
      setReminders(applyReadOverrides(normalizeReminderPayload(data)));
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
      const result = await markReminderRead(id);

      if (!result.ok) {
        throw new Error(result.detail || "Failed to mark as read");
      }

      saveReadOverride(id);

      setReminders((prev) =>
        prev.map((r) => (r.id === id ? { ...r, is_read: true } : r))
      );
      notifyReminderChanged();
    } catch (err) {
      console.error("Error marking reminder as read:", err);
      setErrorToast(err?.message || "Could not mark reminder as read. Please try again.");
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

      {errorToast && (
        <div className="tr-snackbar" role="alert" aria-live="assertive">
          <AlertCircle size={16} />
          <span>{errorToast}</span>
        </div>
      )}
    </main>
  );
}