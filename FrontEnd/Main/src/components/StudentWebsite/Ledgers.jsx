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
    setIsPrinting(true);

    setTimeout(() => {
      window.print();
      setTimeout(() => setIsPrinting(false), 300);
    }, 150);
  };

  return (
    <div className="ledger-wrapper">
      <div className="ledger-content">
        {!isPrinting && (
          <>
            <header className="ledger-header-flex">
              <div className="header-title-area">
                <div>
                  <h2 className="title-text">Ledger</h2>
                  <p style={{ margin: 0, color: "#64748b", fontSize: "0.95rem" }}>
                    View tuition and payment ledger.
                  </p>
                </div>
              </div>

              <div className="header-actions">
                <button
                  type="button"
                  className="btn-action btn-print"
                  onClick={handlePrint}
                >
                  Print
                </button>
              </div>
            </header>

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
            Loading ledger...
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
                            marginBottom: "0.4rem",
                          }}
                        >
                          {buildLedgerGroupTitle(group) || "Ledger Record"}
                        </div>

                        <div
                          style={{
                            display: "flex",
                            flexWrap: "wrap",
                            gap: "0.85rem",
                            fontSize: "0.82rem",
                            color: "#64748b",
                          }}
                        >
                          <span>
                            Semester: <strong>{group.semester || "—"}</strong>
                          </span>
                          <span>
                            Total Billed:{" "}
                            <strong>{formatCurrency(group.totalDebit)}</strong>
                          </span>
                          <span>
                            Total Paid:{" "}
                            <strong>{formatCurrency(group.totalCredit)}</strong>
                          </span>
                          <span>
                            Balance: <strong>{formatCurrency(group.balance)}</strong>
                          </span>
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
                              <td className="text-center">
                                {formatCurrency(group.totalDebit)}
                              </td>
                              <td className="text-center">
                                {formatCurrency(group.totalCredit)}
                              </td>
                              <td
                                className="text-right"
                                style={{ color: "#dc2626" }}
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
                          }}
                        >
                          <div>
                            Grade:{" "}
                            <strong>
                              {gradeLevelLabel(student.grade_level) || "—"}
                            </strong>
                          </div>
                          <div>
                            Mode:{" "}
                            <strong>
                              {paymentModeLabel(student.payment_mode) || "—"}
                            </strong>
                          </div>
                          <div>
                            Status:{" "}
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
                            student.installments.map((item, itemIndex) => (
                              <tr
                                key={item.id || `${student.student_id}-${itemIndex}`}
                              >
                                <td>{item.installment_number || itemIndex + 1}</td>
                                <td>{item.due_date || "—"}</td>
                                <td>{item.description || "Installment"}</td>
                                <td>{formatCurrency(item.amount_due)}</td>
                                <td>{formatCurrency(item.amount_paid)}</td>
                                <td>{formatCurrency(item.balance)}</td>
                                <td>
                                  <span
                                    className="status-pill"
                                    style={statusPillStyle(item.status)}
                                  >
                                    {item.status || "PENDING"}
                                  </span>
                                </td>
                              </tr>
                            ))
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
      </div>
    </div>
  );
}