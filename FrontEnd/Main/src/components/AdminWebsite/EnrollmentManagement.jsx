import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Edit2, Trash2, Search, Filter,
  CheckCircle, Clock, AlertCircle, XCircle, Eye, RefreshCw,
  AlertTriangle, ArrowUpCircle, FileText, Settings, Calendar, X,
  Users, UserCheck, UserMinus, UserX, Paperclip, ExternalLink,
} from "lucide-react";
import StatCard, { StatsGrid } from "./StatCard";
import Pagination from "./Pagination";
import "../AdminWebsiteCSS/EnrollmentManagement.css";
import { apiFetch } from "../api/apiFetch";
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';


/* ─────────────────────────────────────────────
   LABELS / HELPERS
───────────────────────────────────────────── */
const gradeLabel = (code) => ({
  prek: "Pre-Kinder",
  kinder: "Kindergarten",
  grade1: "Grade 1",
  grade2: "Grade 2",
  grade3: "Grade 3",
  grade4: "Grade 4",
  grade5: "Grade 5",
  grade6: "Grade 6",
}[code] || code || "");

const statusLabel = (s) => ({
  ACTIVE: "Active",
  PENDING: "Pending",
  DROPPED: "Dropped",
  COMPLETED: "Completed",
  EXPIRED: "Expired",
}[s] || s || "");

const FILTER_OPTIONS = [
  { value: "All", label: "All Status" },
  { value: "Active", label: "Enrolled" },
  { value: "Pending", label: "Pending" },
  { value: "Dropped", label: "Dropped" },
  { value: "Completed", label: "Completed" },
  { value: "Expired", label: "Expired" },
];

const DOCUMENT_TYPE_OPTIONS = [
  { value: "form_137", label: "Form 137-E" },
  { value: "sf10", label: "School Form 10 (SF10)" },
  { value: "birth_certificate", label: "Birth Certificate" },
  { value: "good_moral", label: "Good Moral Certificate" },
  { value: "report_card", label: "Report Card" },
  { value: "other", label: "Other Document" },
];

const matchesStatusFilter = (filterStatus, statusText, isExpired) => {
  if (filterStatus === "Expired") return isExpired;
  if (filterStatus === "All") return !isExpired;
  return !isExpired && statusText === filterStatus;
};

const GRADE_AGE_RULES = {
  prek: { min: 3, max: 5, label: "Pre-Kinder" },
  kinder: { min: 4, max: 6, label: "Kindergarten" },
  grade1: { min: 5, max: 7, label: "Grade 1" },
  grade2: { min: 6, max: 8, label: "Grade 2" },
  grade3: { min: 7, max: 9, label: "Grade 3" },
  grade4: { min: 8, max: 10, label: "Grade 4" },
  grade5: { min: 9, max: 11, label: "Grade 5" },
  grade6: { min: 10, max: 12, label: "Grade 6" },
};

const GRADE_PROGRESSION = {
  prek: { next: "kinder", nextEdu: "preschool" },
  kinder: { next: "grade1", nextEdu: "elementary" },
  grade1: { next: "grade2", nextEdu: "elementary" },
  grade2: { next: "grade3", nextEdu: "elementary" },
  grade3: { next: "grade4", nextEdu: "elementary" },
  grade4: { next: "grade5", nextEdu: "elementary" },
  grade5: { next: "grade6", nextEdu: "elementary" },
  grade6: { next: null, nextEdu: null },
};

const getNextGrade = (gradeCode) =>
  GRADE_PROGRESSION[gradeCode] || { next: null, nextEdu: null };

const advanceAcademicYear = (academicYear) => {
  if (!academicYear) return getCurrentAcademicYear();
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return getCurrentAcademicYear();
  const end = parseInt(parts[1], 10);
  if (isNaN(end)) return getCurrentAcademicYear();
  return `${end}-${end + 1}`;
};

const validateAgeForGrade = (birthDate, gradeCode) => {
  if (!birthDate || !gradeCode) return true;
  const rule = GRADE_AGE_RULES[gradeCode];
  if (!rule) return true;
  const bd = new Date(birthDate + "T00:00:00");
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  if (age < rule.min) return `Student is too young for ${rule.label}. Minimum age is ${rule.min} (current age: ${age}).`;
  if (age > rule.max) return `Student is too old for ${rule.label}. Maximum age is ${rule.max} (current age: ${age}).`;
  return true;
};

const getAcademicYearExpiry = (academicYear) => {
  if (!academicYear) return null;
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return null;
  const endYear = parseInt(parts[1], 10);
  if (isNaN(endYear)) return null;
  return new Date(endYear, 2, 31, 23, 59, 59);
};

const isEnrollmentExpired = (academicYear) => {
  const expiry = getAcademicYearExpiry(academicYear);
  return expiry ? new Date() > expiry : false;
};

const formatExpiryDate = (academicYear) => {
  const expiry = getAcademicYearExpiry(academicYear);
  if (!expiry) return "—";
  return expiry.toLocaleDateString("en-PH", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
};

const fmtDate = (date) =>
  date instanceof Date
    ? date.toLocaleDateString("en-PH", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "—";

const computeEnrollmentWindow = (settings) => {
  const autoOpen = () => {
    const today = new Date();
    const year = today.getFullYear();
    const startYear = today.getMonth() >= 5 ? year : year - 1;
    return new Date(startYear, 5, 1);
  };

  const openDate = settings?.open_date
    ? new Date(settings.open_date + "T00:00:00")
    : autoOpen();

  const days = Math.max(1, parseInt(settings?.window_days ?? 7, 10));
  const closeDate = new Date(openDate);
  closeDate.setDate(openDate.getDate() + days - 1);
  closeDate.setHours(23, 59, 59, 999);

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  const isOpen = today >= openDate && today <= closeDate;
  const daysLeft = isOpen ? Math.ceil((closeDate - today) / 86_400_000) : 0;

  const autoAY = () => {
    const y = openDate.getFullYear();
    return `${y}-${y + 1}`;
  };

  const academicYear = settings?.academic_year || autoAY();
  return { isOpen, openDate, closeDate, daysLeft, academicYear };
};

const splitFullName = (fullName = "") => {
  const parts = String(fullName).trim().split(/\s+/).filter(Boolean);
  if (parts.length === 0) return { first: "", middle: "", last: "" };
  if (parts.length === 1) return { first: parts[0], middle: "", last: "" };
  if (parts.length === 2) return { first: parts[0], middle: "", last: parts[1] };
  return {
    first: parts[0],
    middle: parts.slice(1, -1).join(" "),
    last: parts[parts.length - 1],
  };
};

const buildName = (first, middle, last) =>
  [first, middle, last]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(" ");

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

const buildAddress = ({ street, barangay, city, province, region, zip_code }) =>
  [street, barangay, city, province, region, zip_code]
    .map((p) => String(p || "").trim())
    .filter(Boolean)
    .join(", ");

const emptyForm = () => ({
  first_name: "",
  last_name: "",
  middle_name: "",
  birth_date: "",
  gender: "",
  lrn: "",
  education_level: "",
  grade_level: "",
  student_type: "",
  academic_year: "2024-2025",
  status: "PENDING",
  payment_mode: "",
  section: "",
  email: "",
  religion: "",
  telephone_number: "",
  mobile_number: "",
  parent_facebook: "",
  street: "",
  barangay: "",
  city: "",
  province: "",
  region: "",
  zip_code: "",
  remarks: "",
  parent_info: {
    father_first: "",
    father_middle: "",
    father_last: "",
    father_contact: "",
    father_occupation: "",
    mother_first: "",
    mother_middle: "",
    mother_last: "",
    mother_contact: "",
    mother_occupation: "",
    guardian_first: "",
    guardian_middle: "",
    guardian_last: "",
    guardian_contact: "",
    guardian_relationship: "",
  },
});

const getCurrentAcademicYear = () => {
  const today = new Date();
  const year = today.getFullYear();
  return today.getMonth() >= 5 ? `${year}-${year + 1}` : `${year - 1}-${year}`;
};

const todayISO = () => new Date().toISOString().split("T")[0];

const calcAge = (yyyyMMdd) => {
  if (!yyyyMMdd) return null;
  const bd = new Date(yyyyMMdd + "T00:00:00");
  const now = new Date();
  let age = now.getFullYear() - bd.getFullYear();
  const m = now.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && now.getDate() < bd.getDate())) age--;
  return age;
};

const validateBirthDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return true;
  const bd = new Date(yyyyMMdd + "T00:00:00");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  if (bd >= today) return "Birth date must be in the past.";
  const age = calcAge(yyyyMMdd);
  if (age < 3) return "Student must be at least 3 years old.";
  if (age > 18) return "Student age exceeds allowed school range.";
  return true;
};

const normalizePHMobile = (number) => {
  if (!number) return "";
  const cleaned = String(number).replace(/[\s\-()]/g, "");
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  return null;
};

const normalizeSectionGrade = (value) => {
  const v = String(value ?? "").trim().toLowerCase();
  if (v === "0" || v === "k" || v === "kinder" || v === "kindergarten") return "kinder";
  if (v === "prek" || v === "pre-k" || v === "pre kinder" || v === "pre-kinder") return "prek";
  if (v === "1" || v === "grade1" || v === "grade 1") return "grade1";
  if (v === "2" || v === "grade2" || v === "grade 2") return "grade2";
  if (v === "3" || v === "grade3" || v === "grade 3") return "grade3";
  if (v === "4" || v === "grade4" || v === "grade 4") return "grade4";
  if (v === "5" || v === "grade5" || v === "grade 5") return "grade5";
  if (v === "6" || v === "grade6" || v === "grade 6") return "grade6";
  return v;
};

