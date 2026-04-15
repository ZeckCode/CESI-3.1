import React, { useCallback, useEffect, useState } from "react";
import { apiFetch } from "../api/apiFetch";
import "../StudentWebsiteCSS/ProofOfPayment.css";
import Toast from "../Global/Toast";

const formatCurrency = (value) =>
  `₱${Number(value || 0).toLocaleString("en-PH", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;

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

export default function ProofOfPayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [toasts, setToasts] = useState([]);
  const [formData, setFormData] = useState({
    reference_number: "",
    description: "",
    amount: "",
    billed_item: "PAYMENT",
    proof_image: null,
  });

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const fetchStudentProfile = useCallback(async () => {
    try {
      const endpoints = ["/api/accounts/me/detail/"];

      for (const endpoint of endpoints) {
        const response = await apiFetch(endpoint);
        if (response.ok) {
          const data = await response.json();
          setStudentData(data);
          return;
        }
      }

      console.log("Could not fetch profile from endpoints");
    } catch (err) {
      console.error("Error fetching profile:", err);
      addToast("Profile Warning", "Could not load your profile details.", "warning");
    }
  }, [addToast]);

  const fetchPayments = useCallback(async () => {
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
      addToast("Load Error", err.message || "Failed to load payment proofs", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast]);

  useEffect(() => {
    fetchPayments();
    fetchStudentProfile();
  }, [fetchPayments, fetchStudentProfile]);

  const getStudentName = () => {
    if (!studentData) return "Loading...";
    const p = studentData?.profile || {};
    const e = studentData?.enrollment || {};

    const name = formatFullName(
      p.student_first_name || e.first_name,
      p.student_middle_name || e.middle_name,
      p.student_last_name || e.last_name
    );

    return name || studentData?.username || "Student";
  };

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    if (name === "reference_number") {
      const numbersOnly = value.replace(/[^0-9]/g, "");
      setFormData((prev) => ({ ...prev, [name]: numbersOnly }));
    } else {
      setFormData((prev) => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ["image/jpeg", "image/png", "image/jpg", "image/heic"];
      if (!validTypes.includes(file.type)) {
        addToast("Invalid File", "Please upload a valid image file (JPEG, PNG, or HEIC)", "error");
        return;
      }

      if (file.size > 5 * 1024 * 1024) {
        addToast("File Too Large", "File size must be less than 5MB", "error");
        return;
      }

      setFormData((prev) => ({ ...prev, proof_image: file }));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();

    if (!formData.reference_number.trim()) {
      addToast("Missing Field", "Reference number is required", "warning");
      return;
    }

    if (!/^\d+$/.test(formData.reference_number)) {
      addToast("Invalid Reference", "Reference number must contain only numbers", "warning");
      return;
    }

    if (!formData.amount || Number(formData.amount) <= 0) {
      addToast("Invalid Amount", "Amount is required and must be greater than 0", "warning");
      return;
    }

    if (!formData.description.trim()) {
      addToast("Missing Field", "Description is required", "warning");
      return;
    }

    if (!formData.proof_image) {
      addToast("Missing File", "Proof of payment image is required", "warning");
      return;
    }

    try {
      setSubmitting(true);

      const formDataToSend = new FormData();
      formDataToSend.append("reference_number", formData.reference_number);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("amount", formData.amount);
      formDataToSend.append("billed_item", formData.billed_item);
      formDataToSend.append("proof_image", formData.proof_image);

      const response = await apiFetch("/api/finance/proof-of-payments/", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.detail ||
            errorData.message ||
            "Failed to submit payment proof"
        );
      }

      addToast(
        "Submission Successful",
        "Payment proof submitted successfully. Waiting for admin approval.",
        "success"
      );
      setFormData({
        reference_number: "",
        description: "",
        amount: "",
        billed_item: "PAYMENT",
        proof_image: null,
      });

      const fileInput = document.getElementById("proof_image");
      if (fileInput) fileInput.value = "";

      fetchPayments();
    } catch (err) {
      console.error("Error submitting payment:", err);
      addToast("Submission Failed", err.message || "Failed to submit payment proof", "error");
    } finally {
      setSubmitting(false);
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

  const getImageUrl = (payment) => {
    if (!payment) return null;
    if (payment.proof_image_url) return payment.proof_image_url;

    const imagePath = payment.proof_image;
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return imagePath;
  };

  if (loading) {
    return (
      <div className="proof-wrapper">
        <div className="proof-content">
          <div className="proof-form-card proofSkel__card">
            <div className="proofSkel proof-shimmer proofSkel__line proofSkel__line--title" />
            {[...Array(6)].map((_, idx) => (
              <div key={idx} className="form-group">
                <div className="proofSkel proof-shimmer proofSkel__line proofSkel__line--label" />
                <div className="proofSkel proof-shimmer proofSkel__field" />
              </div>
            ))}
            <div className="proofSkel proof-shimmer proofSkel__submit" />
          </div>

          <div className="proof-history proofSkel__card">
            <div className="proofSkel proof-shimmer proofSkel__line proofSkel__line--historyTitle" />
            <div className="proof-list">
              {[...Array(3)].map((_, idx) => (
                <div key={idx} className="proof-item proofSkel__item">
                  <div className="proof-item-header">
                    <div className="proofSkel proof-shimmer proofSkel__line proofSkel__line--ref" />
                    <div className="proofSkel proof-shimmer proofSkel__pill" />
                  </div>
                  <div className="proof-item-details">
                    {[...Array(4)].map((__, detailIdx) => (
                      <div
                        key={detailIdx}
                        className="proofSkel proof-shimmer proofSkel__line proofSkel__line--detail"
                      />
                    ))}
                  </div>
                  <div className="proof-image-container">
                    <div className="proofSkel proof-shimmer proofSkel__line proofSkel__line--imageLink" />
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
        <Toast toasts={toasts} onDismiss={dismissToast} />
      </div>
    );
  }

  return (
    <div className="proof-wrapper">
      <div className="proof-content">
        <div className="proof-form-card">
          <h3 className="form-title">Submit New Proof of Payment</h3>

          <form onSubmit={handleSubmit} className="proof-form">
            <div className="form-group">
              <label className="form-label">Student Name</label>
              <input
                type="text"
                className="form-input"
                value={getStudentName()}
                disabled
                style={{ background: "#f3f4f6", cursor: "not-allowed" }}
              />
            </div>

            <div className="form-group">
              <label htmlFor="reference_number" className="form-label">
                Reference Number <span className="required">*</span>
              </label>
              <input
                type="text"
                id="reference_number"
                name="reference_number"
                value={formData.reference_number}
                onChange={handleInputChange}
                className="form-input"
                placeholder="Enter reference number"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="description" className="form-label">
                Description <span className="required">*</span>
              </label>
              <textarea
                id="description"
                name="description"
                value={formData.description}
                onChange={handleInputChange}
                className="form-textarea"
                rows="3"
                placeholder="Describe the payment"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="amount" className="form-label">
                Amount Paid <span className="required">*</span>
              </label>
              <input
                type="number"
                id="amount"
                name="amount"
                value={formData.amount}
                onChange={handleInputChange}
                onWheel={(e) => e.currentTarget.blur()}
                className="form-input"
                placeholder="Enter amount paid"
                min="0"
                step="0.01"
                disabled={submitting}
              />
            </div>

            <div className="form-group">
              <label htmlFor="billed_item" className="form-label">
                Bill Type
              </label>
              <select
                id="billed_item"
                name="billed_item"
                value={formData.billed_item}
                onChange={handleInputChange}
                className="form-input"
                disabled={submitting}
              >
                <option value="PAYMENT">General Payment</option>
                <option value="INITIAL">Initial Payment</option>
                <option value="MONTHLY">Monthly Installment</option>
                <option value="MISC">Miscellaneous</option>
                <option value="REGISTRATION">Registration</option>
                <option value="ASSESSMENT">Assessment</option>
                <option value="OTHER">Other</option>
              </select>
            </div>

            <div className="form-group">
              <label htmlFor="proof_image" className="form-label">
                Proof of Payment Image <span className="required">*</span>
              </label>
              <input
                type="file"
                id="proof_image"
                name="proof_image"
                onChange={handleFileChange}
                className="form-file-input"
                accept="image/jpeg,image/png,image/jpg,image/heic"
                disabled={submitting}
              />
              <small className="form-help-text">
                Accepted formats: JPEG, PNG, HEIC. Max size: 5MB
              </small>
            </div>

            <button type="submit" className="btn-submit" disabled={submitting}>
              {submitting ? "Submitting..." : "Submit Proof of Payment"}
            </button>
          </form>
        </div>

        <div className="proof-history">
          <h3 className="history-title">My Submissions</h3>

          {loading ? (
            <div className="proof-loading">
              <div className="spinner-border" role="status" />
              Loading submissions...
            </div>
          ) : payments.length === 0 ? (
            <div className="proof-empty">
              <p>No submissions yet. Submit your first proof of payment above.</p>
            </div>
          ) : (
            <div className="proof-list">
              {payments.map((payment) => (
                <div key={payment.id} className="proof-item">
                  <div className="proof-item-header">
                    <div className="proof-reference">
                      <strong>Reference:</strong> {payment.reference_number}
                    </div>
                    <span
                      className="status-pill"
                      style={statusPillStyle(payment.status)}
                    >
                      {payment.status || "PENDING"}
                    </span>
                  </div>

                  <div className="proof-item-details">
                    <div className="proof-detail">
                      <strong>Submitted:</strong> {formatDate(payment.submitted_date || payment.created_at)}
                    </div>

                    <div className="proof-detail">
                      <strong>Description:</strong> {payment.description}
                    </div>

                    <div className="proof-detail">
                      <strong>Amount:</strong> {formatCurrency(payment.amount)}
                    </div>

                    <div className="proof-detail">
                      <strong>Bill Type:</strong> {payment.billed_item || "—"}
                    </div>

                    {payment.admin_remarks && (
                      <div className="proof-detail proof-remarks">
                        <strong>Admin Remarks:</strong> {payment.admin_remarks}
                      </div>
                    )}
                  </div>

                  {payment.proof_image && (
                    <div className="proof-image-container">
                      <a
                        href={getImageUrl(payment)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="proof-image-link"
                      >
                        <img
                          src={getImageUrl(payment)}
                          alt="Proof of payment"
                          className="proof-image-thumbnail"
                        />
                        <span>View Proof Image</span>
                      </a>
                    </div>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}