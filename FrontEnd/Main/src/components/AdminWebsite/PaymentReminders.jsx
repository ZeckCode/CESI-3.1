import React, { useEffect, useMemo, useState } from "react";
import {
  Bell,
  Search,
  Filter,
  Send,
  AlertCircle,
  Clock,
  CheckCircle,
  DollarSign,
} from "lucide-react";
import { getToken } from "../Auth/auth";
import "../AdminWebsiteCSS/PaymentReminders.css";

const API_BASE = "";

const authHeaders = (extra = {}) => {
  const token = getToken();
  return {
    ...(token ? { Authorization: `Token ${token}` } : {}),
    ...extra,
  };
};

const PaymentReminders = () => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [reminders, setReminders] = useState([]);
  const [loading, setLoading] = useState(true);
  const [sendingId, setSendingId] = useState(null);
  const [sendingBulk, setSendingBulk] = useState(false);

  const loadReminders = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/reminders/?type=PAYMENT`, {
        credentials: "include",
        headers: authHeaders(),
      });

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

  const sendReminder = async (transactionId) => {
    if (!transactionId) {
      alert("This reminder has no linked transaction.");
      return;
    }

    setSendingId(transactionId);
    try {
      const res = await fetch(
        `${API_BASE}/api/reminders/payments/${transactionId}/send/`,
        {
          method: "POST",
          credentials: "include",
          headers: authHeaders(),
        }
      );

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send reminder.");
      }

      alert(data.detail || "Payment reminder sent successfully.");
      loadReminders();
    } catch (err) {
      console.error("Error sending reminder:", err);
      alert(err.message || "Failed to send reminder.");
    } finally {
      setSendingId(null);
    }
  };

  const sendBulkReminders = async () => {
    setSendingBulk(true);
    try {
      const res = await fetch(`${API_BASE}/api/reminders/payments/send-bulk/`, {
        method: "POST",
        credentials: "include",
        headers: authHeaders(),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send bulk reminders.");
      }

      alert(data.detail || "Bulk reminders sent successfully.");
      loadReminders();
    } catch (err) {
      console.error("Error sending bulk reminders:", err);
      alert(err.message || "Failed to send bulk reminders.");
    } finally {
      setSendingBulk(false);
    }
  };

  return (
    <main className="pr-main">
      <section className="pr-section">
        <div className="pr-stats-grid">
          <div className="pr-stat-card pr-stat-blue">
            <div className="pr-stat-header">
              <span className="pr-stat-label">Total Outstanding</span>
              <DollarSign size={24} className="pr-stat-icon" />
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
      </section>

      <section className="pr-section">
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

        <div className="pr-table-container">
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
                <tr>
                  <td colSpan="7" className="pr-no-data">
                    <p>Loading reminders...</p>
                  </td>
                </tr>
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
    </main>
  );
};

export default PaymentReminders;