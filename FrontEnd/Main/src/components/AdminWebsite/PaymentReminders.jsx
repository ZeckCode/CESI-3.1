import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Bell,
  Search,
  Filter,
  Send,
  AlertCircle,
  Clock,
  CheckCircle,
  Wallet,
} from "lucide-react";
import { apiFetch } from "../api/apiFetch";
import Toast from "../Global/Toast";
import "../AdminWebsiteCSS/PaymentReminders.css";

const REMINDER_SKELETON_ROWS = 6;

const PaymentReminders = () => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/api/reminders/?type=PAYMENT");

      if (!res.ok) throw new Error("Failed to load reminders");

      const data = await res.json();
      setReminders(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading payment reminders:", err);
      setReminders([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const filteredReminders = useMemo(() => {
    return reminders.filter((r) => {
      const text = searchTerm.toLowerCase();

      const matchesSearch =
        (r.reference_number || "").toLowerCase().includes(text) ||
        String(r.transaction || "").toLowerCase().includes(text) ||
        (r.title || "").toLowerCase().includes(text) ||
        (r.recipient_name || "").toLowerCase().includes(text);

      const statusValue = r.is_read ? "reminded" : "pending";
      const matchesFilter = filterStatus === "all" || statusValue === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [reminders, searchTerm, filterStatus]);

  const totalOutstanding = reminders.reduce((sum, r) => {
    return sum + Number(r.amount_to_pay || 0);
  }, 0);

  const pendingCount = reminders.filter((r) => !r.is_read).length;
  const remindedCount = reminders.filter((r) => r.is_read).length;

  const renderSkeletonRows = (columnCount) =>
    Array.from({ length: REMINDER_SKELETON_ROWS }).map((_, rowIdx) => (
      <tr key={`pr-skeleton-row-${rowIdx}`}>
        {Array.from({ length: columnCount }).map((__, colIdx) => (
          <td key={`pr-skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`pr-skeleton-line ${
                colIdx === 0 ? 'w-lg' : colIdx === columnCount - 1 ? 'w-sm' : 'w-md'
              }`}
            />
          </td>
        ))}
      </tr>
    ));

  const sendReminder = async (transactionId) => {
    if (!transactionId) {
      addToast("Error", "This reminder has no linked transaction.", "error");
      return;
    }

    setSendingId(transactionId);
    try {
      const res = await apiFetch(`/api/reminders/payments/${transactionId}/send/`, {
        method: "POST",
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send reminder.");
      }

      addToast("Success", data.detail || "Payment reminder sent successfully!", "success");
      loadReminders();
    } catch (err) {
      console.error("Error sending reminder:", err);
      addToast("Error", err.message || "Failed to send reminder.", "error");
    } finally {
      setSendingId(null);
    }
  };

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    try {
      const res = await apiFetch('/api/reminders/payments/send-bulk/', {
        method: 'POST',
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send bulk reminders.");
      }

      addToast("Success", data.detail || "Bulk reminders sent successfully!", "success");
      loadReminders();
    } catch (err) {
      console.error("Error sending bulk reminders:", err);
      addToast("Error", err.message || "Failed to send bulk reminders.", "error");
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <main className="pr-main">
      <section className="pr-section">
        {loading ? (
          <div className="pr-stats-grid">
            <div className="pr-stat-card pr-skeleton-stat-card">
              <div className="pr-skeleton-line w-md" />
              <div className="pr-skeleton-line w-sm" />
            </div>
            <div className="pr-stat-card pr-skeleton-stat-card">
              <div className="pr-skeleton-line w-md" />
              <div className="pr-skeleton-line w-sm" />
            </div>
            <div className="pr-stat-card pr-skeleton-stat-card">
              <div className="pr-skeleton-line w-md" />
              <div className="pr-skeleton-line w-sm" />
            </div>
          </div>
        ) : (
          <div className="pr-stats-grid">
            <div className="pr-stat-card pr-stat-blue">
              <div className="pr-stat-header">
                <span className="pr-stat-label">Total Outstanding</span>
                <Wallet size={24} className="pr-stat-icon" />
              </div>
              <div className="pr-stat-value">₱{totalOutstanding.toLocaleString()}</div>
              <div className="pr-stat-change">Based on reminder-linked transactions</div>
            </div>

            <div className="pr-stat-card pr-stat-yellow">
              <div className="pr-stat-header">
                <span className="pr-stat-label">Pending Reminders</span>
                <Clock size={24} className="pr-stat-icon" />
              </div>
              <div className="pr-stat-value">{pendingCount}</div>
              <div className="pr-stat-change">Unread reminders</div>
            </div>

            <div className="pr-stat-card pr-stat-green">
              <div className="pr-stat-header">
                <span className="pr-stat-label">Reminders Sent</span>
                <CheckCircle size={24} className="pr-stat-icon" />
              </div>
              <div className="pr-stat-value">{remindedCount}</div>
              <div className="pr-stat-change">Read reminders</div>
            </div>
          </div>
        )}
      </section>

      <section className="pr-section">
        {loading ? (
          <div className="pr-section-header pr-section-header-skeleton">
            <div>
              <div className="pr-skeleton-line pr-skeleton-title" />
              <div className="pr-skeleton-line pr-skeleton-subtitle" />
            </div>
            <div className="pr-header-actions">
              <div className="pr-skeleton-line pr-skeleton-control" />
            </div>
          </div>
        ) : (
          <div className="pr-section-header">
            <div>
              <h2 className="pr-section-title">Payment Reminders</h2>
              <p className="pr-section-subtitle">
                Manage payment reminders already saved in the system
              </p>
            </div>

            <div className="pr-header-actions">
              <button
                className="pr-btn-success"
                onClick={sendBulkReminders}
                disabled={sendingBulk}
              >
                <Bell size={18} /> {sendingBulk ? "Sending..." : "Send Bulk Reminders"}
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="pr-filters-container pr-filters-skeleton">
            <div className="pr-skeleton-line pr-skeleton-search" />
            <div className="pr-skeleton-line pr-skeleton-filter" />
          </div>
        ) : (
          <div className="pr-filters-container">
            <div className="pr-search-box">
              <Search size={20} className="pr-search-icon" />
              <input
                type="text"
                placeholder="Search by reference, recipient, or title..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pr-search-input"
              />
            </div>

            <div className="pr-filter-group">
              <Filter size={20} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="pr-filter-select"
              >
                <option value="all">All Statuses</option>
                <option value="pending">Pending</option>
                <option value="reminded">Reminded</option>
              </select>
            </div>
          </div>
        )}

        <div className="pr-table-container">
          <div className="pr-table-scroll-hint">← Swipe to scroll →</div>
          <table className="pr-table">
            <thead>
              <tr>
                <th>Transaction</th>
                <th>Recipient</th>
                <th>Title</th>
                <th>Amount to Pay</th>
                <th>Created</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows(7)
              ) : filteredReminders.length > 0 ? (
                filteredReminders.map((r) => (
                  <tr
                    key={r.id}
                    className={hoveredRow === r.id ? "pr-row-hover" : ""}
                    onMouseEnter={() => setHoveredRow(r.id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td>
                      {r.reference_number || r.transaction ? (
                        <div className="pr-transaction-cell">
                          <div className="pr-transaction-id">
                            #{r.transaction || "—"}
                          </div>
                          <div className="pr-transaction-ref">
                            {r.reference_number || "—"}
                          </div>
                          
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pr-student-name">{r.recipient_name || "—"}</td>
                    <td>{r.title || "—"}</td>
                    <td>
                      {r.amount_to_pay != null
                        ? `₱${Number(r.amount_to_pay).toLocaleString()}`
                        : "—"}
                    </td>
                    <td>
                      {r.created_at ? new Date(r.created_at).toLocaleString() : "—"}
                    </td>
                    <td>
                      <span
                        className={`pr-status-badge pr-status-${
                          r.is_read ? "reminded" : "pending"
                        }`}
                      >
                        {r.is_read ? "Reminded" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <button
                        className="pr-btn-send"
                        onClick={() => sendReminder(r.transaction)}
                        disabled={!r.transaction || sendingId === r.transaction}
                      >
                        <Send size={16} />{" "}
                        {sendingId === r.transaction ? "Sending..." : "Send"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="7" className="pr-no-data">
                    <AlertCircle size={24} />
                    <p>No reminders found</p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </section>
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </main>
  );
};

export default PaymentReminders;