import React, { useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import "../StudentWebsiteCSS/Profile.css";
import { getToken } from "../Auth/auth";

const API_BASE = "";

const PROFILE_ENDPOINTS = [
  "/api/accounts/me-detail/",
  "/api/accounts/me/detail/",
];

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

async function tryProfileEndpoints() {
  let lastError = null;

  for (const endpoint of PROFILE_ENDPOINTS) {
    try {
      const res = await fetchWithToken(endpoint, { method: "GET" });
      const text = await res.text();

      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { detail: text };
      }

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

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        setSuccess("");

        const result = await tryProfileEndpoints();
        const json = result.data;
        const p = json?.profile || {};
        const e = json?.enrollment || {};

        setData(json);

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
        setError(e.message || "Failed to load profile.");
        setData(null);
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!studentFirstName.trim() || !studentLastName.trim()) {
      setError("Student first name and last name are required.");
      return;
    }

    if (!parentFirstName.trim() || !parentLastName.trim()) {
      setError("Parent first name and last name are required.");
      return;
    }

    if (!contactNumber.trim()) {
      setError("Contact number is required.");
      return;
    }

    if (!address.trim()) {
      setError("Address is required.");
      return;
    }

    if (!paymentMode.trim()) {
      setError("Please select a payment mode.");
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
      if (birthCertificateFile) form.append("birth_certificate_file", birthCertificateFile);
      if (goodMoralFile) form.append("good_moral_file", goodMoralFile);
      if (reportCardFile) form.append("report_card_file", reportCardFile);
      if (otherDocumentFile) form.append("other_document_file", otherDocumentFile);

      const token = getToken();
      const res = await fetch(`${API_BASE}/api/enrollments/submit-reenrollment/`, {
        method: "POST",
        headers: token ? { Authorization: `Token ${token}` } : {},
        body: form,
      });

      const text = await res.text();
      let json = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = { detail: text };
      }

      if (!res.ok) {
        throw new Error(json?.detail || json?.message || "Failed to submit re-enrollment.");
      }

      setSuccess("Re-enrollment application submitted successfully. Please wait for admin review.");

      setForm137File(null);
      setSf10File(null);
      setBirthCertificateFile(null);
      setGoodMoralFile(null);
      setReportCardFile(null);
      setOtherDocumentFile(null);
    } catch (err) {
      setError(err.message || "Failed to submit re-enrollment.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="profile-content">
        <div className="loading-spinner">Loading reenrollment details...</div>
      </div>
    );
  }

  if (error && !data) {
    return (
      <div className="profile-content">
        <div className="error-message">{error || "Unable to load reenrollment page."}</div>
        <button type="button" onClick={() => navigate("/student")}>
          Back to Portal
        </button>
      </div>
    );
  }

  return (
    <div className="profile-content">
      <div className="profile-hero-card">
        <div className="hero-text">
          <h1 className="student-name">Student Re-enrollment</h1>
          <p className="student-lrn">
            Review and update your information before submitting your re-enrollment application.
          </p>
        </div>
      </div>

      <div className="profile-details-grid">
        <section className="details-card">
          <div className="details-header">Student Information</div>
          <div className="details-body">
            <InfoRow label="LRN" value={studentInfo.lrn} />
            <InfoRow label="Student Number" value={studentInfo.studentNumber} />
            <InfoRow label="Grade Level" value={studentInfo.gradeLevel} />
            <InfoRow label="Section" value={studentInfo.sectionName} />
            <InfoRow label="Academic Year" value={studentInfo.academicYear} />
            <InfoRow label="Current Status" value={studentInfo.status} isLast />
          </div>
        </section>

        <section className="details-card">
          <div className="details-header">Personal Information</div>
          <div className="details-body">
            <InfoRow label="Student Name" value={studentInfo.fullName} />
            <InfoRow label="Parent / Guardian" value={parentName} />
            <InfoRow label="Contact Number" value={contactNumber || "—"} />
            <InfoRow label="Address" value={address || "—"} />
            <InfoRow label="Payment Mode" value={paymentMode || "—"} isLast />
          </div>
        </section>
      </div>

      <form className="details-card" onSubmit={handleSubmit} style={{ marginTop: "20px" }}>
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
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Student Middle Name</span>
            <input
              className="entry-input"
              value={studentMiddleName}
              onChange={(e) => setStudentMiddleName(e.target.value)}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Student Last Name</span>
            <input
              className="entry-input"
              value={studentLastName}
              onChange={(e) => setStudentLastName(e.target.value)}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent First Name</span>
            <input
              className="entry-input"
              value={parentFirstName}
              onChange={(e) => setParentFirstName(e.target.value)}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent Middle Name</span>
            <input
              className="entry-input"
              value={parentMiddleName}
              onChange={(e) => setParentMiddleName(e.target.value)}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Parent Last Name</span>
            <input
              className="entry-input"
              value={parentLastName}
              onChange={(e) => setParentLastName(e.target.value)}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Contact Number</span>
            <input
              className="entry-input"
              value={contactNumber}
              onChange={(e) => setContactNumber(e.target.value)}
              placeholder="09XXXXXXXXX"
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
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Payment Mode</span>
            <select
              className="entry-input"
              value={paymentMode}
              onChange={(e) => setPaymentMode(e.target.value)}
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
            />
          </div>
          
          <div className="details-header" style={{ marginTop: "18px" }}>
            Re-enrollment Documents
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Form 137-E</span>
            <input type="file" className="entry-input" onChange={(e) => setForm137File(e.target.files?.[0] || null)} />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">School Form 10 (SF10)</span>
            <input type="file" className="entry-input" onChange={(e) => setSf10File(e.target.files?.[0] || null)} />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Birth Certificate</span>
            <input type="file" className="entry-input" onChange={(e) => setBirthCertificateFile(e.target.files?.[0] || null)} />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Good Moral Certificate</span>
            <input type="file" className="entry-input" onChange={(e) => setGoodMoralFile(e.target.files?.[0] || null)} />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Report Card</span>
            <input type="file" className="entry-input" onChange={(e) => setReportCardFile(e.target.files?.[0] || null)} />
          </div>

          <div className="info-entry edit-mode">
            <span className="entry-label">Other Document</span>
            <input type="file" className="entry-input" onChange={(e) => setOtherDocumentFile(e.target.files?.[0] || null)} />
          </div>

          <div className="form-actions" style={{ marginTop: "16px" }}>
            <button type="submit" disabled={saving}>
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