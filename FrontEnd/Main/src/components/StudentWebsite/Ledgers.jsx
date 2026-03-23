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
          <div className="ledger-sumCard__label">💰 TOTAL BILLED</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_billed).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>Total amount due</div>
        </div>

        <div className="ledger-sumCard ledger-sumCard--success">
          <div className="ledger-sumCard__label">✅ TOTAL PAID</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_paid).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>Already submitted</div>
        </div>

        {/* <div className="ledger-sumCard ledger-sumCard--warn">
          <div className="ledger-sumCard__label">⏳ PENDING</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_pending).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>Not yet processed</div>
        </div> */}

        <div className={`ledger-sumCard ${
          summary && summary.total_overdue > 0 ? "ledger-sumCard--danger" : "ledger-sumCard--neutral"
        }`}>
          <div className="ledger-sumCard__label">📅 OVERDUE</div>
          <div className="ledger-sumCard__value">
            ₱{summary ? Number(summary.total_overdue).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>Past due date</div>
        </div>

        <div className={`ledger-sumCard ledger-sumCard--balance ${
          summary && summary.balance > 0 ? "ledger-sumCard--balanceOwed" : "ledger-sumCard--balanceClear"
        }`}>
          <div className="ledger-sumCard__label">🔔 OUTSTANDING BALANCE</div>
          <div className="ledger-sumCard__value ledger-sumCard__value--lg">
            ₱{summary ? Number(summary.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}
          </div>
          {summary && (
            <div className="ledger-sumCard__sub">
              {summary.balance <= 0 ? "✅ Fully Paid" : "Billed - Paid = Balance"}
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
              <i className="bi bi-book-fill me-2"></i> Account Ledger
            </div>

            <div className="ledger-info" style={{ 
              background: "#f0f9ff", 
              padding: "1rem", 
              borderRadius: "0.5rem", 
              marginBottom: "1rem",
              fontSize: "0.875rem",
              color: "#64748b"
            }}>
              <strong style={{ color: "#1e293b" }}>Ledger Format:</strong> Charges (Debit) are shown on the left, Payments (Credit) on the right, with a running balance.
            </div>

            {transactions.length === 0 ? (
              <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
                No transactions found.
              </div>
            ) : (
              <div className="table-responsive">
                <table className="ledger-table ledger-accounting">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Description</th>
                      <th className="text-center">Charge (Debit)</th>
                      <th className="text-center">Payment (Credit)</th>
                      <th className="text-right">Balance</th>
                    </tr>
                  </thead>
                  <tbody>
                    {transactions.map((tx, idx) => {
                      const isCharge = ["PENDING"].includes(tx.status);
                      const isPayment = tx.status === "PAID";
                      const debit = isCharge ? tx.amount : 0;
                      const credit = isPayment ? tx.amount : 0;
                      
                      return (
                        <tr 
                          key={tx.id}
                          style={{
                            backgroundColor: isCharge ? "rgba(206, 17, 38, 0.03)" : "rgba(34, 197, 94, 0.03)",
                            borderLeftColor: isCharge ? "#ce1126" : "#22c55e",
                            borderLeftWidth: "3px",
                            borderLeftStyle: "solid",
                          }}
                        >
                          <td data-label="Date" style={{ fontWeight: 500 }}>
                            {tx.date_created ? tx.date_created.split(" ")[0] : "—"}
                          </td>
                          <td data-label="Description">
                            <div style={{ display: "flex", flexDirection: "column", gap: "0.25rem" }}>
                              <span style={{ fontWeight: 600, color: "#1e293b" }}>
                                {TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                              </span>
                              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                Due: {tx.due_date || "N/A"} | {METHOD_LABELS[tx.payment_method] || tx.payment_method}
                              </span>
                            </div>
                          </td>
                          <td data-label="Charge (₱)" className="text-center" style={{ color: "#991b1b", fontWeight: 600 }}>
                            {debit > 0 ? `₱${Number(debit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td data-label="Payment (₱)" className="text-center" style={{ color: "#16a34a", fontWeight: 600 }}>
                            {credit > 0 ? `₱${Number(credit).toLocaleString("en-PH", { minimumFractionDigits: 2 })}` : "—"}
                          </td>
                          <td data-label="Balance" className="text-right" style={{ fontWeight: 700, color: "#0284c7" }}>
                            ₱{Number(summary?.balance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                  <tfoot>
                    <tr style={{ 
                      background: "#f1f5f9", 
                      borderTop: "2px solid #cbd5e1",
                      fontWeight: 700,
                    }}>
                      <td colSpan="2" style={{ textAlign: "right" }}>TOTALS:</td>
                      <td className="text-center" style={{ color: "#991b1b" }}>
                        ₱{Number(summary?.total_billed || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-center" style={{ color: "#16a34a" }}>
                        ₱{Number(summary?.total_paid || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                      <td className="text-right" style={{ color: "#0284c7" }}>
                        ₱{Number(summary?.balance || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>
      )}

      {!loading && !error && viewMode === "installments" && (
        <section className="ledger-section">
          <div className="section-header blue-header">
            <i className="bi bi-calendar2-month me-2"></i> Tuition Installment Schedule
          </div>

          <div className="ledger-info" style={{ 
            background: "#f0f9ff", 
            padding: "1rem", 
            borderRadius: "0.5rem", 
            marginBottom: "1.5rem",
            fontSize: "0.875rem",
            color: "#64748b",
            borderLeft: "4px solid #0284c7"
          }}>
            <strong style={{ color: "#0284c7" }}>📋 How to Read this Schedule:</strong>
            <br />Paid installments (✓) have been submitted and cleared. Unpaid installments ("Part of Balance") are still owed and contribute to your <strong>Outstanding Balance</strong> of <strong style={{ color: "#0284c7" }}>₱{summary ? Number(summary.balance).toLocaleString("en-PH", { minimumFractionDigits: 2 }) : "—"}</strong>
          </div>

          {tuitionInstallments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              No tuition installment information available.
            </div>
          ) : (
            tuitionInstallments.map((student) => (
              <div key={student.student_id} style={{ marginBottom: "2.5rem" }}>
                <div style={{
                  background: "#f1f5f9",
                  padding: "1rem",
                  borderRadius: "0.5rem",
                  marginBottom: "1rem",
                  borderLeft: "4px solid #3b82f6",
                }}>
                  <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>
                    📚 {student.student_name}
                  </h4>
                  <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.875rem" }}>
                    Grade Level: <strong>{student.grade_level}</strong> | Payment Mode: <strong>{(student.payment_mode || "N/A").toUpperCase()}</strong>
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
                      TOTAL TUITION FEE
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
                      ALREADY PAID
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
                      🔔 STILL OWED
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
                          <th>Installment</th>
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
                              backgroundColor: !inst.is_paid ? "rgba(206, 17, 38, 0.05)" : "rgba(34, 197, 94, 0.05)",
                              borderLeftColor: !inst.is_paid ? "#ce1126" : "#22c55e",
                              borderLeftWidth: "4px",
                              borderLeftStyle: "solid",
                            }}
                          >
                            <td data-label="Installment" style={{ fontWeight: 600 }}>{inst.type}</td>
                            <td data-label="Due Date">{inst.due_date}</td>
                            <td data-label="Amount" className="text-debit" style={{ fontWeight: 600 }}>
                              ₱{Number(inst.amount).toLocaleString("en-PH", { minimumFractionDigits: 2 })}
                            </td>
                            <td data-label="Status">
                              <span
                                className={`status-pill ${inst.is_paid ? "paid" : "unpaid-balance"}`}
                              >
                                {inst.is_paid ? "✓ Paid" : "⏳ Unpaid"}
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