const STATUS_STYLES = {
  ACTIVE: { background: "#d1fae5", color: "#065f46" },
  PENDING: { background: "#fef3c7", color: "#92400e" },
  DROPPED: { background: "#fee2e2", color: "#7f1d1d" },
  COMPLETED: { background: "#dbeafe", color: "#1e40af" },
  EXPIRED: { background: "#f3e8ff", color: "#6b21a8" },
};

const FEE_STYLES = {
  cash: { background: "#d1fae5", color: "#065f46" },
  Paid: { background: "#d1fae5", color: "#065f46" },
  installment: { background: "#fef3c7", color: "#92400e" },
  Pending: { background: "#fef3c7", color: "#92400e" },
};

const badgeStyle = (map, key) => ({
  display: "inline-flex",
  alignItems: "center",
  gap: "5px",
  padding: "4px 10px",
  borderRadius: "20px",
  fontSize: "11px",
  fontWeight: 700,
  textTransform: "uppercase",
  letterSpacing: "0.4px",
  whiteSpace: "nowrap",
  lineHeight: 1,
  ...(map[key] || { background: "#f3f4f6", color: "#6b7280" }),
});

const StatusBadge = ({ code, expired }) => {
  const displayCode =
    expired && code !== "DROPPED" && code !== "COMPLETED" ? "EXPIRED" : code;
  const icon =
    displayCode === "EXPIRED" ? (
      <AlertTriangle size={12} />
    ) : displayCode === "ACTIVE" || displayCode === "COMPLETED" ? (
      <CheckCircle size={12} />
    ) : displayCode === "DROPPED" ? (
      <XCircle size={12} />
    ) : (
      <Clock size={12} />
    );
  return (
    <span style={badgeStyle(STATUS_STYLES, displayCode)}>
      {icon}
      {statusLabel(displayCode)}
    </span>
  );
};

const FeeBadge = ({ fee }) => {
  const icon =
    fee === "cash" || fee === "Paid" ? (
      <CheckCircle size={12} />
    ) : fee === "installment" || fee === "Pending" ? (
      <Clock size={12} />
    ) : (
      <AlertCircle size={12} />
    );
  return (
    <span style={badgeStyle(FEE_STYLES, fee)}>
      {icon}
      {String(fee).toUpperCase()}
    </span>
  );
};

