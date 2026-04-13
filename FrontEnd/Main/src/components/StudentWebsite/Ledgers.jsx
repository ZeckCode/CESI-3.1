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
    ADVANCE: "Advance Credit",
    REFUND: "Refund",
    ADVANCE_APPLIED: "Advance Applied",
    ADVANCE_TRANSFER_OUT: "Advance Transfer Out",
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

  const getGroupStatus = (group) => {
    if (Number(group.payableBalance || 0) <= 0) return "PAID";
    if (Number(group.totalCredit || 0) > 0) return "PARTIAL";
    return "POSTED";
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

    const [showRequestModal, setShowRequestModal] = useState(false);
    const [requestSubmitting, setRequestSubmitting] = useState(false);
    const [requestError, setRequestError] = useState("");
    const [selectedRequestGroup, setSelectedRequestGroup] = useState(null);
    const [requestForm, setRequestForm] = useState({
      request_type: "APPLY_ADVANCE",
      amount: "",
      reason: "",
      enrollment: "",
    });

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
        transactions.filter((tx) => tx.transaction_type !== "CONTRIBUTION"),
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

          // Sum totals first
          sortedRows.forEach((tx) => {
            totalDebit += Number(tx.debit || 0);
            totalCredit += Number(tx.credit || 0);
          });

          // Determine earliest posted date (fallback to transaction_date) and its reference
          let earliestPost = null;
          let earliestTx = null;
          sortedRows.forEach((tx) => {
            const post = tx.date_post || tx.date_posted || tx.transaction_date || null;
            if (!post) return;
            const d = new Date(`${post}T00:00:00`);
            if (Number.isNaN(d.getTime())) return;
            if (earliestPost === null || d < earliestPost) {
              earliestPost = d;
              earliestTx = tx;
            }
          });

          const aggregatedRows = [];

          if (totalDebit > 0) {
            runningBalance += totalDebit;
            aggregatedRows.push({
              id: `agg-debit-${group.key}`,
              // use earliest posted date if available, otherwise use latest_date
              transaction_date: earliestPost ? earliestPost.toISOString().slice(0, 10) : (group.latest_date || "-"),
              reference_number: earliestTx ? (earliestTx.reference_number || "-") : "-",
              item: "Charges",
              transaction_type: "TUITION",
              entry_type: "DEBIT",
              debit: totalDebit,
              credit: 0,
              description: "Consolidated tuition charges",
              due_date: earliestPost ? earliestPost.toISOString().slice(0, 10) : undefined,
              _runningBalance: runningBalance,
            });
          }

          if (totalCredit > 0) {
            runningBalance -= totalCredit;
            aggregatedRows.push({
              id: `agg-credit-${group.key}`,
              transaction_date: earliestPost ? earliestPost.toISOString().slice(0, 10) : (group.latest_date || "-"),
              reference_number: earliestTx ? (earliestTx.reference_number || "-") : "-",
              item: "Payments",
              transaction_type: "PAYMENT",
              entry_type: "CREDIT",
              debit: 0,
              credit: totalCredit,
              description: "Consolidated payments/credits",
              due_date: earliestPost ? earliestPost.toISOString().slice(0, 10) : undefined,
              _runningBalance: runningBalance,
            });
          }

          const rawBalance = runningBalance;
          const payableBalance = rawBalance > 0 ? rawBalance : 0;
          const advanceAvailable = rawBalance < 0 ? Math.abs(rawBalance) : 0;
          const groupStatus =
            payableBalance <= 0 ? "PAID" : totalCredit > 0 ? "PARTIAL" : "POSTED";

          return {
            ...group,
            rows: aggregatedRows,
            totalDebit,
            totalCredit,
            balance: payableBalance,
            rawBalance,
            payableBalance,
            advanceAvailable,
            groupStatus,
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

    const openRequestModal = (group, requestType) => {
      setSelectedRequestGroup(group);
      setRequestError("");
      setRequestForm({
        request_type: requestType,
        amount: String(Number(group.advanceAvailable || 0)),
        reason: "",
        enrollment: group.enrollment_id || "",
      });
      setShowRequestModal(true);
    };

    const handleRequestFormChange = (e) => {
      const { name, value } = e.target;
      setRequestForm((prev) => ({ ...prev, [name]: value }));
    };

    const submitAdvanceRequest = async (e) => {
      e.preventDefault();
      setRequestError("");

      if (!requestForm.amount || Number(requestForm.amount) <= 0) {
        setRequestError("Please enter a valid amount.");
        return;
      }

      setRequestSubmitting(true);
      try {
        const res = await apiFetch("/api/finance/my-advance-requests/", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            request_type: requestForm.request_type,
            amount: Number(requestForm.amount),
            reason: requestForm.reason,
            enrollment: requestForm.enrollment || null,
          }),
        });

        const data = await res.json().catch(() => ({}));
        if (!res.ok) {
          throw new Error(data.detail || "Failed to submit request.");
        }

        alert("Request submitted successfully.");
        setShowRequestModal(false);
        setSelectedRequestGroup(null);
      } catch (err) {
        setRequestError(err.message || "Failed to submit request.");
      } finally {
        setRequestSubmitting(false);
      }
    };

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
                  <h2 className="ledger-section-title">Tuition Ledger</h2>
                  <p className="ledger-section-subtitle">Complete tuition transaction history</p>
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
                  Current Registration 
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

              <div className="ledger-sumCard ledger-sumCard--info">
                <div className="ledger-sumCard__label">Advance Available</div>
                <div className="ledger-sumCard__value">
                  {formatCurrency(summary?.advance_available || 0)}
                </div>
                <div className="ledger-sumCard__sub">
                  {Number(summary?.advance_available || 0) > 0
                    ? "Available for refund or future use"
                    : "No available advance"}
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
                <strong style={{ color: "#1e293b" }}>Tuition History Format:</strong> Charges
                appear under <strong>Debit</strong>, payments appear under{" "}
                <strong>Credit</strong>, and the <strong>Balance</strong> column
                shows the running tuition balance for each entry.
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
                              gridTemplateColumns: "repeat(auto-fit, minmax(160px, 1fr))",
                              gap: "1rem",
                              fontSize: "0.82rem",
                              color: "#64748b",
                            }}
                            className="ledger-group-info"
                          >
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Total Billed</div>
                              <div style={{ fontWeight: 700, color: "#1e293b" }}>{formatCurrency(group.totalDebit)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Total Paid</div>
                              <div style={{ fontWeight: 700, color: "#16a34a" }}>{formatCurrency(group.totalCredit)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Payable Balance</div>
                              <div style={{ fontWeight: 700, color: group.payableBalance > 0 ? "#dc2626" : "#16a34a" }}>{formatCurrency(group.payableBalance)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Advance Available</div>
                              <div style={{ fontWeight: 700, color: group.advanceAvailable > 0 ? "#1d4ed8" : "#1e293b" }}>{formatCurrency(group.advanceAvailable)}</div>
                            </div>
                            <div>
                              <div style={{ fontSize: "0.7rem", color: "#94a3b8", marginBottom: "0.25rem", textTransform: "uppercase", fontWeight: 600 }}>Status</div>
                              <div>
                                <span
                                  className="status-pill"
                                  style={statusPillStyle(getGroupStatus(group))}
                                >
                                  {getGroupStatus(group)}
                                </span>
                                {group.advanceAvailable > 0 ? (
                                  <span
                                    className="status-pill"
                                    style={{
                                      background: "#dbeafe",
                                      color: "#1d4ed8",
                                      marginLeft: "0.5rem",
                                    }}
                                  >
                                    ADVANCE {formatCurrency(group.advanceAvailable)}
                                  </span>
                                ) : null}
                              </div>
                            </div>
                          </div>

                          {group.advanceAvailable > 0 && (
                            <div
                              style={{
                                marginTop: "1rem",
                                display: "flex",
                                gap: "0.75rem",
                                flexWrap: "wrap",
                              }}
                            >
                              <button
                                type="button"
                                className="ledger-btn-print"
                                onClick={() => openRequestModal(group, "APPLY_ADVANCE")}
                              >
                                Request Apply Advance
                              </button>

                              <button
                                type="button"
                                className="ledger-btn-print"
                                onClick={() => openRequestModal(group, "REFUND")}
                              >
                                Request Refund
                              </button>
                            </div>
                          )}
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
                                        color: Number(tx._runningBalance) > 0 ? "#dc2626" : "#16a34a",
                                      }}
                                    >
                                      {formatCurrency(tx._runningBalance)}
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
                                  style={{ color: group.payableBalance > 0 ? "#dc2626" : "#16a34a" }}
                                  data-label="Balance Total"
                                >
                                  {formatCurrency(group.payableBalance)}
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
                              <th>Reference</th>
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
                              const amount_paid = Number(item.amount_paid || 0);
                              const balance = Number(item.balance || 0);

                              return (
                                <tr key={item.id || `${student.student_id}-${itemIndex}`}>
                                  <td data-label="Item #">{itemIndex + 1}</td>
                                  <td data-label="Due Date">{item.due_date || "—"}</td>
                                  <td data-label="Reference">
                                    {item.reference_number ||
                                      (Array.isArray(item.reference_numbers) && item.reference_numbers.length > 1
                                        ? item.reference_numbers.join(", ")
                                        : "—")}
                                  </td>
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
                                colSpan="8"
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
                                <td style={{ textAlign: "left" }}></td>
                                <td style={{ textAlign: "right" }}>TOTAL:</td>
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
                                        sum + Number(item.amount_paid || 0),
                                      0
                                    )
                                  )}
                                </td>
                                <td style={{ textAlign: "right", color: "#dc2626" }} data-label="Total Balance">
                                  {formatCurrency(
                                    (student.installments || []).reduce(
                                      (sum, item) =>
                                        sum + (Number(item.amount || 0) - Number(item.amount_paid || 0)),
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
                            <div><strong>Total Billed:</strong> {formatCurrency(group.totalDebit)}</div>
                            <div><strong>Total Paid:</strong> {formatCurrency(group.totalCredit)}</div>
                            <div><strong>Payable Balance:</strong> {formatCurrency(group.payableBalance)}</div>
                            <div><strong>Advance Available:</strong> {formatCurrency(group.advanceAvailable)}</div>
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

        {showRequestModal && (
          <div className="th-modal-overlay" onClick={() => setShowRequestModal(false)}>
            <div className="th-modal" onClick={(e) => e.stopPropagation()}>
              <div className="th-modal-header">
                <h3>
                  {requestForm.request_type === "REFUND"
                    ? "Request Refund"
                    : "Request Apply Advance"}
                </h3>
                <button
                  className="th-modal-close"
                  onClick={() => setShowRequestModal(false)}
                >
                  ×
                </button>
              </div>

              <form className="th-modal-form" onSubmit={submitAdvanceRequest}>
                {requestError && <div className="th-form-error">{requestError}</div>}

                <div className="th-form-group">
                  <label>Enrollment</label>
                  <input
                    type="text"
                    value={
                      selectedRequestGroup?.enrollment_id
                        ? `#${selectedRequestGroup.enrollment_id}`
                        : "—"
                    }
                    className="th-form-input"
                    readOnly
                  />
                </div>

                <div className="th-form-group">
                  <label>Available Advance</label>
                  <input
                    type="text"
                    value={formatCurrency(selectedRequestGroup?.advanceAvailable || 0)}
                    className="th-form-input"
                    readOnly
                  />
                </div>

                <div className="th-form-group">
                  <label>Requested Amount</label>
                  <input
                    type="number"
                    name="amount"
                    step="0.01"
                    min="0"
                    value={requestForm.amount}
                    onChange={handleRequestFormChange}
                    className="th-form-input"
                  />
                </div>

                <div className="th-form-group">
                  <label>Reason / Note</label>
                  <textarea
                    name="reason"
                    rows="3"
                    value={requestForm.reason}
                    onChange={handleRequestFormChange}
                    className="th-form-input"
                    placeholder="Optional note..."
                  />
                </div>

                <div className="th-modal-footer">
                  <button
                    type="button"
                    className="th-btn-cancel"
                    onClick={() => setShowRequestModal(false)}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    className="th-btn-success"
                    disabled={requestSubmitting}
                  >
                    {requestSubmitting ? "Submitting..." : "Submit Request"}
                  </button>
                </div>
              </form>
            </div>
          </div>
        )}

        <PreviewModal
          isOpen={showPreview}
          onClose={() => setShowPreview(false)}
          title="Account & Financial Ledger"
          customPreview={
            <div
              style={{
                padding: "1.5rem",
                fontSize: "0.9rem",
                lineHeight: "1.6",
                color: "#1e293b",
              }}
              data-preview-type={viewMode}
            >
              {viewMode === "transactions" ? (
                <div data-transactions-preview="true">
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "1.5rem",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                    }}
                  >
                    Account Ledger Details
                  </h3>
                  {paginatedTransactions.length > 0 ? (
                    paginatedTransactions.map((group) => (
                      <div
                        key={group.key}
                        style={{
                          marginBottom: "2rem",
                          paddingBottom: "1.5rem",
                          borderBottom: "1px solid #e2e8f0",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: 700,
                            color: "#1d4ed8",
                            marginBottom: "1rem",
                          }}
                        >
                          {buildLedgerGroupTitle(group) || "Ledger Record"}
                        </div>
                        <div
                          style={{
                            display: "grid",
                            gridTemplateColumns:
                              "repeat(auto-fit, minmax(180px, 1fr))",
                            gap: "0.75rem",
                            marginBottom: "1rem",
                            fontSize: "0.85rem",
                            padding: "0.75rem",
                            background: "#f8fafc",
                            borderRadius: "0.5rem",
                          }}
                        >
                          <div><strong>Total Billed:</strong> {formatCurrency(group.totalDebit)}</div>
                          <div><strong>Total Paid:</strong> {formatCurrency(group.totalCredit)}</div>
                          <div><strong>Payable Balance:</strong> {formatCurrency(group.payableBalance)}</div>
                          <div><strong>Advance Available:</strong> {formatCurrency(group.advanceAvailable)}</div>
                        </div>
                        <table
                          style={{
                            width: "100%",
                            borderCollapse: "collapse",
                            fontSize: "0.8rem",
                          }}
                        >
                          <thead>
                            <tr
                              style={{
                                borderBottom: "2px solid #1d4ed8",
                                background: "#f0f9ff",
                              }}
                            >
                              <th style={{ padding: "0.5rem", textAlign: "left" }}>Date</th>
                              <th style={{ padding: "0.5rem", textAlign: "left" }}>Description</th>
                              <th style={{ padding: "0.5rem", textAlign: "right" }}>Debit</th>
                              <th style={{ padding: "0.5rem", textAlign: "right" }}>Credit</th>
                              <th style={{ padding: "0.5rem", textAlign: "right" }}>Balance</th>
                            </tr>
                          </thead>
                          <tbody>
                            {group.rows.map((tx, idx) => (
                              <tr
                                key={tx.id}
                                style={{
                                  borderBottom: "1px solid #e2e8f0",
                                  background: idx % 2 === 0 ? "#ffffff" : "#f8fafc",
                                }}
                              >
                                <td style={{ padding: "0.5rem" }}>{tx.transaction_date || "—"}</td>
                                <td style={{ padding: "0.5rem" }}>{ITEM_LABELS[tx.item] || tx.item || "Entry"}</td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                  {tx.debit ? formatCurrency(tx.debit) : "—"}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right" }}>
                                  {tx.credit ? formatCurrency(tx.credit) : "—"}
                                </td>
                                <td style={{ padding: "0.5rem", textAlign: "right", fontWeight: 700 }}>
                                  {formatCurrency(tx._runningBalance)}
                                </td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ))
                  ) : (
                    <p style={{ color: "#64748b" }}>No transactions to display.</p>
                  )}
                </div>
              ) : (
                <div data-installments-preview="true">
                  <h3
                    style={{
                      marginTop: 0,
                      marginBottom: "1.5rem",
                      fontSize: "1.1rem",
                      fontWeight: 700,
                    }}
                  >
                    Tuition Installment Schedule
                  </h3>
                  {paginatedInstallments.length > 0 ? (
                    <table
                      style={{
                        width: "100%",
                        borderCollapse: "collapse",
                        fontSize: "0.85rem",
                      }}
                    >
                      <thead>
                        <tr
                          style={{
                            borderBottom: "2px solid #16a34a",
                            background: "#f0fdf4",
                          }}
                        >
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Student</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Installment</th>
                          <th style={{ padding: "0.75rem", textAlign: "left" }}>Due Date</th>
                          <th style={{ padding: "0.75rem", textAlign: "right" }}>Amount</th>
                          <th style={{ padding: "0.75rem", textAlign: "center" }}>Status</th>
                        </tr>
                      </thead>
                      <tbody>
                        {paginatedInstallments.map((student, sidx) =>
                          (student.installments || []).map((inst, iidx) => (
                            <tr
                              key={`${student.student_id || sidx}-${iidx}`}
                              style={{
                                borderBottom: "1px solid #e2e8f0",
                                background: iidx % 2 === 0 ? "#ffffff" : "#f9fdf6",
                              }}
                            >
                              <td style={{ padding: "0.75rem" }}>{student.student_name || "—"}</td>
                              <td style={{ padding: "0.75rem" }}>
                                Installment {inst.installment_number || iidx + 1}
                              </td>
                              <td style={{ padding: "0.75rem" }}>{inst.due_date || "—"}</td>
                              <td style={{ padding: "0.75rem", textAlign: "right", fontWeight: 700 }}>
                                {formatCurrency(inst.amount)}
                              </td>
                              <td style={{ padding: "0.75rem", textAlign: "center" }}>
                                <span
                                  style={{
                                    padding: "0.25rem 0.5rem",
                                    borderRadius: "0.25rem",
                                    fontSize: "0.75rem",
                                    fontWeight: 600,
                                    background: inst.is_paid ? "#dcfce7" : "#fef3c7",
                                    color: inst.is_paid ? "#166534" : "#b45309",
                                  }}
                                >
                                  {inst.is_paid ? "Paid" : "Pending"}
                                </span>
                              </td>
                            </tr>
                          ))
                        )}
                      </tbody>
                    </table>
                  ) : (
                    <p style={{ color: "#64748b" }}>No installment information available.</p>
                  )}
                </div>
              )}
              <div
                style={{
                  marginTop: "1.5rem",
                  paddingTop: "1rem",
                  borderTop: "1px solid #e2e8f0",
                  fontSize: "0.75rem",
                  color: "#64748b",
                }}
              >
                Document Generated: {new Date().toLocaleString()}
              </div>
            </div>
          }
        />
      </div>
    );
  }