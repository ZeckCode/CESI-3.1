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

const parseResponseJson = async (response) => {
  if (!response) return null;
  const contentType = response.headers?.get("content-type") || "";
  if (!contentType.toLowerCase().includes("application/json")) return null;

  try {
    return await response.json();
  } catch {
    return null;
  }
};

export default function ProofOfPayment() {
  const [payments, setPayments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [studentData, setStudentData] = useState(null);
  const [billingItems, setBillingItems] = useState([]);
  const [tuition, setTuition] = useState(null);
  const [tuitionLoading, setTuitionLoading] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [formData, setFormData] = useState({
    amount: "",
    billed_item: "PAYMENT",
    bill_transaction: "",
    other_bill_description: "",
    payment_channel: "",
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

  const fetchBillingItems = useCallback(async () => {
    try {
      const response = await apiFetch("/api/finance/my-billing-items/");
      if (!response.ok) throw new Error("Failed to fetch billing items");
      const data = await response.json();
      setBillingItems(Array.isArray(data) ? data : []);
    } catch (err) {
      console.error("Error fetching billing items:", err);
      addToast("Billing Warning", "Could not load your unpaid bills.", "warning");
    }
  }, [addToast]);

  useEffect(() => {
    fetchPayments();
    fetchStudentProfile();
    fetchBillingItems();
  }, [fetchPayments, fetchStudentProfile, fetchBillingItems]);

  useEffect(() => {
    const gradeKey = studentData?.enrollment?.grade_level || studentData?.profile?.grade_level;
    if (!gradeKey) return;

    const loadTuition = async () => {
      setTuitionLoading(true);
      try {
        const response = await apiFetch(`/api/finance/tuition-configs/by-grade/${encodeURIComponent(gradeKey)}/`);
        if (response.ok) setTuition(await response.json());
      } catch (err) {
        console.error("Error fetching tuition configuration:", err);
      } finally {
        setTuitionLoading(false);
      }
    };

    loadTuition();
  }, [studentData]);

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
    setFormData((prev) => ({ ...prev, [name]: value }));
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

    if (!formData.amount || Number(formData.amount) <= 0) {
      addToast("Invalid Amount", "Amount is required and must be greater than 0", "warning");
      return;
    }

    const isOtherBill = formData.bill_transaction === "OTHER";

    if (billingItems.length > 0 && !formData.bill_transaction) {
      addToast("Select a Bill", "Please choose the bill this payment is for.", "warning");
      return;
    }

    if (isOtherBill && !formData.other_bill_description.trim()) {
      addToast("Describe Other Bill", "Please enter the bill type or payment purpose.", "warning");
      return;
    }

    if (!formData.payment_channel) {
      addToast("Select Payment Channel", "Please choose bank or e-wallet.", "warning");
      return;
    }

    if (!formData.proof_image) {
      addToast("Missing File", "Proof of payment image is required", "warning");
      return;
    }

    try {
      setSubmitting(true);

      const formDataToSend = new FormData();
      formDataToSend.append("amount", formData.amount);
      formDataToSend.append("billed_item", isOtherBill ? "OTHER" : formData.billed_item);
      formDataToSend.append("bill_transaction", isOtherBill ? "" : formData.bill_transaction || "");
      if (isOtherBill) {
        formDataToSend.append("description", formData.other_bill_description.trim());
      }
      formDataToSend.append("payment_channel", formData.payment_channel || "");
      formDataToSend.append("proof_image", formData.proof_image);

      const response = await apiFetch("/api/finance/proof-of-payments/", {
        method: "POST",
        body: formDataToSend,
      });

      if (!response.ok) {
        const errorData = await parseResponseJson(response);
        throw new Error(
          errorData?.detail ||
            errorData?.message ||
            "Failed to submit payment proof"
        );
      }

      addToast(
        "Submission Successful",
        "Payment proof submitted successfully. Waiting for admin approval.",
        "success"
      );
      setFormData({
        amount: "",
        billed_item: "PAYMENT",
        bill_transaction: "",
        other_bill_description: "",
        payment_channel: "",
        proof_image: null,
      });

      const fileInput = document.getElementById("proof_image");
      if (fileInput) fileInput.value = "";

      fetchPayments();
      fetchBillingItems();
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
              <label htmlFor="bill_transaction" className="form-label">
                Bill to Pay <span className="required">*</span>
              </label>
              <select
                id="bill_transaction"
                name="bill_transaction"
                value={formData.bill_transaction}
                onChange={(e) => {
                  const selected = billingItems.find((item) => String(item.id) === e.target.value);
                  setFormData((prev) => ({
                    ...prev,
                    bill_transaction: e.target.value,
                    billed_item: selected?.item || (e.target.value === "OTHER" ? "OTHER" : prev.billed_item),
                    amount: selected?.amount ? String(selected.amount) : prev.amount,
                  }));
                }}
                className="form-input"
                disabled={submitting}
                required
              >
                <option value="">
                  {billingItems.length ? "Select the bill you are paying" : "Select a bill type"}
                </option>
                {billingItems.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.item} {item.due_date ? `due ${item.due_date}` : ""} - {formatCurrency(item.amount)}
                  </option>
                ))}
                <option value="OTHER">Other bill or payment purpose</option>
              </select>
              <small className="form-help-text">
                Selecting a bill links this proof directly to that ledger charge for admin approval.
              </small>
            </div>

            {formData.bill_transaction === "OTHER" && (
              <div className="form-group">
                <label htmlFor="other_bill_description" className="form-label">
                  Other Bill Type <span className="required">*</span>
                </label>
                <textarea
                  id="other_bill_description"
                  name="other_bill_description"
                  value={formData.other_bill_description}
                  onChange={handleInputChange}
                  className="form-textarea"
                  rows="2"
                  placeholder="Example: Books, uniform, or other school charge"
                  disabled={submitting}
                />
              </div>
            )}

            <div className="form-group">
              <label htmlFor="payment_channel" className="form-label">
                Payment Channel <span className="required">*</span>
              </label>
              <select
                id="payment_channel"
                name="payment_channel"
                value={formData.payment_channel}
                onChange={handleInputChange}
                className="form-input"
                disabled={submitting}
                required
              >
                <option value="">Select channel</option>
                <option value="bank">Bank (PNB)</option>
                <option value="ewallet">E-Wallet (GCash/Maya)</option>
              </select>
              {formData.payment_channel === "bank" && (
                <small className="form-help-text">PNB account: CESI Admin, 1003-10040-500</small>
              )}
              {formData.payment_channel === "ewallet" && (
                <small className="form-help-text">GCash/Maya: 0912345678, account name CESI Admin</small>
              )}
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

        <div className="proof-history" style={{ marginTop: "1rem" }}>
          <h3 className="history-title">Billing Information</h3>
          {tuitionLoading ? (
            <div className="proof-empty"><p>Loading tuition information...</p></div>
          ) : tuition ? (
            <div className="proof-item-details">
              <div className="proof-detail"><strong>Cash Tuition:</strong> {formatCurrency(tuition.cash)}</div>
              <div className="proof-detail"><strong>Installment Tuition:</strong> {formatCurrency(tuition.installment)}</div>
              <div className="proof-detail"><strong>Initial Payment:</strong> {formatCurrency(tuition.initial)}</div>
              <div className="proof-detail"><strong>Monthly Installment:</strong> {formatCurrency(tuition.monthly)}</div>
              <div className="proof-detail"><strong>Miscellaneous (August):</strong> {formatCurrency(tuition.misc_aug)}</div>
              <div className="proof-detail"><strong>Miscellaneous (November):</strong> {formatCurrency(tuition.misc_nov)}</div>
              <div className="proof-detail"><strong>Assessment Fee:</strong> {formatCurrency(tuition.assessment)}</div>
            </div>
          ) : (
            <div className="proof-empty"><p>Tuition information is not available yet.</p></div>
          )}
        </div>
      </div>
      <Toast toasts={toasts} onDismiss={dismissToast} />
    </div>
  );
}