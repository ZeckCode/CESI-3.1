import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../StudentWebsiteCSS/Profile.css";
import { getToken } from "../Auth/auth";
import Toast from "../Global/Toast";

const API_BASE = "";

const PROFILE_ENDPOINTS = [
  "/api/accounts/me-detail/",
  "/api/accounts/me/detail/",
];

const LEDGER_SUMMARY_ENDPOINT = "/api/finance/my-ledger-summary/";

const NEXT_GRADE_MAP = {
  prek: "Kinder",
  kinder: "Grade 1",
  grade1: "Grade 2",
  grade2: "Grade 3",
  grade3: "Grade 4",
  grade4: "Grade 5",
  grade5: "Grade 6",
  grade6: null,
};

async function fetchWithToken(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };

  const res = await fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });

  return res;
}

async function parseJsonSafe(res) {
  const text = await res.text();
  try {
    return text ? JSON.parse(text) : null;
  } catch {
    return { detail: text };
  }
}

async function tryProfileEndpoints() {
  let lastError = null;

  for (const endpoint of PROFILE_ENDPOINTS) {
    try {
      const res = await fetchWithToken(endpoint, { method: "GET" });
      const json = await parseJsonSafe(res);

      if (res.ok) {
        return { data: json, endpoint };
      }

      lastError = new Error(
        json?.detail || `Request failed (${res.status}) at ${endpoint}`
      );
    } catch (err) {
      lastError = err;
    }
  }

  throw lastError || new Error("Unable to load profile.");
}

async function loadLedgerSummary() {
  try {
    const res = await fetchWithToken(LEDGER_SUMMARY_ENDPOINT, { method: "GET" });
    const json = await parseJsonSafe(res);

    if (!res.ok) {
      throw new Error(json?.detail || "Failed to load ledger summary.");
    }

    return json || {};
  } catch (err) {
    throw err;
  }
}

const gradeLabelFromProfile = (raw) => {
  if (raw == null) return "—";
  const v = String(raw).trim();

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

  if (map[v.toLowerCase()]) return map[v.toLowerCase()];
  return v;
};

const normalizeGradeCode = (raw) => {
  if (!raw) return "";
  return String(raw).trim().toLowerCase();
};

const formatFullName = (...parts) =>
  parts
    .filter(Boolean)
    .map((p) => String(p).trim())
    .filter(Boolean)
    .join(" ");

