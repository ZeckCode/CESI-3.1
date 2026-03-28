import React, { useState, useEffect } from "react";
import { apiFetch } from "../api/apiFetch";
import "../AdminWebsiteCSS/AdminProofOfPayment.css";
import { Check, X } from "lucide-react";

const formatFullName = (...parts) =>
  parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(" ");

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

export default function AdminProofOfPayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [selectedPayment, setSelectedPayment] = useState(null);
  const [remarks, setRemarks] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [actionType, setActionType] = useState(""); 

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
      setPayments(Array.isArray(data) ? data : []);
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
        body: JSON.stringify({ remarks: remarks }),
      });

      if (!response.ok) {
        throw new Error(`Failed to ${actionType} payment proof`);
      }

      setSuccess(`Payment proof ${actionType}d successfully!`);
      setShowModal(false);
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

  return (
    <div className="admin-proof-wrapper">
      <div className="admin-proof-content">

        {error && (
          <div className="admin-proof-error">
            {error}
          </div>
        )}

        {success && (
          <div className="admin-proof-success">
            {success}
          </div>
        )}

        {loading ? (
          <div className="admin-proof-loading">
            Loading submissions...
          </div>
        ) : payments.length === 0 ? (
          <div className="admin-proof-empty">
            <p>No proof of payment submissions found.</p>
          </div>
        ) : (
          <div className="admin-proof-table-container">
            <table className="admin-proof-table">
              <thead>
                <tr>
                  <th>ID</th>
                  <th>Student</th>
                  <th>Reference Number</th>
                  <th>Description</th>
                  <th>Submitted Date</th>
                  <th>Status</th>
                  <th>Proof Image</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {payments.map((payment) => (
                  <tr key={payment.id}>
                    <td>{payment.id}</td>
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
                    <td>{payment.reference_number}</td>
                    <td>
                      <div className="admin-proof-description">
                        {payment.description}
                      </div>
                    </td>
                    <td>{formatDate(payment.created_at)}</td>
                    <td>
                      <span
                        className={`admin-proof-status-badge admin-proof-status-${payment.status || "pending"}`}
                        >
                        {payment.status || "PENDING"}
                        </span>
                    </td>
                    <td>
                      {payment.proof_image && (
                        <a
                          href={getImageUrl(payment.proof_image)}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="admin-proof-view-image"
                        >
                          View Image
                        </a>
                      )}
                    </td>
                    <td data-label="Actions">
                    {payment.status === "pending" && (
                        <div className="admin-proof-actions-icons">
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
                        </div>
                    )}
                    {payment.status !== "pending" && (
                        <span className={`admin-proof-reviewed ${payment.status}`}>
                        {payment.status === "approved" ? <Check size={14} /> : <X size={14} />}
                        <span>{payment.status === "approved" ? " Approved" : " Rejected"}</span>
                        </span>
                    )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* Modal for remarks */}
        {showModal && (
          <div className="admin-proof-modal-overlay">
            <div className="admin-proof-modal">
              <h3>{actionType === "approve" ? "Approve" : "Reject"} Payment Proof</h3>
              <p>
                <strong>Student:</strong> {getStudentDisplayName(selectedPayment)}
              </p>
              <p>
                <strong>Reference Number:</strong> {selectedPayment?.reference_number}
              </p>
              
              <div className="form-group">
                <label>Remarks (Optional):</label>
                <textarea
                  value={remarks}
                  onChange={(e) => setRemarks(e.target.value)}
                  rows="3"
                  placeholder={actionType === "approve" 
                    ? "Add approval remarks (optional)" 
                    : "Provide reason for rejection (optional)"}
                />
              </div>
              
              <div className="admin-proof-modal-actions">
                <button className="btn-cancel" onClick={() => setShowModal(false)}>
                  Cancel
                </button>
                <button 
                  className={actionType === "approve" ? "btn-approve" : "btn-reject"}
                  onClick={handleAction}
                >
                  {actionType === "approve" ? "Approve" : "Reject"}
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}