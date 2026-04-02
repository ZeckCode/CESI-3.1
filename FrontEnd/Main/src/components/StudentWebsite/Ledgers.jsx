import React, { useEffect, useMemo, useState } from "react";
import "../StudentWebsiteCSS/Ledgers.css";
import { apiFetch } from "../api/apiFetch";
import Pagination from "./Pagination";
import PreviewModal from "../PreviewModal";

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
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const normalizeStatus = (value) => String(value || "").trim().toLowerCase();

const paymentModeLabel = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";
  if (v === "cash") return "Cash";
  if (v === "installment") return "Installment";
  return v.charAt(0).toUpperCase() + v.slice(1);
};

const studentTypeLabel = (value) => {
  const v = String(value || "").trim().toLowerCase();
  if (!v) return "";

  if (["old", "old_student", "returning", "returning_student"].includes(v)) {
    return "Old Student";
  }

  if (["new", "new_student", "new enrollee", "new_enrollee"].includes(v)) {
    return "New Student";
  }

  return value;
};

const gradeLevelLabel = (value) => {
  const v = String(value || "").trim();
  if (!v) return "";

  const lower = v.toLowerCase();
  const map = {
    prek: "Pre-Kinder",
    kinder: "Kinder",
    grade1: "Grade 1",
    grade2: "Grade 2",
    grade3: "Grade 3",
    grade4: "Grade 4",
    grade5: "Grade 5",
    grade6: "Grade 6",
  };

  return map[lower] || v;
};

const buildLedgerGroupTitle = (group) =>
  [
    group.school_year ? `SY ${group.school_year}` : "",
    gradeLevelLabel(group.grade_level),
    studentTypeLabel(group.student_type),
    paymentModeLabel(group.payment_mode),
  ]
    .filter(Boolean)
    .join(" • ");

const statusPillStyle = (status) => {
  const normalized = normalizeStatus(status);

  if (normalized === "paid") {
    return { background: "#dcfce7", color: "#166534" };
  }
  if (normalized === "posted") {
    return { background: "#e2e8f0", color: "#334155" };
  }
  if (normalized === "partial") {
    return { background: "#dbeafe", color: "#1d4ed8" };
  }
  if (normalized === "overdue") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  return { background: "#fef3c7", color: "#b45309" };
};

