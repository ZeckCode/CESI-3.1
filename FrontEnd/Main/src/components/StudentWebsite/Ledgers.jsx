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
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [currentPage, setCurrentPage] = useState(1);

  useEffect(() => {
    const fetchMyTransactions = async () => {
      try {
        const res = await apiFetch(`${API_BASE}/api/finance/my-transactions/`);
        if (!res.ok) throw new Error("Failed to load transactions");
        const data = await res.json();
        setTransactions(Array.isArray(data) ? data : []);
      } catch (err) {
        console.error("Ledger fetch error:", err);
        setError(err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMyTransactions();
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
          <h2 className="title-text">
            <i className="bi bi-clock-history me-2"></i>Transaction History
          </h2>
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

      {!loading && !error && (
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
    </div>
  );
};

export default Ledgers;
