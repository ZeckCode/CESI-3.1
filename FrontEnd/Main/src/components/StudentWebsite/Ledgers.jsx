import React, { useEffect, useState } from "react";
import "../StudentWebsiteCSS/Ledgers.css";
import { apiFetch } from "../api/apiFetch";
import Pagination from "./Pagination";

const API_BASE = "";
const ITEMS_PER_PAGE = 5;

const TYPE_LABELS = {
  TUITION: "Tuition Fee",
  REGISTRATION: "Registration Fee",
  MISC: "Miscellaneous",
  BOOKS: "Books & Materials",
  UNIFORM: "Uniform",
  OTHER: "Other",
};

const METHOD_LABELS = {
  CASH: "Cash",
  BANK_TRANSFER: "Bank Transfer",
  GCASH: "GCash",
  PAYMAYA: "PayMaya",
  CHECK: "Check",
  OTHER: "Other",
};

const Ledgers = () => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tuitionInstallments, setTuitionInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState("transactions"); // "transactions" or "installments"

  useEffect(() => {
    const fetchData = async () => {
      try {
        const [txRes, sumRes, instRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/finance/my-transactions/`),
          apiFetch(`${API_BASE}/api/finance/my-ledger-summary/`),
          apiFetch(`${API_BASE}/api/finance/my-tuition-installments/`),
        ]);
        if (!txRes.ok) throw new Error("Failed to load transactions");
        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);
        if (sumRes.ok) setSummary(await sumRes.json());
        if (instRes.ok) setTuitionInstallments(await instRes.json());
      } catch (err) {
        console.error("Ledger fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // ── derived data ──
  // (Payment summary removed — only transaction history is shown)

  // ── pagination ──
  const totalPages = Math.ceil(transactions.length / ITEMS_PER_PAGE);
  const paginatedTransactions = transactions.slice(
    (currentPage - 1) * ITEMS_PER_PAGE,
    currentPage * ITEMS_PER_PAGE
  );

  // Reset to page 1 when data changes
  useEffect(() => {
    setCurrentPage(1);
  }, [transactions.length]);

  return (
    <div className="ledger-content">
      <header className="ledger-header-flex">
        <div className="header-title-area">
           
          <span className="sy-badge">S.Y. 2025-2026</span>
        </div>

        <div className="header-actions">
          <button
            type="button"
            className="btn-action btn-print"
            onClick={() => window.print()}
          >
            <i className="bi bi-printer-fill me-2"></i>Print
          </button>
        </div>
      </header>

      {/* Balance / Summary Cards */}
      <div className="ledger-summary-row">
        <div className="ledger-sumCard ledger-sumCard--blue">
          <div className="ledger-sumCard__label">TOTAL BILLED</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_billed).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
        </div>

        <div className="ledger-sumCard ledger-sumCard--success">
          <div className="ledger-sumCard__label">TOTAL PAID</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_paid).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
        </div>

        <div className="ledger-sumCard ledger-sumCard--warn">
          <div className="ledger-sumCard__label">PENDING</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_pending).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
        </div>

        <div className={`ledger-sumCard ${
          summary && summary.total_overdue > 0 ? "ledger-sumCard--danger" : "ledger-sumCard--neutral"
        }`}>
          <div className="ledger-sumCard__label">OVERDUE</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_overdue).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
        </div>

        <div className={`ledger-sumCard ledger-sumCard--balance ${
          summary && summary.balance > 0 ? "ledger-sumCard--balanceOwed" : "ledger-sumCard--balanceClear"
        }`}>
          <div className="ledger-sumCard__label">OUTSTANDING BALANCE</div>
          <div className="ledger-sumCard__value ledger-sumCard__value--lg">
            ₱{summary ? Number(summary.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          {summary && (
            <div className="ledger-sumCard__sub">
              {summary.balance <= 0 ? "✅ Fully Paid" : "🔔 Balance Due"}
            </div>
          )}
        </div>
      </div>

      {/* View Mode Tabs */}
      <div className="ledger-tabs" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`ledger-tab ${viewMode === "transactions" ? "active" : ""}`}
          onClick={() => {
            setViewMode("transactions");
            setCurrentPage(1);
          }}
        >
          <i className="bi bi-clock-history me-2"></i>Transaction History
        </button>
        <button
          className={`ledger-tab ${viewMode === "installments" ? "active" : ""}`}
          onClick={() => {
            setViewMode("installments");
            setCurrentPage(1);
          }}
        >
          <i className="bi bi-calendar2-month me-2"></i>Tuition Installments
        </button>
      </div>

      {/* Loading / Error */}
      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          Loading transactions...
        </div>
      )}
      {error && (
        <div
          style={{
            textAlign: "center",
            padding: "2rem",
            color: "#991b1b",
            background: "#fee2e2",
            borderRadius: "0.75rem",
            marginBottom: "1.5rem",
          }}
        >
          {error}
        </div>
      )}

      {!loading && !error && viewMode === "transactions" && (
          <section className="ledger-section">
            <div className="section-header blue-header">
              <i className="bi bi-clock-history me-2"></i> Transaction History
            </div>

            <div className="table-responsive">
              <table className="ledger-table">
                <thead>
                  <tr>
                    <th>Type</th>
                    <th>Date</th>
                    <th>Due Date</th>
                    <th>Method</th>
                    <th>Amount</th>
                    <th>Status</th>
                  </tr>
                </thead>

                <tbody>
                  {paginatedTransactions.length === 0 ? (
                    <tr>
                      <td colSpan="6" style={{ textAlign: "center", color: "#94a3b8" }}>
                        No transactions found.
                      </td>
                    </tr>
                  ) : (
                    paginatedTransactions.map((row) => (
                      <tr key={row.id}>
                        <td data-label="Type">
                          <span className="item-badge">
                            {TYPE_LABELS[row.transaction_type] || row.transaction_type}
                          </span>
                        </td>
                        <td data-label="Date">
                          {row.date_created ? row.date_created.split(" ")[0] : "—"}
                        </td>
                        <td data-label="Due Date">{row.due_date || "—"}</td>
                        <td data-label="Method">
                          {METHOD_LABELS[row.payment_method] || row.payment_method}
                        </td>
                        <td data-label="Amount" className="text-debit">
                          ₱{Number(row.amount).toLocaleString()}
                        </td>
                        <td data-label="Status">
                          <span
                            className={`status-pill ${
                              row.status === "PAID"
                                ? "paid"
                                : row.status === "OVERDUE"
                                ? "overdue"
                                : "pending"
                            }`}
                          >
                            {row.status}
                          </span>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
              <Pagination
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={setCurrentPage}
                totalItems={transactions.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </div>
          </section>
      )}

      {!loading && !error && viewMode === "installments" && (
        <section className="ledger-section">
          <div className="section-header blue-header">
            <i className="bi bi-calendar2-month me-2"></i> Tuition Installment Schedule
          </div>

          {tuitionInstallments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              No tuition installment information available.
            </div>
          ) : (
            tuitionInstallments.map((student) => (
              <div key={student.student_id} style={{ marginBottom: "2rem" }}>
                <div style={{
                  background: "#f1f5f9",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                  borderLeft: "4px solid #3b82f6",
                }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>
                    {student.student_name}
                  </h4>
                  <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.875rem" }}>
                    Grade Level: {student.grade_level} | Payment Mode: {(student.payment_mode || "N/A").toUpperCase()}
                  </p>
                </div>

                {/* Summary Cards for this Student */}
                <div style={{
                  display: "grid",
                  gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                  gap: "1rem",
                  marginBottom: "1.5rem",
                }}>
                  <div style={{
                    background: "#eff6ff",
                    border: "1px solid #bfdbfe",
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      TOTAL DUE
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0284c7" }}>
                      ₱{Number(student.total_due).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{
                    background: "#f0fdf4",
                    border: "1px solid #bbf7d0",
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      TOTAL PAID
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#16a34a" }}>
                      ₱{Number(student.total_paid).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                  </div>

                  <div style={{
                    background: "#fef3c7",
                    border: "1px solid #fde68a",
                    padding: "1rem",
                    borderRadius: "0.5rem",
                    textAlign: "center",
                  }}>
                    <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                      REMAINING BALANCE
                    </div>
                    <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#d97706" }}>
                      ₱{Number(student.remaining_balance).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                    </div>
                  </div>
                </div>

                {/* Installments Table */}
                {student.installments && student.installments.length > 0 ? (
                  <div className="table-responsive">
                    <table className="ledger-table" style={{ marginBottom: "2rem" }}>
                      <thead>
                        <tr>
                          <th>Type</th>
                          <th>Month</th>
                          <th>Due Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {student.installments.map((inst, idx) => (
                          <tr 
                            key={idx}
                            style={{
                              backgroundColor: !inst.is_paid ? "rgba(206, 17, 38, 0.05)" : "transparent",
                              borderLeftColor: !inst.is_paid ? "#ce1126" : "transparent",
                              borderLeftWidth: !inst.is_paid ? "4px" : "0px",
                              borderLeftStyle: "solid",
                            }}
                          >
                            <td data-label="Type">{inst.type}</td>
                            <td data-label="Month">{inst.month}</td>
                            <td data-label="Due Date">{inst.due_date}</td>
                            <td data-label="Amount" className="text-debit">
                              ₱{Number(inst.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td data-label="Status">
                              <span
                                className={`status-pill ${inst.is_paid ? "paid" : "unpaid-balance"}`}
                              >
                                {inst.is_paid ? "✓ Paid" : "Part of Balance"}
                              </span>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <p style={{ color: "#94a3b8", textAlign: "center" }}>
                    No installment details available for this student.
                  </p>
                )}
              </div>
            ))
          )}
        </section>
      )}
    </div>
  );
};

export default Ledgers;