export default function Ledgers() {
  const [transactions, setTransactions] = useState([]);
  const [summary, setSummary] = useState(null);
  const [tuitionInstallments, setTuitionInstallments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const [txPage, setTxPage] = useState(1);
  const [installmentPage, setInstallmentPage] = useState(1);
  const [viewMode, setViewMode] = useState("transactions");
  const [isPrinting, setIsPrinting] = useState(false);
  const [showPreview, setShowPreview] = useState(false);

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError(null);

        const [txRes, sumRes, instRes] = await Promise.all([
          apiFetch(`${API_BASE}/api/finance/my-transactions/`),
          apiFetch(`${API_BASE}/api/finance/my-ledger-summary/`),
          apiFetch(`${API_BASE}/api/finance/my-tuition-installments/`),
        ]);

        if (!txRes.ok) {
          throw new Error("Failed to load transactions");
        }

        const txData = await txRes.json();
        setTransactions(Array.isArray(txData) ? txData : []);

        if (sumRes.ok) {
          const sumData = await sumRes.json();
          setSummary(sumData);
        } else {
          setSummary(null);
        }

        if (instRes.ok) {
          const instData = await instRes.json();
          setTuitionInstallments(Array.isArray(instData) ? instData : []);
        } else {
          setTuitionInstallments([]);
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

  const filteredTransactions = useMemo(
    () =>
      transactions.filter(
        (tx) =>
          normalizeStatus(tx.status) !== "pending" &&
          tx.transaction_type !== "CONTRIBUTION"
      ),
    [transactions]
  );

  useEffect(() => {
    setTxPage(1);
  }, [filteredTransactions.length]);

  useEffect(() => {
    setInstallmentPage(1);
  }, [tuitionInstallments.length]);

  const groupedTransactions = useMemo(() => {
    const map = new Map();

    filteredTransactions.forEach((tx) => {
      const key =
        tx.enrollment_id != null && tx.enrollment_id !== ""
          ? `enrollment-${tx.enrollment_id}`
          : [
              tx.school_year || "no-sy",
              tx.grade_level || "no-grade",
              tx.student_type || "no-type",
              tx.payment_mode || "no-mode",
            ].join("|");

      if (!map.has(key)) {
        map.set(key, {
          key,
          enrollment_id: tx.enrollment_id || null,
          school_year: tx.school_year || "",
          semester: tx.semester || "",
          grade_level: tx.grade_level || "",
          student_type: tx.student_type || "",
          payment_mode: tx.payment_mode || "",
          latest_date: tx.transaction_date || "",
          rows: [],
        });
      }

      const group = map.get(key);
      group.rows.push(tx);

      if ((tx.transaction_date || "") > group.latest_date) {
        group.latest_date = tx.transaction_date || "";
      }
    });

    return Array.from(map.values())
      .map((group) => {
        const sortedRows = group.rows
          .slice()
          .sort((a, b) => {
            const dateCompare = String(a.transaction_date || "").localeCompare(
              String(b.transaction_date || "")
            );
            if (dateCompare !== 0) return dateCompare;
            return Number(a.id || 0) - Number(b.id || 0);
          });

        let runningBalance = 0;
        let totalDebit = 0;
        let totalCredit = 0;

        const normalizedRows = sortedRows.map((tx) => {
          const debit = Number(tx.debit || 0);
          const credit = Number(tx.credit || 0);

          totalDebit += debit;
          totalCredit += credit;
          runningBalance += debit - credit;

          return {
            ...tx,
            _runningBalance: runningBalance,
          };
        });

        return {
          ...group,
          rows: normalizedRows,
          totalDebit,
          totalCredit,
          balance: runningBalance,
        };
      })
      .sort((a, b) =>
        String(b.latest_date || "").localeCompare(String(a.latest_date || ""))
      );
  }, [filteredTransactions]);

  const txTotalPages = Math.max(
    1,
    Math.ceil(groupedTransactions.length / ITEMS_PER_PAGE)
  );

  const paginatedTransactions = useMemo(
    () =>
      groupedTransactions.slice(
        (txPage - 1) * ITEMS_PER_PAGE,
        txPage * ITEMS_PER_PAGE
      ),
    [groupedTransactions, txPage]
  );

  const installmentTotalPages = Math.max(
    1,
    Math.ceil(tuitionInstallments.length / ITEMS_PER_PAGE)
  );

  const paginatedInstallments = useMemo(
    () =>
      tuitionInstallments.slice(
        (installmentPage - 1) * ITEMS_PER_PAGE,
        installmentPage * ITEMS_PER_PAGE
      ),
    [tuitionInstallments, installmentPage]
  );

  const handlePrint = () => {
    setShowPreview(true);
  };

  return (
    <div className="ledger-wrapper">
      <div className="ledger-content">
        {!isPrinting && (
          <>
            <div className="ledger-section-header">
              <div>
                <h2 className="ledger-section-title">Account & Financial Records</h2>
                <p className="ledger-section-subtitle">Complete financial transaction history</p>
              </div>
              <div className="ledger-header-actions">
                <button 
                  className="ledger-btn-print" 
                  onClick={handlePrint}
                  type="button"
                  title="Print ledger"
                >
                  <span>🖨️</span> Print Ledger
                </button>
              </div>
            </div>

            <div className="ledger-tabs">
              <button
                type="button"
                className={`ledger-tab ${
                  viewMode === "transactions" ? "active" : ""
                }`}
                onClick={() => setViewMode("transactions")}
              >
                Account Ledger
              </button>
              <button
                type="button"
                className={`ledger-tab ${
                  viewMode === "installments" ? "active" : ""
                }`}
                onClick={() => setViewMode("installments")}
              >
                Tuition Installments
              </button>
            </div>
          </>
        )}

        {!loading && !error && !isPrinting && (
          <div className="ledger-summary-row">
            <div className="ledger-sumCard ledger-sumCard--blue">
              <div className="ledger-sumCard__label">Total Billed</div>
              <div className="ledger-sumCard__value">
                {formatCurrency(summary?.total_billed || 0)}
              </div>
            </div>

            <div className="ledger-sumCard ledger-sumCard--success">
              <div className="ledger-sumCard__label">Total Paid</div>
              <div className="ledger-sumCard__value">
                {formatCurrency(summary?.total_paid || 0)}
              </div>
            </div>

            <div
              className={`ledger-sumCard ledger-sumCard--balance ${
                Number(summary?.balance || 0) > 0
                  ? "ledger-sumCard--balanceOwed"
                  : "ledger-sumCard--balanceClear"
              }`}
            >
              <div className="ledger-sumCard__label">Current Balance</div>
              <div className="ledger-sumCard__value ledger-sumCard__value--lg">
                {formatCurrency(summary?.balance || 0)}
              </div>
              <div className="ledger-sumCard__sub">
                {Number(summary?.balance || 0) > 0
                  ? "Outstanding balance"
                  : "Account settled"}
              </div>
            </div>
          </div>
        )}

        {loading && (
          <div className="ledger-loading">
            <div className="spinner-border text-primary me-2" role="status" />
            Loading ledger…
          </div>
        )}

        {!loading && error && <div className="ledger-error">{error}</div>}

        {!loading && !error && viewMode === "transactions" && !isPrinting && (
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
              <strong>Credit</strong>, and the <strong>Balance</strong> column
              shows the running account balance for each entry.
            </div>

            {transactions.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}
              >
                No transactions found.
              </div>
            ) : filteredTransactions.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}
              >
                No posted or paid ledger entries to display.
              </div>
            ) : (
              <>
                <div className="ledger-group-list">
                  {paginatedTransactions.map((group) => (
                    <div
                      key={group.key}
                      className="ledger-group-card"
                      style={{
                        background: "#ffffff",
                        border: "1px solid #dbeafe",
                        borderRadius: "16px",
                        overflow: "hidden",
                        marginBottom: "1.25rem",
                        boxShadow: "0 10px 24px rgba(15, 23, 42, 0.06)",
                      }}
                    >
                      <div
                        className="ledger-group-header"
                        style={{
                          background:
                            "linear-gradient(135deg, #eff6ff 0%, #f8fbff 100%)",
                          borderBottom: "1px solid #dbeafe",
                          padding: "1rem 1.25rem",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 800,
                            color: "#1d4ed8",
                            fontSize: "1rem",
                            marginBottom: "0.8rem",
                          }}
                        >
                          {buildLedgerGroupTitle(group) || "Ledger Record"}
                        </div>

                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns: "1fr 1fr",
                            gap: "1rem",
                            fontSize: "0.82rem",
                            color: "#64748b",
                          }}
                          className="ledger-group-info"
                        >
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Semester</div>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{group.semester || "—"}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Total Billed</div>
                            <div style={{ fontWeight: 700, color: "#1e293b" }}>{formatCurrency(group.totalDebit)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Total Paid</div>
                            <div style={{ fontWeight: 700, color: "#16a34a" }}>{formatCurrency(group.totalCredit)}</div>
                          </div>
                          <div>
                            <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Balance</div>
                            <div style={{ fontWeight: 700, color: group.balance > 0 ? "#dc2626" : "#16a34a" }}>{formatCurrency(group.balance)}</div>
                          </div>
                        </div>
                      </div>

                      <div className="table-responsive">
                        <table
                          className="ledger-table ledger-accounting"
                          style={{ marginBottom: 0 }}
                        >
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
                            {group.rows.map((tx) => {
                              const debit = Number(tx.debit || 0);
                              const credit = Number(tx.credit || 0);

                              return (
                                <tr key={tx.id}>
                                  <td
                                    data-label="Date"
                                    style={{ fontWeight: 500 }}
                                  >
                                    {tx.transaction_date || "—"}
                                  </td>

                                  <td
                                    data-label="Reference"
                                    style={{ fontSize: "0.85rem" }}
                                  >
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
                                      <span
                                        style={{
                                          fontWeight: 700,
                                          color: "#0f172a",
                                        }}
                                      >
                                        {ITEM_LABELS[tx.item] || tx.item || "Entry"}
                                      </span>

                                      <span
                                        style={{
                                          fontSize: "0.8rem",
                                          color: "#475569",
                                        }}
                                      >
                                        {TYPE_LABELS[tx.transaction_type] ||
                                          tx.transaction_type}
                                        {" • "}
                                        {ENTRY_LABELS[tx.entry_type] || tx.entry_type}
                                      </span>

                                      <span
                                        style={{
                                          fontSize: "0.75rem",
                                          color: "#64748b",
                                        }}
                                      >
                                        {tx.due_date
                                          ? `Due: ${tx.due_date}`
                                          : "No due date"}
                                      </span>

                                      {tx.description ? (
                                        <span
                                          style={{
                                            fontSize: "0.75rem",
                                            color: "#64748b",
                                          }}
                                        >
                                          {tx.description}
                                        </span>
                                      ) : null}
                                    </div>
                                  </td>

                                  <td
                                    className="text-center"
                                    data-label="Debit"
                                    style={{ fontWeight: 700 }}
                                  >
                                    {debit > 0 ? formatCurrency(debit) : "—"}
                                  </td>

                                  <td
                                    className="text-center"
                                    data-label="Credit"
                                    style={{ fontWeight: 700 }}
                                  >
                                    {credit > 0 ? formatCurrency(credit) : "—"}
                                  </td>

                                  <td
                                    className="text-right"
                                    data-label="Balance"
                                    style={{
                                      fontWeight: 700,
                                      color: "#dc2626",
                                    }}
                                  >
                                    {formatCurrency(tx._runningBalance)}
                                  </td>

                                  <td
                                    className="text-center"
                                    data-label="Status"
                                  >
                                    <span
                                      className="status-pill"
                                      style={statusPillStyle(tx.status)}
                                    >
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
                                background: "#f8fafc",
                                borderTop: "2px solid #dbeafe",
                                fontWeight: 700,
                              }}
                            >
                              <td colSpan="3" style={{ textAlign: "right" }}>
                                GROUP TOTALS:
                              </td>
                              <td className="text-center" data-label="Debit Total">
                                {formatCurrency(group.totalDebit)}
                              </td>
                              <td className="text-center" data-label="Credit Total">
                                {formatCurrency(group.totalCredit)}
                              </td>
                              <td
                                className="text-right"
                                style={{ color: "#dc2626" }}
                                data-label="Balance Total"
                              >
                                {formatCurrency(group.balance)}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        </table>
                      </div>
                    </div>
                  ))}
                </div>

                <Pagination
                  currentPage={txPage}
                  totalPages={txTotalPages}
                  onPageChange={setTxPage}
                  totalItems={groupedTransactions.length}
                  itemsPerPage={ITEMS_PER_PAGE}
                />
              </>
            )}
          </section>
        )}

        {!loading && !error && viewMode === "installments" && !isPrinting && (
          <section className="ledger-section">
            <div className="section-header blue-header">
              <i className="bi bi-calendar2-month me-2"></i>Tuition Installment
              Schedule
            </div>

            {tuitionInstallments.length === 0 ? (
              <div
                style={{ textAlign: "center", padding: "2rem", color: "#94a3b8" }}
              >
                No tuition installment information available.
              </div>
            ) : (
              <>
                {paginatedInstallments.map((student, idx) => (
                  <div
                    key={student.student_id || `${student.student_name}-${idx}`}
                    style={{ marginBottom: "2.5rem" }}
                  >
                    <div
                      style={{
                        background: "#f1f5f9",
                        padding: "1.5rem",
                        borderRadius: "0.5rem",
                        marginBottom: "1.5rem",
                        borderLeft: "4px solid #3b82f6",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          justifyContent: "space-between",
                          alignItems: "flex-start",
                          gap: "2rem",
                          flexWrap: "wrap",
                          flexDirection: "row",
                        }}
                      >
                        <div>
                          <h4
                            style={{
                              margin: "0 0 0.5rem 0",
                              color: "#1e293b",
                              fontSize: "1.1rem",
                            }}
                          >
                            📚 {student.student_name}
                          </h4>
                        </div>

                        <div
                          style={{
                            fontSize: "0.85rem",
                            color: "#64748b",
                            textAlign: "right",
                            display: "grid",
                            gridTemplateColumns: "auto auto",
                            gap: "0 1.5rem",
                          }}
                        >
                          <div>Grade:</div>
                          <div>
                            <strong>
                              {gradeLevelLabel(student.grade_level) || "—"}
                            </strong>
                          </div>
                          <div>Mode:</div>
                          <div>
                            <strong>
                              {paymentModeLabel(student.payment_mode) || "—"}
                            </strong>
                          </div>
                          <div>Status:</div>
                          <div>
                            <strong
                              style={{
                                color:
                                  student.overall_status === "PENDING"
                                    ? "#d97706"
                                    : "#16a34a",
                              }}
                            >
                              {student.overall_status || "PENDING"}
                            </strong>
                          </div>
                        </div>
                      </div>
                    </div>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: "1rem",
                        marginBottom: "1.5rem",
                      }}
                      className="tabbed-summary-grid"
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
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            marginBottom: "0.5rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          TF (TUITION FEE)
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: "600",
                            color: "#0284c7",
                          }}
                        >
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
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            marginBottom: "0.5rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          TOTAL PAID
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: "600",
                            color: "#16a34a",
                          }}
                        >
                          {formatCurrency(student.total_paid)}
                        </div>
                      </div>

                      <div
                        style={{
                          background: "#fef2f2",
                          border: "1px solid #fecaca",
                          padding: "1rem",
                          borderRadius: "0.5rem",
                          textAlign: "center",
                        }}
                      >
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "#64748b",
                            marginBottom: "0.5rem",
                            fontWeight: 600,
                            textTransform: "uppercase",
                            letterSpacing: "0.3px",
                          }}
                        >
                          REMAINING BALANCE
                        </div>
                        <div
                          style={{
                            fontSize: "1.25rem",
                            fontWeight: "600",
                            color: "#dc2626",
                          }}
                        >
                          {formatCurrency(student.remaining_balance)}
                        </div>
                      </div>
                    </div>

                    <div className="table-responsive">
                      <table className="ledger-table">
                        <thead>
                          <tr>
                            <th>#</th>
                            <th>Due Date</th>
                            <th>Description</th>
                            <th>Amount Due</th>
                            <th>Amount Paid</th>
                            <th>Balance</th>
                            <th>Status</th>
                          </tr>
                        </thead>

                        <tbody>
                          {(student.installments || []).length > 0 ? (
                            student.installments.map((item, itemIndex) => {
                              const amount_due = Number(item.amount || 0);
                              const amount_paid = item.is_paid ? amount_due : 0;
                              const balance = amount_due - amount_paid;
                              
                              return (
                                <tr
                                  key={item.id || `${student.student_id}-${itemIndex}`}
                                >
                                  <td data-label="Item #">{itemIndex + 1}</td>
                                  <td data-label="Due Date">{item.due_date || "—"}</td>
                                  <td data-label="Description">{item.type || "Installment"}</td>
                                  <td data-label="Amount Due">{formatCurrency(amount_due)}</td>
                                  <td data-label="Amount Paid">{formatCurrency(amount_paid)}</td>
                                  <td data-label="Balance">{formatCurrency(balance)}</td>
                                  <td data-label="Status">
                                    <span
                                      className="status-pill"
                                      style={statusPillStyle(item.status)}
                                    >
                                      {item.status || "PENDING"}
                                    </span>
                                  </td>
                                </tr>
                              );
                            })
                          ) : (
                            <tr>
                              <td
                                colSpan="7"
                                style={{
                                  textAlign: "center",
                                  color: "#94a3b8",
                                  padding: "1.5rem",
                                }}
                              >
                                No installment rows found.
                              </td>
                            </tr>
                          )}
                        </tbody>

                        {(student.installments || []).length > 0 && (
                          <tfoot>
                            <tr
                              style={{
                                background: "#f8fafc",
                                borderTop: "2px solid #dbeafe",
                                fontWeight: 700,
                              }}
                            >
                              <td style={{ textAlign: "left" }}></td>
                              <td style={{ textAlign: "left" }}></td>
                              <td style={{ textAlign: "left" }}>TOTAL:</td>
                              <td style={{ textAlign: "right" }} data-label="Total Due">
                                {formatCurrency(
                                  (student.installments || []).reduce(
                                    (sum, item) => sum + Number(item.amount || 0),
                                    0
                                  )
                                )}
                              </td>
                              <td style={{ textAlign: "right" }} data-label="Total Paid">
                                {formatCurrency(
                                  (student.installments || []).reduce(
                                    (sum, item) => 
                                      sum + (item.is_paid ? Number(item.amount || 0) : 0),
                                    0
                                  )
                                )}
                              </td>
                              <td style={{ textAlign: "right", color: "#dc2626" }} data-label="Total Balance">
                                {formatCurrency(
                                  (student.installments || []).reduce(
                                    (sum, item) => 
                                      sum + (item.is_paid ? 0 : Number(item.amount || 0)),
                                    0
                                  )
                                )}
                              </td>
                              <td></td>
                            </tr>
                          </tfoot>
                        )}
                      </table>
                    </div>
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

        {/* Print Area */}
        {isPrinting && (
          <section className="ledger-print-area">
            <div className="ledger-print-header">
              <h2 className="ledger-print-title">Account & Financial Ledger</h2>
              <p className="ledger-print-subtitle">Complete Financial Transaction History</p>
            </div>
            
            {viewMode === "transactions" && (
              <div className="ledger-print-content">
                <div className="ledger-print-section">
                  <h3 className="ledger-print-section-title">Account Ledger Details</h3>
                  {groupedTransactions.length === 0 ? (
                    <p style={{ marginTop: "1rem", color: "#64748b" }}>No transactions to display.</p>
                  ) : (
                    groupedTransactions.map((group) => (
                      <div key={group.key} className="ledger-print-group">
                        <h4 className="ledger-print-group-title">
                          {buildLedgerGroupTitle(group) || "Ledger Record"}
                        </h4>
                        <div className="ledger-print-group-info">
                          <div><strong>Semester:</strong> {group.semester || "—"}</div>
                          <div><strong>Total Billed:</strong> {formatCurrency(group.totalDebit)}</div>
                          <div><strong>Total Paid:</strong> {formatCurrency(group.totalCredit)}</div>
                          <div><strong>Balance:</strong> {formatCurrency(group.balance)}</div>
                        </div>
                        <table className="ledger-print-table">
                          <thead>
                            <tr>
                              <th>Date</th>
                              <th>Reference</th>
                              <th>Description</th>
                              <th>Debit</th>
                              <th>Credit</th>
                              <th>Balance</th>
                              <th>Status</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((tx) => (
                              <tr key={tx.id}>
                                <td>{tx.transaction_date || "—"}</td>
                                <td>{tx.reference_number || tx.id || "—"}</td>
                                <td>{ITEM_LABELS[tx.item] || tx.item || "Entry"}</td>
                                <td style={{ textAlign: "right" }}>
                                  {Number(tx.debit || 0) > 0 ? formatCurrency(tx.debit) : "—"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {Number(tx.credit || 0) > 0 ? formatCurrency(tx.credit) : "—"}
                                </td>
                                <td style={{ textAlign: "right" }}>
                                  {formatCurrency(tx._runningBalance)}
                                </td>
                                <td style={{ textAlign: "center" }}>{tx.status || "—"}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  )}
                </div>
              </div>
            )}

            {viewMode === "installments" && (
              <div className="ledger-print-content">
                <div className="ledger-print-section">
                  <h3 className="ledger-print-section-title">Tuition Installment Schedule</h3>
                  {tuitionInstallments.length === 0 ? (
                    <p style={{ marginTop: "1rem", color: "#64748b" }}>No installment information available.</p>
                  ) : (
                    <table className="ledger-print-table">
                      <thead>
                        <tr>
                          <th>Installment</th>
                          <th>Due Date</th>
                          <th>Amount</th>
                          <th>Status</th>
                          <th>Date Paid</th>
                        </tr>
                      </thead>
                      <tbody>
                        {tuitionInstallments.flatMap((student) =>
                          (student.installments || []).map((inst, idx) => (
                            <tr key={`${student.student_id}-${idx}`}>
                              <td>{inst.installment_number ? `Installment ${inst.installment_number}` : `Installment ${idx + 1}`}</td>
                              <td>{inst.due_date || "—"}</td>
                              <td style={{ textAlign: "right" }}>{formatCurrency(inst.amount)}</td>
                              <td>{inst.is_paid ? "Paid" : "Pending"}</td>
                              <td>{inst.date_paid || "—"}</td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  )}
                </div>
              </div>
            )}

            <div className="ledger-print-footer">
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                Document Generated: {new Date().toLocaleString()}
              </p>
            </div>
          </section>
        )}
      </div>

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title="Account & Financial Ledger - Preview"
        customPreview={
          <div style={{ padding: "2rem", background: "white" }}>
            <div style={{ textAlign: "center", marginBottom: "2rem", paddingBottom: "1rem", borderBottom: "2px solid #1e293b" }}>
              <h2 style={{ fontSize: "1.75rem", fontWeight: 800, color: "#1e293b", margin: "0 0 0.5rem 0", textTransform: "uppercase", letterSpacing: "0.05em" }}>
                Account & Financial Ledger
              </h2>
              <p style={{ fontSize: "0.95rem", color: "#64748b", margin: 0 }}>
                Complete Financial Transaction History
              </p>
            </div>

            {viewMode === "transactions" && (
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", margin: "1rem 0 1.5rem 0", paddingBottom: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>
                  Account Ledger Details
                </h3>
                {groupedTransactions.length === 0 ? (
                  <p style={{ marginTop: "1rem", color: "#64748b" }}>No transactions to display.</p>
                ) : (
                  groupedTransactions.map((group) => (
                    <div key={group.key} style={{ marginBottom: "2.5rem", pageBreakInside: "avoid" }}>
                      <h4 style={{ fontSize: "1rem", fontWeight: 700, color: "#1d4ed8", margin: "0 0 1rem 0" }}>
                        {buildLedgerGroupTitle(group) || "Ledger Record"}
                      </h4>
                      <div style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: "1rem", marginBottom: "1.5rem", padding: "1rem", background: "#f8fafc", borderRadius: "0.5rem", fontSize: "0.9rem" }}>
                        <div><strong>Semester:</strong> {group.semester || "—"}</div>
                        <div><strong>Total Billed:</strong> {formatCurrency(group.totalDebit)}</div>
                        <div><strong>Total Paid:</strong> {formatCurrency(group.totalCredit)}</div>
                        <div><strong>Balance:</strong> {formatCurrency(group.balance)}</div>
                      </div>
                      <table style={{ width: "100%", borderCollapse: "collapse", margin: "1rem 0", fontSize: "0.9rem" }}>
                        <thead style={{ background: "#f1f5f9" }}>
                          <tr>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Date</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Reference</th>
                            <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Description</th>
                            <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Debit</th>
                            <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Credit</th>
                            <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Balance</th>
                            <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem", letterSpacing: "0.05em" }}>Status</th>
                          </tr>
                        </thead>
                        <tbody>
                          {group.rows.map((tx) => (
                            <tr key={tx.id} style={{ borderBottom: "1px solid #e2e8f0" }}>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b" }}>{tx.transaction_date || "—"}</td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b" }}>{tx.reference_number || tx.id || "—"}</td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b" }}>{ITEM_LABELS[tx.item] || tx.item || "Entry"}</td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "right" }}>
                                {Number(tx.debit || 0) > 0 ? formatCurrency(tx.debit) : "—"}
                              </td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "right" }}>
                                {Number(tx.credit || 0) > 0 ? formatCurrency(tx.credit) : "—"}
                              </td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "right" }}>
                                {formatCurrency(tx._runningBalance)}
                              </td>
                              <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "center" }}>{tx.status || "—"}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ))
                )}
              </div>
            )}

            {viewMode === "installments" && (
              <div>
                <h3 style={{ fontSize: "1.25rem", fontWeight: 700, color: "#1e293b", margin: "1rem 0 1.5rem 0", paddingBottom: "0.5rem", borderBottom: "1px solid #e2e8f0" }}>
                  Tuition Installment Schedule
                </h3>
                {tuitionInstallments.length === 0 ? (
                  <p style={{ marginTop: "1rem", color: "#64748b" }}>No installment information available.</p>
                ) : (
                  <table style={{ width: "100%", borderCollapse: "collapse", margin: "1rem 0", fontSize: "0.9rem" }}>
                    <thead style={{ background: "#f1f5f9" }}>
                      <tr>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem" }}>Installment</th>
                        <th style={{ padding: "0.75rem", textAlign: "left", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem" }}>Due Date</th>
                        <th style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem" }}>Amount</th>
                        <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem" }}>Status</th>
                        <th style={{ padding: "0.75rem", textAlign: "center", fontWeight: 700, color: "#1e293b", border: "1px solid #cbd5e1", textTransform: "uppercase", fontSize: "0.8rem" }}>Date Paid</th>
                      </tr>
                    </thead>
                    <tbody>
                      {tuitionInstallments.flatMap((student) =>
                        (student.installments || []).map((inst, idx) => (
                          <tr key={`${student.student_id}-${idx}`} style={{ borderBottom: "1px solid #e2e8f0" }}>
                            <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b" }}>{inst.installment_number ? `Installment ${inst.installment_number}` : `Installment ${idx + 1}`}</td>
                            <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b" }}>{inst.due_date || "—"}</td>
                            <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "right" }}>{formatCurrency(inst.amount)}</td>
                            <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "center" }}>{inst.is_paid ? "Paid" : "Pending"}</td>
                            <td style={{ padding: "0.75rem", border: "1px solid #e2e8f0", color: "#1e293b", textAlign: "center" }}>{inst.date_paid || "—"}</td>
                          </tr>
                        ))
                      )}
                    </tbody>
                  </table>
                )}
              </div>
            )}

            <div style={{ textAlign: "center", marginTop: "3rem", paddingTop: "1rem", borderTop: "1px solid #e2e8f0" }}>
              <p style={{ fontSize: "0.75rem", color: "#64748b", margin: 0 }}>
                Document Generated: {new Date().toLocaleString()}
              </p>
            </div>
          </div>
        }
      />
    </div>
  );
}