export default function StudentReenrollment() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [data, setData] = useState(null);
  const [ledgerSummary, setLedgerSummary] = useState(null);

  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentMiddleName, setStudentMiddleName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentMiddleName, setParentMiddleName] = useState("");
  const [parentLastName, setParentLastName] = useState("");

  const [contactNumber, setContactNumber] = useState("");
  const [address, setAddress] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");

  const [form137File, setForm137File] = useState(null);
  const [sf10File, setSf10File] = useState(null);
  const [birthCertificateFile, setBirthCertificateFile] = useState(null);
  const [goodMoralFile, setGoodMoralFile] = useState(null);
  const [reportCardFile, setReportCardFile] = useState(null);
  const [otherDocumentFile, setOtherDocumentFile] = useState(null);

  const [toasts, setToasts] = useState([]);

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

  useEffect(() => {
    const loadData = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const [profileResult, summaryResult] = await Promise.allSettled([
          tryProfileEndpoints(),
          loadLedgerSummary(),
        ]);

        if (profileResult.status !== "fulfilled") {
          throw profileResult.reason;
        }

        const json = profileResult.value.data;
        const p = json?.profile || {};
        const e = json?.enrollment || {};

        setData(json);

        if (summaryResult.status === "fulfilled") {
          setLedgerSummary(summaryResult.value || {});
        } else {
          setLedgerSummary(null);
          addToast(
            "Ledger Warning",
            summaryResult.reason?.message || "Could not load ledger summary. Eligibility may be incomplete.",
            "warning"
          );
        }

        setStudentFirstName(p.student_first_name || e.first_name || "");
        setStudentMiddleName(p.student_middle_name || e.middle_name || "");
        setStudentLastName(p.student_last_name || e.last_name || "");

        setParentFirstName(p.parent_first_name || "");
        setParentMiddleName(p.parent_middle_name || "");
        setParentLastName(p.parent_last_name || "");

        setContactNumber(
          p.contact_number || e.mobile_number || e.telephone_number || ""
        );
        setAddress(p.address || e.address || "");
        setPaymentMode(p.payment_mode || e.payment_mode || "");
      } catch (e) {
        const msg = e.message || "Failed to load profile.";
        setError(msg);
        setData(null);
        addToast("Load Failed", msg, "error");
      } finally {
        setLoading(false);
      }
    };

    loadData();
  }, [addToast]);

  const studentInfo = useMemo(() => {
    const u = data || {};
    const p = u.profile || {};
    const e = u.enrollment || {};

    return {
      fullName:
        formatFullName(studentFirstName, studentMiddleName, studentLastName) ||
        u.username ||
        "—",
      lrn: p.lrn || e.lrn || "—",
      studentNumber: p.student_number || e.student_number || "—",
      gradeLevel: gradeLabelFromProfile(p.grade_level || e.grade_level),
      gradeCode: normalizeGradeCode(p.grade_level || e.grade_level),
      sectionName:
        p.section?.name || e.section_details?.name || e.section_name || "—",
      academicYear: e.academic_year || "—",
      status: e.status || "—",
    };
  }, [data, studentFirstName, studentMiddleName, studentLastName]);

  const parentName = useMemo(
    () =>
      formatFullName(parentFirstName, parentMiddleName, parentLastName) || "—",
    [parentFirstName, parentMiddleName, parentLastName]
  );

  const outstandingBalance = useMemo(() => {
    // Prefer live finance summary from ledger page endpoint
    const summaryBalance = ledgerSummary?.balance;
    if (summaryBalance !== undefined && summaryBalance !== null) {
      return Number(summaryBalance || 0);
    }

    // Fallback to profile response only if available
    return Number(
      data?.outstanding_balance ??
        data?.profile?.outstanding_balance ??
        data?.enrollment?.outstanding_balance ??
        0
    );
  }, [ledgerSummary, data]);

  const eligibility = useMemo(() => {
    const currentGradeCode = studentInfo.gradeCode;
    const nextGrade = NEXT_GRADE_MAP[currentGradeCode] || null;
    const hasBalance = outstandingBalance > 0;

    if (currentGradeCode === "grade6") {
      return {
        eligible: false,
        badge: "Completed",
        color: "#7c2d12",
        bg: "#ffedd5",
        border: "#fdba74",
        nextGrade: null,
        financeNote: "Clearing balance is no longer the blocker here.",
        academicNote: "Grade 6 completed.",
        message:
          "Congratulations! You already completed Grade 6. No further re-enrollment is needed.",
      };
    }

    if (hasBalance) {
      return {
        eligible: false,
        badge: "Not Eligible",
        color: "#991b1b",
        bg: "#fef2f2",
        border: "#fecaca",
        nextGrade,
        financeNote: "With outstanding balance",
        academicNote: "Grade progression ready",
        message: `You still have an outstanding balance of ₱${outstandingBalance.toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}. Please settle it before re-enrollment.`,
      };
    }

    return {
      eligible: true,
      badge: "Eligible",
      color: "#065f46",
      bg: "#ecfdf5",
      border: "#a7f3d0",
      nextGrade,
      financeNote: "No existing balance",
      academicNote: "No failing-grade check yet",
      message: nextGrade
        ? `You are eligible to re-enroll for ${nextGrade}.`
        : "You are eligible to re-enroll.",
    };
  }, [studentInfo.gradeCode, outstandingBalance]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!eligibility.eligible) {
      setError(eligibility.message);
      addToast("Not Eligible", eligibility.message, "warning");
      return;
    }

    if (!studentFirstName.trim() || !studentLastName.trim()) {
      const msg = "Student first name and last name are required.";
      setError(msg);
      addToast("Missing Information", msg, "warning");
      return;
    }

    if (!parentFirstName.trim() || !parentLastName.trim()) {
      const msg = "Parent first name and last name are required.";
      setError(msg);
      addToast("Missing Information", msg, "warning");
      return;
    }

    if (!contactNumber.trim()) {
      const msg = "Contact number is required.";
      setError(msg);
      addToast("Missing Information", msg, "warning");
      return;
    }

    if (!address.trim()) {
      const msg = "Address is required.";
      setError(msg);
      addToast("Missing Information", msg, "warning");
      return;
    }

    if (!paymentMode.trim()) {
      const msg = "Please select a payment mode.";
      setError(msg);
      addToast("Missing Information", msg, "warning");
      return;
    }

    setSaving(true);

    try {
      const form = new FormData();
      form.append("student_first_name", studentFirstName.trim());
      form.append("student_middle_name", studentMiddleName.trim());
      form.append("student_last_name", studentLastName.trim());
      form.append("parent_first_name", parentFirstName.trim());
      form.append("parent_middle_name", parentMiddleName.trim());
      form.append("parent_last_name", parentLastName.trim());
      form.append("contact_number", contactNumber.trim());
      form.append("address", address.trim());
      form.append("payment_mode", paymentMode);
      form.append("remarks", remarks.trim());

      if (form137File) form.append("form_137_file", form137File);
      if (sf10File) form.append("sf10_file", sf10File);
      if (birthCertificateFile)
        form.append("birth_certificate_file", birthCertificateFile);
      if (goodMoralFile) form.append("good_moral_file", goodMoralFile);
      if (reportCardFile) form.append("report_card_file", reportCardFile);
      if (otherDocumentFile) form.append("other_document_file", otherDocumentFile);

      const token = getToken();
      const res = await fetch(
        `${API_BASE}/api/enrollments/submit-reenrollment/`,
        {
          method: "POST",
          headers: token ? { Authorization: `Token ${token}` } : {},
          body: form,
        }
      );

      const json = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(
          json?.detail || json?.message || "Failed to submit re-enrollment."
        );
      }

      const msg =
        "Re-enrollment application submitted successfully. Please wait for admin review.";
      setSuccess(msg);
      addToast("Submitted", msg, "success");

      setForm137File(null);
      setSf10File(null);
      setBirthCertificateFile(null);
      setGoodMoralFile(null);
      setReportCardFile(null);
      setOtherDocumentFile(null);
    } catch (err) {
      const msg = err.message || "Failed to submit re-enrollment.";
      setError(msg);
      addToast("Submission Failed", msg, "error");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-content">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <div className="loading-spinner">Loading reenrollment details...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="profile-content">
        <Toast toasts={toasts} onDismiss={dismissToast} />
        <div className="error-message">
          {error || "Unable to load reenrollment page."}
        </div>
        <button type="button" onClick={() => navigate("/student")}>
          Back to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="profile-content">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="profile-hero-card">
        <div className="hero-text">
          <h1 className="student-name">Student Re-enrollment</h1>
          <p className="student-lrn">
            Review and update your information before submitting your
            re-enrollment application.
          </p>
        </div>
      </div>

      <div
        style={{
          marginTop: "18px",
          marginBottom: "18px",
          padding: "16px 18px",
          borderRadius: "14px",
          background: eligibility.bg,
          border: `1px solid ${eligibility.border}`,
          color: eligibility.color,
        }}
      >
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            gap: "12px",
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: "13px",
                fontWeight: 800,
                textTransform: "uppercase",
                letterSpacing: "0.5px",
              }}
            >
              Re-enrollment Eligibility
            </div>
            <div style={{ marginTop: "6px", fontSize: "14px", fontWeight: 600 }}>
              {eligibility.message}
            </div>
          </div>

          <div
            style={{
              alignSelf: "flex-start",
              padding: "6px 12px",
              borderRadius: "999px",
              background: "#ffffffaa",
              fontSize: "12px",
              fontWeight: 800,
              whiteSpace: "nowrap",
            }}
          >
            {eligibility.badge}
          </div>
        </div>

        <div
          style={{
            marginTop: "12px",
            display: "grid",
            gap: "6px",
            fontSize: "13px",
          }}
        >
          <div>
            <strong>Current Grade:</strong> {studentInfo.gradeLevel}
          </div>
          <div>
            <strong>Next Grade:</strong> {eligibility.nextGrade || "—"}
          </div>
          <div>
            <strong>Outstanding Balance:</strong> ₱
            {outstandingBalance.toLocaleString(undefined, {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}
          </div>
          <div>
            <strong>Finance Check:</strong> {eligibility.financeNote}
          </div>
          <div>
            <strong>Academic Check:</strong> {eligibility.academicNote}
          </div>
        </div>
      </div>

      <div className="profile-details-grid">
        <section className="details-card">
          <div className="details-header">Student Information</div>
          <div className="details-body">
            <InfoRow label="LRN" value={studentInfo.lrn} />
            <InfoRow label="Student Number" value={studentInfo.studentNumber} />
            <InfoRow label="Grade Level" value={studentInfo.gradeLevel} />
            <InfoRow label="Next Grade" value={eligibility.nextGrade || "—"} />
            <InfoRow label="Section" value={studentInfo.sectionName} />
            <InfoRow label="Academic Year" value={studentInfo.academicYear} />
            <InfoRow label="Current Status" value={studentInfo.status} isLast />
          </div>
        </section>

        <section className="details-card">
          <div className="details-header">Eligibility Overview</div>
          <div className="details-body">
            <InfoRow label="Student Name" value={studentInfo.fullName} />
            <InfoRow label="Parent / Guardian" value={parentName} />
            <InfoRow
              label="Outstanding Balance"
              value={`₱${outstandingBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
            <InfoRow label="Finance Check" value={eligibility.financeNote} />
            <InfoRow label="Academic Check" value={eligibility.academicNote} />
            <InfoRow label="Eligibility" value={eligibility.badge} isLast />
          </div>
        </section>
      </div>

      <form
        className="details-card"
        onSubmit={handleSubmit}
        style={{ marginTop: "20px" }}
      >
        <div className="details-header">Editable Re-enrollment Details</div>
        <div className="details-body">
          {error && (
            <div className="error-message" style={{ marginBottom: "12px" }}>
              {error}
            </div>
          )}

          {success && (
            <div
              style={{
                marginBottom: "12px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#ecfdf5",
                color: "#065f46",
                fontWeight: 600,
              }}
            >
              {success}
            </div>
          )}

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Student First Name</span>
            <input
              className="entry-input"
              value={studentFirstName}
              onChange={(e) => setStudentFirstName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Student Middle Name</span>
            <input
              className="entry-input"
              value={studentMiddleName}
              onChange={(e) => setStudentMiddleName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Student Last Name</span>
            <input
              className="entry-input"
              value={studentLastName}
              onChange={(e) => setStudentLastName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent First Name</span>
            <input
              className="entry-input"
              value={parentFirstName}
              onChange={(e) => setParentFirstName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent Middle Name</span>
            <input
              className="entry-input"
              value={parentMiddleName}
              onChange={(e) => setParentMiddleName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent Last Name</span>
            <input
              className="entry-input"
              value={parentLastName}
              onChange={(e) => setParentLastName(e.target.value)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Contact Number</span>
            <input
              className="entry-input"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09XXXXXXXXX"
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Address</span>
            <textarea
              className="entry-input"
              rows={3}
              value={address}
              onChange={(e) => setAddress(e.target.value)}
              placeholder="Complete home address"
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Payment Mode</span>
            <select
              className="entry-input"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
              disabled={!eligibility.eligible}
            >
              <option value="">Select payment mode</option>
              <option value="cash">Cash</option>
              <option value="installment">Installment</option>
            </select>
          </div>

          <div className="info-entry edit-mode">
            <span className="entry-label">Remarks</span>
            <textarea
              className="entry-input"
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes for re-enrollment"
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="details-header" style={{ marginTop: "18px" }}>
            Re-enrollment Documents
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Form 137-E</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) => setForm137File(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">School Form 10 (SF10)</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) => setSf10File(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Birth Certificate</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) =>
                setBirthCertificateFile(e.target.files?.[0] || null)
              }
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Good Moral Certificate</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) => setGoodMoralFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Report Card</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) => setReportCardFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry edit-mode">
            <span className="entry-label">Other Document</span>
            <input
              type="file"
              className="entry-input"
              onChange={(e) => setOtherDocumentFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="form-actions" style={{ marginTop: "16px" }}>
            <button type="submit" disabled={saving || !eligibility.eligible}>
              {saving ? "Submitting..." : "Submit Re-enrollment"}
            </button>
            <button
              type="button"
              className="secondary"
              onClick={() => navigate("/student")}
              disabled={saving}
            >
              Back to Portal
            </button>
          </div>
        </div>
      </form>
    </div>
  );
}

const InfoRow = ({ label, value, isLast }) => (
  <div className={`info-entry ${!isLast ? "entry-border" : ""}`}>
    <span className="entry-label">{label}</span>
    <span className="entry-value">{value || "—"}</span>
  </div>
);