import React, { useState, useEffect, useRef } from "react";
import "../StudentWebsiteCSS/ProofOfPayment.css";
import {
  submitProofOfPayment,
  getMyPaymentProofs,
  deletePaymentProof,
  getPaymentProofDetail,
} from "../api/finance";
import { getMyTransactions } from "../api/finance";
import Toast from "../Global/Toast";

const ProofOfPaymentUpload = () => {
  // Form state
  const [transactions, setTransactions] = useState([]);
  const [selectedTransaction, setSelectedTransaction] = useState("");
  const [referenceNumber, setReferenceNumber] = useState("");
  const [paymentAmount, setPaymentAmount] = useState("");
  const [paymentDate, setPaymentDate] = useState("");
  const [paymentMethod, setPaymentMethod] = useState("");
  const [description, setDescription] = useState("");
  const [document, setDocument] = useState(null);
  const [documentPreview, setDocumentPreview] = useState(null);

  // Submission state
  const [proofs, setProofs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  // UI state
  const [showForm, setShowForm] = useState(false);
  const [expandedProofId, setExpandedProofId] = useState(null);
  const fileInputRef = useRef(null);

  // Toast notification
  const [toast, setToast] = useState(null);

  const PAYMENT_METHODS = [
    "Bank Transfer",
    "GCash",
    "PayMaya",
    "Check",
    "Cash",
    "Other",
  ];

  const STATUS_COLORS = {
    PENDING: "#FFA500",
    APPROVED: "#28a745",
    REJECTED: "#dc3545",
    RESUBMIT: "#FF6B6B",
  };

  const STATUS_LABELS = {
    PENDING: "Pending Review",
    APPROVED: "Approved",
    REJECTED: "Rejected",
    RESUBMIT: "Resubmit Required",
  };

  useEffect(() => {
    loadInitialData();
  }, []);

  const loadInitialData = async () => {
    try {
      setLoading(true);
      const [txRes, proofsRes] = await Promise.all([
        getMyTransactions(),
        getMyPaymentProofs(),
      ]);

      if (Array.isArray(txRes)) {
        setTransactions(txRes);
      }

      if (Array.isArray(proofsRes)) {
        setProofs(proofsRes);
      }
    } catch (err) {
      console.error("Load error:", err);
      setError("Failed to load data.");
    } finally {
      setLoading(false);
    }
  };

  const handleFileSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Validate file size (5MB max)
    if (file.size > 5 * 1024 * 1024) {
      showToast("File size must not exceed 5MB", "error");
      return;
    }

    // Validate file type
    const allowedTypes = ["image/jpeg", "image/png", "image/jpg", "application/pdf"];
    if (!allowedTypes.includes(file.type)) {
      showToast("Only JPEG, PNG, and PDF files are allowed", "error");
      return;
    }

    setDocument(file);

    // Generate preview for images
    if (file.type.startsWith("image/")) {
      const reader = new FileReader();
      reader.onload = (event) => {
        setDocumentPreview(event.target.result);
      };
      reader.readAsDataURL(file);
    } else {
      // For PDFs, show a generic preview
      setDocumentPreview(null);
    }
  };

  const validateFormSubmission = () => {
    if (!selectedTransaction) {
      showToast("Please select a transaction", "warning");
      return false;
    }
    if (!referenceNumber.trim()) {
      showToast("Reference number is required", "warning");
      return false;
    }
    if (!paymentAmount || Number(paymentAmount) <= 0) {
      showToast("Payment amount must be greater than 0", "warning");
      return false;
    }
    if (!paymentDate) {
      showToast("Payment date is required", "warning");
      return false;
    }
    if (!paymentMethod) {
      showToast("Payment method is required", "warning");
      return false;
    }
    if (!document) {
      showToast("Please upload a payment proof document", "warning");
      return false;
    }
    return true;
  };

  const resetForm = () => {
    setSelectedTransaction("");
    setReferenceNumber("");
    setPaymentAmount("");
    setPaymentDate("");
    setPaymentMethod("");
    setDescription("");
    setDocument(null);
    setDocumentPreview(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = "";
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!validateFormSubmission()) return;

    try {
      setSubmitting(true);
      setError("");

      const newProof = await submitProofOfPayment(
        selectedTransaction,
        referenceNumber,
        paymentAmount,
        paymentDate,
        paymentMethod,
        document,
        description
      );

      setProofs([newProof, ...proofs]);
      resetForm();
      setShowForm(false);
      showToast(
        "Payment proof submitted successfully! It will be reviewed shortly.",
        "success"
      );
    } catch (err) {
      console.error("Submission error:", err);
      setError(err.message || "Failed to submit proof of payment.");
      showToast(err.message || "Submission failed", "error");
    } finally {
      setSubmitting(false);
    }
  };

  const handleDelete = async (proofId) => {
    if (!window.confirm("Are you sure you want to delete this submission?")) {
      return;
    }

    try {
      await deletePaymentProof(proofId);
      setProofs(proofs.filter((p) => p.id !== proofId));
      showToast("Proof of payment deleted", "success");
    } catch (err) {
      console.error("Delete error:", err);
      showToast(err.message || "Failed to delete proof", "error");
    }
  };

  const showToast = (message, type) => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 4000);
  };

  const formatCurrency = (value) =>
    `₱${Number(value || 0).toLocaleString("en-PH", { minimumFractionDigits: 2 })}`;

  const formatDate = (dateString) => {
    if (!dateString) return "—";
    return new Date(dateString).toLocaleDateString("en-PH", {
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  };

  const getTransactionLabel = (transactionId) => {
    const tx = transactions.find((t) => t.id === transactionId);
    if (!tx) return `Transaction #${transactionId}`;
    return `${tx.item} - ${formatCurrency(tx.amount)} (Ref: ${tx.reference_number})`;
  };

  if (loading) {
    return (
      <div className="proof-payment-container">
        <div className="loading-spinner">Loading...</div>
      </div>
    );
  }

  return (
    <div className="proof-payment-container">
      {toast && <Toast message={toast.message} type={toast.type} />}

      <div className="proof-payment-header">
        <h2>Proof of Payment (Delivery/Submission)</h2>
        <p className="subtitle">
          Submit payment proof documents to verify your transactions
        </p>
      </div>

      {error && <div className="alert alert-error">{error}</div>}

      {/* Upload Form Section */}
      <div className="proof-payment-form-section">
        <button
          className={`btn-toggle-form ${showForm ? "active" : ""}`}
          onClick={() => setShowForm(!showForm)}
        >
          {showForm ? "▼ Hide Form" : "▶ Upload Proof of Payment"}
        </button>

        {showForm && (
          <form className="proof-payment-form" onSubmit={handleSubmit}>
            <div className="form-row">
              <div className="form-group">
                <label htmlFor="transaction">Select Transaction *</label>
                <select
                  id="transaction"
                  value={selectedTransaction}
                  onChange={(e) => setSelectedTransaction(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Select a Transaction --</option>
                  {transactions.map((tx) => (
                    <option key={tx.id} value={tx.id}>
                      {tx.item} - {formatCurrency(tx.amount)} (Ref:{" "}
                      {tx.reference_number})
                    </option>
                  ))}
                </select>
              </div>

              <div className="form-group">
                <label htmlFor="refNumber">Reference Number *</label>
                <input
                  id="refNumber"
                  type="text"
                  placeholder="e.g., GCASH123456, BANK-TRX-2024"
                  value={referenceNumber}
                  onChange={(e) => setReferenceNumber(e.target.value)}
                  disabled={submitting}
                />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label htmlFor="amount">Payment Amount (₱) *</label>
                <input
                  id="amount"
                  type="number"
                  step="0.01"
                  min="0"
                  placeholder="0.00"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="date">Payment Date *</label>
                <input
                  id="date"
                  type="date"
                  value={paymentDate}
                  onChange={(e) => setPaymentDate(e.target.value)}
                  disabled={submitting}
                />
              </div>

              <div className="form-group">
                <label htmlFor="method">Payment Method *</label>
                <select
                  id="method"
                  value={paymentMethod}
                  onChange={(e) => setPaymentMethod(e.target.value)}
                  disabled={submitting}
                >
                  <option value="">-- Select Method --</option>
                  {PAYMENT_METHODS.map((method) => (
                    <option key={method} value={method}>
                      {method}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-group">
              <label htmlFor="description">Additional Notes</label>
              <textarea
                id="description"
                placeholder="Any additional information about this payment..."
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                disabled={submitting}
                rows="3"
              />
            </div>

            {/* File Upload */}
            <div className="form-group file-upload-group">
              <label>Payment Document Upload *</label>
              <div className="file-upload-area">
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="image/jpeg,image/png,image/jpg,application/pdf"
                  onChange={handleFileSelect}
                  disabled={submitting}
                  className="file-input"
                />
                <div className="file-upload-prompt">
                  <svg
                    className="upload-icon"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  <p>
                    {document
                      ? `Selected: ${document.name}`
                      : "Click to upload or drag and drop"}
                  </p>
                  <span className="file-hint">
                    JPG, PNG, or PDF (max 5MB)
                  </span>
                </div>
              </div>

              {/* Document Preview */}
              {documentPreview && (
                <div className="document-preview">
                  <p className="preview-label">Preview:</p>
                  <img
                    src={documentPreview}
                    alt="Payment proof preview"
                    className="preview-image"
                  />
                </div>
              )}

              {document && document.type === "application/pdf" && (
                <div className="document-preview pdf-preview">
                  <p className="preview-label">PDF Document</p>
                  <p className="pdf-info">
                    File: {document.name} ({(document.size / 1024).toFixed(2)} KB)
                  </p>
                </div>
              )}
            </div>

            {/* Form Actions */}
            <div className="form-actions">
              <button
                type="submit"
                className="btn btn-primary"
                disabled={submitting}
              >
                {submitting ? "Submitting..." : "Submit Proof of Payment"}
              </button>
              <button
                type="button"
                className="btn btn-secondary"
                onClick={resetForm}
                disabled={submitting}
              >
                Clear Form
              </button>
            </div>
          </form>
        )}
      </div>

      {/* Submissions List */}
      <div className="proof-payment-list-section">
        <h3>Your Submissions ({proofs.length})</h3>

        {proofs.length === 0 ? (
          <div className="empty-state">
            <p>No payment proofs submitted yet.</p>
            <p className="hint">Upload your first proof of payment above.</p>
          </div>
        ) : (
          <div className="submissions-grid">
            {proofs.map((proof) => (
              <div key={proof.id} className="proof-card">
                {/* Card Header */}
                <div className="proof-card-header">
                  <div className="proof-title">
                    <h4>{getTransactionLabel(proof.transaction)}</h4>
                    <span
                      className="status-badge"
                      style={{
                        backgroundColor: STATUS_COLORS[proof.status],
                      }}
                    >
                      {STATUS_LABELS[proof.status]}
                    </span>
                  </div>
                  <button
                    className="btn-expand"
                    onClick={() =>
                      setExpandedProofId(
                        expandedProofId === proof.id ? null : proof.id
                      )
                    }
                  >
                    {expandedProofId === proof.id ? "▼" : "▶"}
                  </button>
                </div>

                {/* Card Quick Info */}
                <div className="proof-quick-info">
                  <div className="info-item">
                    <span className="label">Reference:</span>
                    <span className="value">{proof.reference_number}</span>
                  </div>
                  <div className="info-item">
                    <span className="label">Amount:</span>
                    <span className="value">
                      {formatCurrency(proof.payment_amount)}
                    </span>
                  </div>
                  <div className="info-item">
                    <span className="label">Submitted:</span>
                    <span className="value">
                      {formatDate(proof.submitted_date)}
                    </span>
                  </div>
                </div>

                {/* Expanded Details */}
                {expandedProofId === proof.id && (
                  <div className="proof-details">
                    <div className="details-grid">
                      <div className="detail-row">
                        <span className="label">Payment Date:</span>
                        <span className="value">
                          {formatDate(proof.payment_date)}
                        </span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Payment Method:</span>
                        <span className="value">{proof.payment_method}</span>
                      </div>
                      <div className="detail-row">
                        <span className="label">Document:</span>
                        <span className="value">
                          <a
                            href={proof.document}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="document-link"
                          >
                            View Document
                          </a>
                        </span>
                      </div>
                      {proof.description && (
                        <div className="detail-row full-width">
                          <span className="label">Notes:</span>
                          <span className="value">{proof.description}</span>
                        </div>
                      )}

                      {/* Review Information */}
                      {proof.reviewed_by_username && (
                        <>
                          <div className="detail-row">
                            <span className="label">Reviewed By:</span>
                            <span className="value">
                              {proof.reviewed_by_username}
                            </span>
                          </div>
                          <div className="detail-row">
                            <span className="label">Reviewed Date:</span>
                            <span className="value">
                              {formatDate(proof.reviewed_date)}
                            </span>
                          </div>
                        </>
                      )}

                      {/* Rejection Reason */}
                      {proof.rejection_reason && (
                        <div className="detail-row full-width">
                          <span className="label rejection">
                            Review Reason:
                          </span>
                          <span className="value rejection">
                            {proof.rejection_reason}
                          </span>
                        </div>
                      )}
                    </div>

                    {/* Action Buttons */}
                    {(proof.status === "PENDING" ||
                      proof.status === "RESUBMIT" ||
                      proof.status === "REJECTED") && (
                      <div className="proof-actions">
                        <button
                          className="btn btn-danger"
                          onClick={() => handleDelete(proof.id)}
                        >
                          Delete
                        </button>
                      </div>
                    )}
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Info Box */}
      <div className="info-box">
        <h4>📋 How to Submit Your Proof of Payment</h4>
        <ol>
          <li>Select the transaction you're paying for</li>
          <li>Enter the payment reference/confirmation number</li>
          <li>Enter the payment amount and date</li>
          <li>Select the payment method used</li>
          <li>Upload a clear image or PDF of your payment receipt/proof</li>
          <li>Submit for review</li>
          <li>Check back for approval status</li>
        </ol>
        <p className="note">
          <strong>Note:</strong> Accepted file formats: JPG, PNG, PDF (Max 5MB).
          Payment proofs are reviewed within 1-3 business days.
        </p>
      </div>
    </div>
  );
};

export default ProofOfPaymentUpload;
