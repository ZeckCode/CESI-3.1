import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Edit2, Trash2, Search, Filter,
  CheckCircle, Clock, AlertCircle, XCircle, Eye, RefreshCw,
  AlertTriangle, ArrowUpCircle, Settings, Calendar, X,
  Users, UserCheck, UserMinus, UserX,
} from "lucide-react";
import StatCard, { StatsGrid } from './StatCard';
import Pagination from './Pagination';
import "../AdminWebsiteCSS/EnrollmentManagement.css";
import { getToken } from "../Auth/auth";

const API_BASE = "http://127.0.0.1:8000";

function authHeaders(json = true) {
  const token = getToken();
  return {
    ...(json ? { "Content-Type": "application/json" } : {}),
    ...(token ? { Authorization: `Token ${token}` } : {}),
  };
}

/* ─────────────────────────────────────────────
   GRADE LABELS
───────────────────────────────────────────── */
const gradeLabel = (code) => ({
  prek: "Pre-Kinder", kinder: "Kindergarten",
  grade1: "Grade 1", grade2: "Grade 2", grade3: "Grade 3",
  grade4: "Grade 4", grade5: "Grade 5", grade6: "Grade 6",
}[code] || code || "");

const statusLabel = (s) => ({
  ACTIVE: "Active", PENDING: "Pending", DROPPED: "Dropped",
  COMPLETED: "Completed", EXPIRED: "Expired",
}[s] || s || "");

/* ─────────────────────────────────────────────
   AGE VALIDATION
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   GRADE PROGRESSION
───────────────────────────────────────────── */
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

const getNextGrade = (gradeCode) => GRADE_PROGRESSION[gradeCode] || { next: null, nextEdu: null };

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

/* ─────────────────────────────────────────────
   ENROLLMENT EXPIRY
───────────────────────────────────────────── */
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
  return expiry.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
};

const fmtDate = (date) =>
  date instanceof Date
    ? date.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" })
    : "—";

/* ─────────────────────────────────────────────
   ENROLLMENT WINDOW HELPERS
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   HELPERS FOR MATCHING ENROLLMENT FORM
───────────────────────────────────────────── */
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
  [first, middle, last].map((p) => String(p || "").trim()).filter(Boolean).join(" ");

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

/* ─────────────────────────────────────────────
   EMPTY FORM / HELPERS
───────────────────────────────────────────── */
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

/* ─────────────────────────────────────────────
   BADGE STYLES
───────────────────────────────────────────── */
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
  const displayCode = expired && code !== "DROPPED" && code !== "COMPLETED" ? "EXPIRED" : code;
  const icon =
    displayCode === "EXPIRED" ? <AlertTriangle size={12} /> :
    displayCode === "ACTIVE" || displayCode === "COMPLETED" ? <CheckCircle size={12} /> :
    displayCode === "DROPPED" ? <XCircle size={12} /> :
    <Clock size={12} />;
  return <span style={badgeStyle(STATUS_STYLES, displayCode)}>{icon}{statusLabel(displayCode)}</span>;
};

const FeeBadge = ({ fee }) => {
  const icon =
    fee === "cash" || fee === "Paid" ? <CheckCircle size={12} /> :
    fee === "installment" || fee === "Pending" ? <Clock size={12} /> :
    <AlertCircle size={12} />;
  return <span style={badgeStyle(FEE_STYLES, fee)}>{icon}{String(fee).toUpperCase()}</span>;
};

/* ─────────────────────────────────────────────
   TOAST
───────────────────────────────────────────── */
const Toast = ({ toasts, onDismiss }) => (
  <div style={{ position: "fixed", top: 20, right: 20, zIndex: 9999, display: "flex", flexDirection: "column", gap: 10, maxWidth: 380 }}>
    {toasts.map((t) => (
      <div
        key={t.id}
        style={{
          background: t.type === "error" ? "#1c0a0a" : t.type === "success" ? "#052e16" : "#1a1d2e",
          color: "white",
          padding: "14px 18px",
          borderRadius: 12,
          boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
          display: "flex",
          alignItems: "flex-start",
          gap: 10,
          borderLeft: `4px solid ${t.type === "error" ? "#ef4444" : t.type === "success" ? "#22c55e" : "#f59e0b"}`,
        }}
      >
        <AlertTriangle
          size={17}
          style={{
            flexShrink: 0,
            marginTop: 1,
            color: t.type === "error" ? "#f87171" : t.type === "success" ? "#4ade80" : "#fbbf24",
          }}
        />
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{t.title}</div>
          <div style={{ opacity: 0.8 }}>{t.message}</div>
        </div>
        <button
          onClick={() => onDismiss(t.id)}
          style={{ background: "none", border: "none", color: "white", cursor: "pointer", padding: 0, fontSize: 16, opacity: 0.6, flexShrink: 0 }}
        >
          ✕
        </button>
      </div>
    ))}
  </div>
);

