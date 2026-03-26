import React, { useEffect, useMemo, useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import "../StudentWebsiteCSS/StudentEnroll.css";
import { getToken } from "../Auth/auth";
import Toast from "../Global/Toast";

const API_BASE = "";

const PROFILE_ENDPOINTS = [
  "/api/accounts/me/detail/",
];

const LEDGER_SUMMARY_ENDPOINT = "/api/finance/my-ledger-summary/";
const MY_GRADES_ENDPOINT = "/api/grades/my-grades/";

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

const NAME_REGEX = /^[a-zA-ZÀ-ÿ.'\-\s]+$/;
const ALLOWED_FILE_TYPES = [
  "application/pdf",
  "image/jpeg",
  "image/jpg",
  "image/png",
];
const MAX_FILE_SIZE = 5 * 1024 * 1024;

async function fetchWithToken(url, options = {}) {
  const token = getToken();
  const headers = {
    ...(options.headers || {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };

  return fetch(`${API_BASE}${url}`, {
    ...options,
    headers,
  });
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
  const res = await fetchWithToken(LEDGER_SUMMARY_ENDPOINT, { method: "GET" });
  const json = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(json?.detail || "Failed to load ledger summary.");
  }

  return json || {};
}

async function loadMyGrades() {
  const res = await fetchWithToken(MY_GRADES_ENDPOINT, { method: "GET" });
  const json = await parseJsonSafe(res);

  if (!res.ok) {
    throw new Error(json?.detail || "Failed to load grades.");
  }

  return Array.isArray(json) ? json : [];
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

  return map[v.toLowerCase()] || v;
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

const normalizePhone = (value) => String(value || "").replace(/[^\d+]/g, "");

const isValidPHMobile = (value) => {
  const v = normalizePhone(value);
  return /^09\d{9}$/.test(v) || /^\+639\d{9}$/.test(v);
};

const isValidName = (value) => {
  const v = String(value || "").trim();
  return !!v && NAME_REGEX.test(v);
};

const validateUploadFile = (file, label) => {
  if (!file) return null;

  if (!ALLOWED_FILE_TYPES.includes(file.type)) {
    return `${label} must be PDF, JPG, or PNG only.`;
  }

  if (file.size > MAX_FILE_SIZE) {
    return `${label} must be 5MB or smaller.`;
  }

  return null;
};

const splitAddress = (address = "") => {
  const parts = String(address).split(",").map((p) => p.trim());
  return {
    street: parts[0] || "",
    barangay: parts[1] || "",
    city: parts[2] || "",
    province: parts[3] || "",
    region: parts[4] || "",
    zip_code: parts[5] || "",
  };
};

const buildAddress = ({ street, barangay, city, province, region, zipCode }) =>
  [street, barangay, city, province, region, zipCode]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");

export default function StudentReenrollment() {
  const navigate = useNavigate();

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const [data, setData] = useState(null);
  const [ledgerSummary, setLedgerSummary] = useState(null);
  const [grades, setGrades] = useState([]);

  const [studentFirstName, setStudentFirstName] = useState("");
  const [studentMiddleName, setStudentMiddleName] = useState("");
  const [studentLastName, setStudentLastName] = useState("");

  const [parentFirstName, setParentFirstName] = useState("");
  const [parentMiddleName, setParentMiddleName] = useState("");
  const [parentLastName, setParentLastName] = useState("");

  const [contactNumber, setContactNumber] = useState("");
  const [paymentMode, setPaymentMode] = useState("");
  const [remarks, setRemarks] = useState("");

  const [street, setStreet] = useState("");
  const [barangay, setBarangay] = useState("");
  const [city, setCity] = useState("");
  const [province, setProvince] = useState("");
  const [region, setRegion] = useState("");
  const [zipCode, setZipCode] = useState("");

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

        const [profileResult, summaryResult, gradesResult] = await Promise.allSettled([
          tryProfileEndpoints(),
          loadLedgerSummary(),
          loadMyGrades(),
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
            summaryResult.reason?.message ||
              "Could not load ledger summary. Finance eligibility may be incomplete.",
            "warning"
          );
        }

        if (gradesResult.status === "fulfilled") {
          setGrades(gradesResult.value || []);
        } else {
          setGrades([]);
          addToast(
            "Grades Warning",
            gradesResult.reason?.message ||
              "Could not load grades. Academic eligibility may be incomplete.",
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
        setPaymentMode(p.payment_mode || e.payment_mode || "");

        const parsedAddress = splitAddress(p.address || e.address || "");
        setStreet(parsedAddress.street);
        setBarangay(parsedAddress.barangay);
        setCity(parsedAddress.city);
        setProvince(parsedAddress.province);
        setRegion(parsedAddress.region);
        setZipCode(parsedAddress.zip_code);
      } catch (e) {
        const msg = e.message || "Failed to load reenrollment data.";
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
    const summaryBalance = ledgerSummary?.balance;
    if (summaryBalance !== undefined && summaryBalance !== null) {
      return Number(summaryBalance || 0);
    }

    return Number(
      data?.outstanding_balance ??
        data?.profile?.outstanding_balance ??
        data?.enrollment?.outstanding_balance ??
        0
    );
  }, [ledgerSummary, data]);

  const gradeSummary = useMemo(() => {
    const totalSubjects = grades.length;
    const incompleteSubjects = grades.filter((g) => g.final_grade === null).length;
    const completedSubjects = totalSubjects - incompleteSubjects;
    const failedSubjects = grades.filter(
      (g) => g.final_grade !== null && Number(g.final_grade) < 75
    ).length;
    const passedSubjects = grades.filter(
      (g) => g.final_grade !== null && Number(g.final_grade) >= 75
    ).length;

    return {
      totalSubjects,
      completedSubjects,
      incompleteSubjects,
      failedSubjects,
      passedSubjects,
    };
  }, [grades]);

  const eligibility = useMemo(() => {
    const currentGradeCode = studentInfo.gradeCode;
    const nextGrade = NEXT_GRADE_MAP[currentGradeCode] || null;
    const hasBalance = outstandingBalance > 0;
    const hasIncompleteGrades = gradeSummary.incompleteSubjects > 0;
    const hasFailingGrades = gradeSummary.failedSubjects > 0;

    if (currentGradeCode === "grade6") {
      return {
        eligible: false,
        badge: "Completed",
        color: "#7c2d12",
        bg: "#ffedd5",
        border: "#fdba74",
        nextGrade: "Grade 7 (High School)",
        financeNote: "No existing balance",
        academicNote: "Grade 6 completed.",
        message:
          "Congratulations! You already completed Grade 6.",
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
        academicNote: "Academic check pending",
        message: `You still have an outstanding balance of ₱${outstandingBalance.toLocaleString(
          undefined,
          {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }
        )}. Please settle it before enrolling.`,
      };
    }

    if (hasIncompleteGrades) {
      return {
        eligible: false,
        badge: "Not Eligible",
        color: "#92400e",
        bg: "#fffbeb",
        border: "#fcd34d",
        nextGrade,
        financeNote: "No existing balance",
        academicNote: "Incomplete grades detected",
        message:
          "You have incomplete grades. Please wait until all subjects have final grades before enrolling.",
      };
    }

    if (hasFailingGrades) {
      return {
        eligible: false,
        badge: "Not Eligible",
        color: "#991b1b",
        bg: "#fef2f2",
        border: "#fecaca",
        nextGrade,
        financeNote: "No existing balance",
        academicNote: "Failing grades detected",
        message:
          "You have failing grades. Please coordinate with the school before enrolling.",
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
      academicNote: "No incomplete or failing grades",
      message: nextGrade
        ? `You are eligible to enroll for ${nextGrade}.`
        : "You are eligible to enroll.",
    };
  }, [studentInfo.gradeCode, outstandingBalance, gradeSummary]);

  const formValidation = useMemo(() => {
    const errors = [];

    if (!studentFirstName.trim()) errors.push("Student first name is required.");
    else if (!isValidName(studentFirstName)) {
      errors.push("Student first name contains invalid characters.");
    }

    if (studentMiddleName.trim() && !isValidName(studentMiddleName)) {
      errors.push("Student middle name contains invalid characters.");
    }

    if (!studentLastName.trim()) errors.push("Student last name is required.");
    else if (!isValidName(studentLastName)) {
      errors.push("Student last name contains invalid characters.");
    }

    if (!parentFirstName.trim()) errors.push("Parent first name is required.");
    else if (!isValidName(parentFirstName)) {
      errors.push("Parent first name contains invalid characters.");
    }

    if (parentMiddleName.trim() && !isValidName(parentMiddleName)) {
      errors.push("Parent middle name contains invalid characters.");
    }

    if (!parentLastName.trim()) errors.push("Parent last name is required.");
    else if (!isValidName(parentLastName)) {
      errors.push("Parent last name contains invalid characters.");
    }

    if (!contactNumber.trim()) {
      errors.push("Contact number is required.");
    } else if (!isValidPHMobile(contactNumber)) {
      errors.push("Contact number must be 09XXXXXXXXX or +639XXXXXXXXX.");
    }

    if (!street.trim()) errors.push("House No. / Street is required.");
    if (!barangay.trim()) errors.push("Barangay is required.");
    if (!city.trim()) errors.push("City / Municipality is required.");
    if (!province.trim()) errors.push("Province is required.");
    if (!region.trim()) errors.push("Region is required.");
    if (!zipCode.trim()) {
      errors.push("ZIP Code is required.");
    } else if (!/^\d{4}$/.test(zipCode.trim())) {
      errors.push("ZIP Code must be exactly 4 digits.");
    }

    if (!paymentMode.trim()) {
      errors.push("Please select a payment mode.");
    }

    if (remarks.trim().length > 500) {
      errors.push("Remarks must not exceed 500 characters.");
    }

    const fileChecks = [
      validateUploadFile(form137File, "Form 137-E"),
      validateUploadFile(sf10File, "School Form 10"),
      validateUploadFile(birthCertificateFile, "Birth Certificate"),
      validateUploadFile(goodMoralFile, "Good Moral Certificate"),
      validateUploadFile(reportCardFile, "Report Card"),
      validateUploadFile(otherDocumentFile, "Other Document"),
    ].filter(Boolean);

    errors.push(...fileChecks);

    return {
      valid: errors.length === 0,
      errors,
    };
  }, [
    studentFirstName,
    studentMiddleName,
    studentLastName,
    parentFirstName,
    parentMiddleName,
    parentLastName,
    contactNumber,
    street,
    barangay,
    city,
    province,
    region,
    zipCode,
    paymentMode,
    remarks,
    form137File,
    sf10File,
    birthCertificateFile,
    goodMoralFile,
    reportCardFile,
    otherDocumentFile,
  ]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setSuccess("");

    if (!eligibility.eligible) {
      setError(eligibility.message);
      addToast("Not Eligible", eligibility.message, "warning");
      return;
    }

    if (!formValidation.valid) {
      const msg = formValidation.errors[0];
      setError(msg);
      addToast("Validation Error", msg, "warning");
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
      form.append("contact_number", normalizePhone(contactNumber.trim()));
      form.append(
        "address",
        buildAddress({
          street,
          barangay,
          city,
          province,
          region,
          zipCode,
        })
      );
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

      const json = await parseJsonSafe(res);

      if (!res.ok) {
        throw new Error(
          json?.detail || json?.message || "Failed to submit enrollment."
        );
      }

      const msg =
        "Enrollment application submitted successfully. Please wait for admin review.";
      setSuccess(msg);
      addToast("Submitted", msg, "success");

      setForm137File(null);
      setSf10File(null);
      setBirthCertificateFile(null);
      setGoodMoralFile(null);
      setReportCardFile(null);
      setOtherDocumentFile(null);
      setRemarks("");
    } catch (err) {
      const msg = err.message || "Failed to submit enrollment.";
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
          <h1 className="student-name">Student enrollment</h1>
          <p className="student-lrn">
            Review and update your information before submitting your
            enrollment application.
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
              enrollment Eligibility
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
              label="Address"
              value={
                buildAddress({ street, barangay, city, province, region, zipCode }) || "—"
              }
            />
            <InfoRow
              label="Outstanding Balance"
              value={`₱${outstandingBalance.toLocaleString(undefined, {
                minimumFractionDigits: 2,
                maximumFractionDigits: 2,
              })}`}
            />
            <InfoRow
              label="Completed Subjects"
              value={`${gradeSummary.completedSubjects}/${gradeSummary.totalSubjects}`}
            />
            <InfoRow
              label="Incomplete Subjects"
              value={String(gradeSummary.incompleteSubjects)}
            />
            <InfoRow
              label="Failed Subjects"
              value={String(gradeSummary.failedSubjects)}
            />
            <InfoRow label="Eligibility" value={eligibility.badge} isLast />
          </div>
        </section>
      </div>

      <form
        className="details-card"
        onSubmit={handleSubmit}
        style={{ marginTop: "20px" }}
      >
        <div className="details-header">Editable enrollment Details</div>
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

          <div className="details-header" style={{ marginTop: "18px" }}>
            Address
          </div>

          <div className="form-grid">
            <div className="form-group form-group--full">
              <label>
                House No. / Street<span className="required">*</span>
              </label>
              <input
                value={street}
                onChange={(e) => setStreet(e.target.value)}
                placeholder="e.g. 123 Rizal St."
                disabled={!eligibility.eligible}
                required
              />
            </div>

            <div className="form-group">
              <label>
                Barangay<span className="required">*</span>
              </label>
              <input
                value={barangay}
                onChange={(e) => setBarangay(e.target.value)}
                placeholder="e.g. Brgy. Santo Niño"
                disabled={!eligibility.eligible}
                required
              />
            </div>

            <div className="form-group">
              <label>
                City / Municipality<span className="required">*</span>
              </label>
              <input
                value={city}
                onChange={(e) => setCity(e.target.value)}
                placeholder="e.g. Caloocan City"
                disabled={!eligibility.eligible}
                required
              />
            </div>

            <div className="form-group">
              <label>
                Province<span className="required">*</span>
              </label>
              <input
                value={province}
                onChange={(e) => setProvince(e.target.value)}
                placeholder="e.g. Metro Manila"
                disabled={!eligibility.eligible}
                required
              />
            </div>

            <div className="form-group">
              <label>
                Region<span className="required">*</span>
              </label>
              <select
                value={region}
                onChange={(e) => setRegion(e.target.value)}
                disabled={!eligibility.eligible}
                required
              >
                <option value="">Select Region</option>
                <option value="NCR">NCR – National Capital Region</option>
                <option value="Region I">Region I – Ilocos Region</option>
                <option value="Region II">Region II – Cagayan Valley</option>
                <option value="Region III">Region III – Central Luzon</option>
                <option value="Region IV-A">Region IV-A – CALABARZON</option>
                <option value="Region IV-B">Region IV-B – MIMAROPA</option>
                <option value="Region V">Region V – Bicol Region</option>
                <option value="Region VI">Region VI – Western Visayas</option>
                <option value="Region VII">Region VII – Central Visayas</option>
                <option value="Region VIII">Region VIII – Eastern Visayas</option>
                <option value="Region IX">Region IX – Zamboanga Peninsula</option>
                <option value="Region X">Region X – Northern Mindanao</option>
                <option value="Region XI">Region XI – Davao Region</option>
                <option value="Region XII">Region XII – SOCCSKSARGEN</option>
                <option value="Region XIII">Region XIII – Caraga</option>
                <option value="CAR">CAR – Cordillera Administrative Region</option>
                <option value="BARMM">BARMM – Bangsamoro</option>
              </select>
            </div>

            <div className="form-group">
              <label>
                ZIP Code<span className="required">*</span>
              </label>
              <input
                value={zipCode}
                onChange={(e) =>
                  setZipCode(e.target.value.replace(/\D/g, "").slice(0, 4))
                }
                placeholder="e.g. 1400"
                maxLength={4}
                inputMode="numeric"
                disabled={!eligibility.eligible}
                required
              />
            </div>
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
            <textareapush
              className="entry-input"
              rows={4}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
              placeholder="Optional notes for enrollment"
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="details-header" style={{ marginTop: "18px" }}>
            enrollment Documents
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Form 137-E</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="entry-input"
              onChange={(e) => setForm137File(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">School Form 10 (SF10)</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="entry-input"
              onChange={(e) => setSf10File(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Birth Certificate</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
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
              accept=".pdf,.png,.jpg,.jpeg"
              className="entry-input"
              onChange={(e) => setGoodMoralFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry entry-border edit-mode">
            <span className="entry-label">Report Card</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="entry-input"
              onChange={(e) => setReportCardFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          <div className="info-entry edit-mode">
            <span className="entry-label">Other Document</span>
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg"
              className="entry-input"
              onChange={(e) => setOtherDocumentFile(e.target.files?.[0] || null)}
              disabled={!eligibility.eligible}
            />
          </div>

          {!formValidation.valid && (
            <div
              style={{
                marginTop: "14px",
                marginBottom: "10px",
                padding: "10px 12px",
                borderRadius: "10px",
                background: "#fff7ed",
                color: "#9a3412",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {formValidation.errors[0]}
            </div>
          )}

          <div className="form-actions" style={{ marginTop: "16px" }}>
            <button type="submit" disabled={saving || !eligibility.eligible}>
              {saving ? "Submitting..." : "Submit enrollment"}
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