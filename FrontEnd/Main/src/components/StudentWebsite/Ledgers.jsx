import React, { useEffect, useMemo, useState } from "react";
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

const ITEM_LABELS = {
  REGISTRATION: "Registration",
  PAYMENT: "Payment",
  INITIAL: "Initial Payment",
  MONTHLY: "Monthly Installment",
  MISC: "Miscellaneous",
  RESERVATION: "Reservation Fee",
  ASSESSMENT: "Assessment",
  OTHER: "Other",
};

const ENTRY_LABELS = {
  DEBIT: "Charge",
  CREDIT: "Payment",
};

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

const normalizeStatus = (value) => String(value || "").toLowerCase();

const paymentModeLabel = (value) => {
  const v = String(value || "").toLowerCase();
  if (!v) return "—";
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const Ledgers = () => {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tuitionInstallments, setTuitionInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [txPage, setTxPage] = useState(1);
  const [installmentPage, setInstallmentPage] = useState(1);
  const [viewMode, setViewMode] = useState("transactions");

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

        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setSummary(sumData);
        }

        if (instRes.ok) {
          const instData = await instRes.json();
          setTuitionInstallments(Array.isArray(instData) ? instData : []);
        }
      } catch (err) {
        console.error("Ledger fetch error:", err);
        setError(err.message || "Failed to load ledger data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  useEffect(() => {
    setTxPage(1);
  }, [transactions.length]);

  useEffect(() => {
    setInstallmentPage(1);
  }, [tuitionInstallments.length]);

  const txTotalPages = Math.max(1, Math.ceil(transactions.length / ITEMS_PER_PAGE));
  const paginatedTransactions = useMemo(
    () =>
      transactions.slice(
        (txPage - 1) * ITEMS_PER_PAGE,
        txPage * ITEMS_PER_PAGE
      ),
    [transactions, txPage]
  );

  const installmentTotalPages = Math.max(1, Math.ceil(tuitionInstallments.length / ITEMS_PER_PAGE));
  const paginatedInstallments = useMemo(
    () =>
      tuitionInstallments.slice(
        (installmentPage - 1) * ITEMS_PER_PAGE,
        installmentPage * ITEMS_PER_PAGE
      ),
    [tuitionInstallments, installmentPage]
  );

  return (
    <div className="ledger-content">
      <header className="ledger-header-flex">
        <div className="header-title-area">
          <span className="sy-badge">Student Ledger</span>
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

      <div className="ledger-summary-row">
        <div className="ledger-sumCard ledger-sumCard--blue">
          <div className="ledger-sumCard__label">💰 TOTAL BILLED</div>
          <div className="ledger-sumCard__value">
            {summary ? formatCurrency(summary.total_billed) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>
            Total debit entries
          </div>
        </div>

        <div className="ledger-sumCard ledger-sumCard--success">
          <div className="ledger-sumCard__label">✅ TOTAL PAID</div>
          <div className="ledger-sumCard__value">
            {summary ? formatCurrency(summary.total_paid) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>
            Total credit entries
          </div>
        </div>

        <div
          className={`ledger-sumCard ${
            summary && Number(summary.balance) > 0
              ? "ledger-sumCard--danger"
              : "ledger-sumCard--neutral"
          }`}
        >
          <div className="ledger-sumCard__label">🔔 OUTSTANDING BALANCE</div>
          <div className="ledger-sumCard__value">
            {summary ? formatCurrency(summary.balance) : "—"}
          </div>
          <div className="ledger-sumCard__sub" style={{ fontSize: "0.7rem" }}>
            Debit minus credit
          </div>
        </div>

        <div
          className={`ledger-sumCard ledger-sumCard--balance ${
            summary && Number(summary.balance) > 0
              ? "ledger-sumCard--balanceOwed"
              : "ledger-sumCard--balanceClear"
          }`}
        >
          <div className="ledger-sumCard__label">📘 LEDGER STATUS</div>
          <div className="ledger-sumCard__value ledger-sumCard__value--lg">
            {summary && Number(summary.balance) <= 0 ? "CLEARED" : "WITH BALANCE"}
          </div>
          <div className="ledger-sumCard__sub">
            {summary && Number(summary.balance) <= 0
              ? "✅ Fully Paid"
              : "Please monitor due entries"}
          </div>
        </div>
      </div>

      <div className="ledger-tabs" style={{ marginBottom: "1.5rem" }}>
        <button
          className={`ledger-tab ${viewMode === "transactions" ? "active" : ""}`}
          onClick={() => {
            setViewMode("transactions");
            setTxPage(1);
          }}
        >
          <i className="bi bi-clock-history me-2"></i>Transaction History
        </button>
        <button
          className={`ledger-tab ${viewMode === "installments" ? "active" : ""}`}
          onClick={() => {
            setViewMode("installments");
            setInstallmentPage(1);
          }}
        >
          <i className="bi bi-calendar2-month me-2"></i>Tuition Installments
        </button>
      </div>

      {loading && (
        <div style={{ textAlign: "center", padding: "3rem", color: "#64748b" }}>
          Loading ledger...
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
            <i className="bi bi-book-fill me-2"></i>Account Ledger
          </div>

          <div
            className="ledger-info"
            style={{
              background: "#f0f9ff",
              padding: "1rem",
              borderRadius: "0.5rem",
              marginBottom: "1rem",
              fontSize: "0.875rem",
              color: "#64748b",
            }}
          >
            <strong style={{ color: "#1e293b" }}>Ledger Format:</strong> Charges
            appear under <strong>Debit</strong>, payments appear under{" "}
            <strong>Credit</strong>, and the <strong>Balance</strong> column shows
            the running account balance for each entry.
          </div>

          {transactions.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              No transactions found.
            </div>
          ) : (
            <>
              <div className="table-responsive">
                <table className="ledger-table ledger-accounting">
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Reference</th>
                      <th>Description</th>
                      <th className="text-center">Debit</th>
                      <th className="text-center">Credit</th>
                      <th className="text-right">Balance</th>
                      <th className="text-center">Status</th>
                    </tr>
                  </thead>

                  <tbody>
                    {paginatedTransactions.map((tx) => {
                      const isCharge = tx.entry_type === "DEBIT";
                      const debit = Number(tx.debit || 0);
                      const credit = Number(tx.credit || 0);

                      return (
                        <tr
                          key={tx.id}
                          style={{
                            backgroundColor: isCharge
                              ? "rgba(206, 17, 38, 0.03)"
                              : "rgba(34, 197, 94, 0.03)",
                            borderLeftColor: isCharge ? "#ce1126" : "#22c55e",
                            borderLeftWidth: "3px",
                            borderLeftStyle: "solid",
                          }}
                        >
                          <td data-label="Date" style={{ fontWeight: 500 }}>
                            {tx.transaction_date || "—"}
                          </td>

                          <td data-label="Reference" style={{ fontSize: "0.85rem" }}>
                            {tx.reference_number || "—"}
                          </td>

                          <td data-label="Description">
                            <div
                              style={{
                                display: "flex",
                                flexDirection: "column",
                                gap: "0.25rem",
                              }}
                            >
                              <span style={{ fontWeight: 700, color: "#1e293b" }}>
                                {ITEM_LABELS[tx.item] || tx.item || "Entry"}
                              </span>

                              <span style={{ fontSize: "0.8rem", color: "#475569" }}>
                                {TYPE_LABELS[tx.transaction_type] || tx.transaction_type}
                                {" • "}
                                {ENTRY_LABELS[tx.entry_type] || tx.entry_type}
                              </span>

                              <span style={{ fontSize: "0.75rem", color: "#94a3b8" }}>
                                {tx.due_date ? `Due: ${tx.due_date}` : "No due date"}
                                {" • "}
                                {METHOD_LABELS[tx.payment_method] || tx.payment_method}
                              </span>

                              {tx.description ? (
                                <span style={{ fontSize: "0.75rem", color: "#64748b" }}>
                                  {tx.description}
                                </span>
                              ) : null}
                            </div>
                          </td>

                          <td
                            data-label="Debit"
                            className="text-center"
                            style={{ color: "#991b1b", fontWeight: 700 }}
                          >
                            {debit > 0 ? formatCurrency(debit) : "—"}
                          </td>

                          <td
                            data-label="Credit"
                            className="text-center"
                            style={{ color: "#16a34a", fontWeight: 700 }}
                          >
                            {credit > 0 ? formatCurrency(credit) : "—"}
                          </td>

                          <td
                            data-label="Balance"
                            className="text-right"
                            style={{ fontWeight: 700, color: "#0284c7" }}
                          >
                            {formatCurrency(tx.balance)}
                          </td>

                          <td data-label="Status" className="text-center">
                            <span className={`status-pill ${normalizeStatus(tx.status)}`}>
                              {tx.status}
                            </span>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>

                  <tfoot>
                    <tr
                      style={{
                        background: "#f1f5f9",
                        borderTop: "2px solid #cbd5e1",
                        fontWeight: 700,
                      }}
                    >
                      <td colSpan="3" style={{ textAlign: "right" }}>
                        TOTALS:
                      </td>
                      <td className="text-center" style={{ color: "#991b1b" }}>
                        {formatCurrency(summary?.total_billed || 0)}
                      </td>
                      <td className="text-center" style={{ color: "#16a34a" }}>
                        {formatCurrency(summary?.total_paid || 0)}
                      </td>
                      <td className="text-right" style={{ color: "#0284c7" }}>
                        {formatCurrency(summary?.balance || 0)}
                      </td>
                      <td></td>
                    </tr>
                  </tfoot>
                </table>
              </div>

              <Pagination
                currentPage={txPage}
                totalPages={txTotalPages}
                onPageChange={setTxPage}
                totalItems={transactions.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </>
          )}
        </section>
      )}

      {!loading && !error && viewMode === "installments" && (
        <section className="ledger-section">
          <div className="section-header blue-header">
            <i className="bi bi-calendar2-month me-2"></i>Tuition Installment Schedule
          </div>

          <div
            className="ledger-info"
            style={{
              background: "#f0f9ff",
              padding: "1rem",
              borderRadius: "0.5rem",
              marginBottom: "1.5rem",
              fontSize: "0.875rem",
              color: "#64748b",
              borderLeft: "4px solid #0284c7",
            }}
          >
            <strong style={{ color: "#0284c7" }}>📋 How to Read this Schedule:</strong>
            <br />
            Paid installments are already covered by your ledger credits. Unpaid
            installments remain part of your outstanding balance of{" "}
            <strong style={{ color: "#0284c7" }}>
              {summary ? formatCurrency(summary.balance) : "—"}
            </strong>
            .
          </div>

          {tuitionInstallments.length === 0 ? (
            <div style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}>
              No tuition installment information available.
            </div>
          ) : (
            <>
              {paginatedInstallments.map((student) => (
                <div key={student.student_id} style={{ marginBottom: "2.5rem" }}>
                  <div
                    style={{
                      background: "#f1f5f9",
                      padding: "1rem",
                      borderRadius: "0.5rem",
                      marginBottom: "1rem",
                      borderLeft: "4px solid #3b82f6",
                    }}
                  >
                    <h4 style={{ margin: "0 0 0.5rem 0", color: "#1e293b" }}>
                      📚 {student.student_name}
                    </h4>
                    <p style={{ margin: "0.25rem 0", color: "#64748b", fontSize: "0.875rem" }}>
                      Grade Level: <strong>{student.grade_level}</strong> | Payment Mode:{" "}
                      <strong>{paymentModeLabel(student.payment_mode)}</strong> | Overall Status:{" "}
                      <strong>{student.overall_status || "PENDING"}</strong>
                    </p>
                  </div>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: "1rem",
                      marginBottom: "1.5rem",
                    }}
                  >
                    <div
                      style={{
                        background: "#eff6ff",
                        border: "1px solid #bfdbfe",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        TOTAL TUITION FEE
                      </div>
                      <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#0284c7" }}>
                        {formatCurrency(student.total_due)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f0fdf4",
                        border: "1px solid #bbf7d0",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        ALREADY PAID
                      </div>
                      <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#16a34a" }}>
                        {formatCurrency(student.total_paid)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#fef3c7",
                        border: "1px solid #fde68a",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        STILL OWED
                      </div>
                      <div style={{ fontSize: "1.25rem", fontWeight: "600", color: "#d97706" }}>
                        {formatCurrency(student.remaining_balance)}
                      </div>
                    </div>

                    <div
                      style={{
                        background: "#f8fafc",
                        border: "1px solid #cbd5e1",
                        padding: "1rem",
                        borderRadius: "0.5rem",
                        textAlign: "center",
                      }}
                    >
                      <div style={{ fontSize: "0.75rem", color: "#64748b", marginBottom: "0.5rem" }}>
                        OVERALL STATUS
                      </div>
                      <div style={{ fontSize: "1rem", fontWeight: "700", color: "#334155" }}>
                        {student.overall_status || "PENDING"}
                      </div>
                    </div>
                  </div>

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
                          {student.installments.map((inst, idx) => {
                            const isPaid = inst.status === "PAID";
                            const isOverdue = inst.status === "OVERDUE";

                            return (
                              <tr
                                key={idx}
                                style={{
                                  backgroundColor: isPaid
                                    ? "rgba(34, 197, 94, 0.05)"
                                    : isOverdue
                                    ? "rgba(220, 38, 38, 0.06)"
                                    : "rgba(245, 158, 11, 0.06)",
                                  borderLeftColor: isPaid
                                    ? "#22c55e"
                                    : isOverdue
                                    ? "#dc2626"
                                    : "#f59e0b",
                                  borderLeftWidth: "4px",
                                  borderLeftStyle: "solid",
                                }}
                              >
                                <td data-label="Installment" style={{ fontWeight: 600 }}>
                                  {inst.type}
                                </td>
                                <td data-label="Due Date">{inst.due_date}</td>
                                <td data-label="Amount" className="text-debit" style={{ fontWeight: 600 }}>
                                  {formatCurrency(inst.amount)}
                                </td>
                                <td data-label="Status">
                                  <span className={`status-pill ${normalizeStatus(inst.status)}`}>
                                    {inst.status}
                                  </span>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <p style={{ color: "#94a3b8", textAlign: "center" }}>
                      No installment details available for this student.
                    </p>
                  )}
                </div>
              ))}

              <Pagination
                currentPage={installmentPage}
                totalPages={installmentTotalPages}
                onPageChange={setInstallmentPage}
                totalItems={tuitionInstallments.length}
                itemsPerPage={ITEMS_PER_PAGE}
              />
            </>
          )}
        </section>
      )}
    </div>
  );
};

export default Ledgers;