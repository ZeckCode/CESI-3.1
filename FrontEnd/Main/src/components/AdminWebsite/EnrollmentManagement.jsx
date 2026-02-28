import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Edit2, Trash2, Search, Filter,
  CheckCircle, Clock, AlertCircle, XCircle, Eye, RefreshCw, AlertTriangle, ArrowUpCircle,
} from "lucide-react";
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
  grade1: "Grade 1",  grade2: "Grade 2",  grade3: "Grade 3",
  grade4: "Grade 4",  grade5: "Grade 5",  grade6: "Grade 6",
}[code] || code || "");

const statusLabel = (s) => ({
  ACTIVE: "Active", PENDING: "Pending", DROPPED: "Dropped",
  COMPLETED: "Completed", EXPIRED: "Expired",
}[s] || s || "");

/* ─────────────────────────────────────────────
   AGE VALIDATION PER GRADE (Philippine Standard)
   Each entry: [minAge, maxAge] (inclusive)
───────────────────────────────────────────── */
const GRADE_AGE_RULES = {
  prek:   { min: 3,  max: 5,  label: "Pre-Kinder"   },
  kinder: { min: 4,  max: 6,  label: "Kindergarten"  },
  grade1: { min: 5,  max: 7,  label: "Grade 1"       },
  grade2: { min: 6,  max: 8,  label: "Grade 2"       },
  grade3: { min: 7,  max: 9,  label: "Grade 3"       },
  grade4: { min: 8,  max: 10, label: "Grade 4"       },
  grade5: { min: 9,  max: 11, label: "Grade 5"       },
  grade6: { min: 10, max: 12, label: "Grade 6"       },
};

/* ─────────────────────────────────────────────
   GRADE PROGRESSION (for Promote feature)
───────────────────────────────────────────── */
const GRADE_PROGRESSION = {
  prek:   { next: "kinder",  nextEdu: "preschool"  },
  kinder: { next: "grade1",  nextEdu: "elementary" },
  grade1: { next: "grade2",  nextEdu: "elementary" },
  grade2: { next: "grade3",  nextEdu: "elementary" },
  grade3: { next: "grade4",  nextEdu: "elementary" },
  grade4: { next: "grade5",  nextEdu: "elementary" },
  grade5: { next: "grade6",  nextEdu: "elementary" },
  grade6: { next: null,      nextEdu: null          }, // graduated
};

const getNextGrade = (gradeCode) => GRADE_PROGRESSION[gradeCode] || { next: null, nextEdu: null };

const advanceAcademicYear = (academicYear) => {
  if (!academicYear) return getCurrentAcademicYear();
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return getCurrentAcademicYear();
  const start = parseInt(parts[0], 10);
  const end   = parseInt(parts[1], 10);
  if (isNaN(start) || isNaN(end)) return getCurrentAcademicYear();
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

  if (age < rule.min)
    return `Student is too young for ${rule.label}. Minimum age is ${rule.min} years old (current age: ${age}).`;
  if (age > rule.max)
    return `Student is too old for ${rule.label}. Maximum age is ${rule.max} years old (current age: ${age}).`;
  return true;
};

/* ─────────────────────────────────────────────
   ENROLLMENT EXPIRY
   Academic year "YYYY-YYYY" expires on March 31 of the end year
   e.g. "2024-2025" -> March 31, 2025
───────────────────────────────────────────── */
const getAcademicYearExpiry = (academicYear) => {
  if (!academicYear) return null;
  const parts = String(academicYear).split("-");
  if (parts.length !== 2) return null;
  const endYear = parseInt(parts[1], 10);
  if (isNaN(endYear)) return null;
  return new Date(endYear, 2, 31, 23, 59, 59); // March 31
};

const isEnrollmentExpired = (academicYear) => {
  const expiry = getAcademicYearExpiry(academicYear);
  if (!expiry) return false;
  return new Date() > expiry;
};

const formatExpiryDate = (academicYear) => {
  const expiry = getAcademicYearExpiry(academicYear);
  if (!expiry) return "—";
  return expiry.toLocaleDateString("en-PH", { year: "numeric", month: "long", day: "numeric" });
};

