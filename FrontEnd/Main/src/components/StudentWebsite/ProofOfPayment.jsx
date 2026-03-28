import React, { useState, useEffect } from "react";
import { apiFetch } from "../api/apiFetch";
import "../StudentWebsiteCSS/ProofOfPayment.css"; 

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
  const [error, setError] = useState(null);
  const [success, setSuccess] = useState(null);
  const [studentData, setStudentData] = useState(null);
  const [formData, setFormData] = useState({
    reference_number: "",
    description: "",
    proof_image: null,
  });

  useEffect(() => {
    fetchPayments();
    fetchStudentProfile(); 
  }, []);

  const fetchStudentProfile = async () => {
  try {
    const endpoints = ["/api/accounts/me-detail/", "/api/accounts/me/detail/"];
    
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
  }
};

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
      setFormData(prev => ({ ...prev, [name]: numbersOnly }));
    } else {
      setFormData(prev => ({ ...prev, [name]: value }));
    }
  };

  const handleFileChange = (e) => {
    const file = e.target.files[0];
    if (file) {
      const validTypes = ['image/jpeg', 'image/png', 'image/jpg', 'image/heic'];
      if (!validTypes.includes(file.type)) {
        setError("Please upload a valid image file (JPEG, PNG, or HEIC)");
        return;
      }
      
      if (file.size > 5 * 1024 * 1024) {
        setError("File size must be less than 5MB");
        return;
      }
      
      setFormData(prev => ({ ...prev, proof_image: file }));
      setError(null);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    
    if (!formData.reference_number.trim()) {
      setError("Reference number is required");
      return;
    }
    
    if (!/^\d+$/.test(formData.reference_number)) {
      setError("Reference number must contain only numbers");
      return;
    }
    
    if (!formData.description.trim()) {
      setError("Description is required");
      return;
    }
    
    if (!formData.proof_image) {
      setError("Proof of payment image is required");
      return;
    }

    try {
      setSubmitting(true);
      setError(null);
      
      const formDataToSend = new FormData();
      formDataToSend.append("reference_number", formData.reference_number);
      formDataToSend.append("description", formData.description);
      formDataToSend.append("proof_image", formData.proof_image);
      
      const response = await apiFetch("/api/finance/proof-of-payments/", {
        method: "POST",
        body: formDataToSend,
      });
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to submit payment proof");
      }
      
      setSuccess("Payment proof submitted successfully! Waiting for admin approval.");
      setFormData({
        reference_number: "",
        description: "",
        proof_image: null,
      });

      const fileInput = document.getElementById("proof_image");
      if (fileInput) fileInput.value = "";
      
      fetchPayments();
      
      setTimeout(() => setSuccess(null), 5000);
    } catch (err) {
      console.error("Error submitting payment:", err);
      setError(err.message || "Failed to submit payment proof");
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

  const getImageUrl = (imagePath) => {
    if (!imagePath) return null;
    if (imagePath.startsWith("http")) return imagePath;
    return `${process.env.REACT_APP_API_URL || ""}${imagePath}`;
  };

  return (
    <div className="proof-wrapper">
      <div className="proof-content">

        {/* Submission Form */}
        <div className="proof-form-card">
          <h3 className="form-title">Submit New Proof of Payment</h3>
          
          {error && (
            <div className="proof-error-message">
              {error}
            </div>
          )}
          
          {success && (
            <div className="proof-success-message">
              {success}
            </div>
          )}
          
          <form onSubmit={handleSubmit} className="proof-form">
            <div className="form-group">
              <label className="form-label">
                Student Name
              </label>
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
                placeholder="Enter reference number (e.g., GCash ref no., bank ref no.)"
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
                placeholder="Describe the payment (e.g., Tuition fee for March 2026, Registration fee)"
                disabled={submitting}
              />
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
            
            <button
              type="submit"
              className="btn-submit"
              disabled={submitting}
            >
              {submitting ? "Submitting..." : "Submit Proof of Payment"}
            </button>
          </form>
        </div>

        {/* Existing Submissions */}
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
                      <strong>Submitted:</strong> {formatDate(payment.created_at)}
                    </div>
                    
                    <div className="proof-detail">
                      <strong>Description:</strong> {payment.description}
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
                        href={getImageUrl(payment.proof_image)}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="proof-image-link"
                      >
                        <img
                          src={getImageUrl(payment.proof_image)}
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
    </div>
  );
}