import React, { useState, useEffect } from "react";
import { apiFetch } from "../api/apiFetch";
import "../AdminWebsiteCSS/AdminProofOfPayment.css";
import { Check, X, Eye, XCircle } from "lucide-react";

const formatFullName = (...parts) =>
  parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(" ");

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

const statusPillStyle = (status) => {
  const normalized = String(status || "").toLowerCase();

  if (normalized === "approved") {
    return { background: "#dcfce7", color: "#166534" };
  }
  if (normalized === "rejected") {
    return { background: "#fee2e2", color: "#b91c1c" };
  }
  if (normalized === "pending") {
    return { background: "#fef3c7", color: "#b45309" };
  }
  return { background: "#e2e8f0", color: "#334155" };
};

const billTypeLabel = (value) => {
  const map = {
    PAYMENT: "General Payment",
    INITIAL: "Initial Payment",
    MONTHLY: "Monthly Installment",
    MISC: "Miscellaneous",
    REGISTRATION: "Registration",
    ASSESSMENT: "Assessment",
    OTHER: "Other",
  };
  return map[value] || value || "—";
};

export default function AdminProofOfPayment() {
  const SKELETON_ROWS = 6;
  const SKELETON_COLS = 8;
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState("");
  const [imageOverlay, setImageOverlay] = useState(null);

  useEffect(() => {
    fetchPayments();
  }, []);

  const fetchPayments = async () => {
    try {
      setLoading(true);
      const response = await apiFetch("/api/finance/proof-of-payments/");

      if (!response.ok) {
        throw new Error("Failed to fetch payment proofs");
      }

      const data = await response.json();

      const transformedData = (Array.isArray(data) ? data : []).map((payment) => {
        const isEnrollmentPayment =
          payment.payment_type === "enrollment" ||
          payment.description?.toLowerCase().includes("enrollment initial payment") ||
          payment.source === "enrollment_form";

        let formatted_description = payment.description;

        if (isEnrollmentPayment) {
          const studentName = getStudentDisplayName(payment);
          formatted_description = `Enrollment Initial Payment - ${studentName}`;
        }

        return {
          ...payment,
          formatted_description,
          is_enrollment_payment: isEnrollmentPayment,
          original_description: payment.description,
        };
      });

      setPayments(transformedData);
    } catch (err) {
      console.error("Error fetching payments:", err);
      setError(err.message || "Failed to load payment proofs");
    } finally {
      setLoading(false);
    }
  };

  const getStudentDisplayName = (payment) => {
    if (payment.student_name) {
      return payment.student_name;
    }

    if (payment.user_details) {
      const profile = payment.user_details?.profile || {};
      const enrollment = payment.user_details?.enrollment || {};
      const name = formatFullName(
        profile.student_first_name || enrollment.first_name,
        profile.student_middle_name || enrollment.middle_name,
        profile.student_last_name || enrollment.last_name
      );
      if (name) return name;
      return payment.user_details?.username || payment.user || "Unknown";
    }

    if (payment.user_username) return payment.user_username;
    if (payment.user_name) return payment.user_name;

    return `Student ${payment.user || payment.id}`;
  };

  const openActionModal = (payment, action) => {
    setSelectedPayment(payment);
    setActionType(action);
    setRemarks("");
    setShowModal(true);
  };

  const handleAction = async () => {
    if (!selectedPayment) return;

    try {
      const endpoint = `/api/finance/proof-of-payments/${selectedPayment.id}/${actionType}/`;

      const response = await apiFetch(endpoint, {
        method: "PATCH",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ remarks }),
      });

      const data = await response.json().catch(() => ({}));

      if (!response.ok) {
        throw new Error(
          data.detail || data.message || `Failed to ${actionType} payment proof`
        );
      }

      setSuccess(data.message || `Payment proof ${actionType}d successfully!`);
      setShowModal(false);
      setSelectedPayment(null);
      fetchPayments();

      setTimeout(() => setSuccess(null), 3000);
    } catch (err) {
      console.error("Error updating payment:", err);
      setError(err.message || `Failed to ${actionType} payment proof`);
      setTimeout(() => setError(null), 3000);
    }
  };

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    const date = new Date(dateString);
    return date.toLocaleDateString("en-PH", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${process.env.REACT_APP_API_URL || ""}${imagePath}`;
  };

  const openImageOverlay = (imageUrl) => {
    setImageOverlay(imageUrl);
  };

  const closeImageOverlay = () => {
    setImageOverlay(null);
  };

  const renderSkeletonRows = () =>
    Array.from({ length: SKELETON_ROWS }).map((_, rowIdx) => (
      <tr key={`payment-skeleton-row-${rowIdx}`}>
        {Array.from({ length: SKELETON_COLS }).map((__, colIdx) => (
          <td key={`payment-skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`admin-proof-skeleton-line ${
                colIdx === 0 ? "w-lg" : colIdx === SKELETON_COLS - 1 ? "w-sm" : "w-md"
              }`}
            />
          </td>
        ))}
      </tr>
    ));

  return (
    <div className="admin-proof-wrapper">
      <div className="admin-proof-content">
        {error && <div className="admin-proof-error">{error}</div>}
        {success && <div className="admin-proof-success">{success}</div>}

        {loading ? (
          <div className="admin-proof-table-wrapper">
            <div className="admin-proof-table-container admin-proof-table-container--skeleton">
              <div className="admin-proof-table-scroll-hint">Loading submissions...</div>
              <table className="admin-proof-table admin-proof-table--skeleton" aria-hidden="true">
                <thead>
                  <tr>
                    {Array.from({ length: SKELETON_COLS }).map((_, idx) => (
                      <th key={`payment-skeleton-head-${idx}`}>
                        <div className="admin-proof-skeleton-line admin-proof-skeleton-head" />
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>{renderSkeletonRows()}</tbody>
              </table>
            </div>
          </div>
        ) : payments.length === 0 ? (
          <div className="admin-proof-empty">
            <p>No proof of payment submissions found.</p>
          </div>
        ) : (
          <div className="admin-proof-table-wrapper">
            <div className="admin-proof-table-container">
              <div className="admin-proof-table-scroll-hint">← Swipe to scroll →</div>
              <table className="admin-proof-table">
                <thead>
                  <tr>
                    <th>Reference Number</th>
                    <th>Student</th>
                    <th>Amount</th>
                    <th>Bill Type</th>
                    <th>Type</th>
                    <th>Submitted Date</th>
                    <th>Status</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {payments.map((payment) => (
                    <tr key={payment.id}>
                    <td data-label="Reference Number">{payment.reference_number}</td>
                    <td data-label="Student">
                      <div className="admin-proof-student-name">
                        {getStudentDisplayName(payment)}
                      </div>
                      {payment.student_grade && (
                        <div className="admin-proof-student-grade">
                          {payment.student_grade}
                        </div>
                      )}
                    </td>
                    <td data-label="Amount">{formatCurrency(payment.amount)}</td>
                    <td data-label="Bill Type">{billTypeLabel(payment.billed_item)}</td>
                    <td data-label="Type">
                      {payment.is_enrollment_payment ? (
                        <span
                          style={{
                            background: "#e0e7ff",
                            color: "#4338ca",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "500",
                          }}
                        >
                          Enrollment Fee
                        </span>
                      ) : (
                        <span
                          style={{
                            background: "#f3e8ff",
                            color: "#6b21a5",
                            padding: "4px 8px",
                            borderRadius: "12px",
                            fontSize: "11px",
                            fontWeight: "500",
                          }}
                        >
                          Installment
                        </span>
                      )}
                    </td>
                    <td data-label="Submitted Date">{formatDate(payment.submitted_date || payment.created_at)}</td>
                    <td data-label="Status">
                      <span
                        className={`admin-proof-status-badge admin-proof-status-${payment.status || "pending"}`}
                        style={statusPillStyle(payment.status)}
                      >
                        {payment.status || "PENDING"}
                      </span>
                    </td>
                    <td data-label="Actions">
                      <div className="admin-proof-actions-icons">
                        <button
                          className="action-icon"
                          onClick={() => openActionModal(payment, "view")}
                          title="View"
                        >
                          <Eye size={18} />
                        </button>
                      {payment.status === "pending" ? (
                        <>
                          <button
                            className="action-icon approve-icon"
                            onClick={() => openActionModal(payment, "approve")}
                            title="Approve"
                          >
                            <Check size={18} />
                          </button>
                          <button
                            className="action-icon reject-icon"
                            onClick={() => openActionModal(payment, "reject")}
                            title="Reject"
                          >
                            <X size={18} />
                          </button>
                        </>
                      ) : (
                        <span className={`admin-proof-reviewed ${payment.status}`}>
                          {payment.status === "approved" ? <Check size={14} /> : <X size={14} />}
                          <span>
                            {payment.status === "approved" ? " Approved" : " Rejected"}
                          </span>
                        </span>
                      )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>
          </div>
        )}

        {showModal && (
          <div
            className="admin-proof-modal-overlay"
            onClick={() => setShowModal(false)}
          >
            <div
              className="admin-proof-modal"
              onClick={(e) => e.stopPropagation()}
            >
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  marginBottom: "16px",
                }}
              >
                <h3 style={{ margin: 0 }}>
                  {actionType === "approve"
                    ? "Approve Payment Proof"
                    : actionType === "reject"
                    ? "Reject Payment Proof"
                    : "View Payment Proof"}
                </h3>
                <button
                  onClick={() => setShowModal(false)}
                  style={{
                    background: "none",
                    border: "none",
                    cursor: "pointer",
                    fontSize: "20px",
                    color: "#64748b",
                  }}
                >
                  ×
                </button>
              </div>

              <div className="admin-proof-modal-meta">
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Student</div>
                  <div className="admin-proof-modal-value">
                    {getStudentDisplayName(selectedPayment)}
                  </div>
                </div>
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Reference Number</div>
                  <div className="admin-proof-modal-value">
                    {selectedPayment?.reference_number || "—"}
                  </div>
                </div>
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Description</div>
                  <div className="admin-proof-modal-value">
                    {selectedPayment?.formatted_description || "—"}
                  </div>
                </div>
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Amount</div>
                  <div className="admin-proof-modal-value">
                    {formatCurrency(selectedPayment?.amount)}
                  </div>
                </div>
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Bill Type</div>
                  <div className="admin-proof-modal-value">
                    {billTypeLabel(selectedPayment?.billed_item)}
                  </div>
                </div>
                <div className="admin-proof-modal-row">
                  <div className="admin-proof-modal-label">Submitted Date</div>
                  <div className="admin-proof-modal-value">
                    {formatDate(selectedPayment?.submitted_date || selectedPayment?.created_at)}
                  </div>
                </div>
              </div>

              {selectedPayment?.proof_image && (
                <div className="admin-proof-modal-image-wrap" style={{ marginBottom: "16px" }}>
                  <label
                    style={{
                      display: "block",
                      marginBottom: "8px",
                      fontWeight: 600,
                    }}
                  >
                    Payment Proof:
                  </label>
                  <img
                    src={getImageUrl(selectedPayment.proof_image)}
                    alt="Payment proof"
                    style={{
                      maxWidth: "100%",
                      maxHeight: "300px",
                      objectFit: "contain",
                      borderRadius: "4px",
                      border: "1px solid #e2e8f0",
                      cursor: "pointer",
                    }}
                    onClick={() =>
                      openImageOverlay(getImageUrl(selectedPayment.proof_image))
                    }
                  />
                </div>
              )}

              {actionType !== "view" && (
                <div className="form-group">
                  <label>Remarks (Optional):</label>
                  <textarea
                    value={remarks}
                    onChange={(e) => setRemarks(e.target.value)}
                    rows="3"
                    placeholder={
                      actionType === "approve"
                        ? "Add approval remarks (optional)"
                        : "Provide reason for rejection (optional)"
                    }
                    style={{
                      width: "100%",
                      padding: "8px",
                      border: "1px solid #e2e8f0",
                      borderRadius: "4px",
                      fontFamily: "inherit",
                    }}
                  />
                </div>
              )}

              <div
                className="admin-proof-modal-actions"
                style={{ display: "flex", gap: "12px", marginTop: "20px" }}
              >
                <button
                  className="btn-cancel"
                  onClick={() => setShowModal(false)}
                  style={{
                    flex: 1,
                    padding: "10px",
                    border: "1px solid #e2e8f0",
                    background: "#f8fafc",
                    borderRadius: "4px",
                    cursor: "pointer",
                  }}
                >
                  {actionType === "view" ? "Close" : "Cancel"}
                </button>
                {actionType !== "view" && (
                  <button
                    className={actionType === "approve" ? "btn-approve" : "btn-reject"}
                    onClick={handleAction}
                    style={{
                      flex: 1,
                      padding: "10px",
                      border: "none",
                      background: actionType === "approve" ? "#10b981" : "#ef4444",
                      color: "white",
                      borderRadius: "4px",
                      cursor: "pointer",
                    }}
                  >
                    {actionType === "approve" ? "Approve" : "Reject"}
                  </button>
                )}
              </div>
            </div>
          </div>
        )}

        {imageOverlay && (
          <div
            onClick={closeImageOverlay}
            style={{
              position: "fixed",
              top: 0,
              left: 0,
              right: 0,
              bottom: 0,
              backgroundColor: "rgba(0, 0, 0, 0.9)",
              zIndex: 9999,
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              cursor: "pointer",
            }}
          >
            <button
              onClick={closeImageOverlay}
              style={{
                position: "absolute",
                top: "20px",
                right: "20px",
                background: "none",
                border: "none",
                color: "white",
                cursor: "pointer",
                zIndex: 10000,
              }}
            >
              <XCircle size={32} />
            </button>
            <img
              src={imageOverlay}
              alt="Payment proof full view"
              style={{
                maxWidth: "90vw",
                maxHeight: "90vh",
                objectFit: "contain",
                borderRadius: "8px",
              }}
              onClick={(e) => e.stopPropagation()}
            />
          </div>
        )}
      </div>
    </div>
  );
}