/* ═══════════════════════════════════════════════
   MAIN COMPONENT
═══════════════════════════════════════════════ */
export default function EnrollmentManagement() {
  /* ── Enrollment list ── */
  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [enrollPage, setEnrollPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  /* ── Modal ── */
  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [modalStatus, setModalStatus] = useState(null);
  const [modalExpired, setModalExpired] = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState(false);

  /* ── Settings panel ── */
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsLoading, setSettingsLoading] = useState(false);
  const [settingsSaving, setSettingsSaving] = useState(false);
  const [settings, setSettings] = useState(null);
  const [draft, setDraft] = useState({
    open_date: "",
    window_days: 7,
    academic_year: "",
  });

  /* ── Toasts ── */
  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const window_ = useMemo(() => computeEnrollmentWindow(settings), [settings]);

  /* ═══════════ API: ENROLLMENTS ═══════════ */
  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/enrollments/`, {
        method: "GET",
        headers: authHeaders(),
        credentials: "include",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();
      const list = Array.isArray(data) ? data : [];
      setEnrollments(list);

      const expiredList = list.filter(
        (e) => isEnrollmentExpired(e.academic_year) && e.status !== "DROPPED" && e.status !== "COMPLETED"
      );

      if (expiredList.length > 0) {
        const names = expiredList.slice(0, 3).map((e) => `${e.first_name} ${e.last_name}`).join(", ");
        const more = expiredList.length > 3 ? ` and ${expiredList.length - 3} more` : "";
        addToast(
          `${expiredList.length} Expired Enrollment${expiredList.length > 1 ? "s" : ""}`,
          `${names}${more} — academic year has ended.`,
          "warning"
        );
      }
    } catch {
      alert("Failed to load enrollments. Check admin login/token + backend permissions.");
      setEnrollments([]);
    } finally {
      setLoading(false);
    }
  };

  /* ═══════════ API: SETTINGS ═══════════ */
  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/enrollment-settings/`, {
        method: "GET",
        headers: authHeaders(),
        credentials: "include",
      });
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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        open_date: draft.open_date || null,
        window_days: parseInt(draft.window_days, 10) || 7,
        academic_year: draft.academic_year.replace(/\s+/g, "") || null,
      };
      const res = await fetch(`${API_BASE}/api/enrollment-settings/`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Save error: " + JSON.stringify(data));
        return;
      }
      setSettings(data);
      addToast("Settings Saved", "Enrollment window has been updated successfully.", "success");
    } catch {
      alert("Failed to save settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  const handleResetSettings = async () => {
    if (!window.confirm("Reset to auto-calculated defaults? This will clear the manual open date and academic year.")) return;
    setDraft({ open_date: "", window_days: 7, academic_year: "" });
    setSettingsSaving(true);
    try {
      const res = await fetch(`${API_BASE}/api/enrollment-settings/`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ open_date: null, window_days: 7, academic_year: null }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Reset error: " + JSON.stringify(data));
        return;
      }
      setSettings(data);
      addToast("Settings Reset", "Enrollment window is now auto-calculated.", "success");
    } catch {
      alert("Failed to reset settings.");
    } finally {
      setSettingsSaving(false);
    }
  };

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
  }, []); // eslint-disable-line

  /* ═══════════ API: ENROLLMENT ACTIONS ═══════════ */
  const callAction = async (id, actionName) => {
    const res = await fetch(`${API_BASE}/api/enrollments/${id}/${actionName}/`, {
      method: "POST",
      headers: authHeaders(),
      credentials: "include",
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error("Action failed.");
    await fetchEnrollments();
    return data;
  };

  const handleApprove = (id) => callAction(id, "mark_active");
  const handleDecline = (id) => callAction(id, "mark_dropped");

  const handleDeleteEnrollment = async (id) => {
    if (!window.confirm("Delete this enrollment?")) return;
    try {
      const res = await fetch(`${API_BASE}/api/enrollments/${id}/`, {
        method: "DELETE",
        headers: authHeaders(false),
        credentials: "include",
      });
      if (!res.ok) throw new Error();
      await fetchEnrollments();
      if (editingId === id) closeModal();
    } catch {
      alert("Delete failed. Check permissions/token.");
    }
  };

  /* ═══════════ NORMALIZED DATA ═══════════ */
  const normalized = useMemo(() => enrollments.map((e) => {
    const statusCode = String(e.status || "PENDING").toUpperCase();
    const expired = isEnrollmentExpired(e.academic_year) && statusCode !== "DROPPED" && statusCode !== "COMPLETED";
    return {
      id: e.id,
      raw: e,
      studentName: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
      gradeLevel: gradeLabel(e.grade_level),
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
  }), [enrollments]);

  const filteredEnrollments = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return normalized.filter((row) => {
      const matchesSearch =
        !s ||
        row.studentName.toLowerCase().includes(s) ||
        row.parentName.toLowerCase().includes(s) ||
        String(row.phone).includes(searchTerm);

      const matchesStatus =
        filterStatus === "All"
          ? true
          : filterStatus === "Expired"
            ? row.expired
            : row.statusText === filterStatus;

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

  const stats = useMemo(() => ({
    total: normalized.length,
    active: normalized.filter((e) => e.statusCode === "ACTIVE" && !e.expired).length,
    pending: normalized.filter((e) => e.statusCode === "PENDING" && !e.expired).length,
    dropped: normalized.filter((e) => e.statusCode === "DROPPED").length,
    expired: normalized.filter((e) => e.expired).length,
  }), [normalized]);

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

  /* ═══════════ MODAL ═══════════ */
  const openModal = (row, mode = "view") => {
    const e = row.raw;
    const expired = isEnrollmentExpired(e.academic_year) && e.status !== "DROPPED" && e.status !== "COMPLETED";

    if (mode === "edit" && expired) {
      addToast(
        "Enrollment Expired",
        `${e.first_name} ${e.last_name}'s enrollment ended on ${formatExpiryDate(e.academic_year)}. Editing is blocked.`,
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
        : ["grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].includes(e.grade_level)
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
      addToast("Already at Highest Grade", `${e.first_name} ${e.last_name} has completed Grade 6.`, "warning");
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
  };

  const isReadOnly = (modalMode === "view" && editingId !== null) || modalExpired;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) =>
      name === "education_level"
        ? { ...p, education_level: value, grade_level: "" }
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
    if (!formData.email?.trim()) missing.push("Email");
    if (!formData.mobile_number?.trim()) missing.push("Mobile Number");
    if (!formData.parent_facebook?.trim()) missing.push("Parent Facebook");
    if (!formData.payment_mode) missing.push("Payment Mode");

    if (missing.length) {
      alert("Please fill required:\n- " + missing.join("\n- "));
      return false;
    }
    return true;
  };

  const handleApproveModal = async () => {
    if (!editingId) return;
    try {
      const u = await handleApprove(editingId);
      setModalStatus("ACTIVE");
      setFormData((p) => ({ ...p, status: "ACTIVE", remarks: u?.remarks ?? p.remarks }));
      setModalMode("view");
    } catch {
      alert("Approve failed.");
    }
  };

  const handleDeclineModal = async () => {
    if (!editingId) return;
    try {
      const u = await handleDecline(editingId);
      setModalStatus("DROPPED");
      setFormData((p) => ({ ...p, status: "DROPPED", remarks: u?.remarks ?? p.remarks }));
      setModalMode("view");
    } catch {
      alert("Decline failed.");
    }
  };

  const handleSaveAcademicYear = async () => {
    if (!editingId) return;
    const newYear = formData.academic_year?.trim();
    if (!newYear || !/^\d{4}-\d{4}$/.test(newYear)) {
      alert("Invalid format. Use YYYY-YYYY (e.g. 2025-2026).");
      return;
    }

    try {
      const res = await fetch(`${API_BASE}/api/enrollments/${editingId}/`, {
        method: "PATCH",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify({ academic_year: newYear }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Save error: " + JSON.stringify(data));
        return;
      }
      await fetchEnrollments();
      const nowExpired = isEnrollmentExpired(newYear);
      setModalExpired(nowExpired);
      setEditingAcademicYear(false);
      if (!nowExpired) addToast("Academic Year Updated", `Enrollment is now active for ${newYear}.`, "success");
    } catch {
      alert("Save failed.");
    }
  };

  const handleSaveEnrollment = async () => {
    if (!editingId && !validateCreate()) return;

    const bdCheck = validateBirthDate(formData.birth_date);
    if (bdCheck !== true) {
      alert(bdCheck);
      return;
    }

    const ageCheck = validateAgeForGrade(formData.birth_date, formData.grade_level);
    if (ageCheck !== true) {
      alert(ageCheck);
      return;
    }

    if (isEnrollmentExpired(formData.academic_year)) {
      if (!window.confirm(`Warning: AY "${formData.academic_year}" has already ended.\n\nDo you still want to save?`)) return;
    }

    let normalizedMobile = null;
    if (formData.mobile_number?.trim()) {
      normalizedMobile = normalizePHMobile(formData.mobile_number);
      if (!normalizedMobile) {
        alert("Invalid PH mobile number.\nUse 09XXXXXXXXX or +639XXXXXXXXX format.");
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
      ? `${API_BASE}/api/enrollments/${editingId}/`
      : `${API_BASE}/api/enrollments/`;

    try {
      const res = await fetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: authHeaders(),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        alert("Save error: " + JSON.stringify(data));
        return;
      }
      await fetchEnrollments();
      if (!editingId) closeModal();
      else {
        setModalMode("view");
        setModalStatus(data?.status ?? formData.status);
      }
    } catch {
      alert("Save failed.");
    }
  };

  /* ═══════════════════════════════════════════════
     RENDER
  ═══════════════════════════════════════════════ */
  return (
    <div className="enrollment-management">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="enrollment-stats-section">
        <div className="enrollment-stats-header">
          <div className="enrollment-stats-title">Overview</div>
          <div className="header-actions">
            <button className="btn-primary" onClick={openCreateModal}>+ Add Enrollee</button>
            <button className="btn-icon" onClick={fetchEnrollments} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button
              className={`btn-icon ${settingsOpen ? 'btn-icon--active' : ''}`}
              onClick={() => setSettingsOpen((v) => !v)}
              title="School Year Settings"
            >
              <Settings size={16} />
            </button>
          </div>
        </div>

        <StatsGrid>
          <StatCard label="Total" value={stats.total} icon={<Users size={20} />} color="blue" subtitle="All enrollees" />
          <StatCard label="Active" value={stats.active} icon={<UserCheck size={20} />} color="green" subtitle={stats.total ? `${Math.round((stats.active / stats.total) * 100)}% of total` : '—'} subtitleType="positive" />
          <StatCard label="Pending" value={stats.pending} icon={<Clock size={20} />} color="yellow" subtitle={stats.total ? `${Math.round((stats.pending / stats.total) * 100)}% of total` : '—'} />
          <StatCard label="Dropped" value={stats.dropped} icon={<UserMinus size={20} />} color="red" subtitle={stats.total ? `${Math.round((stats.dropped / stats.total) * 100)}% of total` : '—'} subtitleType="negative" />
          <StatCard label="Expired" value={stats.expired} icon={<UserX size={20} />} color="purple" subtitle={stats.total ? `${Math.round((stats.expired / stats.total) * 100)}% of total` : '—'} subtitleType="negative" />
          <StatCard
            label="Enrollment"
            value={window_.isOpen ? `Open · ${window_.daysLeft}d left` : 'Closed'}
            icon={<Calendar size={20} />}
            color={window_.isOpen ? 'teal' : 'red'}
            subtitle={window_.isOpen ? 'Accepting enrollees' : 'Window closed'}
          />
        </StatsGrid>
      </div>

      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-panel__header">
            <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
              <Calendar size={16} style={{ color: "#4f6ef7" }} />
              <span style={{ fontWeight: 700, fontSize: 14 }}>Enrollment Window & School Year</span>
            </div>
            <button onClick={() => setSettingsOpen(false)} style={{ background: "none", border: "none", cursor: "pointer", color: "#6b7280", display: "flex" }}>
              <X size={16} />
            </button>
          </div>

          {settingsLoading ? (
            <div style={{ padding: "20px", textAlign: "center", color: "#6b7280", fontSize: 13 }}>Loading settings…</div>
          ) : (
            <>
              <div className="settings-panel__status">
                <div className="settings-panel__status-badge" style={{ background: window_.isOpen ? "#d1fae5" : "#fee2e2", color: window_.isOpen ? "#065f46" : "#7f1d1d" }}>
                  {window_.isOpen ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {window_.isOpen ? `Open — ${window_.daysLeft} day${window_.daysLeft !== 1 ? "s" : ""} left` : "Closed"}
                </div>
                <div style={{ fontSize: 12, color: "#6b7280" }}>
                  {fmtDate(window_.openDate)} → {fmtDate(window_.closeDate)}
                  {" · "}AY <strong>{window_.academicYear}</strong>
                </div>
              </div>

              <div className="settings-panel__fields">
                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Academic Year
                    <span className="settings-panel__hint">Leave blank to auto-calculate from open date</span>
                  </label>
                  <input
                    className="settings-panel__input"
                    value={draft.academic_year}
                    onChange={(e) => setDraft((p) => ({ ...p, academic_year: e.target.value.replace(/\s+/g, "") }))}
                    placeholder={`Auto: ${window_.academicYear}`}
                  />
                </div>

                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Enrollment Open Date
                    <span className="settings-panel__hint">Leave blank to use auto default (June 1)</span>
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
                      style={{ fontSize: 11, color: "#6b7280", background: "none", border: "none", cursor: "pointer", marginTop: 4, textDecoration: "underline" }}
                    >
                      Clear (use auto)
                    </button>
                  )}
                </div>

                <div className="settings-panel__field">
                  <label className="settings-panel__label">
                    Enrollment Window Duration
                    <span className="settings-panel__hint">Number of days the form stays open</span>
                  </label>
                  <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="settings-panel__input"
                      style={{ width: 80 }}
                      value={draft.window_days}
                      onChange={(e) => setDraft((p) => ({ ...p, window_days: e.target.value }))}
                    />
                    <span style={{ fontSize: 13, color: "#6b7280" }}>
                      days
                      {draft.open_date || settings?.open_date
                        ? ` · closes ${fmtDate((() => {
                          const d = new Date((draft.open_date || settings?.open_date) + "T00:00:00");
                          d.setDate(d.getDate() + parseInt(draft.window_days, 10) - 1);
                          return d;
                        })())}`
                        : ""}
                    </span>
                  </div>
                </div>
              </div>

              {(draft.open_date || draft.academic_year || draft.window_days !== (settings?.window_days ?? 7)) && (
                <div className="settings-panel__preview">
                  <span style={{ fontSize: 12, color: "#4f6ef7", fontWeight: 600 }}>📋 Preview after saving:</span>
                  <span style={{ fontSize: 12, color: "#374151" }}>
                    {" "}AY <strong>{draft.academic_year || computeEnrollmentWindow({ ...settings, ...draft, open_date: draft.open_date || null, academic_year: draft.academic_year || null }).academicYear}</strong>
                    {" · "}Window: {fmtDate(computeEnrollmentWindow({ ...settings, ...draft, open_date: draft.open_date || null }).openDate)}
                    {" → "}{fmtDate(computeEnrollmentWindow({ ...settings, ...draft, open_date: draft.open_date || null, window_days: draft.window_days }).closeDate)}
                  </span>
                </div>
              )}

              <div className="settings-panel__actions">
                <button className="btn-primary" onClick={handleSaveSettings} disabled={settingsSaving}>
                  {settingsSaving ? "Saving…" : <><CheckCircle size={13} /> Save Settings</>}
                </button>
                <button className="btn-secondary" onClick={handleResetSettings} disabled={settingsSaving}>
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
            placeholder="Search by student, parent name or phone…"
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={16} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active</option>
            <option value="Pending">Pending</option>
            <option value="Dropped">Dropped</option>
            <option value="Completed">Completed</option>
            <option value="Expired">Expired</option>
          </select>
        </div>
      </div>

      <div className="enrollments-container">
        {loading ? (
          <div className="no-results">Loading…</div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="no-results">No enrollments found. Try adjusting filters.</div>
        ) : (
          <table className="enrollments-table">
            <thead>
              <tr>
                <th>Student Name</th>
                <th>Grade Level</th>
                <th>Enrollment Date</th>
                <th>Status</th>
                <th>Fee Status</th>
                <th>Parent/Guardian</th>
                <th>Phone</th>
                <th>Approve / Decline</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {paginatedEnrollments.map((row) => (
                <tr key={row.id} style={row.expired ? { background: "#fdf4ff" } : {}}>
                  <td style={{ fontWeight: 500 }}>
                    {row.studentName}
                    {row.expired && (
                      <div style={{ fontSize: 10, color: "#9333ea", fontWeight: 600, marginTop: 2 }}>
                        Expired · {formatExpiryDate(row.academicYear)}
                      </div>
                    )}
                  </td>
                  <td>{row.gradeLevel}</td>
                  <td>{row.enrollmentDate ? new Date(row.enrollmentDate).toLocaleDateString() : "—"}</td>
                  <td><StatusBadge code={row.statusCode} expired={row.expired} /></td>
                  <td><FeeBadge fee={row.fee} /></td>
                  <td>{row.parentName}</td>
                  <td>{row.phone}</td>
                  <td>
                    {row.expired ? (
                      <span style={{ color: "#9333ea", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <AlertTriangle size={13} /> Expired
                      </span>
                    ) : row.statusCode === "PENDING" ? (
                      <div className="approve-decline-group">
                        <button className="btn-approve" onClick={() => handleApprove(row.id)}><CheckCircle size={12} /> Approve</button>
                        <button className="btn-decline" onClick={() => handleDecline(row.id)}><XCircle size={12} /> Decline</button>
                      </div>
                    ) : row.statusCode === "ACTIVE" ? (
                      <span style={{ color: "#059669", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle size={13} /> Approved
                      </span>
                    ) : row.statusCode === "DROPPED" ? (
                      <span style={{ color: "#dc2626", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <XCircle size={13} /> Declined
                      </span>
                    ) : row.statusCode === "COMPLETED" ? (
                      <span style={{ color: "#1d4ed8", fontWeight: 600, fontSize: 12, display: "flex", alignItems: "center", gap: 4 }}>
                        <CheckCircle size={13} /> Completed
                      </span>
                    ) : <span style={{ opacity: 0.4 }}>—</span>}
                  </td>
                  <td>
                    <div className="action-buttons">
                      <button className="btn-edit" title="View" onClick={() => openModal(row, "view")}><Eye size={14} /></button>
                      <button
                        className="btn-edit"
                        title={row.expired ? "Editing blocked — enrollment expired" : "Edit"}
                        onClick={() => openModal(row, "edit")}
                        style={row.expired ? { opacity: 0.35, cursor: "not-allowed" } : {}}
                      >
                        <Edit2 size={14} />
                      </button>
                      {(row.statusCode === "ACTIVE" || row.statusCode === "COMPLETED") && getNextGrade(row.raw.grade_level).next && (
                        <button
                          className="btn-promote"
                          title={`Promote to ${gradeLabel(getNextGrade(row.raw.grade_level).next)}`}
                          onClick={() => handlePromote(row)}
                        >
                          <ArrowUpCircle size={14} />
                        </button>
                      )}
                      <button className="btn-delete" title="Delete" onClick={() => handleDeleteEnrollment(row.id)}>
                        <Trash2 size={14} />
                      </button>
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
        <div className="modal-overlay">
          <div className="modal-content">
            {modalExpired && (
              <div style={{ background: "#fdf4ff", border: "1.5px solid #d8b4fe", borderRadius: 10, padding: "14px 16px", marginBottom: 18 }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle size={17} style={{ color: "#9333ea", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#6b21a8", lineHeight: 1.5 }}>
                      <strong>Enrollment Expired</strong><br />
                      This enrollment ended on <strong>{formatExpiryDate(formData.academic_year)}</strong>.
                      Editing is disabled — you can update the academic year to re-activate it.
                    </div>
                    {editingAcademicYear ? (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            name="academic_year"
                            value={formData.academic_year}
                            onChange={handleInputChange}
                            placeholder="e.g. 2025-2026"
                            style={{
                              padding: "8px 12px",
                              borderRadius: 8,
                              fontSize: 13,
                              border: "1.5px solid #a855f7",
                              outline: "none",
                              fontFamily: "inherit",
                              width: 140,
                            }}
                          />
                          {formData.academic_year && (
                            <span style={{ fontSize: 11, color: isEnrollmentExpired(formData.academic_year) ? "#9333ea" : "#059669" }}>
                              {isEnrollmentExpired(formData.academic_year)
                                ? `Still expired — ends ${formatExpiryDate(formData.academic_year)}`
                                : `✓ Valid — expires ${formatExpiryDate(formData.academic_year)}`}
                            </span>
                          )}
                        </div>
                        <button className="btn-primary" onClick={handleSaveAcademicYear}><CheckCircle size={13} /> Save</button>
                        <button className="btn-secondary" onClick={() => setEditingAcademicYear(false)}>Cancel</button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingAcademicYear(true)}
                        style={{
                          marginTop: 10,
                          display: "inline-flex",
                          alignItems: "center",
                          gap: 6,
                          padding: "7px 14px",
                          borderRadius: 8,
                          border: "1.5px solid #a855f7",
                          background: "white",
                          color: "#7e22ce",
                          fontSize: 12,
                          fontWeight: 600,
                          cursor: "pointer",
                          fontFamily: "inherit",
                        }}
                      >
                        <Edit2 size={12} /> Edit Academic Year
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )}

            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: 12 }}>
              <h2>
                {editingId
                  ? "Enrollment Details"
                  : formData.student_type === "old" && formData.grade_level
                    ? `Promote to ${gradeLabel(formData.grade_level)}`
                    : "Add Enrollee"}
              </h2>
              <div style={{ display: "flex", gap: 8, alignItems: "center" }}>
                {editingId && !modalExpired && (
                  modalMode === "view"
                    ? <button className="btn-primary" onClick={() => setModalMode("edit")}>Edit</button>
                    : <button className="btn-secondary" onClick={() => setModalMode("view")}>View</button>
                )}

                {editingId && !modalExpired && modalStatus === "PENDING" && (
                  <>
                    <button className="btn-approve" onClick={handleApproveModal}><CheckCircle size={13} /> Approve</button>
                    <button className="btn-decline" onClick={handleDeclineModal}><XCircle size={13} /> Decline</button>
                  </>
                )}

                {editingId && modalStatus === "ACTIVE" && !modalExpired && <span style={{ color: "#059669", fontWeight: 700, fontSize: 13 }}>✔ Approved</span>}
                {editingId && modalStatus === "DROPPED" && <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 13 }}>✖ Declined</span>}
                {editingId && modalStatus === "COMPLETED" && <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>✔ Completed</span>}
                {modalExpired && <span style={badgeStyle(STATUS_STYLES, "EXPIRED")}><AlertTriangle size={11} /> Expired</span>}

                {editingId && (modalStatus === "ACTIVE" || modalStatus === "COMPLETED") && !modalExpired && getNextGrade(formData.grade_level).next && (
                  <button
                    className="btn-promote"
                    onClick={() => {
                      const m = normalized.find((r) => r.id === editingId);
                      if (m) {
                        closeModal();
                        handlePromote(m);
                      }
                    }}
                  >
                    <ArrowUpCircle size={13} /> Promote to {gradeLabel(getNextGrade(formData.grade_level).next)}
                  </button>
                )}
              </div>
            </div>

            {!editingId && formData.student_type === "old" && formData.grade_level && (
              <div style={{ background: "#f0fdf4", border: "1.5px solid #86efac", borderRadius: 10, padding: "12px 16px", marginBottom: 18, display: "flex", alignItems: "flex-start", gap: 10 }}>
                <ArrowUpCircle size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
                  <strong>Promotion Enrollment</strong><br />
                  Creating a new enrollment for <strong>{formData.first_name} {formData.last_name}</strong> — promoted to <strong>{gradeLabel(formData.grade_level)}</strong> for AY <strong>{formData.academic_year}</strong>.
                  Personal and parent info has been carried over. Please set the <strong>Payment Mode</strong> before saving.
                </div>
              </div>
            )}

            <h3>🎓 Academic Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>LRN</label>
                <input name="lrn" value={formData.lrn} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Student Type *</label>
                <select name="student_type" value={formData.student_type} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option value="new">New / Transferee</option>
                  <option value="old">Old Student</option>
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Education Level *</label>
                <select name="education_level" value={formData.education_level} onChange={handleInputChange} disabled={isReadOnly}>
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
                      {g.label} (age {GRADE_AGE_RULES[g.value]?.min}–{GRADE_AGE_RULES[g.value]?.max})
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Academic Year *</label>
                <input name="academic_year" value={formData.academic_year} onChange={handleInputChange} disabled={isReadOnly} />
                {formData.academic_year && (
                  <span style={{ fontSize: 11, marginTop: 4, color: isEnrollmentExpired(formData.academic_year) ? "#9333ea" : "#059669" }}>
                    {isEnrollmentExpired(formData.academic_year)
                      ? `Expired on ${formatExpiryDate(formData.academic_year)}`
                      : `Expires ${formatExpiryDate(formData.academic_year)}`}
                  </span>
                )}
              </div>
              <div className="form-group">
                <label>Status</label>
                <select name="status" value={formData.status} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="PENDING">Pending</option>
                  <option value="ACTIVE">Active</option>
                  <option value="DROPPED">Dropped</option>
                  <option value="COMPLETED">Completed</option>
                </select>
              </div>
            </div>

            <h3>👤 Student Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Last Name *</label>
                <input name="last_name" value={formData.last_name} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>First Name *</label>
                <input name="first_name" value={formData.first_name} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Middle Name</label>
                <input name="middle_name" value={formData.middle_name} onChange={handleInputChange} disabled={isReadOnly} />
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

            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
            </div>

            {formData.birth_date && formData.grade_level && !isReadOnly && (() => {
              const check = validateAgeForGrade(formData.birth_date, formData.grade_level);
              const age = calcAge(formData.birth_date);
              const rule = GRADE_AGE_RULES[formData.grade_level];
              return (
                <div
                  style={{
                    padding: "9px 13px",
                    borderRadius: 8,
                    marginBottom: 12,
                    fontSize: 12,
                    background: check === true ? "#f0fdf4" : "#fff7ed",
                    border: `1.5px solid ${check === true ? "#86efac" : "#fed7aa"}`,
                    color: check === true ? "#166534" : "#92400e",
                    display: "flex",
                    alignItems: "center",
                    gap: 7,
                  }}
                >
                  {check === true
                    ? <><CheckCircle size={13} /> Age {age} is valid for {rule?.label} (allowed: {rule?.min}–{rule?.max} yrs)</>
                    : <><AlertTriangle size={13} /> {check}</>}
                </div>
              );
            })()}

            <h3>📞 Contact Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input name="email" value={formData.email} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Religion</label>
                <input name="religion" value={formData.religion} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Telephone</label>
                <input name="telephone_number" value={formData.telephone_number} onChange={handleInputChange} disabled={isReadOnly} />
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
              <input name="parent_facebook" value={formData.parent_facebook} onChange={handleInputChange} disabled={isReadOnly}  required={!isReadOnly} placeholder="Facebook profile link"/>
            </div>

            <h3>📍 Address</h3>
            <div className="form-group">
              <label>House No. / Street</label>
              <input name="street" value={formData.street} onChange={handleInputChange} disabled={isReadOnly} />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Barangay</label>
                <input name="barangay" value={formData.barangay} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>City / Municipality</label>
                <input name="city" value={formData.city} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Province</label>
                <input name="province" value={formData.province} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Region</label>
                <input name="region" value={formData.region} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>ZIP Code</label>
                <input name="zip_code" value={formData.zip_code} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
              <div className="form-group" />
            </div>

            <h3>👨‍👩‍👧 Parent / Guardian Information</h3>

            <p className="parent-section-label">Mother</p>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input name="mother_first" value={formData.parent_info.mother_first} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input name="mother_middle" value={formData.parent_info.mother_middle} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Last Name</label>
                <input name="mother_last" value={formData.parent_info.mother_last} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input name="mother_contact" value={formData.parent_info.mother_contact} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-group">
              <label>Occupation</label>
              <input name="mother_occupation" value={formData.parent_info.mother_occupation} onChange={handleParentChange} disabled={isReadOnly} />
            </div>

            <p className="parent-section-label">Father</p>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input name="father_first" value={formData.parent_info.father_first} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input name="father_middle" value={formData.parent_info.father_middle} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Last Name</label>
                <input name="father_last" value={formData.parent_info.father_last} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input name="father_contact" value={formData.parent_info.father_contact} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-group">
              <label>Occupation</label>
              <input name="father_occupation" value={formData.parent_info.father_occupation} onChange={handleParentChange} disabled={isReadOnly} />
            </div>

            <p className="parent-section-label">
              Guardian <span style={{ fontWeight: 400, color: "#9ca3af" }}>(if applicable)</span>
            </p>
            <div className="form-row">
              <div className="form-group">
                <label>First Name</label>
                <input name="guardian_first" value={formData.parent_info.guardian_first} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input name="guardian_middle" value={formData.parent_info.guardian_middle} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Last Name</label>
                <input name="guardian_last" value={formData.parent_info.guardian_last} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input name="guardian_contact" value={formData.parent_info.guardian_contact} onChange={handleParentChange} disabled={isReadOnly} />
              </div>
            </div>
            <div className="form-group">
              <label>Relationship to Student</label>
              <input name="guardian_relationship" value={formData.parent_info.guardian_relationship} onChange={handleParentChange} disabled={isReadOnly} />
            </div>

            <h3>💰 Payment Information</h3>
            <div className="form-row">
              <div className="form-group">
                <label>Payment Mode *</label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                </select>
              </div>
              <div className="form-group">
                <label>Remarks</label>
                <input name="remarks" value={formData.remarks} onChange={handleInputChange} disabled={isReadOnly} />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={closeModal}>Close</button>
              {modalMode === "edit" && !modalExpired && (
                <button className="btn-primary" onClick={handleSaveEnrollment}>
                  {editingId ? "Save Changes" : "Create Enrollee"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}