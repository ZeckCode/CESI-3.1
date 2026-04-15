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

const canSendReminderForTransaction = (row) =>
  Boolean(row?.transaction_id) && row?.can_send_payment_reminder === true;

const dueStateLabel = (state) => {
  if (state === "paid") return "Paid";
  if (state === "overdue") return "Overdue";
  if (state === "due_today") return "Due Today";
  return "Upcoming";
};

const dueStateBadgeClass = (state) => {
  if (state === "paid") return "reminded";
  if (state === "overdue") return "reminded";
  return "pending";
};

const PaymentReminders = () => {
  const [hoveredRow, setHoveredRow] = useState(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("all");
  const [ledgerRows, setLedgerRows] = useState([]);
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
      const res = await apiFetch("/api/reminders/payments/ledger/nearest-due/");

      if (!res.ok) throw new Error("Failed to load payment ledger");

      const data = await res.json();
      setLedgerRows(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error loading payment ledger:", err);
      setLedgerRows([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadReminders();
  }, []);

  const filteredRows = useMemo(() => {
    return ledgerRows.filter((r) => {
      const text = searchTerm.toLowerCase();

      const matchesSearch =
        (r.reference_number || "").toLowerCase().includes(text) ||
        String(r.transaction_id || "").toLowerCase().includes(text) ||
        (r.student_name || "").toLowerCase().includes(text) ||
        (r.student_number || "").toLowerCase().includes(text) ||
        (r.parent_name || "").toLowerCase().includes(text);

      const statusValue = r.due_state || "upcoming";
      const matchesFilter = filterStatus === "all" || statusValue === filterStatus;

      return matchesSearch && matchesFilter;
    });
  }, [ledgerRows, searchTerm, filterStatus]);

  const totalOutstanding = ledgerRows.reduce((sum, r) => {
    return sum + Number(r.remaining_balance || 0);
  }, 0);

  const studentsWithBalance = ledgerRows.filter((r) => Number(r.remaining_balance || 0) > 0).length;
  const overdueCount = ledgerRows.filter((r) => r.due_state === "overdue" && !r.is_paid_already).length;

  const dueWithin7Days = useMemo(() => {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const sevenDays = new Date(today);
    sevenDays.setDate(today.getDate() + 7);

    return ledgerRows.filter((r) => {
      if (!r?.due_date) return false;
      const due = new Date(`${r.due_date}T00:00:00`);
      if (Number.isNaN(due.getTime())) return false;
      return due >= today && due <= sevenDays;
    }).length;
  }, [ledgerRows]);

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

  const sendReminder = async (row) => {
    const transactionId = row?.transaction_id;
    if (!transactionId) {
      addToast("Error", "This student row has no linked transaction.", "error");
      return;
    }

    if (!canSendReminderForTransaction(row)) {
      addToast(
        "Blocked",
        row?.is_paid_already
          ? "This reminder is already paid. No reminder needed."
          : "Only due/overdue PENDING/PARTIAL transactions can receive reminders.",
        "warning"
      );
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
      await loadReminders();
    } catch (err) {
      console.error("Error sending reminder:", err);
      addToast("Error", err.message || "Failed to send reminder.", "error");
    } finally {
      setSendingId(null);
    }
  };

  const sendBulkReminders = async () => {
    const selectedTransactionIds = filteredRows
      .filter((row) => canSendReminderForTransaction(row))
      .map((row) => row.transaction_id)
      .filter(Boolean);

    if (selectedTransactionIds.length === 0) {
      addToast(
        "Blocked",
        "No eligible rows in the current filter. Adjust filters to include due or overdue pending/partial balances.",
        "warning"
      );
      return;
    }

    setSendingBulk(true);
    try {
      const res = await apiFetch('/api/reminders/payments/send-bulk/', {
        method: 'POST',
        body: JSON.stringify({ transaction_ids: selectedTransactionIds }),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        throw new Error(data.detail || "Failed to send bulk reminders.");
      }

      addToast("Success", data.detail || "Bulk reminders sent successfully!", "success");
      await loadReminders();
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
              <div className="pr-stat-change">Sum of current student ledger balances</div>
            </div>

            <div className="pr-stat-card pr-stat-yellow">
              <div className="pr-stat-header">
                <span className="pr-stat-label">Due Within 7 Days</span>
                <Clock size={24} className="pr-stat-icon" />
              </div>
              <div className="pr-stat-value">{dueWithin7Days}</div>
              <div className="pr-stat-change">Nearest-due student ledgers</div>
            </div>

            <div className="pr-stat-card pr-stat-green">
              <div className="pr-stat-header">
                <span className="pr-stat-label">Students With Balance</span>
                <CheckCircle size={24} className="pr-stat-icon" />
              </div>
              <div className="pr-stat-value">{studentsWithBalance}</div>
              <div className="pr-stat-change">Overdue: {overdueCount}</div>
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
                One nearest-due ledger row per student with remaining balance
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
                placeholder="Search by student, student no., parent, or reference..."
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
                <option value="upcoming">Upcoming</option>
                <option value="due_today">Due Today</option>
                <option value="overdue">Overdue</option>
                <option value="paid">Paid</option>
              </select>
            </div>
          </div>
        )}

        <div className="pr-table-container">
          <div className="pr-table-scroll-hint">← Swipe to scroll →</div>
          <table className="pr-table">
            <thead>
              <tr>
                <th>Student</th>
                <th>Parent</th>
                <th>Next Due Date</th>
                <th>Amount Due</th>
                <th>Remaining Balance</th>
                <th>Status</th>
                <th>Payment Info</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {loading ? (
                renderSkeletonRows(8)
              ) : filteredRows.length > 0 ? (
                filteredRows.map((r) => (
                  <tr
                    key={`${r.enrollment_id || "none"}-${r.transaction_id}`}
                    className={hoveredRow === r.transaction_id ? "pr-row-hover" : ""}
                    onMouseEnter={() => setHoveredRow(r.transaction_id)}
                    onMouseLeave={() => setHoveredRow(null)}
                  >
                    <td>
                      {r.student_name || r.transaction_id ? (
                        <div className="pr-transaction-cell">
                          <div className="pr-transaction-id">
                            {r.student_name || "—"}
                          </div>
                          <div className="pr-transaction-ref">
                            {r.student_number ? `SN: ${r.student_number}` : "SN: —"}
                          </div>
                          <div className="pr-transaction-ref">
                            {r.reference_number ? `Ref: ${r.reference_number}` : `Txn #${r.transaction_id || "—"}`}
                          </div>
                        </div>
                      ) : (
                        "—"
                      )}
                    </td>
                    <td className="pr-student-name">{r.parent_name || "—"}</td>
                    <td>
                      {r.due_date ? new Date(`${r.due_date}T00:00:00`).toLocaleDateString() : "—"}
                    </td>
                    <td>{`₱${Number(r.outstanding_balance || r.amount_to_pay || 0).toLocaleString()}`}</td>
                    <td>{`₱${Number(r.remaining_balance || 0).toLocaleString()}`}</td>
                    <td>
                      <span
                        className={`pr-status-badge pr-status-${
                          dueStateBadgeClass(r.due_state)
                        }`}
                      >
                        {dueStateLabel(r.due_state)}
                      </span>
                    </td>
                    <td>{r.payment_info || (r.is_paid_already ? "Paid already" : "With remaining balance")}</td>
                    <td>
                      <button
                        className="pr-btn-send"
                        onClick={() => sendReminder(r)}
                        disabled={
                          !r.transaction_id ||
                          sendingId === r.transaction_id
                        }
                        title={
                          !r.transaction_id
                            ? "No linked transaction"
                            : sendingId === r.transaction_id
                            ? "Sending..."
                            : r.is_paid_already
                            ? "Paid already"
                            : !canSendReminderForTransaction(r)
                            ? "Click to see why this row is not eligible"
                            : "Send payment reminder"
                        }
                      >
                        <Send size={16} />{" "}
                        {sendingId === r.transaction_id ? "Sending..." : "Send"}
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan="8" className="pr-no-data">
                    <AlertCircle size={24} />
                    <p>No student ledger rows found</p>
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