/* ─────────────────────────────────────────────
   EMPTY FORM
───────────────────────────────────────────── */
const emptyForm = () => ({
  first_name: "", last_name: "", middle_name: "",
  birth_date: "", gender: "", lrn: "",
  education_level: "", grade_level: "", student_type: "",
  academic_year: "2024-2025", status: "PENDING", payment_mode: "",
  email: "", address: "", religion: "",
  telephone_number: "", mobile_number: "", parent_facebook: "",
  remarks: "",
  parent_info: {
    father_name: "", father_contact: "", father_occupation: "",
    mother_name: "", mother_contact: "", mother_occupation: "",
    guardian_name: "", guardian_contact: "", guardian_relationship: "",
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
  const today = new Date();
  let age = today.getFullYear() - bd.getFullYear();
  const m = today.getMonth() - bd.getMonth();
  if (m < 0 || (m === 0 && today.getDate() < bd.getDate())) age--;
  return age;
};

const validateBirthDate = (yyyyMMdd) => {
  if (!yyyyMMdd) return true;
  const bd = new Date(yyyyMMdd + "T00:00:00");
  const today = new Date(); today.setHours(0, 0, 0, 0);
  if (bd >= today) return "Birth date must be in the past.";
  const age = calcAge(yyyyMMdd);
  if (age < 3) return "Student must be at least 3 years old.";
  if (age > 18) return "Student age exceeds allowed school range.";
  return true;
};

const normalizePHMobile = (number) => {
  if (!number) return "";
  const cleaned = number.replace(/\s+/g, "");
  if (/^09\d{9}$/.test(cleaned)) return "+63" + cleaned.slice(1);
  if (/^\+639\d{9}$/.test(cleaned)) return cleaned;
  return null;
};

/* ─────────────────────────────────────────────
   BADGE STYLES (pure inline — no CSS cascade)
───────────────────────────────────────────── */
const STATUS_STYLES = {
  ACTIVE:    { background: "#d1fae5", color: "#065f46" },
  PENDING:   { background: "#fef3c7", color: "#92400e" },
  DROPPED:   { background: "#fee2e2", color: "#7f1d1d" },
  COMPLETED: { background: "#dbeafe", color: "#1e40af" },
  EXPIRED:   { background: "#f3e8ff", color: "#6b21a8" },
};

const FEE_STYLES = {
  cash:        { background: "#d1fae5", color: "#065f46" },
  Paid:        { background: "#d1fae5", color: "#065f46" },
  installment: { background: "#fef3c7", color: "#92400e" },
  Pending:     { background: "#fef3c7", color: "#92400e" },
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
    displayCode === "EXPIRED"                           ? <AlertTriangle size={12} /> :
    displayCode === "ACTIVE" || displayCode === "COMPLETED" ? <CheckCircle size={12} /> :
    displayCode === "DROPPED"                           ? <XCircle size={12} /> :
    <Clock size={12} />;
  return (
    <span style={badgeStyle(STATUS_STYLES, displayCode)}>
      {icon}{statusLabel(displayCode)}
    </span>
  );
};

const FeeBadge = ({ fee }) => {
  const icon =
    fee === "cash" || fee === "Paid"              ? <CheckCircle size={12} /> :
    fee === "installment" || fee === "Pending"    ? <Clock size={12} /> :
    <AlertCircle size={12} />;
  return (
    <span style={badgeStyle(FEE_STYLES, fee)}>
      {icon}{String(fee).toUpperCase()}
    </span>
  );
};

/* ─────────────────────────────────────────────
   TOAST COMPONENT
───────────────────────────────────────────── */
const Toast = ({ toasts, onDismiss }) => (
  <div style={{
    position: "fixed", top: 20, right: 20, zIndex: 9999,
    display: "flex", flexDirection: "column", gap: 10, maxWidth: 380,
  }}>
    {toasts.map((t) => (
      <div key={t.id} style={{
        background: t.type === "error" ? "#1c0a0a" : t.type === "success" ? "#052e16" : "#1a1d2e",
        color: "white", padding: "14px 18px", borderRadius: 12,
        boxShadow: "0 8px 24px rgba(0,0,0,0.25)",
        display: "flex", alignItems: "flex-start", gap: 10,
        borderLeft: `4px solid ${t.type === "error" ? "#ef4444" : t.type === "success" ? "#22c55e" : "#f59e0b"}`,
      }}>
        <AlertTriangle size={17} style={{ flexShrink: 0, marginTop: 1, color: t.type === "error" ? "#f87171" : t.type === "success" ? "#4ade80" : "#fbbf24" }} />
        <div style={{ flex: 1, fontSize: 13, lineHeight: 1.5 }}>
          <div style={{ fontWeight: 700, marginBottom: 3 }}>{t.title}</div>
          <div style={{ opacity: 0.8 }}>{t.message}</div>
        </div>
        <button onClick={() => onDismiss(t.id)} style={{
          background: "none", border: "none", color: "white",
          cursor: "pointer", padding: 0, fontSize: 16, opacity: 0.6, flexShrink: 0,
        }}>✕</button>
      </div>
    ))}
  </div>
);

/* ─────────────────────────────────────────────
   MAIN COMPONENT
───────────────────────────────────────────── */
export default function EnrollmentManagement() {
  const [enrollments, setEnrollments]   = useState([]);
  const [loading, setLoading]           = useState(true);
  const [searchTerm, setSearchTerm]     = useState("");
  const [filterStatus, setFilterStatus] = useState("All");

  const [modalOpen, setModalOpen]       = useState(false);
  const [modalMode, setModalMode]       = useState("view");
  const [editingId, setEditingId]       = useState(null);
  const [formData, setFormData]         = useState(emptyForm());
  const [modalStatus, setModalStatus]   = useState(null);
  const [modalExpired, setModalExpired]               = useState(false);
  const [editingAcademicYear, setEditingAcademicYear] = useState(false);

  const [toasts, setToasts] = useState([]);

  const addToast = useCallback((title, message, type = "warning") => {
    const id = Date.now() + Math.random();
    setToasts((prev) => [...prev, { id, title, message, type }]);
    setTimeout(() => setToasts((prev) => prev.filter((t) => t.id !== id)), 6000);
  }, []);

  const dismissToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  /* ── API ── */
  const fetchEnrollments = async () => {
    setLoading(true);
    try {
      const res = await fetch(`${API_BASE}/api/enrollments/`, {
        method: "GET", headers: authHeaders(true), credentials: "include",
      });
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error("Failed to load enrollments.");
      const list = Array.isArray(data) ? data : [];
      setEnrollments(list);

      // Notify about expired enrollments
      const expiredList = list.filter(
        (e) => isEnrollmentExpired(e.academic_year) &&
               e.status !== "DROPPED" && e.status !== "COMPLETED"
      );
      if (expiredList.length > 0) {
        const names = expiredList.slice(0, 3).map((e) => `${e.first_name} ${e.last_name}`).join(", ");
        const more  = expiredList.length > 3 ? ` and ${expiredList.length - 3} more` : "";
        addToast(
          `${expiredList.length} Expired Enrollment${expiredList.length > 1 ? "s" : ""}`,
          `${names}${more} — academic year has ended. Editing is blocked.`,
          "warning"
        );
      }
    } catch (e) {
      console.error(e);
      alert("Failed to load enrollments. Check admin login/token + backend permissions.");
      setEnrollments([]);
    } finally { setLoading(false); }
  };

  useEffect(() => { fetchEnrollments(); }, []); // eslint-disable-line

  const callAction = async (id, actionName) => {
    const res = await fetch(`${API_BASE}/api/enrollments/${id}/${actionName}/`, {
      method: "POST", headers: authHeaders(true), credentials: "include",
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
        method: "DELETE", headers: authHeaders(false), credentials: "include",
      });
      if (!res.ok) throw new Error("Delete failed.");
      await fetchEnrollments();
      if (editingId === id) closeModal();
    } catch (e) {
      console.error(e);
      alert("Delete failed. Check permissions/token.");
    }
  };

  /* ── Normalize ── */
  const normalized = useMemo(() => enrollments.map((e) => {
    const statusCode = String(e.status || "PENDING").toUpperCase();
    const expired    = isEnrollmentExpired(e.academic_year) &&
                       statusCode !== "DROPPED" && statusCode !== "COMPLETED";
    return {
      id: e.id, raw: e,
      studentName: `${e.first_name || ""} ${e.last_name || ""}`.trim(),
      gradeLevel: gradeLabel(e.grade_level),
      enrollmentDate: e.enrolled_at || e.created_at || null,
      statusCode, statusText: statusLabel(statusCode),
      expired, academicYear: e.academic_year || "",
      fee: e.payment_mode || "Pending",
      parentName:
        e?.parent_info?.guardian_name ||
        e?.parent_info?.mother_name   ||
        e?.parent_info?.father_name   || "(not set)",
      phone:
        e?.parent_info?.guardian_contact ||
        e?.parent_info?.mother_contact   ||
        e?.parent_info?.father_contact   ||
        e?.mobile_number || e?.telephone_number || "(not set)",
    };
  }), [enrollments]);

  const filteredEnrollments = useMemo(() => {
    const s = searchTerm.toLowerCase().trim();
    return normalized.filter((row) => {
      const matchesSearch = !s ||
        row.studentName.toLowerCase().includes(s) ||
        row.parentName.toLowerCase().includes(s)  ||
        String(row.phone).includes(searchTerm);
      const matchesStatus =
        filterStatus === "All"     ? true :
        filterStatus === "Expired" ? row.expired :
        row.statusText === filterStatus;
      return matchesSearch && matchesStatus;
    });
  }, [normalized, searchTerm, filterStatus]);

  const stats = useMemo(() => ({
    total:   normalized.length,
    active:  normalized.filter((e) => e.statusCode === "ACTIVE"  && !e.expired).length,
    pending: normalized.filter((e) => e.statusCode === "PENDING" && !e.expired).length,
    dropped: normalized.filter((e) => e.statusCode === "DROPPED").length,
    expired: normalized.filter((e) => e.expired).length,
  }), [normalized]);

  const gradeOptions = useMemo(() => {
    if (formData.education_level === "preschool")
      return [{ value: "prek", label: "Pre-Kinder" }, { value: "kinder", label: "Kindergarten" }];
    if (formData.education_level === "elementary")
      return ["grade1","grade2","grade3","grade4","grade5","grade6"]
        .map((v) => ({ value: v, label: gradeLabel(v) }));
    return [];
  }, [formData.education_level]);

  /* ── Modal ── */
  const openModal = (row, mode = "view") => {
    const e       = row.raw;
    const expired = isEnrollmentExpired(e.academic_year) &&
                    e.status !== "DROPPED" && e.status !== "COMPLETED";

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

    const inferredEdu = e.education_level ||
      (["prek","kinder"].includes(e.grade_level)                                         ? "preschool"  :
       ["grade1","grade2","grade3","grade4","grade5","grade6"].includes(e.grade_level)   ? "elementary" : "");

    setFormData({
      ...emptyForm(),
      first_name: e.first_name || "",    last_name: e.last_name || "",
      middle_name: e.middle_name || "",  birth_date: e.birth_date || "",
      gender: e.gender || "",            lrn: e.lrn || "",
      education_level: inferredEdu,      grade_level: e.grade_level || "",
      student_type: e.student_type || "",
      academic_year: e.academic_year || getCurrentAcademicYear(),
      status: e.status || "PENDING",     payment_mode: e.payment_mode || "",
      email: e.email || "",              address: e.address || "",
      religion: e.religion || "",        telephone_number: e.telephone_number || "",
      mobile_number: e.mobile_number || "", parent_facebook: e.parent_facebook || "",
      remarks: e.remarks || "",
      parent_info: {
        father_name: e?.parent_info?.father_name || "",
        father_contact: e?.parent_info?.father_contact || "",
        father_occupation: e?.parent_info?.father_occupation || "",
        mother_name: e?.parent_info?.mother_name || "",
        mother_contact: e?.parent_info?.mother_contact || "",
        mother_occupation: e?.parent_info?.mother_occupation || "",
        guardian_name: e?.parent_info?.guardian_name || "",
        guardian_contact: e?.parent_info?.guardian_contact || "",
        guardian_relationship: e?.parent_info?.guardian_relationship || "",
      },
    });
    setModalOpen(true);
  };

  const openCreateModal = () => {
    setEditingId(null); setModalMode("edit");
    setModalStatus(null); setModalExpired(false);
    setEditingAcademicYear(false);
    setFormData(emptyForm()); setModalOpen(true);
  };

  // ── Promote: open create modal pre-filled with next grade + next AY ──
  const handlePromote = (row) => {
    const e = row.raw;
    const { next, nextEdu } = getNextGrade(e.grade_level);

    if (!next) {
      addToast(
        "Already at Highest Grade",
        `${e.first_name} ${e.last_name} has completed Grade 6. No further promotion available.`,
        "warning"
      );
      return;
    }

    const nextYear = advanceAcademicYear(e.academic_year);

    setEditingId(null);          // new record
    setModalMode("edit");
    setModalStatus(null);
    setModalExpired(false);
    setEditingAcademicYear(false);
    setFormData({
      ...emptyForm(),
      // ── Personal info carried over ──
      first_name:        e.first_name        || "",
      last_name:         e.last_name         || "",
      middle_name:       e.middle_name       || "",
      birth_date:        e.birth_date        || "",
      gender:            e.gender            || "",
      lrn:               e.lrn               || "",
      email:             e.email             || "",
      address:           e.address           || "",
      religion:          e.religion          || "",
      telephone_number:  e.telephone_number  || "",
      mobile_number:     e.mobile_number     || "",
      parent_facebook:   e.parent_facebook   || "",
      // ── Auto-advanced academic info ──
      education_level: nextEdu,
      grade_level:     next,
      academic_year:   nextYear,
      student_type:    "old",        // returning student
      status:          "PENDING",    // starts as pending
      payment_mode:    "",           // admin picks fresh
      remarks:         "",
      // ── Parent info carried over ──
      parent_info: {
        father_name:            e?.parent_info?.father_name            || "",
        father_contact:         e?.parent_info?.father_contact         || "",
        father_occupation:      e?.parent_info?.father_occupation      || "",
        mother_name:            e?.parent_info?.mother_name            || "",
        mother_contact:         e?.parent_info?.mother_contact         || "",
        mother_occupation:      e?.parent_info?.mother_occupation      || "",
        guardian_name:          e?.parent_info?.guardian_name          || "",
        guardian_contact:       e?.parent_info?.guardian_contact       || "",
        guardian_relationship:  e?.parent_info?.guardian_relationship  || "",
      },
    });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false); setModalMode("view");
    setEditingId(null); setModalStatus(null);
    setModalExpired(false); setEditingAcademicYear(false);
  };

  const isReadOnly = (modalMode === "view" && editingId !== null) || modalExpired;

  const handleInputChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => name === "education_level"
      ? { ...p, education_level: value, grade_level: "" }
      : { ...p, [name]: value });
  };

  const handleParentChange = (e) => {
    const { name, value } = e.target;
    setFormData((p) => ({ ...p, parent_info: { ...p.parent_info, [name]: value } }));
  };

  const validateCreate = () => {
    const missing = [];
    if (!formData.first_name?.trim())  missing.push("First Name");
    if (!formData.last_name?.trim())   missing.push("Last Name");
    if (!formData.grade_level)         missing.push("Grade Level");
    if (!formData.education_level)     missing.push("Education Level");
    if (!formData.student_type)        missing.push("Student Type");
    if (!formData.payment_mode)        missing.push("Payment Mode");
    if (!formData.academic_year)       missing.push("Academic Year");
    if (missing.length) { alert("Please fill required:\n- " + missing.join("\n- ")); return false; }
    return true;
  };

  const handleApproveModal = async () => {
    if (!editingId) return;
    try {
      const updated = await handleApprove(editingId);
      setModalStatus("ACTIVE");
      setFormData((p) => ({ ...p, status: "ACTIVE", remarks: updated?.remarks ?? p.remarks }));
      setModalMode("view");
    } catch (e) { console.error(e); alert("Approve failed."); }
  };

  const handleDeclineModal = async () => {
    if (!editingId) return;
    try {
      const updated = await handleDecline(editingId);
      setModalStatus("DROPPED");
      setFormData((p) => ({ ...p, status: "DROPPED", remarks: updated?.remarks ?? p.remarks }));
      setModalMode("view");
    } catch (e) { console.error(e); alert("Decline failed."); }
  };

  const handleSaveAcademicYear = async () => {
    if (!editingId) return;
    const newYear = formData.academic_year?.trim();
    if (!newYear || !/^\d{4}-\d{4}$/.test(newYear)) {
      alert("Invalid format. Use YYYY-YYYY (e.g. 2025-2026).");
      return;
    }
    try {
      // Send full payload — backend requires all fields even on PATCH
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
        academic_year: newYear,           // ← the updated value
        status: formData.status,
        payment_mode: formData.payment_mode,
        email: formData.email,
        address: formData.address,
        religion: formData.religion,
        telephone_number: formData.telephone_number,
        mobile_number: formData.mobile_number,
        parent_facebook: formData.parent_facebook,
        remarks: formData.remarks,
        parent_info: formData.parent_info,
      };

      const res = await fetch(`${API_BASE}/api/enrollments/${editingId}/`, {
        method: "PATCH",
        headers: authHeaders(true),
        credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { alert("Save error: " + JSON.stringify(data)); return; }

      await fetchEnrollments();
      const nowExpired = isEnrollmentExpired(newYear);
      setModalExpired(nowExpired);
      setEditingAcademicYear(false);
      if (!nowExpired) {
        addToast("Academic Year Updated", `Enrollment is now active for ${newYear}.`, "success");
      }
    } catch (e) {
      console.error(e);
      alert("Save failed.");
    }
  };

  const handleSaveEnrollment = async () => {
    if (!editingId && !validateCreate()) return;

    const bdCheck = validateBirthDate(formData.birth_date);
    if (bdCheck !== true) { alert(bdCheck); return; }

    // Age vs grade validation
    const ageCheck = validateAgeForGrade(formData.birth_date, formData.grade_level);
    if (ageCheck !== true) { alert(ageCheck); return; }

    // Expired academic year warning
    if (isEnrollmentExpired(formData.academic_year)) {
      const ok = window.confirm(
        `Warning: The academic year "${formData.academic_year}" has already ended (expired on ${formatExpiryDate(formData.academic_year)}).\n\nDo you still want to save?`
      );
      if (!ok) return;
    }

    let normalizedMobile = null;
    if (formData.mobile_number?.trim()) {
      normalizedMobile = normalizePHMobile(formData.mobile_number);
      if (!normalizedMobile) { alert("Invalid PH mobile number.\nUse 09XXXXXXXXX or +639XXXXXXXXX format."); return; }
    }

    const payload = {
      first_name: formData.first_name,  last_name: formData.last_name,
      middle_name: formData.middle_name, birth_date: formData.birth_date || null,
      gender: formData.gender,           lrn: formData.lrn,
      education_level: formData.education_level, grade_level: formData.grade_level,
      student_type: formData.student_type, academic_year: formData.academic_year,
      status: formData.status,           payment_mode: formData.payment_mode,
      email: formData.email,             address: formData.address,
      religion: formData.religion,       telephone_number: formData.telephone_number,
      mobile_number: normalizedMobile ?? formData.mobile_number,
      parent_facebook: formData.parent_facebook, remarks: formData.remarks,
      parent_info: formData.parent_info,
    };

    const url    = editingId ? `${API_BASE}/api/enrollments/${editingId}/` : `${API_BASE}/api/enrollments/`;
    const method = editingId ? "PATCH" : "POST";

    try {
      const res = await fetch(url, {
        method, headers: authHeaders(true), credentials: "include",
        body: JSON.stringify(payload),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) { console.error("Save error:", data); alert("Save error: " + JSON.stringify(data)); return; }
      await fetchEnrollments();
      if (!editingId) closeModal();
      else { setModalMode("view"); setModalStatus(data?.status ?? formData.status); }
    } catch (e) { console.error(e); alert("Save failed."); }
  };

  /* ─────────────────────────────────────────────
     RENDER
  ───────────────────────────────────────────── */
  return (
    <div className="enrollment-management">

      <Toast toasts={toasts} onDismiss={dismissToast} />

      {/* Header */}
      <div className="enrollment-header">
        <h1>Enrollment Management</h1>
        <div className="header-actions">
          <button className="btn-primary" onClick={openCreateModal}>+ Add Enrollee</button>
          <button className="btn-secondary" onClick={fetchEnrollments}>
            <RefreshCw size={14} /> Refresh
          </button>
        </div>
      </div>

      {/* Stats — includes Expired */}
      <div className="stats-grid">
        <div className="stat-card"><h3>Total</h3><p className="stat-number">{stats.total}</p></div>
        <div className="stat-card"><h3>Active</h3><p className="stat-number active">{stats.active}</p></div>
        <div className="stat-card"><h3>Pending</h3><p className="stat-number pending">{stats.pending}</p></div>
        <div className="stat-card"><h3>Dropped</h3><p className="stat-number overdue">{stats.dropped}</p></div>
        <div className="stat-card"><h3>Expired</h3><p className="stat-number expired">{stats.expired}</p></div>
      </div>

      {/* Controls */}
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

      {/* Table */}
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
              {filteredEnrollments.map((row) => (
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
                        <button className="btn-approve" onClick={() => handleApprove(row.id)}>
                          <CheckCircle size={12} /> Approve
                        </button>
                        <button className="btn-decline" onClick={() => handleDecline(row.id)}>
                          <XCircle size={12} /> Decline
                        </button>
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
                      <button className="btn-edit" title="View" onClick={() => openModal(row, "view")}>
                        <Eye size={14} />
                      </button>
                      <button
                        className="btn-edit"
                        title={row.expired ? "Editing blocked — enrollment expired" : "Edit"}
                        onClick={() => openModal(row, "edit")}
                        style={row.expired ? { opacity: 0.35, cursor: "not-allowed" } : {}}
                      >
                        <Edit2 size={14} />
                      </button>
                      {/* Promote button — only for ACTIVE or COMPLETED */}
                      {(row.statusCode === "ACTIVE" || row.statusCode === "COMPLETED") &&
                       getNextGrade(row.raw.grade_level).next && (
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
      </div>

      {/* Modal */}
      {modalOpen && (
        <div className="modal-overlay">
          <div className="modal-content">

            {/* Expired banner */}
            {modalExpired && (
              <div style={{
                background: "#fdf4ff", border: "1.5px solid #d8b4fe",
                borderRadius: 10, padding: "14px 16px", marginBottom: 18,
              }}>
                <div style={{ display: "flex", alignItems: "flex-start", gap: 10 }}>
                  <AlertTriangle size={17} style={{ color: "#9333ea", flexShrink: 0, marginTop: 1 }} />
                  <div style={{ flex: 1 }}>
                    <div style={{ fontSize: 13, color: "#6b21a8", lineHeight: 1.5 }}>
                      <strong>Enrollment Expired</strong><br />
                      This enrollment ended on <strong>{formatExpiryDate(formData.academic_year)}</strong>.
                      Editing is disabled — you can update the academic year to re-activate it.
                    </div>

                    {/* ── Inline Academic Year Edit ── */}
                    {editingAcademicYear ? (
                      <div style={{ marginTop: 12, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
                        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
                          <input
                            name="academic_year"
                            value={formData.academic_year}
                            onChange={handleInputChange}
                            placeholder="e.g. 2025-2026"
                            style={{
                              padding: "8px 12px", borderRadius: 8, fontSize: 13,
                              border: "1.5px solid #a855f7", outline: "none",
                              fontFamily: "inherit", width: 140,
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
                        <button className="btn-primary" onClick={handleSaveAcademicYear}>
                          <CheckCircle size={13} /> Save
                        </button>
                        <button className="btn-secondary" onClick={() => setEditingAcademicYear(false)}>
                          Cancel
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={() => setEditingAcademicYear(true)}
                        style={{
                          marginTop: 10, display: "inline-flex", alignItems: "center", gap: 6,
                          padding: "7px 14px", borderRadius: 8, border: "1.5px solid #a855f7",
                          background: "white", color: "#7e22ce", fontSize: 12, fontWeight: 600,
                          cursor: "pointer", fontFamily: "inherit",
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
                    ? <button className="btn-primary"   onClick={() => setModalMode("edit")}>Edit</button>
                    : <button className="btn-secondary" onClick={() => setModalMode("view")}>View</button>
                )}
                {editingId && !modalExpired && modalStatus === "PENDING" && (
                  <>
                    <button className="btn-approve" onClick={handleApproveModal}><CheckCircle size={13} /> Approve</button>
                    <button className="btn-decline" onClick={handleDeclineModal}><XCircle size={13} /> Decline</button>
                  </>
                )}
                {editingId && modalStatus === "ACTIVE"    && !modalExpired && <span style={{ color: "#059669", fontWeight: 700, fontSize: 13 }}>✔ Approved</span>}
                {editingId && modalStatus === "DROPPED"   && <span style={{ color: "#dc2626", fontWeight: 700, fontSize: 13 }}>✖ Declined</span>}
                {editingId && modalStatus === "COMPLETED" && <span style={{ color: "#1d4ed8", fontWeight: 700, fontSize: 13 }}>✔ Completed</span>}
                {modalExpired && <span style={badgeStyle(STATUS_STYLES, "EXPIRED")}><AlertTriangle size={11} /> Expired</span>}
                {/* Promote button in modal — for ACTIVE or COMPLETED */}
                {editingId && (modalStatus === "ACTIVE" || modalStatus === "COMPLETED") && !modalExpired &&
                  getNextGrade(formData.grade_level).next && (
                  <button
                    className="btn-promote"
                    onClick={() => {
                      // find the row and promote
                      const match = normalized.find((r) => r.id === editingId);
                      if (match) { closeModal(); handlePromote(match); }
                    }}
                  >
                    <ArrowUpCircle size={13} />
                    Promote to {gradeLabel(getNextGrade(formData.grade_level).next)}
                  </button>
                )}
              </div>
            </div>

            {/* Promote info banner — shown when creating a promoted enrollment */}
            {!editingId && formData.student_type === "old" && formData.grade_level && (
              <div style={{
                background: "#f0fdf4", border: "1.5px solid #86efac",
                borderRadius: 10, padding: "12px 16px", marginBottom: 18,
                display: "flex", alignItems: "flex-start", gap: 10,
              }}>
                <ArrowUpCircle size={17} style={{ color: "#16a34a", flexShrink: 0, marginTop: 1 }} />
                <div style={{ fontSize: 13, color: "#166534", lineHeight: 1.6 }}>
                  <strong>Promotion Enrollment</strong><br />
                  Creating a new enrollment for <strong>{formData.first_name} {formData.last_name}</strong> —
                  promoted to <strong>{gradeLabel(formData.grade_level)}</strong> for AY <strong>{formData.academic_year}</strong>.
                  Personal and parent info has been carried over. Please set the <strong>Payment Mode</strong> before saving.
                </div>
              </div>
            )}

            <h3>Student Info</h3>
            <div className="form-row">
              <div className="form-group"><label>First Name *</label><input name="first_name" value={formData.first_name} onChange={handleInputChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Last Name *</label><input name="last_name" value={formData.last_name} onChange={handleInputChange} disabled={isReadOnly} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Middle Name</label><input name="middle_name" value={formData.middle_name} onChange={handleInputChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Birth Date</label><input type="date" name="birth_date" value={formData.birth_date || ""} onChange={handleInputChange} disabled={isReadOnly} max={todayISO()} /></div>
            </div>

            {/* Live age/grade compatibility hint */}
            {formData.birth_date && formData.grade_level && !isReadOnly && (() => {
              const check = validateAgeForGrade(formData.birth_date, formData.grade_level);
              const age   = calcAge(formData.birth_date);
              const rule  = GRADE_AGE_RULES[formData.grade_level];
              return (
                <div style={{
                  padding: "9px 13px", borderRadius: 8, marginBottom: 12, fontSize: 12,
                  background: check === true ? "#f0fdf4" : "#fff7ed",
                  border: `1.5px solid ${check === true ? "#86efac" : "#fed7aa"}`,
                  color: check === true ? "#166534" : "#92400e",
                  display: "flex", alignItems: "center", gap: 7,
                }}>
                  {check === true
                    ? <><CheckCircle size={13} /> Age {age} is valid for {rule?.label} (allowed: {rule?.min}–{rule?.max} yrs)</>
                    : <><AlertTriangle size={13} /> {check}</>}
                </div>
              );
            })()}

            <div className="form-row">
              <div className="form-group">
                <label>Gender</label>
                <select name="gender" value={formData.gender} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option value="male">Male</option>
                  <option value="female">Female</option>
                </select>
              </div>
              <div className="form-group"><label>LRN</label><input name="lrn" value={formData.lrn} onChange={handleInputChange} disabled={isReadOnly} /></div>
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Academic Year *</label>
                <input name="academic_year" value={formData.academic_year} onChange={handleInputChange} disabled={isReadOnly} />
                {formData.academic_year && (
                  <span style={{
                    fontSize: 11, marginTop: 4,
                    color: isEnrollmentExpired(formData.academic_year) ? "#9333ea" : "#059669",
                  }}>
                    {isEnrollmentExpired(formData.academic_year)
                      ? `Expired on ${formatExpiryDate(formData.academic_year)}`
                      : `Expires ${formatExpiryDate(formData.academic_year)}`}
                  </span>
                )}
              </div>
            </div>

            <h3>Academic</h3>
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
                <label>Grade Level *</label>
                <select name="grade_level" value={formData.grade_level} onChange={handleInputChange} disabled={isReadOnly || !formData.education_level}>
                  <option value="">Select</option>
                  {gradeOptions.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label} (age {GRADE_AGE_RULES[g.value]?.min}–{GRADE_AGE_RULES[g.value]?.max})
                    </option>
                  ))}
                </select>
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
            <div className="form-row">
              <div className="form-group">
                <label>Payment Mode *</label>
                <select name="payment_mode" value={formData.payment_mode} onChange={handleInputChange} disabled={isReadOnly}>
                  <option value="">Select</option>
                  <option value="cash">Cash</option>
                  <option value="installment">Installment</option>
                </select>
              </div>
              <div className="form-group"><label>Remarks</label><input name="remarks" value={formData.remarks} onChange={handleInputChange} disabled={isReadOnly} /></div>
            </div>

            <h3>Contact</h3>
            <div className="form-row">
              <div className="form-group"><label>Email</label><input name="email" value={formData.email} onChange={handleInputChange} disabled={isReadOnly} /></div>
              <div className="form-group">
                <label>Mobile</label>
                <input name="mobile_number" value={formData.mobile_number} onChange={handleInputChange}
                  onBlur={() => { const n = normalizePHMobile(formData.mobile_number); if (n) setFormData((p) => ({ ...p, mobile_number: n })); }}
                  disabled={isReadOnly} placeholder="09XXXXXXXXX" />
              </div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Telephone</label><input name="telephone_number" value={formData.telephone_number} onChange={handleInputChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Religion</label><input name="religion" value={formData.religion} onChange={handleInputChange} disabled={isReadOnly} /></div>
            </div>
            <div className="form-group"><label>Address</label><input name="address" value={formData.address} onChange={handleInputChange} disabled={isReadOnly} /></div>
            <div className="form-group"><label>Parent Facebook</label><input name="parent_facebook" value={formData.parent_facebook} onChange={handleInputChange} disabled={isReadOnly} /></div>

            <h3>Parent / Guardian</h3>
            <div className="form-row">
              <div className="form-group"><label>Guardian Name</label><input name="guardian_name" value={formData.parent_info.guardian_name} onChange={handleParentChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Guardian Contact</label><input name="guardian_contact" value={formData.parent_info.guardian_contact} onChange={handleParentChange} disabled={isReadOnly} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Guardian Relationship</label><input name="guardian_relationship" value={formData.parent_info.guardian_relationship} onChange={handleParentChange} disabled={isReadOnly} /></div>
              <div className="form-group" />
            </div>
            <div className="form-row">
              <div className="form-group"><label>Mother Name</label><input name="mother_name" value={formData.parent_info.mother_name} onChange={handleParentChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Mother Contact</label><input name="mother_contact" value={formData.parent_info.mother_contact} onChange={handleParentChange} disabled={isReadOnly} /></div>
            </div>
            <div className="form-row">
              <div className="form-group"><label>Father Name</label><input name="father_name" value={formData.parent_info.father_name} onChange={handleParentChange} disabled={isReadOnly} /></div>
              <div className="form-group"><label>Father Contact</label><input name="father_contact" value={formData.parent_info.father_contact} onChange={handleParentChange} disabled={isReadOnly} /></div>
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