const Toast = ({ toasts, onDismiss }) => (
  <div
    style={{
      position: "fixed",
      top: 20,
      right: 20,
      zIndex: 9999,
      display: "flex",
      flexDirection: "column",
      gap: 10,
      maxWidth: 380,
    }}
  >
    {toasts.map((t) => (
      <div
        key={t.id}
        style={{
          background:
            t.type === "error"
              ? "#1c0a0a"
              : t.type === "success"
                ? "#052e16"
                : "#1a1d2e",
          color: "white",
          padding: "14px 18px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          borderLeft: `4px solid ${
            t.type === "error"
              ? "#ef4444"
              : t.type === "success"
                ? "#22c55e"
                : "#f59e0b"
          }`,
        }}
      >
        <AlertTriangle
          size={17}
          style={{
            flexShrink: 0,
            marginTop: 1,
            color:
              t.type === "error"
                ? "#f87171"
                : t.type === "success"
                  ? "#4ade80"
                  : "#fbbf24",
          }}
        />
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{t.title}</div>
          <div style={{ opacity: 0.8 }}>{t.message}</div>
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          style={{
            background: "none",
            border: "none",
            color: "white",
            cursor: "pointer",
            padding: 0,
            fontSize: 16,
            opacity: 0.6,
            flexShrink: 0,
          }}
        >
          ✕
        </button>
      </div>
    ))}
  </div>
);

const exportToPDF = (enrollments, stats, window_) => {
  // Create new PDF document
  const doc = new jsPDF('landscape');
  
  // Add title and header
  doc.setFontSize(18);
  doc.setTextColor(33, 37, 41);
  doc.text('Enrollment Report', 14, 15);
  
  // Add date
  doc.setFontSize(10);
  doc.setTextColor(108, 117, 125);
  const currentDate = new Date().toLocaleDateString('en-PH', {
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
  doc.text(`Generated: ${currentDate}`, 14, 22);
  
  // Add stats summary
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text('Summary Statistics', 14, 35);
  
  const statsData = [
    ['Total Enrollments', stats.total.toString()],
    ['Active/Enrolled', stats.active.toString()],
    ['Pending', stats.pending.toString()],
    ['Declined/Dropped', stats.dropped.toString()],
    ['Expired', stats.expired.toString()],
    ['Enrollment Status', window_.isOpen ? `Open (${window_.daysLeft} days left)` : 'Closed'],
    ['Academic Year', window_.academicYear || '—'],
  ];
  
  // Use autoTable function directly
  autoTable(doc, {
    startY: 40,
    head: [['Metric', 'Value']],
    body: statsData,
    theme: 'grid',
    headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 10 },
    bodyStyles: { fontSize: 9 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 80 },
      1: { cellWidth: 40 }
    }
  });
  
  // Add enrollment data table
  const finalY = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(12);
  doc.setTextColor(33, 37, 41);
  doc.text('Enrollment Details', 14, finalY);
  
  // Prepare table data
  const tableData = enrollments.map(enrollment => [
    enrollment.studentName,
    enrollment.gradeLevel,
    enrollment.sectionName,
    enrollment.enrollmentDate ? new Date(enrollment.enrollmentDate).toLocaleDateString() : '—',
    enrollment.statusText + (enrollment.expired ? ' (Expired)' : ''),
    enrollment.fee === 'cash' || enrollment.fee === 'Paid' ? 'Cash' : 'Installment',
    enrollment.parentName,
    enrollment.phone
  ]);
  
  // Add enrollment table
  autoTable(doc, {
    startY: finalY + 5,
    head: [['Student Name', 'Grade', 'Section', 'Enrollment Date', 'Status', 'Payment', 'Parent/Guardian', 'Contact']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: [79, 110, 247], textColor: 255, fontSize: 8, cellPadding: 3 },
    bodyStyles: { fontSize: 7, cellPadding: 3 },
    margin: { left: 14, right: 14 },
    columnStyles: {
      0: { cellWidth: 35 },
      1: { cellWidth: 25 },
      2: { cellWidth: 25 },
      3: { cellWidth: 28 },
      4: { cellWidth: 28 },
      5: { cellWidth: 25 },
      6: { cellWidth: 35 },
      7: { cellWidth: 35 }
    }
  });
  
  // Add footer with page number
  const pageCount = doc.internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.setTextColor(108, 117, 125);
    doc.text(
      `Page ${i} of ${pageCount}`,
      doc.internal.pageSize.width - 20,
      doc.internal.pageSize.height - 10
    );
  }
  
  // Save the PDF
  doc.save(`enrollment_report_${new Date().toISOString().split('T')[0]}.pdf`);
};

const EnrollmentSection = ({ title, icon, full = false, children }) => (
  <section
    className={`enrollment-details-section ${
      full ? "enrollment-details-section--full" : ""
    }`}
  >
    <div className="enrollment-details-section__header">
      <span>{icon}</span>
      <span className="enrollment-details-section__title">{title}</span>
    </div>
    <div className="enrollment-details-section__body">{children}</div>
  </section>
);

const StudentCell = ({ row }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontWeight: 700, color: "#111827" }}>{row.studentName}</div>
    <div style={{ fontSize: 11, color: "#64748b" }}>
      AY {row.academicYear || "—"} · {row.sectionName || "No section"}
    </div>
    {row.expired && (
      <div style={{ fontSize: 11, color: "#7e22ce", fontWeight: 700 }}>
        Expired · {formatExpiryDate(row.academicYear)}
      </div>
    )}
  </div>
);

const ParentCell = ({ row }) => (
  <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
    <div style={{ fontWeight: 600 }}>{row.parentName}</div>
    <div style={{ fontSize: 11, color: "#64748b" }}>{row.phone}</div>
  </div>
);

export default function EnrollmentManagement() {
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [enrollPage, setEnrollPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [modalStatus, setModalStatus] = useState(null);
  const [modalExpired, setModalExpired] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState(false);

  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({
    open_date: "",
    window_days: 7,
    academic_year: "",
  });

  const [selectedIds, setSelectedIds] = useState(new Set());
  const [toasts, setToasts] = useState([]);

  const [docUploadFile, setDocUploadFile] = useState(null);
  const [docUploadType, setDocUploadType] = useState("other");
  const [docUploadLabel, setDocUploadLabel] = useState("");
  const [docSaving, setDocSaving] = useState(false);

  const [editingDocId, setEditingDocId] = useState(null);
  const [editingDocLabel, setEditingDocLabel] = useState("");
  const [editingDocType, setEditingDocType] = useState("other");
  const [editingDocFile, setEditingDocFile] = useState(null);

  const [idUploadOpen, setIdUploadOpen] = useState(false);
  const [idUploadEnrollmentId, setIdUploadEnrollmentId] = useState(null);
  const [idUploadFile, setIdUploadFile] = useState(null);
  const [idUploadPreview, setIdUploadPreview] = useState(null);
  const [idUploading, setIdUploading] = useState(false);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => {
      const exists = prev.some(
        (t) => t.title === title && t.message === message && t.type === type
      );
      if (exists) return prev;
      return [...prev, { id, title, message, type }];
    });
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const window_ = useMemo(() => computeEnrollmentWindow(settings), [settings]);

  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const res = await apiFetch('/api/enrollments/');
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();
      const list = Array.isArray(data) ? data : [];
      setEnrollments(list);

      const expiredList = list.filter(
        (e) =>
          isEnrollmentExpired(e.academic_year) &&
          e.status !== "DROPPED" &&
          e.status !== "COMPLETED"
      );

      if (expiredList.length > 0) {
        const names = expiredList
          .slice(0, 3)
          .map((e) => `${e.first_name} ${e.last_name}`)
          .join(", ");
        const more = expiredList.length > 3 ? ` and ${expiredList.length - 3} more` : "";
        addToast(
          `${expiredList.length} Expired Enrollment${expiredList.length > 1 ? "s" : ""}`,
          `${names}${more} — academic year has ended.`,
          "warning"
        );
      }
    } catch {
      addToast("Load Failed", "Failed to load enrollments.", "error");
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await apiFetch('/api/enrollment-settings/');
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();
      setSettings(data);
      setDraft({
        open_date: data.open_date || "",
        window_days: data.window_days ?? 7,
        academic_year: data.academic_year || "",
      });
    } catch {
      setSettings(null);
    } finally {
      setSettingsLoading(false);
    }
  }, []);

  const fetchSections = useCallback(async () => {
    setSectionsLoading(true);
    try {
      const res = await apiFetch('/api/accounts/sections/');
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();
      setSections(Array.isArray(data) ? data : []);
    } catch {
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        open_date: draft.open_date || null,
        window_days: parseInt(draft.window_days, 10) || 7,
        academic_year: draft.academic_year.replace(/\s+/g, "") || null,
      };
      const res = await apiFetch('/api/enrollment-settings/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", JSON.stringify(data), "error");
        return;
      }
      setSettings(data);
      addToast(
        "Settings Saved",
        "Enrollment window has been updated successfully.",
        "success"
      );
    } catch {
      addToast("Save Failed", "Failed to save settings.", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (
      !window.confirm(
        "Reset to auto-calculated defaults? This will clear the manual open date and academic year."
      )
    )
      return;

    setDraft({ open_date: "", window_days: 7, academic_year: "" });
    setSettingsSaving(true);
    try {
      const res = await apiFetch('/api/enrollment-settings/', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ open_date: null, window_days: 7, academic_year: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Reset Failed", JSON.stringify(data), "error");
        return;
      }
      setSettings(data);
      addToast("Settings Reset", "Enrollment window is now auto-calculated.", "success");
    } catch {
      addToast("Reset Failed", "Failed to reset settings.", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
    fetchSections();
  }, [fetchSettings, fetchSections]);

  const callAction = async (id, actionName) => {
    const res = await apiFetch(`/api/enrollments/${id}/${actionName}/`, {
      method: "POST",
      headers: { 'Content-Type': 'application/json' },
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Action failed.");
    await fetchEnrollments();
    return data;
  };

  const normalized = useMemo(
    () =>
      enrollments.map((e) => {
        const statusCode = String(e.status || "PENDING").toUpperCase();
        const expired =
          isEnrollmentExpired(e.academic_year) &&
          statusCode !== "DROPPED" &&
          statusCode !== "COMPLETED";
        return {
          id: e.id,
          raw: e,
          studentName: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
          gradeLevel: gradeLabel(e.grade_level),
          sectionName:
            e?.section_name ||
            e?.section_details?.name ||
            e?.section?.name ||
            sections.find((s) => String(s.id) === String(e.section))?.name ||
            "—",
          enrollmentDate: e.enrolled_at || e.created_at || null,
          statusCode,
          statusText: statusLabel(statusCode),
          expired,
          academicYear: e.academic_year || "",
          fee: e.payment_mode || "Pending",
          parentName:
            e?.parent_info?.guardian_name ||
            e?.parent_info?.mother_name ||
            e?.parent_info?.father_name ||
            "(not set)",
          phone:
            e?.parent_info?.guardian_contact ||
            e?.parent_info?.mother_contact ||
            e?.parent_info?.father_contact ||
            e?.mobile_number ||
            e?.telephone_number ||
            "(not set)",
        };
      }),
    [enrollments, sections]
  );

  const getMissingFieldsForApproval = useCallback((row) => {
    const e = row?.raw || {};
    const missing = [];
    if (!e.first_name?.trim()) missing.push("First Name");
    if (!e.last_name?.trim()) missing.push("Last Name");
    if (!e.birth_date) missing.push("Birth Date");
    if (!e.education_level) missing.push("Education Level");
    if (!e.grade_level) missing.push("Grade Level");
    if (!e.student_type) missing.push("Student Type");
    if (!e.academic_year) missing.push("Academic Year");
    if (!e.payment_mode) missing.push("Payment Mode");
    if (!e.parent_facebook?.trim()) missing.push("Parent Facebook");

    const hasStudentContact =
      e.email?.trim() || e.mobile_number?.trim() || e.telephone_number?.trim();

    if (!hasStudentContact) {
      missing.push("At least one contact (Email, Mobile, or Telephone)");
    }

    const lrnRequiredGrades = [
      "kinder",
      "grade1",
      "grade2",
      "grade3",
      "grade4",
      "grade5",
      "grade6",
    ];
    if (lrnRequiredGrades.includes(e.grade_level)) {
      if (!e.lrn?.trim()) {
        missing.push("LRN");
      } else if (String(e.lrn).trim().length !== 12) {
        missing.push("LRN must be exactly 12 digits");
      }
    }

    const ageCheck = validateAgeForGrade(e.birth_date, e.grade_level);
    if (e.birth_date && ageCheck !== true) {
      missing.push(ageCheck);
    }

    return missing;
  }, []);

  const validateBeforeApprove = useCallback(
    (row) => {
      const missing = getMissingFieldsForApproval(row);
      if (missing.length > 0) {
        addToast(
          "Cannot Approve Yet",
          `Please complete/fix: ${missing.join(", ")}`,
          "error"
        );
        return false;
      }
      return true;
    },
    [getMissingFieldsForApproval, addToast]
  );

  const filteredEnrollments = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return normalized.filter((row) => {
      const matchesSearch =
        !s ||
        row.studentName.toLowerCase().includes(s) ||
        row.parentName.toLowerCase().includes(s) ||
        String(row.phone).toLowerCase().includes(s) ||
        String(row.sectionName).toLowerCase().includes(s);

      const matchesStatus = matchesStatusFilter(
        filterStatus,
        row.statusText,
        row.expired
      );
      return matchesSearch && matchesStatus;
    });
  }, [normalized, searchTerm, filterStatus]);

  const enrollTotalPages = Math.ceil(filteredEnrollments.length / ITEMS_PER_PAGE);
  const paginatedEnrollments = filteredEnrollments.slice(
    (enrollPage - 1) * ITEMS_PER_PAGE,
    enrollPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setEnrollPage(1);
  }, [searchTerm, filterStatus]);

  const stats = useMemo(
    () => ({
      total: normalized.length,
      active: normalized.filter((e) => e.statusCode === "ACTIVE" && !e.expired).length,
      pending: normalized.filter((e) => e.statusCode === "PENDING" && !e.expired).length,
      dropped: normalized.filter((e) => e.statusCode === "DROPPED").length,
      expired: normalized.filter((e) => e.expired).length,
    }),
    [normalized]
  );

  const gradeOptions = useMemo(() => {
    if (formData.education_level === "preschool") {
      return [
        { value: "prek", label: "Pre-Kinder" },
        { value: "kinder", label: "Kindergarten" },
      ];
    }
    if (formData.education_level === "elementary") {
      return ["grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].map((v) => ({
        value: v,
        label: gradeLabel(v),
      }));
    }
    return [];
  }, [formData.education_level]);

  const filteredSections = useMemo(() => {
    if (!formData.grade_level) return sections;
    const selectedGrade = normalizeSectionGrade(formData.grade_level);

    return sections.filter((s) => {
      const rawSectionGrade = s.grade_level ?? s.grade ?? s.year_level ?? s.level ?? "";
      const sectionGrade = normalizeSectionGrade(rawSectionGrade);
      return !sectionGrade || sectionGrade === selectedGrade;
    });
  }, [sections, formData.grade_level]);

  const openModal = (row, mode = "view") => {
    const e = row.raw;
    const expired =
      isEnrollmentExpired(e.academic_year) &&
      e.status !== "DROPPED" &&
      e.status !== "COMPLETED";

    if (mode === "edit" && expired) {
      addToast(
        "Enrollment Expired",
        `${e.first_name} ${e.last_name}'s enrollment ended on ${formatExpiryDate(
          e.academic_year
        )}. Editing is blocked.`,
        "error"
      );
      mode = "view";
    }

    setEditingId(e.id);
    setModalMode(mode);
    setModalStatus(e.status || "PENDING");
    setModalExpired(expired);
    setEditingAcademicYear(false);

    const inferredEdu =
      e.education_level ||
      (["prek", "kinder"].includes(e.grade_level)
        ? "preschool"
        : ["grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].includes(
              e.grade_level
            )
          ? "elementary"
          : "");

    const father = splitFullName(e?.parent_info?.father_name || "");
    const mother = splitFullName(e?.parent_info?.mother_name || "");
    const guardian = splitFullName(e?.parent_info?.guardian_name || "");
    const addr = splitAddress(e.address || "");

    setFormData({
      ...emptyForm(),
      first_name: e.first_name || "",
      last_name: e.last_name || "",
      middle_name: e.middle_name || "",
      birth_date: e.birth_date || "",
      gender: e.gender || "",
      lrn: e.lrn || "",
      education_level: inferredEdu,
      grade_level: e.grade_level || "",
      student_type: e.student_type || "",
      academic_year: e.academic_year || getCurrentAcademicYear(),
      status: e.status || "PENDING",
      payment_mode: e.payment_mode || "",
      section: e.section ? String(e.section) : "",
      email: e.email || "",
      religion: e.religion || "",
      telephone_number: e.telephone_number || "",
      mobile_number: e.mobile_number || "",
      parent_facebook: e.parent_facebook || "",
      street: addr.street,
      barangay: addr.barangay,
      city: addr.city,
      province: addr.province,
      region: addr.region,
      zip_code: addr.zip_code,
      remarks: e.remarks || "",
      parent_info: {
        father_first: father.first,
        father_middle: father.middle,
        father_last: father.last,
        father_contact: e?.parent_info?.father_contact || "",
        father_occupation: e?.parent_info?.father_occupation || "",
        mother_first: mother.first,
        mother_middle: mother.middle,
        mother_last: mother.last,
        mother_contact: e?.parent_info?.mother_contact || "",
        mother_occupation: e?.parent_info?.mother_occupation || "",
        guardian_first: guardian.first,
        guardian_middle: guardian.middle,
        guardian_last: guardian.last,
        guardian_contact: e?.parent_info?.guardian_contact || "",
        guardian_relationship: e?.parent_info?.guardian_relationship || "",
      },
    });

    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingId(null);
    setModalMode("edit");
    setModalStatus(null);
    setModalExpired(false);
    setEditingAcademicYear(false);
    setFormData({ ...emptyForm(), academic_year: window_.academicYear });
    setModalOpen(true);
  };

  const handlePromote = (row) => {
    const e = row.raw;
    const { next, nextEdu } = getNextGrade(e.grade_level);

    if (!next) {
      addToast(
        "Already at Highest Grade",
        `${e.first_name} ${e.last_name} has completed Grade 6.`,
        "warning"
      );
      return;
    }

    const nextYear = advanceAcademicYear(e.academic_year);
    const father = splitFullName(e?.parent_info?.father_name || "");
    const mother = splitFullName(e?.parent_info?.mother_name || "");
    const guardian = splitFullName(e?.parent_info?.guardian_name || "");
    const addr = splitAddress(e.address || "");

    setEditingId(null);
    setModalMode("edit");
    setModalStatus(null);
    setModalExpired(false);
    setEditingAcademicYear(false);

    setFormData({
      ...emptyForm(),
      first_name: e.first_name || "",
      last_name: e.last_name || "",
      middle_name: e.middle_name || "",
      birth_date: e.birth_date || "",
      gender: e.gender || "",
      lrn: e.lrn || "",
      email: e.email || "",
      religion: e.religion || "",
      telephone_number: e.telephone_number || "",
      mobile_number: e.mobile_number || "",
      parent_facebook: e.parent_facebook || "",
      street: addr.street,
      barangay: addr.barangay,
      city: addr.city,
      province: addr.province,
      region: addr.region,
      zip_code: addr.zip_code,
      education_level: nextEdu,
      grade_level: next,
      academic_year: nextYear,
      student_type: "old",
      status: "PENDING",
      payment_mode: "",
      section: "",
      remarks: "",
      parent_info: {
        father_first: father.first,
        father_middle: father.middle,
        father_last: father.last,
        father_contact: e?.parent_info?.father_contact || "",
        father_occupation: e?.parent_info?.father_occupation || "",
        mother_first: mother.first,
        mother_middle: mother.middle,
        mother_last: mother.last,
        mother_contact: e?.parent_info?.mother_contact || "",
        mother_occupation: e?.parent_info?.mother_occupation || "",
        guardian_first: guardian.first,
        guardian_middle: guardian.middle,
        guardian_last: guardian.last,
        guardian_contact: e?.parent_info?.guardian_contact || "",
        guardian_relationship: e?.parent_info?.guardian_relationship || "",
      },
    });

    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode("view");
    setEditingId(null);
    setModalStatus(null);
    setModalExpired(false);
    setEditingAcademicYear(false);

    setDocUploadFile(null);
    setDocUploadType("other");
    setDocUploadLabel("");
    setDocSaving(false);

    setEditingDocId(null);
    setEditingDocLabel("");
    setEditingDocType("other");
    setEditingDocFile(null);
  };

  const isReadOnly = (modalMode === "view" && editingId !== null) || modalExpired;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) =>
      name === "education_level"
        ? { ...p, education_level: value, grade_level: "", section: "" }
        : name === "grade_level"
          ? { ...p, grade_level: value, section: "" }
          : { ...p, [name]: value }
    );
  };

  const handleParentChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({
      ...p,
      parent_info: { ...p.parent_info, [name]: value },
    }));
  };

  const validateCreate = () => {
    const missing = [];
    if (!formData.last_name?.trim()) missing.push("Last Name");
    if (!formData.first_name?.trim()) missing.push("First Name");
    if (!formData.birth_date) missing.push("Birth Date");
    if (!formData.grade_level) missing.push("Grade Level");
    if (!formData.education_level) missing.push("Education Level");
    if (!formData.student_type) missing.push("Student Type");
    if (!formData.academic_year) missing.push("Academic Year");
    if (
      !formData.email?.trim() &&
      !formData.mobile_number?.trim() &&
      !formData.telephone_number?.trim()
    ) {
      missing.push("At least one contact (Email, Mobile, or Telephone)");
    }
    if (!formData.parent_facebook?.trim()) missing.push("Parent Facebook");
    if (!formData.payment_mode) missing.push("Payment Mode");

    const lrnRequiredGrades = [
      "kinder",
      "grade1",
      "grade2",
      "grade3",
      "grade4",
      "grade5",
      "grade6",
    ];
    if (lrnRequiredGrades.includes(formData.grade_level)) {
      if (!formData.lrn?.trim()) {
        missing.push("LRN (required for this grade level)");
      } else if (formData.lrn.length !== 12) {
        missing.push("LRN must be exactly 12 digits");
      }
    }

    if (missing.length) {
      addToast("Missing Required Fields", missing.join(", "), "error");
      return false;
    }
    return true;
  };

  const handleApprove = async (id) => {
    const row = normalized.find((r) => r.id === id);
    if (!row) return;
    if (!validateBeforeApprove(row)) return;

    try {
      const payload = new FormData();
      if (row.raw?.section) payload.append("section", row.raw.section);

      const res = await apiFetch(`/api/enrollments/${id}/mark_active/`, {
        method: "POST",
        headers: { 'Content-Type': 'application/json' },
        body: payload,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok)
        throw new Error(data.detail || JSON.stringify(data) || "Approval failed");

      await fetchEnrollments();
      addToast("Approved", "Enrollment approved successfully. \n May now be processed to ID.", "success");
    } catch (err) {
      addToast("Approval Failed", err.message || "Could not approve enrollment.", "error");
    }
  };

  const handleDecline = async (id) => {
    try {
      await callAction(id, "mark_dropped");
      addToast("Enrollment Declined", "Enrollment was declined successfully.", "success");
    } catch {
      addToast("Decline Failed", "Could not decline enrollment.", "error");
    }
  };

  const handleDeleteEnrollment = async (id) => {
    if (!window.confirm("Delete this enrollment?")) return;
    try {
      const res = await apiFetch(`/api/enrollments/${id}/`, { method: "DELETE" });
      if (!res.ok) throw new Error();
      await fetchEnrollments();
      if (editingId === id) closeModal();
      addToast("Enrollment Deleted", "Enrollment was deleted successfully.", "success");
    } catch {
      addToast("Delete Failed", "Could not delete enrollment.", "error");
    }
  };

  const handleSelectAll = () => {
    if (selectedIds.size === paginatedEnrollments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedEnrollments.map((e) => e.id)));
    }
  };

  const handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

  const handleApproveModal = async () => {
    if (!editingId) return;
    await handleApprove(editingId);
    closeModal();
  };

  const handleDeclineModal = async () => {
    if (!editingId) return;
    try {
      const u = await callAction(editingId, "mark_dropped");
      setModalStatus("DROPPED");
      setFormData((p) => ({ ...p, status: "DROPPED", remarks: u?.remarks ?? p.remarks }));
      setModalMode("view");
      addToast("Enrollment Declined", "Enrollment was declined successfully.", "success");
    } catch {
      addToast("Decline Failed", "Could not decline enrollment.", "error");
    }
  };

  const handleSaveAcademicYear = async () => {
    if (!editingId) return;
    const newYear = formData.academic_year?.trim();
    if (!newYear || !/^\d{4}-\d{4}$/.test(newYear)) {
      addToast("Invalid Academic Year", "Use YYYY-YYYY format.", "error");
      return;
    }

    try {
      const res = await apiFetch(`/api/enrollments/${editingId}/`, {
        method: "PATCH",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ academic_year: newYear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", JSON.stringify(data), "error");
        return;
      }
      await fetchEnrollments();
      const nowExpired = isEnrollmentExpired(newYear);
      setModalExpired(nowExpired);
      setEditingAcademicYear(false);
      if (!nowExpired) {
        addToast("Academic Year Updated", `Enrollment is now active for ${newYear}.`, "success");
      }
    } catch {
      addToast("Save Failed", "Could not update academic year.", "error");
    }
  };

  const handleSaveEnrollment = async () => {
    if (!validateCreate()) return;

    const bdCheck = validateBirthDate(formData.birth_date);
    if (bdCheck !== true) {
      addToast("Invalid Birth Date", bdCheck, "error");
      return;
    }

    const ageCheck = validateAgeForGrade(formData.birth_date, formData.grade_level);
    if (ageCheck !== true) {
      addToast("Invalid Age for Grade", ageCheck, "error");
      return;
    }

    if (isEnrollmentExpired(formData.academic_year)) {
      if (
        !window.confirm(
          `Warning: AY "${formData.academic_year}" has already ended.\n\nDo you still want to save?`
        )
      ) {
        return;
      }
    }

    let normalizedMobile = null;
    if (formData.mobile_number?.trim()) {
      normalizedMobile = normalizePHMobile(formData.mobile_number);
      if (!normalizedMobile) {
        addToast("Invalid Mobile Number", "Use 09XXXXXXXXX or +639XXXXXXXXX.", "error");
        return;
      }
    }

    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name,
      middle_name: formData.middle_name,
      birth_date: formData.birth_date || null,
      gender: formData.gender,
      lrn: formData.lrn,
      education_level: formData.education_level,
      grade_level: formData.grade_level,
      student_type: formData.student_type,
      academic_year: formData.academic_year,
      status: formData.status,
      payment_mode: formData.payment_mode,
      section: formData.section || null,
      email: formData.email,
      address: buildAddress(formData),
      religion: formData.religion,
      telephone_number: formData.telephone_number,
      mobile_number: normalizedMobile ?? formData.mobile_number,
      parent_facebook: formData.parent_facebook,
      remarks: formData.remarks,
      parent_info: {
        father_name: buildName(
          formData.parent_info.father_first,
          formData.parent_info.father_middle,
          formData.parent_info.father_last
        ),
        father_contact: formData.parent_info.father_contact,
        father_occupation: formData.parent_info.father_occupation,
        mother_name: buildName(
          formData.parent_info.mother_first,
          formData.parent_info.mother_middle,
          formData.parent_info.mother_last
        ),
        mother_contact: formData.parent_info.mother_contact,
        mother_occupation: formData.parent_info.mother_occupation,
        guardian_name: buildName(
          formData.parent_info.guardian_first,
          formData.parent_info.guardian_middle,
          formData.parent_info.guardian_last
        ),
        guardian_contact: formData.parent_info.guardian_contact,
        guardian_relationship: formData.parent_info.guardian_relationship,
      },
    };

    const url = editingId
      ? `/api/enrollments/${editingId}/`
      : '/api/enrollments/';

    try {
      const res = await apiFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", JSON.stringify(data), "error");
        return;
      }

      await fetchEnrollments();

      if (!editingId) {
        addToast(
          "Enrollment Created",
          `${payload.first_name} ${payload.last_name} was added successfully.`,
          "success"
        );
        closeModal();
      } else {
        addToast(
          "Changes Saved",
          `${payload.first_name} ${payload.last_name}'s enrollment was updated successfully.`,
          "success"
        );
        setModalMode("view");
        setModalStatus(data?.status ?? formData.status);
      }
    } catch {
      addToast("Save Failed", "Could not save enrollment.", "error");
    }
  };

  const currentDocs = useMemo(() => {
    const row = normalized.find((r) => r.id === editingId);
    return Array.isArray(row?.raw?.documents) ? row.raw.documents : [];
  }, [normalized, editingId]);

  const refreshEnrollmentById = async (id) => {
    const res = await apiFetch(`/api/enrollments/${id}/`);

    const data = await res.json().catch(() => null);
    if (!res.ok || !data) throw new Error("Failed to refresh enrollment.");
    setEnrollments((prev) => prev.map((item) => (item.id === id ? data : item)));
  };

  const startEditDocument = (doc) => {
    setEditingDocId(doc.id);
    setEditingDocLabel(doc.label || "");
    setEditingDocType(doc.document_type || "other");
    setEditingDocFile(null);
  };

  const cancelEditDocument = () => {
    setEditingDocId(null);
    setEditingDocLabel("");
    setEditingDocType("other");
    setEditingDocFile(null);
  };

  const handleUploadDocument = async () => {
    if (!editingId) return;

    if (!docUploadFile) {
      addToast("Missing File", "Please select a document file first.", "warning");
      return;
    }

    setDocSaving(true);
    try {
      const form = new FormData();
      form.append("file", docUploadFile);
      form.append("document_type", docUploadType);
      form.append("label", docUploadLabel.trim() || docUploadFile.name);

      const res = await apiFetch(`/api/enrollments/${editingId}/documents/upload/`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to upload document.");

      await refreshEnrollmentById(editingId);
      setDocUploadFile(null);
      setDocUploadType("other");
      setDocUploadLabel("");
      addToast("Document Uploaded", "Enrollment document uploaded successfully.", "success");
    } catch (err) {
      addToast("Upload Failed", err.message || "Could not upload document.", "error");
    } finally {
      setDocSaving(false);
    }
  };

  const handleUpdateDocument = async () => {
    if (!editingId || !editingDocId) return;

    setDocSaving(true);
    try {
      const form = new FormData();
      form.append("label", editingDocLabel.trim());
      form.append("document_type", editingDocType);
      if (editingDocFile) form.append("file", editingDocFile);

      const res = await apiFetch(
        `/api/enrollments/${editingId}/documents/${editingDocId}/update/`,
        {
          method: "PATCH",
          body: form,
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to update document.");

      await refreshEnrollmentById(editingId);
      cancelEditDocument();
      addToast("Document Updated", "Enrollment document updated successfully.", "success");
    } catch (err) {
      addToast("Update Failed", err.message || "Could not update document.", "error");
    } finally {
      setDocSaving(false);
    }
  };

  const handleDeleteDocument = async (docId) => {
    if (!editingId) return;
    if (!window.confirm("Delete this document?")) return;

    setDocSaving(true);
    try {
      const res = await apiFetch(`/api/enrollments/${editingId}/documents/${docId}/delete/`, {
        method: "DELETE",
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to delete document.");

      await refreshEnrollmentById(editingId);
      if (editingDocId === docId) cancelEditDocument();
      addToast("Document Deleted", "Enrollment document removed successfully.", "success");
    } catch (err) {
      addToast("Delete Failed", err.message || "Could not delete document.", "error");
    } finally {
      setDocSaving(false);
    }
  };

  const openIdUploadModal = (row) => {
    setIdUploadEnrollmentId(row.id);
    setIdUploadFile(null);
    setIdUploadPreview(null);
    setIdUploadOpen(true);
  };

  const closeIdUploadModal = () => {
    setIdUploadOpen(false);
    setIdUploadEnrollmentId(null);
    setIdUploadFile(null);
    setIdUploadPreview(null);
  };

  const handleIdImageSelect = (e) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      addToast("Invalid File", "Please select an image file.", "error");
      return;
    }

    if (file.size > 5 * 1024 * 1024) {
      addToast("File Too Large", "Image must be under 5MB.", "error");
      return;
    }

    setIdUploadFile(file);

    const reader = new FileReader();
    reader.onload = (evt) => setIdUploadPreview(evt.target?.result);
    reader.readAsDataURL(file);
  };

  const handleUploadIdImage = async () => {
    if (!idUploadEnrollmentId || !idUploadFile) {
      addToast("Missing Image", "Please choose an image first.", "warning");
      return;
    }

    setIdUploading(true);
    try {
      const form = new FormData();
      form.append("id_image", idUploadFile);

      const res = await apiFetch(`/api/enrollments/${idUploadEnrollmentId}/upload-id-image/`, {
        method: "POST",
        body: form,
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to upload ID image.");

      await fetchEnrollments();
      addToast("ID Uploaded", "Student ID image uploaded successfully.", "success");
      closeIdUploadModal();
    } catch (err) {
      addToast("Upload Failed", err.message || "Could not upload ID image.", "error");
    } finally {
      setIdUploading(false);
    }
  };

  return (
    <div className="enrollment-management">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="enrollment-stats-section">
        <div className="enrollment-stats-header">
          <div className="enrollment-stats-title">Enrollment Overview</div>
          <div className="header-actions">
            <button className="btn-primary" onClick={openCreateModal}>
              + Add Enrollee
            </button>
            <button className="btn-icon" onClick={fetchEnrollments} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button 
              className="btn-icon" 
              onClick={() => exportToPDF(normalized, stats, window_)}
              title="Export to PDF"             
            >
              <FileText size={16} />
            </button>
            <button
              className={`btn-icon ${settingsOpen ? "btn-icon--active" : ""}`}
              onClick={() => setSettingsOpen((v) => !v)}
              title="School Year Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        <StatsGrid className="unified-stats-grid">
          <StatCard
            label="Total"
            value={stats.total}
            icon={<Users size={20} />}
            color="blue"
            subtitle="All enrollees"
          />
          <StatCard
            label="Enrolled"
            value={stats.active}
            icon={<UserCheck size={20} />}
            color="green"
            subtitle={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : "—"}
            subtitleType="positive"
          />
          <StatCard
            label="Pending"
            value={stats.pending}
            icon={<Clock size={20} />}
            color="yellow"
            subtitle={stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : "—"}
          />
          <StatCard
            label="Declined"
            value={stats.dropped}
            icon={<UserMinus size={20} />}
            color="red"
            subtitle={stats.total ? `${Math.round((stats.dropped / stats.total) * 100)}% of total` : "—"}
            subtitleType="negative"
          />
          <StatCard
            label="Expired"
            value={stats.expired}
            icon={<UserX size={20} />}
            color="purple"
            subtitle={stats.total ? `${Math.round((stats.expired / stats.total) * 100)}% of total` : "—"}
            subtitleType="negative"
          />
          <StatCard
            label="Enrollment"
            value={window_.isOpen ? `Open · ${window_.daysLeft}d left` : "Closed"}
            icon={<Calendar size={20} />}
            color={window_.isOpen ? "teal" : "red"}
            subtitle={window_.isOpen ? "Accepting enrollees" : "Window closed"}
          />
        </StatsGrid>
      </div>

      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-panel__header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} style={{ color: "#4f6ef7" }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>
                Enrollment Window & School Year
              </span>
            </div>
            <button
              onClick={() => setSettingsOpen(false)}
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                color: "#6b7280",
                display: "flex",
              }}
            >
              <X size={16} />
            </button>
          </div>

          {settingsLoading ? (
            <div
              style={{
                padding: "20px",
                textAlign: "center",
                color: "#6b7280",
                fontSize: 13,
              }}
            >
              Loading settings…
            </div>
          ) : (
            <>
              <div className="settings-panel__status">
                <div
                  className="settings-panel__status-badge"
                  style={{
                    background: window_.isOpen ? "#d1fae5" : "#fee2e2",
                    color: window_.isOpen ? "#065f46" : "#7f1d1d",
                  }}
                >
                  {window_.isOpen ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {window_.isOpen
                    ? `Open — ${window_.daysLeft} day${window_.daysLeft !== 1 ? "s" : ""} left`
                    : "Closed"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {fmtDate(window_.openDate)} → {fmtDate(window_.closeDate)} · AY{" "}
                  <strong>{window_.academicYear}</strong>
                </div>
              </div>

              <div className="settings-panel__fields">
                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Academic Year
                    <span className="settings-panel__hint">
                      Leave blank to auto-calculate from open date
                    </span>
                  </label>
                  <input
                    className="settings-panel__input"
                    value={draft.academic_year}
                    onChange={(e) =>
                      setDraft((p) => ({
                        ...p,
                        academic_year: e.target.value.replace(/\s+/g, ""),
                      }))
                    }
                    placeholder={`Auto: ${window_.academicYear}`}
                  />
                </div>

                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Enrollment Open Date
                    <span className="settings-panel__hint">
                      Leave blank to use auto default (June 1)
                    </span>
                  </label>
                  <input
                    type="date"
                    className="settings-panel__input"
                    value={draft.open_date}
                    onChange={(e) => setDraft((p) => ({ ...p, open_date: e.target.value }))}
                  />
                  {draft.open_date && (
                    <button
                      onClick={() => setDraft((p) => ({ ...p, open_date: "" }))}
                      style={{
                        fontSize: 11,
                        color: "#6b7280",
                        background: "none",
                        border: "none",
                        cursor: "pointer",
                        marginTop: 4,
                        textDecoration: "underline",
                      }}
                    >
                      Clear (use auto)
                    </button>
                  )}
                </div>

                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Enrollment Window Duration
                    <span className="settings-panel__hint">
                      Number of days the form stays open
                    </span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="settings-panel__input"
                      style={{ width: 80 }}
                      value={draft.window_days}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, window_days: e.target.value }))
                      }
                    />
                    <span style={{ fontSize: 13, color: "#6b7280" }}>days</span>
                  </div>
                </div>
              </div>

              <div className="settings-panel__actions">
                <button
                  className="btn-primary"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? "Saving…" : (
                    <>
                      <CheckCircle size={13} /> Save Settings
                    </>
                  )}
                </button>
                <button
                  className="btn-secondary"
                  onClick={handleResetSettings}
                  disabled={settingsSaving}
                >
                  Reset to Defaults
                </button>
              </div>
            </>
          )}
        </div>
      )}

      <div className="enrollment-controls">
        <div className="search-box">
          <Search size={16} />
          <input
            type="text"
            placeholder="Search by student, parent name, phone, or section…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={16} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            {FILTER_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </select>
        </div>
      </div>

      <div className="enrollments-container">
        {loading ? (
          <div className="no-results">Loading…</div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="no-results">
            <div style={{ fontWeight: 700, marginBottom: 6 }}>
              No enrollment records found
            </div>
            <div style={{ fontSize: 13, color: "#94a3b8" }}>
              Try changing the search keyword or status filter.
            </div>
          </div>
        ) : (
          <table className="enrollments-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: "center" }}>
                  <input
                    type="checkbox"
                    checked={
                      selectedIds.size === paginatedEnrollments.length &&
                      paginatedEnrollments.length > 0
                    }
                    onChange={handleSelectAll}
                    title="Select all on this page"
                    style={{ cursor: "pointer", width: 18, height: 18 }}
                  />
                </th>
                <th>Student</th>
                {/* <th>Grade Level</th> */}
                {/* <th>Section</th> */}
                <th>Enrollment Date</th>
                <th>Status</th>
                <th>Fee Status</th>
                <th>Parent / Guardian</th>
                {/* <th>Phone</th> */}
                <th>Approve / Decline</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEnrollments.map((row) => (
                <tr key={row.id} style={row.expired ? { background: "#fcf7ff" } : {}}>
                  <td style={{ textAlign: "center", width: 40 }}>
                    <input
                      type="checkbox"
                      checked={selectedIds.has(row.id)}
                      onChange={() => handleSelectOne(row.id)}
                      style={{ cursor: "pointer", width: 18, height: 18 }}
                    />
                  </td>
                  <td>
                    <StudentCell row={row} />
                  </td>
                  {/* <td>{row.gradeLevel}</td> */}
                  {/* <td>{row.sectionName}</td> */}
                  <td>
                    {row.enrollmentDate
                      ? new Date(row.enrollmentDate).toLocaleDateString()
                      : "—"}
                  </td>
                  <td>
                    <StatusBadge code={row.statusCode} expired={row.expired} />
                  </td>
                  <td>
                    <FeeBadge fee={row.fee} />
                  </td>
                  <td>
                    <ParentCell row={row} />
                  </td>
                  {/* <td>{row.phone}</td> */}
                  <td>
                    {row.expired ? (
                      <span className="table-inline-status table-inline-status--expired">
                        <AlertTriangle size={13} /> Expired
                      </span>
                    ) : row.statusCode === "PENDING" ? (
                      <div className="approve-decline-group">
                        <button className="btn-approve" onClick={() => handleApprove(row.id)}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button className="btn-decline" onClick={() => handleDecline(row.id)}>
                          <XCircle size={12} /> Decline
                        </button>
                      </div>
                    ) : row.statusCode === "ACTIVE" ? (
                      <span className="table-inline-status table-inline-status--approved">
                        <CheckCircle size={13} /> Approved
                      </span>
                    ) : row.statusCode === "DROPPED" ? (
                      <span className="table-inline-status table-inline-status--declined">
                        <XCircle size={13} /> Declined
                      </span>
                    ) : row.statusCode === "COMPLETED" ? (
                      <span className="table-inline-status table-inline-status--completed">
                        <CheckCircle size={13} /> Completed
                      </span>
                    ) : (
                      <span style={{ opacity: 0.4 }}>—</span>
                    )}
                  </td>
                  <td>
                    <div className="action-buttons" style={{ justifyContent: "flex-start" }}>
                      <button className="btn-edit" title="View" onClick={() => openModal(row, "view")}>
                        <Eye size={14} />
                      </button>

                      <button
                        className="btn-edit"
                        title={row.expired ? "Editing blocked — enrollment expired" : "Edit"}
                        onClick={() => !row.expired && openModal(row, "edit")}
                        disabled={row.expired}
                        style={
                          row.expired
                            ? {
                                opacity: 0.35,
                                cursor: "not-allowed",
                                pointerEvents: "none",
                              }
                            : {}
                        }
                      >
                        <Edit2 size={14} />
                      </button>
                      <button
                        className="btn-delete"
                        title="Delete"
                        onClick={() => handleDeleteEnrollment(row.id)}
                      >
                        <Trash2 size={14} />
                      </button>
                      

                      {row.statusCode === "ACTIVE" && (
                        <button
                          className="btn-edit"
                          title="Upload ID Image"
                          onClick={() => openIdUploadModal(row)}
                        >
                          ID
                        </button>
                        
                      )}
                       {(row.statusCode === "ACTIVE" || row.statusCode === "COMPLETED") &&
                        getNextGrade(row.raw.grade_level).next && (
                          <button
                            className="btn-promote"
                            title={`Promote to ${gradeLabel(
                              getNextGrade(row.raw.grade_level).next
                            )}`}
                            onClick={() => handlePromote(row)}
                          >
                            <ArrowUpCircle size={14} />
                          </button>
                        )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}

        <Pagination
          currentPage={enrollPage}
          totalPages={enrollTotalPages}
          onPageChange={setEnrollPage}
          totalItems={filteredEnrollments.length}
          itemsPerPage={ITEMS_PER_PAGE}
        />
      </div>

      {modalOpen && (
        <div className="modal-overlay enrollment-modal-overlay">
          <div className="modal-content enrollment-modal-content enrollment-modal-content--details">
            <div className="enrollment-modal-header">
              <div className="enrollment-modal-title-wrap">
                <h2>
                  {editingId
                    ? `${formData.first_name || "Student"} ${formData.last_name || ""}`.trim()
                    : formData.student_type === "old" && formData.grade_level
                      ? `Promotion Enrollment — ${gradeLabel(formData.grade_level)}`
                      : "New Enrollment Record"}
                </h2>
                <div className="enrollment-modal-subtitle">
                  Review, edit, approve, or decline the enrollment record.
                </div>
              </div>

              <button type="button" className="enrollment-modal-close" onClick={closeModal}>
                <X size={18} />
              </button>
            </div>

            {modalExpired && (
              <div className="enrollment-highlight-note" style={{ marginBottom: 18 }}>
                <strong>Enrollment Expired.</strong> This enrollment ended on{" "}
                <strong>{formatExpiryDate(formData.academic_year)}</strong>. Editing is
                disabled until the academic year is updated.
                {editingAcademicYear ? (
                  <div
                    style={{
                      marginTop: 12,
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                      flexWrap: "wrap",
                    }}
                  >
                    <input
                      name="academic_year"
                      value={formData.academic_year}
                      onChange={handleInputChange}
                      placeholder="e.g. 2025-2026"
                      className="settings-panel__input"
                      style={{ width: 160 }}
                    />
                    <button className="btn-primary" onClick={handleSaveAcademicYear}>
                      <CheckCircle size={13} /> Save
                    </button>
                    <button
                      className="btn-secondary"
                      onClick={() => setEditingAcademicYear(false)}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <div style={{ marginTop: 10 }}>
                    <button
                      className="btn-secondary"
                      onClick={() => setEditingAcademicYear(true)}
                    >
                      <Edit2 size={13} /> Edit Academic Year
                    </button>
                  </div>
                )}
              </div>
            )}

            {!editingId && formData.student_type === "old" && formData.grade_level && (
              <div className="enrollment-soft-note" style={{ marginBottom: 18 }}>
                <strong>Promotion Enrollment.</strong> Creating a new enrollment for{" "}
                <strong>
                  {formData.first_name} {formData.last_name}
                </strong>{" "}
                — promoted to <strong>{gradeLabel(formData.grade_level)}</strong> for AY{" "}
                <strong>{formData.academic_year}</strong>.
              </div>
            )}

            <div className="enrollment-modal-grid">
              <EnrollmentSection title="Academic Information" icon="🎓">
                <div className="form-row">
                  <div className="form-group">
                    <label>
                      LRN{" "}
                      {[
                        "kinder",
                        "grade1",
                        "grade2",
                        "grade3",
                        "grade4",
                        "grade5",
                        "grade6",
                      ].includes(formData.grade_level) && (
                        <span style={{ color: "#dc2626" }}>*</span>
                      )}
                    </label>
                    <input
                      name="lrn"
                      value={formData.lrn}
                      onChange={(e) => {
                        const numericValue = e.target.value.replace(/\D/g, "");
                        setFormData((p) => ({ ...p, lrn: numericValue.slice(0, 12) }));
                      }}
                      disabled={isReadOnly}
                      maxLength="12"
                      inputMode="numeric"
                      placeholder="12 digits for Kinder-Grade 6"
                    />
                  </div>
                  <div className="form-group">
                    <label>Student Type *</label>
                    <select
                      name="student_type"
                      value={formData.student_type}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    >
                      <option value="">Select</option>
                      <option value="new">New / Transferee</option>
                      <option value="old">Old Student</option>
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Education Level *</label>
                    <select
                      name="education_level"
                      value={formData.education_level}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    >
                      <option value="">Select</option>
                      <option value="preschool">Preschool</option>
                      <option value="elementary">Elementary</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Grade Level *</label>
                    <select
                      name="grade_level"
                      value={formData.grade_level}
                      onChange={handleInputChange}
                      disabled={isReadOnly || !formData.education_level}
                    >
                      <option value="">Select</option>
                      {gradeOptions.map((g) => (
                        <option key={g.value} value={g.value}>
                          {g.label} (age {GRADE_AGE_RULES[g.value]?.min}–
                          {GRADE_AGE_RULES[g.value]?.max})
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Section / Room</label>
                    <select
                      name="section"
                      value={formData.section}
                      onChange={handleInputChange}
                      disabled={isReadOnly || sectionsLoading}
                    >
                      <option value="">
                        {sectionsLoading ? "Loading sections..." : "Optional"}
                      </option>
                      {filteredSections.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name || s.section_name || `Section ${s.id}`}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Academic Year *</label>
                    <input
                      name="academic_year"
                      value={formData.academic_year}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Status</label>
                  <select
                    name="status"
                    value={formData.status}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                  >
                    <option value="PENDING">Pending</option>
                    <option value="ACTIVE">Enrolled</option>
                    <option value="DROPPED">Dropped</option>
                    <option value="COMPLETED">Completed</option>
                  </select>
                </div>
              </EnrollmentSection>

              <EnrollmentSection title="Student Information" icon="👤">
                <div className="form-row">
                  <div className="form-group">
                    <label>Last Name *</label>
                    <input
                      name="last_name"
                      value={formData.last_name}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>First Name *</label>
                    <input
                      name="first_name"
                      value={formData.first_name}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      name="middle_name"
                      value={formData.middle_name}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Birth Date</label>
                    <input
                      type="date"
                      name="birth_date"
                      value={formData.birth_date || ""}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                      max={todayISO()}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Gender</label>
                  <select
                    name="gender"
                    value={formData.gender}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                  >
                    <option value="">Select</option>
                    <option value="male">Male</option>
                    <option value="female">Female</option>
                  </select>
                </div>

                {formData.birth_date && formData.grade_level && !isReadOnly && (() => {
                  const check = validateAgeForGrade(formData.birth_date, formData.grade_level);
                  const age = calcAge(formData.birth_date);
                  const rule = GRADE_AGE_RULES[formData.grade_level];
                  return (
                    <div
                      className={check === true ? "enrollment-soft-note" : "enrollment-highlight-note"}
                    >
                      {check === true ? (
                        <>
                          Age {age} is valid for {rule?.label} (allowed: {rule?.min}–
                          {rule?.max} yrs)
                        </>
                      ) : (
                        <>{check}</>
                      )}
                    </div>
                  );
                })()}
              </EnrollmentSection>

              <EnrollmentSection title="Contact Information" icon="📞">
                <div className="form-row">
                  <div className="form-group">
                    <label>Email</label>
                    <input
                      name="email"
                      value={formData.email}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Religion</label>
                    <input
                      name="religion"
                      value={formData.religion}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Telephone</label>
                    <input
                      name="telephone_number"
                      value={formData.telephone_number}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Mobile</label>
                    <input
                      name="mobile_number"
                      value={formData.mobile_number}
                      onChange={handleInputChange}
                      onBlur={() => {
                        const n = normalizePHMobile(formData.mobile_number);
                        if (n) setFormData((p) => ({ ...p, mobile_number: n }));
                      }}
                      disabled={isReadOnly}
                      placeholder="09XXXXXXXXX or +639XXXXXXXXX"
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>Parent Facebook</label>
                  <input
                    name="parent_facebook"
                    value={formData.parent_facebook}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                    placeholder="Facebook profile link"
                  />
                </div>
              </EnrollmentSection>

              <EnrollmentSection title="Address" icon="📍">
                <div className="form-group form-group--full">
                  <label>House No. / Street</label>
                  <input
                    name="street"
                    value={formData.street}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                  />
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Barangay</label>
                    <input
                      name="barangay"
                      value={formData.barangay}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>City / Municipality</label>
                    <input
                      name="city"
                      value={formData.city}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="form-row">
                  <div className="form-group">
                    <label>Province</label>
                    <input
                      name="province"
                      value={formData.province}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Region</label>
                    <input
                      name="region"
                      value={formData.region}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="form-group">
                  <label>ZIP Code</label>
                  <input
                    name="zip_code"
                    value={formData.zip_code}
                    onChange={handleInputChange}
                    disabled={isReadOnly}
                  />
                </div>
              </EnrollmentSection>

              <EnrollmentSection title="Parent / Guardian Information" icon="👨‍👩‍👧" full>
                <div>
                  <p className="parent-section-label">Mother</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        name="mother_first"
                        value={formData.parent_info.mother_first}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label>Middle Name</label>
                      <input
                        name="mother_middle"
                        value={formData.parent_info.mother_middle}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        name="mother_last"
                        value={formData.parent_info.mother_last}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Number</label>
                      <input
                        name="mother_contact"
                        value={formData.parent_info.mother_contact}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Occupation</label>
                    <input
                      name="mother_occupation"
                      value={formData.parent_info.mother_occupation}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div>
                  <p className="parent-section-label">Father</p>
                  <div className="form-row">
                    <div className="form-group">
                      <label>First Name</label>
                      <input
                        name="father_first"
                        value={formData.parent_info.father_first}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label>Middle Name</label>
                      <input
                        name="father_middle"
                        value={formData.parent_info.father_middle}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="form-row">
                    <div className="form-group">
                      <label>Last Name</label>
                      <input
                        name="father_last"
                        value={formData.parent_info.father_last}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                    <div className="form-group">
                      <label>Contact Number</label>
                      <input
                        name="father_contact"
                        value={formData.parent_info.father_contact}
                        onChange={handleParentChange}
                        disabled={isReadOnly}
                      />
                    </div>
                  </div>
                  <div className="form-group">
                    <label>Occupation</label>
                    <input
                      name="father_occupation"
                      value={formData.parent_info.father_occupation}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>

                <div className="enrollment-divider-space" />

                <p className="parent-section-label">
                  Guardian{" "}
                  <span style={{ fontWeight: 400, color: "#9ca3af" }}>
                    (if applicable)
                  </span>
                </p>
                <div className="form-row">
                  <div className="form-group">
                    <label>First Name</label>
                    <input
                      name="guardian_first"
                      value={formData.parent_info.guardian_first}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Middle Name</label>
                    <input
                      name="guardian_middle"
                      value={formData.parent_info.guardian_middle}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <div className="form-row">
                  <div className="form-group">
                    <label>Last Name</label>
                    <input
                      name="guardian_last"
                      value={formData.parent_info.guardian_last}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                  <div className="form-group">
                    <label>Contact Number</label>
                    <input
                      name="guardian_contact"
                      value={formData.parent_info.guardian_contact}
                      onChange={handleParentChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Relationship to Student</label>
                  <input
                    name="guardian_relationship"
                    value={formData.parent_info.guardian_relationship}
                    onChange={handleParentChange}
                    disabled={isReadOnly}
                  />
                </div>
              </EnrollmentSection>

              <EnrollmentSection title="Payment Information" icon="💰" full>
                <div className="form-row">
                  <div className="form-group">
                    <label>Payment Mode *</label>
                    <select
                      name="payment_mode"
                      value={formData.payment_mode}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    >
                      <option value="">Select</option>
                      <option value="cash">Cash</option>
                      <option value="installment">Installment</option>
                    </select>
                  </div>
                  <div className="form-group">
                    <label>Remarks</label>
                    <input
                      name="remarks"
                      value={formData.remarks}
                      onChange={handleInputChange}
                      disabled={isReadOnly}
                    />
                  </div>
                </div>
              </EnrollmentSection>

              <EnrollmentSection title="Submitted Documents" icon="📎" full>
                <div className="enrollment-documents-wrap enrollment-new-documents-space">
                  <div className="enrollment-documents-intro">
                    Admin can review, upload, replace, relabel, or remove documents for
                    this enrollment.
                  </div>

                  <div
                    style={{
                      marginBottom: 18,
                      padding: 14,
                      border: "1px solid #e5eaf2",
                      borderRadius: 14,
                      background: "#f8fbff",
                    }}
                  >
                    <div style={{ fontWeight: 700, marginBottom: 10, fontSize: 13 }}>
                      Add New Document
                    </div>

                    <div className="form-row">
                      <div className="form-group">
                        <label>Document Type</label>
                        <select
                          value={docUploadType}
                          onChange={(e) => setDocUploadType(e.target.value)}
                        >
                          {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                            <option key={opt.value} value={opt.value}>
                              {opt.label}
                            </option>
                          ))}
                        </select>
                      </div>

                      <div className="form-group">
                        <label>Label</label>
                        <input
                          value={docUploadLabel}
                          onChange={(e) => setDocUploadLabel(e.target.value)}
                          placeholder="Optional custom label"
                        />
                      </div>
                    </div>

                    <div className="form-group">
                      <label>Choose File</label>
                      <input
                        type="file"
                        onChange={(e) => setDocUploadFile(e.target.files?.[0] || null)}
                      />
                    </div>

                    <div style={{ display: "flex", justifyContent: "flex-end" }}>
                      <button
                        className="btn-primary"
                        onClick={handleUploadDocument}
                        disabled={docSaving}
                      >
                        {docSaving ? "Saving..." : "Upload Document"}
                      </button>
                    </div>
                  </div>

                  <div className="enrollment-documents-grid">
                    {currentDocs.length ? (
                      currentDocs.map((doc) => (
                        <div key={doc.id} className="enrollment-document-card">
                          {editingDocId === doc.id ? (
                            <>
                              <div className="form-group">
                                <label>Document Type</label>
                                <select
                                  value={editingDocType}
                                  onChange={(e) => setEditingDocType(e.target.value)}
                                >
                                  {DOCUMENT_TYPE_OPTIONS.map((opt) => (
                                    <option key={opt.value} value={opt.value}>
                                      {opt.label}
                                    </option>
                                  ))}
                                </select>
                              </div>

                              <div className="form-group">
                                <label>Label</label>
                                <input
                                  value={editingDocLabel}
                                  onChange={(e) => setEditingDocLabel(e.target.value)}
                                />
                              </div>

                              <div className="form-group">
                                <label>Replace File</label>
                                <input
                                  type="file"
                                  onChange={(e) =>
                                    setEditingDocFile(e.target.files?.[0] || null)
                                  }
                                />
                              </div>

                              <div className="enrollment-document-card__actions">
                                <button
                                  className="btn-primary"
                                  onClick={handleUpdateDocument}
                                  disabled={docSaving}
                                >
                                  Save
                                </button>
                                <button
                                  className="btn-secondary"
                                  onClick={cancelEditDocument}
                                  disabled={docSaving}
                                >
                                  Cancel
                                </button>
                              </div>
                            </>
                          ) : (
                            <>
                              <div className="enrollment-document-card__type">
                                {doc.label || doc.document_type}
                              </div>

                              <div className="enrollment-document-card__meta">
                                {DOCUMENT_TYPE_OPTIONS.find(
                                  (x) => x.value === doc.document_type
                                )?.label || doc.document_type}
                              </div>

                              <div className="enrollment-document-card__actions">
                                <a
                                  href={doc.file}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="enrollment-document-link"
                                >
                                  <Paperclip size={12} />
                                  View
                                  <ExternalLink size={12} />
                                </a>

                                <button
                                  className="btn-edit"
                                  onClick={() => startEditDocument(doc)}
                                >
                                  <Edit2 size={14} />
                                </button>

                                <button
                                  className="btn-delete"
                                  onClick={() => handleDeleteDocument(doc.id)}
                                >
                                  <Trash2 size={14} />
                                </button>
                              </div>
                            </>
                          )}
                        </div>
                      ))
                    ) : (
                      <div className="enrollment-soft-note">
                        No documents submitted for this enrollment.
                      </div>
                    )}
                  </div>
                </div>
              </EnrollmentSection>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={closeModal}>
                Close
              </button>

              {editingId && !modalExpired && modalStatus === "PENDING" && (
                <>
                  <button className="btn-approve" onClick={handleApproveModal}>
                    <CheckCircle size={13} /> Approve
                  </button>
                  <button className="btn-decline" onClick={handleDeclineModal}>
                    <XCircle size={13} /> Decline
                  </button>
                </>
              )}

              {modalMode === "edit" && !modalExpired && (
                <button className="btn-primary" onClick={handleSaveEnrollment}>
                  {editingId ? "Save Changes" : "Create Enrollee"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {idUploadOpen && (
        <div
          className="modal-overlay enrollment-modal-overlay"
          onClick={(e) => e.target === e.currentTarget && closeIdUploadModal()}
        >
          <div className="modal-content" style={{ maxWidth: 460, width: "92vw" }}>
            <div className="enrollment-modal-header">
              <div className="enrollment-modal-title-wrap">
                <h2>Upload Student ID Image</h2>
                <div className="enrollment-modal-subtitle">
                  Upload or replace the student's ID image after enrollment approval.
                </div>
              </div>
              <button
                type="button"
                className="enrollment-modal-close"
                onClick={closeIdUploadModal}
              >
                <X size={18} />
              </button>
            </div>

            {idUploadPreview ? (
              <div style={{ marginBottom: 20, textAlign: "center" }}>
                <img
                  src={idUploadPreview}
                  alt="ID Preview"
                  style={{ maxWidth: "100%", maxHeight: 300, borderRadius: 12 }}
                />
                <div style={{ marginTop: 12 }}>
                  <button
                    className="btn-secondary"
                    onClick={() => {
                      setIdUploadFile(null);
                      setIdUploadPreview(null);
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            ) : (
              <label
                style={{
                  display: "block",
                  border: "2px dashed #d1d5db",
                  borderRadius: 14,
                  padding: 30,
                  textAlign: "center",
                  cursor: "pointer",
                  background: "#f9fafb",
                  marginBottom: 20,
                }}
              >
                <input
                  type="file"
                  accept="image/*"
                  onChange={handleIdImageSelect}
                  style={{ display: "none" }}
                />
                <div style={{ fontSize: 28, marginBottom: 8 }}>🪪</div>
                <div style={{ fontSize: 13, fontWeight: 600, color: "#374151" }}>
                  Click to upload student ID image
                </div>
                <div style={{ fontSize: 11, color: "#9ca3af", marginTop: 4 }}>
                  PNG, JPG up to 5MB
                </div>
              </label>
            )}

            <div className="form-actions">
              <button className="btn-secondary" onClick={closeIdUploadModal} disabled={idUploading}>
                Cancel
              </button>
              <button
                className="btn-primary"
                onClick={handleUploadIdImage}
                disabled={!idUploadFile || idUploading}
              >
                {idUploading ? "Uploading..." : "Upload ID"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}