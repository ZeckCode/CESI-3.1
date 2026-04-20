import React, { useEffect, useMemo, useState, useCallback } from "react";
import {
  Edit2,
  Trash2,
  Search,
  Filter,
  CheckCircle,
  Clock,
  XCircle,
  RefreshCw,
  AlertTriangle,
  ArrowUpCircle,
  FileText,
  Settings,
  Calendar,
  UserCheck,
  UserMinus,
  UserX,
  Users,
  Eye,
} from "lucide-react";

import StatCard, { StatsGrid } from "./StatCard";
import Pagination from "./Pagination";
import Toast from "../Global/Toast";
import "../AdminWebsiteCSS/EnrollmentManagement.css";
import { apiFetch } from "../api/apiFetch";

import {
  FILTER_OPTIONS,
  PROMOTION_FILTER_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
} from "./Enrollment/enrollmentConstants";

import {
  gradeLabel,
  statusLabel,
  GRADE_AGE_RULES,
  getNextGrade,
  advanceAcademicYear,
  validateAgeForGrade,
  fmtDate,
  computeEnrollmentWindow,
  splitFullName,
  buildName,
  splitAddress,
  buildAddress,
  emptyForm,
  getCurrentAcademicYear,
  todayISO,
  calcAge,
  validateBirthDate,
  normalizePHMobile,
  normalizeSectionGrade,
} from "./Enrollment/enrollmentUtils";

import { StatusBadge } from "./Enrollment/EnrollmentBadges";
import { StudentCell, ParentCell } from "./Enrollment/EnrollmentCells";
import DeclineDialog from "./Enrollment/DeclineDialog";
import IdUploadModal from "./Enrollment/IdUploadModal";
import TableActionMenu from "./TableActionMenu";
import EnrollmentDetailsModal from "./Enrollment/EnrollmentDetailsModal";
import IdCardGenerator from "./IdGenerator/IdCardGenerator";
import PreviewModal from "../PreviewModal";
import { DEFAULT_SCHOOL_INFO, prepareIdData } from "./IdGenerator/idGeneratorUtils";

// Helper function for responsive icon sizes
const getResponsiveIconSize = () => {
  if (typeof window === 'undefined') return 12;
  const width = window.innerWidth;
  if (width <= 480) return 9;
  if (width <= 768) return 10;
  return 12;
};

const RELIGION_OPTIONS = [
  "Roman Catholic",
  "Christian",
  "Iglesia ni Cristo",
  "Muslim",
  "Born Again",
  "Seventh-day Adventist",
  "Jehovah's Witness",
  "Buddhist",
  "Hindu",
  "None",
];

const isKnownReligion = (value) => RELIGION_OPTIONS.includes(String(value || "").trim());

const mapReligionToForm = (religion) => {
  const cleaned = String(religion || "").trim();
  if (!cleaned) return { religion: "", custom_religion: "" };
  if (isKnownReligion(cleaned)) return { religion: cleaned, custom_religion: "" };
  return { religion: "others_specify", custom_religion: cleaned };
};

const resolveReligionForPayload = (formData) => {
  if (formData.religion === "others_specify") {
    return String(formData.custom_religion || "").trim();
  }
  return String(formData.religion || "").trim();
};

export default function EnrollmentManagement() {
  const normalizeLookupKey = useCallback((value) => String(value || "").trim().toLowerCase(), []);

  const [enrollments, setEnrollments] = useState([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterStatus, setFilterStatus] = useState("All");
  const [filterPromotionStatus, setFilterPromotionStatus] = useState("All");
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [enrollPage, setEnrollPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const ENROLLMENT_SKELETON_ROWS = 6;
  const ENROLLMENT_SKELETON_COLUMNS = 7;

  const [sections, setSections] = useState([]);
  const [sectionsLoading, setSectionsLoading] = useState(false);

  const [modalOpen, setModalOpen] = useState(false);
  const [modalMode, setModalMode] = useState("view");
  const [editingId, setEditingId] = useState(null);
  const [formData, setFormData] = useState(emptyForm());
  const [modalStatus, setModalStatus] = useState(null);
  const [editingAcademicYear, setEditingAcademicYear] = useState(false);
  const [isPromoteFlow, setIsPromoteFlow] = useState(false);
  const [promoteSourceParentUserId, setPromoteSourceParentUserId] = useState(null);

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
  const [enrollmentPreviewOpen, setEnrollmentPreviewOpen] = useState(false);
  const [enrollmentPreviewData, setEnrollmentPreviewData] = useState([]);

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

  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  // Payment Proof States
  const [proofs, setProofs] = useState([]);
  const [_loadingProofs, setLoadingProofs] = useState(false);
  const [gradeProgressMap, setGradeProgressMap] = useState(new Map());
  const [balanceMap, setBalanceMap] = useState(new Map());
  const [paymentProofModalOpen, setPaymentProofModalOpen] = useState(false);
  const [selectedProofId, _setSelectedProofId] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [_isApprovingProof, setIsApprovingProof] = useState(false);
  const [_isRejectingProof, setIsRejectingProof] = useState(false);
  const [imageViewerOpen, setImageViewerOpen] = useState(false);
  const [selectedImageUrl, setSelectedImageUrl] = useState(null);


  const [approveDialogOpen, setApproveDialogOpen] = useState(false);
  const [approveTargetRow, setApproveTargetRow] = useState(null);
  const [preApproveConfirmOpen, setPreApproveConfirmOpen] = useState(false);
  const [preApproveTargetRow, setPreApproveTargetRow] = useState(null);
  const [preApproveChecked, setPreApproveChecked] = useState(false);
  const [approveAmount, setApproveAmount] = useState("");
  const [approveMinimumAmount, setApproveMinimumAmount] = useState(0);
  const [approveCashFullAmount, setApproveCashFullAmount] = useState(0);
  const [approveRemarks, setApproveRemarks] = useState("");
  const [approveSubmitting, setApproveSubmitting] = useState(false);
  const [approvePaymentMethod, setApprovePaymentMethod] = useState("CASH");

  // ID Generator States
  const [idGeneratorOpen, setIdGeneratorOpen] = useState(false);
  const [selectedStudentForId, setSelectedStudentForId] = useState(null);
  const [schoolInfo, _setSchoolInfo] = useState(DEFAULT_SCHOOL_INFO);

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

  const formatApiErrorMessage = useCallback((payload, fallback = "Request failed.") => {
    if (!payload) return fallback;

    if (typeof payload === "string") {
      const cleaned = payload.trim();
      return cleaned || fallback;
    }

    if (Array.isArray(payload)) {
      const first = payload.find((item) => item !== null && item !== undefined);
      if (first === undefined) return fallback;
      return formatApiErrorMessage(first, fallback);
    }

    if (typeof payload !== "object") {
      return String(payload);
    }

    if (payload.detail) {
      return String(payload.detail);
    }

    if (payload.non_field_errors) {
      return formatApiErrorMessage(payload.non_field_errors, fallback);
    }

    const firstEntry = Object.entries(payload).find(([, value]) => value !== null && value !== undefined);
    if (!firstEntry) return fallback;

    const [rawKey, rawValue] = firstEntry;
    const message = formatApiErrorMessage(rawValue, fallback);
    const key = String(rawKey || "").replace(/_/g, " ").trim();

    if (!key || key === "detail" || key === "non field errors") {
      return message;
    }

    return `${key}: ${message}`;
  }, []);

  const window_ = useMemo(() => computeEnrollmentWindow(settings), [settings]);

    const fetchEnrollments = useCallback(async () => {
      setLoading(true);
      try {
        const res = await apiFetch("/api/enrollments/");
        const data = await res.json().catch(() => []);
        if (!res.ok) throw new Error();
        setEnrollments(Array.isArray(data) ? data : []);
      } catch {
        addToast("Load Failed", "Failed to load enrollments.", "error");
        setEnrollments([]);
      } finally {
        setLoading(false);
      }
    }, [addToast]);

  const fetchSettings = useCallback(async () => {
    setSettingsLoading(true);
    try {
      const res = await apiFetch("/api/enrollment-settings/");
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
      const res = await apiFetch("/api/accounts/sections/");
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();

      setSections(Array.isArray(data) ? data : []);
    } catch {
      setSections([]);
    } finally {
      setSectionsLoading(false);
    }
  }, []);

  const fetchProofs = useCallback(async () => {
    setLoadingProofs(true);
    try {
      const res = await apiFetch("/api/finance/proof-of-payments/");
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();

      setProofs(Array.isArray(data) ? data : []);
    } catch {
      addToast("Load Failed", "Failed to load payment proofs.", "error");
      setProofs([]);
    } finally {
      setLoadingProofs(false);
    }
  }, [addToast]);

  const fetchGradeProgress = useCallback(async () => {
    try {
      const res = await apiFetch("/api/grades/admin-grade-records-monitoring/?quarter=4");
      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error();

      const students = Array.isArray(data?.students) ? data.students : [];
      const nextMap = new Map();
      students.forEach((student) => {
        const payload = {
          status: String(student?.status || "").toLowerCase(),
          gradedSubjects: Number(student?.graded_subjects || 0),
          totalSubjects: Number(student?.total_subjects || 0),
        };

        const idKey = normalizeLookupKey(student?.student_id);
        if (idKey) nextMap.set(idKey, payload);

        const numberKey = normalizeLookupKey(student?.student_number);
        if (numberKey) nextMap.set(numberKey, payload);

        const usernameKey = normalizeLookupKey(student?.student_username);
        if (usernameKey) nextMap.set(usernameKey, payload);
      });

      setGradeProgressMap(nextMap);
    } catch {
      setGradeProgressMap(new Map());
    }
  }, [normalizeLookupKey]);

  const fetchBalances = useCallback(async () => {
    try {
      const res = await apiFetch("/api/finance/student-tuition-overview/");
      const data = await res.json().catch(() => []);
      if (!res.ok) throw new Error();

      const rows = Array.isArray(data) ? data : [];
      const nextMap = new Map();

      rows.forEach((row) => {
        const remaining = Number(row?.remaining_balance || 0);
        const studentNumberKey = normalizeLookupKey(row?.student_number);
        if (studentNumberKey) nextMap.set(studentNumberKey, remaining);

        const usernameKey = normalizeLookupKey(row?.username);
        if (usernameKey) nextMap.set(usernameKey, remaining);
      });

      setBalanceMap(nextMap);
    } catch {
      setBalanceMap(new Map());
    }
  }, [normalizeLookupKey]);

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
    fetchSections();
    fetchProofs();
    fetchGradeProgress();
    fetchBalances();

  }, [fetchSettings, fetchSections, fetchProofs, fetchEnrollments, fetchGradeProgress, fetchBalances]);

  const callAction = async (id, actionName, payload = null) => {
    const res = await apiFetch(`/api/enrollments/${id}/${actionName}/`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: payload ? JSON.stringify(payload) : undefined,
    });

    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.detail || "Action failed.");

    await fetchEnrollments();
    return data;
  };

  const refreshEnrollmentById = async (id) => {
    const res = await apiFetch(`/api/enrollments/${id}/`);
    const data = await res.json().catch(() => null);

    if (!res.ok || !data) throw new Error("Failed to refresh enrollment.");

    setEnrollments((prev) => prev.map((item) => (item.id === id ? data : item)));
  };

  const _handleApproveProof = async () => {
    if (!selectedProofId) return;
    
    setIsApprovingProof(true);
    try {
      const res = await apiFetch(
        `/api/finance/proof-of-payments/${selectedProofId}/approve/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: approvalRemarks }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Approval Failed", data.detail || "Failed to approve proof.", "error");
        return;
      }

      addToast("Approved", "Payment proof has been approved.", "success");
      setPaymentProofModalOpen(false);
      setApprovalRemarks("");
      await fetchProofs();
      await fetchEnrollments();
    } catch (error) {
      addToast("Error", error.message || "Failed to approve proof.", "error");
    } finally {
      setIsApprovingProof(false);
    }
  };

  const _handleRejectProof = async () => {
    if (!selectedProofId) return;
    
    setIsRejectingProof(true);
    try {
      const res = await apiFetch(
        `/api/finance/proof-of-payments/${selectedProofId}/reject/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ remarks: approvalRemarks }),
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Rejection Failed", data.detail || "Failed to reject proof.", "error");
        return;
      }

      addToast("Rejected", "Payment proof has been rejected.", "success");
      setPaymentProofModalOpen(false);
      setApprovalRemarks("");
      await fetchProofs();
      await fetchEnrollments();
    } catch (error) {
      addToast("Error", error.message || "Failed to reject proof.", "error");
    } finally {
      setIsRejectingProof(false);
    }
  };

  const getPromotionReadiness = useCallback((row) => {
    const e = row?.raw || {};
    const normalizedGradeLevel = normalizeSectionGrade(e.grade_level);
    const { next } = getNextGrade(normalizedGradeLevel);
    const sectionIdCandidate =
      e?.section?.id ??
      e?.section_id ??
      e?.section_details?.id ??
      e?.section;
    const parsedSectionId = Number(sectionIdCandidate);
    const hasSectionId = Number.isFinite(parsedSectionId) && parsedSectionId > 0;
    const hasSectionName = [
      e?.section_name,
      e?.section_details?.name,
      e?.section?.name,
      row?.sectionName,
    ].some((name) => {
      const cleaned = String(name || "").trim();
      return cleaned && cleaned !== "—" && cleaned.toLowerCase() !== "no section";
    });
    const hasSection = hasSectionId || hasSectionName;
    const totalSubjects = Number(row?.gradeProgress?.totalSubjects || 0);
    const gradedSubjects = Number(row?.gradeProgress?.gradedSubjects || 0);
    const gradeStatus = String(row?.gradeProgress?.status || "").toLowerCase();
    const hasGradeProgressData =
      totalSubjects > 0 || gradedSubjects > 0 || ["completed", "partial", "pending"].includes(gradeStatus);
    const hasParentUser = Boolean(e?.parent_user);
    const hasPortalPassword = e?.parent_user_has_password === true;

    // Guard unknown grade values so they do not get misclassified as "completed"
    if (!normalizedGradeLevel) {
      return {
        ready: false,
        reason: `Unrecognized grade level: ${e.grade_level || "(empty)"}`,
        status: "ineligible",
        icon: "clock",
      };
    }

    // Check if already at highest grade
    if (!next) {
      if (normalizedGradeLevel !== "grade6") {
        return {
          ready: false,
          reason: `Cannot determine next grade from value: ${e.grade_level}`,
          status: "ineligible",
          icon: "clock",
        };
      }

      return {
        ready: false,
        reason: "Student is already at the highest grade level (Grade 6) and cannot be promoted further",
        status: "completed",
        icon: "check",
      };
    }

    // Promotion is determined by actual completion checks below, not student_type.


    if (!hasSection && !hasGradeProgressData) {
      return {
        ready: false,
        reason: "Student is missing section assignment and grade/subject records. Assign a section and encode at least one subject grade before promotion.",
        status: "ineligible",
        icon: "clock",
      };
    }

    if (hasGradeProgressData && totalSubjects <= 0 && gradedSubjects <= 0) {
      return {
        ready: false,
        reason: "No subjects found for this student. Please ensure subjects are assigned in grade monitoring before promotion.",
        status: "ineligible",
        icon: "clock",
      };
    }

    if (hasGradeProgressData && gradedSubjects <= 0) {
      return {
        ready: false,
        reason: "No subject grades are encoded yet. Please enter and complete all subject grades before promotion.",
        status: "ineligible",
        icon: "clock",
      };
    }

    if (!hasParentUser || !hasPortalPassword) {
      return {
        ready: false,
        reason: "Portal password is not set yet for this account",
        status: "ineligible",
        icon: "clock",
      };
    }

    // Check if enrollment is active (payment approved by admin)
    if (row.statusCode !== "ACTIVE") {
      return {
        ready: false,
        reason: `Enrollment status: ${row.statusCode} - Payment must be approved before promotion`,
        status: "ineligible",
        icon: "clock",
      };
    }

    // Check if payment proof is approved (balance requirement)
    if (row.paymentProof) {
      const proofStatus = String(row.paymentProof?.status || "").toLowerCase();
      if (proofStatus !== "approved") {
        return {
          ready: false,
          reason: `Payment proof: ${row.paymentProof?.status || "pending"} - Must be approved`,
          status: "ineligible",
          icon: "clock",
        };
      }
    }

    // Check if all required grade entries are completed (Q4 monitoring source)
    if (hasGradeProgressData && totalSubjects > 0 && gradeStatus !== "completed") {
      return {
        ready: false,
        reason: `Grades are ${gradeStatus || "pending"} (${gradedSubjects}/${totalSubjects} subjects graded)`,
        status: "ineligible",
        icon: "clock",
      };
    }

    // Check if no remaining tuition balance exists
    if (typeof row.remainingBalance === "number" && row.remainingBalance > 0) {
      return {
        ready: false,
        reason: `Outstanding/partial balance: Php ${row.remainingBalance.toFixed(2)} - must be fully paid before promotion`,
        status: "ineligible",
        icon: "clock",
      };
    }

    // All checks passed - Student meets all promotion standards
    const monitorSuffix = hasGradeProgressData
      ? ""
      : " (grade monitoring data not available, proceeded with payment/status checks)";

    return {
      ready: true,
      reason: `✓ All standards met - Ready to promote to ${next}${monitorSuffix}`,
      status: "ready",
      icon: "arrow-up",
    };
  }, []);

  const normalized = useMemo(
    () =>
      enrollments.map((e) => {
        const statusCode = String(e.status || "PENDING").toUpperCase();
        const studentIdKey = normalizeLookupKey(e.student || e.student_id);
        const studentNumberKey = normalizeLookupKey(e.student_number);
        const studentUsernameKey = normalizeLookupKey(e.student_username);

        const gradeProgress =
          gradeProgressMap.get(studentIdKey) ||
          gradeProgressMap.get(studentNumberKey) ||
          gradeProgressMap.get(studentUsernameKey) ||
          null;

        const remainingBalance =
          balanceMap.get(studentNumberKey) ??
          balanceMap.get(studentUsernameKey) ??
          null;

        const tempRow = {
          id: e.id,
          raw: e,
          statusCode,
          paymentProof: proofs.find(p => p.enrollment_id === e.id) || null,
          gradeProgress,
          remainingBalance,
        };
        const promotionInfo = getPromotionReadiness(tempRow);
        
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
          academicYear: e.academic_year || "",
          paymentMode: e.payment_mode || "—",
          paymentMethod: e.payment_method || "—",
          submittedPaymentAmount:
            tempRow.paymentProof?.amount ?? e.payment_amount ?? null,
          paymentProof: tempRow.paymentProof,
          gradeProgress: tempRow.gradeProgress,
          remainingBalance: tempRow.remainingBalance,
          promotionStatus: promotionInfo.status,
          parentName:
          e?.parent_info?.mother_name ||
          e?.parent_info?.father_name ||
          e?.parent_info?.guardian_name ||
          "(not set)",
        phone:
          e?.parent_info?.mother_contact ||
          e?.parent_info?.father_contact ||
          e?.parent_info?.guardian_contact ||
          e?.mobile_number ||
          "(not set)",
                };
      }),
    [enrollments, sections, proofs, getPromotionReadiness, gradeProgressMap, balanceMap, normalizeLookupKey]
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
      const matchesStatus =
        filterStatus === "All" || row.statusText === filterStatus;
      const matchesPromotionStatus =
        filterPromotionStatus === "All" || row.promotionStatus === filterPromotionStatus;
      return matchesSearch && matchesStatus && matchesPromotionStatus;
    });
  }, [normalized, searchTerm, filterStatus, filterPromotionStatus]);

  const enrollTotalPages = Math.ceil(filteredEnrollments.length / ITEMS_PER_PAGE);

  const paginatedEnrollments = filteredEnrollments.slice(
    (enrollPage - 1) * ITEMS_PER_PAGE,
    enrollPage * ITEMS_PER_PAGE
  );

  useEffect(() => {
    setEnrollPage(1);
  }, [searchTerm, filterStatus, filterPromotionStatus]);

  const stats = useMemo(
    () => ({
      total: normalized.length,
      active: normalized.filter((e) => e.statusCode === "ACTIVE").length,
      pending: normalized.filter((e) => e.statusCode === "PENDING").length,
      dropped: normalized.filter((e) => e.statusCode === "DROPPED").length,
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
      return ["grade1", "grade2", "grade3", "grade4", "grade5", "grade6"].map(
        (v) => ({
          value: v,
          label: gradeLabel(v),
        })
      );
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

  const currentDocs = useMemo(() => {
    const row = normalized.find((r) => r.id === editingId);
    return Array.isArray(row?.raw?.documents) ? row.raw.documents : [];
  }, [normalized, editingId]);

  const currentPaymentProof = useMemo(() => {
    const row = normalized.find((r) => r.id === editingId);
    return row?.paymentProof || null;
  }, [normalized, editingId]);

  const isReadOnly = (modalMode === "view" && editingId !== null);

  const handleEnterEditMode = () => {
    setModalMode("edit");
  };

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
    // if (!e.parent_facebook?.trim()) missing.push("Parent Facebook");

    const hasStudentContact = e.email?.trim() || e.mobile_number?.trim();

    if (!hasStudentContact) {
      missing.push("At least one contact (Email or Mobile)");
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

  const openModal = (row, mode = "view") => {
    const e = row.raw;
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
    const religionFields = mapReligionToForm(e.religion);
    setEditingId(e.id);
    setIsPromoteFlow(false);
    setPromoteSourceParentUserId(null);
    setModalMode(mode);
    setModalStatus(e.status || "PENDING");
    setEditingAcademicYear(false);
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
      religion: religionFields.religion,
      custom_religion: religionFields.custom_religion,
      mobile_number: e.mobile_number || "",
      parent_facebook: e.parent_facebook || "",
      street: addr.street,
      barangay: addr.barangay,
      city: addr.city,
      province: addr.province,
      region: addr.region,
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
    setIsPromoteFlow(false);
    setPromoteSourceParentUserId(null);
    setModalMode("edit");
    setModalStatus(null);
    setEditingAcademicYear(false);
    setFormData({ ...emptyForm(), academic_year: window_.academicYear });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode("view");
    setEditingId(null);
    setIsPromoteFlow(false);
    setPromoteSourceParentUserId(null);
    setModalStatus(null);
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

  const handleInputChange = (e) => {
    const { name, value } = e.target;

    setFormData((p) =>
      name === "education_level"
        ? { ...p, education_level: value, grade_level: "", section: "" }
        : name === "grade_level"
        ? { ...p, grade_level: value, section: "" }
        : name === "religion"
        ? { ...p, religion: value, custom_religion: value === "others_specify" ? p.custom_religion : "" }
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

  const handleSaveSettings = async () => {
    setSettingsSaving(true);
    try {
      const payload = {
        open_date: draft.open_date || null,
        window_days: parseInt(draft.window_days, 10) || 7,
        academic_year: draft.academic_year.replace(/\s+/g, "") || null,
      };

      const res = await apiFetch("/api/enrollment-settings/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", formatApiErrorMessage(data, "Failed to save settings."), "error");
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
    ) {
      return;
    }

    setDraft({ open_date: "", window_days: 7, academic_year: "" });
    setSettingsSaving(true);

    try {
      const res = await apiFetch("/api/enrollment-settings/", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          open_date: null,
          window_days: 7,
          academic_year: null,
        }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Reset Failed", formatApiErrorMessage(data, "Failed to reset settings."), "error");
        return;
      }

      setSettings(data);
      addToast(
        "Settings Reset",
        "Enrollment window is now auto-calculated.",
        "success"
      );
    } catch {
      addToast("Reset Failed", "Failed to reset settings.", "error");
    } finally {
      setSettingsSaving(false);
    }
  };

  const scrollToFirstMissingField = (fieldName) => {
    // Map field names to input name attributes
    const fieldMap = {
      "Last Name": "last_name",
      "First Name": "first_name",
      "Birth Date": "birth_date",
      "Grade Level": "grade_level",
      "Education Level": "education_level",
      "Student Type": "student_type",
      "Academic Year": "academic_year",
      "Payment Mode": "payment_mode",
      "LRN": "lrn",
    };

    const inputName = fieldMap[fieldName] || fieldName.toLowerCase().replace(/\s+/g, "_");
    const inputField = document.querySelector(`input[name="${inputName}"], select[name="${inputName}"], textarea[name="${inputName}"]`);
    
    if (inputField) {
      inputField.scrollIntoView({ behavior: "smooth", block: "center" });
      inputField.focus();
      inputField.style.borderColor = "#ef4444";
      setTimeout(() => {
        inputField.style.borderColor = "";
      }, 2000);
    }
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
    if (!formData.email?.trim() && !formData.mobile_number?.trim()) {
      missing.push("At least one contact (Email or Mobile)");
    }
    if (formData.religion === "others_specify" && !formData.custom_religion?.trim()) {
      missing.push("Religion (specify)");
    }
    // if (!formData.parent_facebook?.trim()) missing.push("Parent Facebook");
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
      if (missing.length > 0) {
        scrollToFirstMissingField(missing[0]);
      }
      return false;
    }

    return true;
  };

 const handleApproveConfirm = async () => {
  if (!approveTargetRow) return;

  const row = approveTargetRow;
  if (!validateBeforeApprove(row)) return;
  
  const amountNum = Number(approveAmount);
  if (!approveAmount || Number.isNaN(amountNum) || amountNum <= 0) {
    addToast(
      "Invalid Amount",
      "Please enter a valid payment amount before approving.",
      "error"
    );
    return;
  }

  const paymentMode = String(row?.raw?.payment_mode || "").trim().toLowerCase();
  const isCashPaymentMode = paymentMode === "cash";
  const requiredCashAmount = Number(approveCashFullAmount || 0);

  if (!isCashPaymentMode && amountNum < Number(approveMinimumAmount || 0)) {
    addToast(
      "Minimum Initial Payment Required",
      `Approved amount must be at least Php ${Number(approveMinimumAmount || 0).toFixed(2)} for this grade level.`,
      "error"
    );
    return;
  }

  if (isCashPaymentMode && requiredCashAmount > 0 && Math.abs(amountNum - requiredCashAmount) > 0.009) {
    addToast(
      "Full Payment Required",
      `Cash mode requires full payment of Php ${requiredCashAmount.toFixed(2)}.`,
      "error"
    );
    return;
  }

 setApproveSubmitting(true);
    try {
      const body = {
        ...(row.raw?.section ? { section: row.raw.section } : {}),
        amount: amountNum,
        remarks: approveRemarks,
        payment_method: approvePaymentMethod,
      };

      const res = await apiFetch(`/api/enrollments/${row.id}/mark_active/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(data.detail || data.error || "Approval failed");
      }

      await fetchEnrollments();
      await fetchProofs();

      addToast(
        "Approved",
        "Enrollment approved and payment posted successfully.",
        "success"
      );

      closeApproveDialog();
    } catch (err) {
      addToast(
        "Approval Failed",
        err.message || "Could not approve enrollment.",
        "error"
      );
    } finally {
      setApproveSubmitting(false);
    }
    };
  const getDeclineTargetName = useCallback(() => {
    if (!declineTargetId) return "this enrollment";

    const row = normalized.find((r) => r.id === declineTargetId);
    if (!row) return "this enrollment";

    return row.studentName || "this enrollment";
  }, [declineTargetId, normalized]);

  const openDeclineDialog = (id) => {
    setDeclineTargetId(id);
    setDeclineReason("");
    setDeclineDialogOpen(true);
  };

  const closeDeclineDialog = () => {
    setDeclineDialogOpen(false);
    setDeclineTargetId(null);
    setDeclineReason("");
  };

  const confirmDecline = async () => {
  if (declineSubmitting) return;
  if (!declineTargetId) return;

  const trimmedReason = declineReason.trim();
  if (!trimmedReason) {
    addToast(
      "Reason Required",
      "Please enter a reason or remark before declining.",
      "warning"
    );
    return;
  }

  setDeclineSubmitting(true);
  try {
    const data = await callAction(declineTargetId, "mark_dropped", {
      reason: trimmedReason,
    });

    if (editingId === declineTargetId) {
      setModalStatus("DROPPED");
      setFormData((p) => ({
        ...p,
        status: "DROPPED",
        remarks: data?.remarks ?? p.remarks,
      }));
      setModalMode("view");
    }

    await fetchEnrollments();
    
    // Auto-reject the payment proof if it exists
    await autoRejectPaymentProof(declineTargetId, trimmedReason);
    
    addToast(
      "Enrollment Declined",
      "Enrollment was declined successfully. Payment proof has been auto-rejected.",
      "success"
    );

    setDeclineDialogOpen(false);
    setDeclineTargetId(null);
    setDeclineReason("");
  } catch (err) {
    addToast(
      "Decline Failed",
      err.message || "Could not decline enrollment.",
      "error"
    );
  } finally {
    setDeclineSubmitting(false);
  }
};

  const handleDecline = (id) => {
    openDeclineDialog(id);
  };
    const openApproveDialog = async (row) => {

    setApproveTargetRow(row);
    setApproveRemarks("");
    setApproveMinimumAmount(0);
    setApproveCashFullAmount(0);

    const gradeKey = String(row?.raw?.grade_level || "").trim();
    if (gradeKey) {
      try {
        const cfgRes = await apiFetch(`/api/finance/tuition-configs/by-grade/${gradeKey}/`);
        const cfg = await cfgRes.json().catch(() => ({}));
        if (cfgRes.ok) {
          const isNewStudent = String(row?.raw?.student_type || "").trim().toLowerCase() === "new";
          const assessment = isNewStudent ? Number(cfg?.assessment || 0) : 0;
          const paymentMode = String(row?.raw?.payment_mode || "").trim().toLowerCase();

          if (paymentMode === "cash") {
            setApproveMinimumAmount(0);
            setApproveCashFullAmount(Number(cfg?.total_cash || 0) + assessment);
          } else {
            setApproveMinimumAmount(Number(cfg?.initial || 0) + assessment);
            setApproveCashFullAmount(0);
          }
        }
      } catch {
        setApproveMinimumAmount(0);
        setApproveCashFullAmount(0);
      }
    }

    const submittedAmount = Number(
      row?.submittedPaymentAmount ?? row?.paymentProof?.amount ?? 0
    );
    setApproveAmount(submittedAmount > 0 ? String(submittedAmount) : "");
    setApproveDialogOpen(true);
  };

  const closeApproveDialog = () => {
    setApproveDialogOpen(false);
    setApproveTargetRow(null);
    setApproveAmount("");
    setApproveMinimumAmount(0);
    setApproveCashFullAmount(0);
    setApproveRemarks("");
  };

  const openPreApproveConfirm = (row) => {
    setPreApproveTargetRow(row);
    setPreApproveChecked(false);
    setPreApproveConfirmOpen(true);
  };

  const closePreApproveConfirm = () => {
    setPreApproveConfirmOpen(false);
    setPreApproveTargetRow(null);
    setPreApproveChecked(false);
  };

  const proceedToApproveDialog = async () => {
    if (!preApproveTargetRow || !preApproveChecked) return;
    const row = preApproveTargetRow;
    closePreApproveConfirm();
    await openApproveDialog(row);
  };

  const _autoApprovePaymentProof = async (enrollmentId) => {
    try {
      // Find the proof of payment for this enrollment
      const proof = proofs.find(p => p.enrollment_id === enrollmentId);
      
      if (!proof) {
        console.log(`No payment proof found for enrollment ${enrollmentId}`);
        return;
      }

      // If already approved, no need to update
      if (proof.status && String(proof.status).toLowerCase() === "approved") {
        return;
      }

      // Auto-approve the payment proof
      const res = await apiFetch(
        `/api/finance/proof-of-payments/${proof.id}/approve/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            remarks: "Auto-approved when enrollment was approved" 
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to auto-approve payment proof:", errorData);
        return;
      }

      await fetchProofs();
    } catch (err) {
      console.error("Error auto-approving payment proof:", err);
    }
  };

  const autoRejectPaymentProof = async (enrollmentId, declineReason = "") => {
    try {
      // Find the proof of payment for this enrollment
      const proof = proofs.find(p => p.enrollment_id === enrollmentId);
      
      if (!proof) {
        console.log(`No payment proof found for enrollment ${enrollmentId}`);
        return;
      }

      // If already rejected, no need to update
      if (proof.status && String(proof.status).toLowerCase() === "rejected") {
        return;
      }

      // Auto-reject the payment proof
      const res = await apiFetch(
        `/api/finance/proof-of-payments/${proof.id}/reject/`,
        {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ 
            remarks: `Auto-rejected when enrollment was declined${declineReason ? ": " + declineReason : ""}`
          }),
        }
      );

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        console.error("Failed to auto-reject payment proof:", errorData);
        return;
      }

      await fetchProofs();
    } catch (err) {
      console.error("Error auto-rejecting payment proof:", err);
    }
  };

  const handleDeleteEnrollment = async (id) => {
    if (!window.confirm("Delete this enrollment?")) return;

    try {
      const res = await apiFetch(`/api/enrollments/${id}/`, {
        method: "DELETE",
      });

      if (!res.ok) throw new Error();

      await fetchEnrollments();
      if (editingId === id) closeModal();

      addToast(
        "Enrollment Deleted",
        "Enrollment was deleted successfully.",
        "success"
      );
    } catch {
      addToast("Delete Failed", "Could not delete enrollment.", "error");
    }
  };

  const _handleSelectAll = () => {
    if (selectedIds.size === paginatedEnrollments.length) {
      setSelectedIds(new Set());
    } else {
      setSelectedIds(new Set(paginatedEnrollments.map((e) => e.id)));
    }
  };

  const _handleSelectOne = (id) => {
    const newSet = new Set(selectedIds);
    if (newSet.has(id)) newSet.delete(id);
    else newSet.add(id);
    setSelectedIds(newSet);
  };

const handleApproveModal = async () => {
  if (!editingId) return;
  const row = normalized.find((r) => r.id === editingId);
  if (!row) return;
  openPreApproveConfirm(row);
};

  const handleDeclineModal = () => {
    if (!editingId) return;
    openDeclineDialog(editingId);
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
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ academic_year: newYear }),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", formatApiErrorMessage(data, "Could not update academic year."), "error");
        return;
      }

      await fetchEnrollments();
      setEditingAcademicYear(false);

      
    } catch {
      addToast("Save Failed", "Could not update academic year.", "error");
    }
  };

  const handlePromote = (row) => {
    const e = row.raw;
    const promotion = getPromotionReadiness(row);

    // Check if student is ready to promote
    if (!promotion.ready) {
      addToast(
        "Cannot Promote",
        promotion.reason,
        "warning"
      );
      return;
    }

    const normalizedGradeLevel = normalizeSectionGrade(e.grade_level);
    const { next, nextEdu } = getNextGrade(normalizedGradeLevel);

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
    const religionFields = mapReligionToForm(e.religion);

    setEditingId(e.id);
    setIsPromoteFlow(true);
    setPromoteSourceParentUserId(e?.parent_user || null);
    setModalMode("edit");
    setModalStatus(null);
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
      religion: religionFields.religion,
      custom_religion: religionFields.custom_religion,
      mobile_number: e.mobile_number || "",
      parent_facebook: e.parent_facebook || "",
      street: addr.street,
      barangay: addr.barangay,
      city: addr.city,
      province: addr.province,
      region: addr.region,
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

  

    let normalizedMobile = null;
    if (formData.mobile_number?.trim()) {
      normalizedMobile = normalizePHMobile(formData.mobile_number);
      if (!normalizedMobile) {
        addToast(
          "Invalid Mobile Number",
          "Use 09XXXXXXXXX or +639XXXXXXXXX.",
          "error"
        );
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
      religion: resolveReligionForPayload(formData),
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

    if (isPromoteFlow && promoteSourceParentUserId) {
      payload.parent_user = promoteSourceParentUserId;
    }

    const shouldCreateEnrollment = !editingId || isPromoteFlow;
    const url = shouldCreateEnrollment
      ? "/api/enrollments/"
      : `/api/enrollments/${editingId}/`;

    try {
      const res = await apiFetch(url, {
        method: shouldCreateEnrollment ? "POST" : "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        addToast("Save Failed", formatApiErrorMessage(data, "Could not save enrollment."), "error");
        return;
      }

      await fetchEnrollments();

      if (editingId && isPromoteFlow) {
        let promotedData = data;
        const promotedEnrollmentId = Number(data?.id) > 0 ? data.id : null;

        if (!promotedData || typeof promotedData !== "object" || !promotedData.id) {
          const fallbackId = promotedEnrollmentId || editingId;
          const refreshedRes = await apiFetch(`/api/enrollments/${fallbackId}/`);
          promotedData = await refreshedRes.json().catch(() => null);
        }

        const promotedId = Number(promotedData?.id) > 0 ? promotedData.id : (promotedEnrollmentId || editingId);
        const promotedRaw = promotedData && typeof promotedData === "object"
          ? promotedData
          : {
              id: promotedId,
              first_name: payload.first_name,
              last_name: payload.last_name,
              birth_date: payload.birth_date,
              education_level: payload.education_level,
              student_type: payload.student_type,
              grade_level: payload.grade_level,
              academic_year: payload.academic_year,
              payment_mode: payload.payment_mode,
              payment_method: payload.payment_method,
              lrn: payload.lrn,
            };

        const promotedRow = {
          id: promotedId,
          raw: promotedRaw,
          studentName: `${promotedRaw.first_name || ""} ${promotedRaw.last_name || ""}`.trim(),
          gradeLevel: gradeLabel(promotedRaw.grade_level),
          academicYear: promotedRaw.academic_year || "",
          paymentMode: promotedRaw.payment_mode || "—",
          paymentMethod: promotedRaw.payment_method || "—",
          submittedPaymentAmount: promotedRaw.payment_amount ?? null,
          paymentProof: proofs.find((p) => p.enrollment_id === promotedId) || null,
        };

        closeModal();

        setTimeout(() => {
          openPreApproveConfirm(promotedRow);
        }, 0);
        addToast(
          "Promotion Saved",
          "Review payment details and approve the promoted enrollment.",
          "success"
        );
        return;
      }

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
      addToast(
        "Document Uploaded",
        "Enrollment document uploaded successfully.",
        "success"
      );
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
      addToast(
        "Document Updated",
        "Enrollment document updated successfully.",
        "success"
      );
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
      const res = await apiFetch(
        `/api/enrollments/${editingId}/documents/${docId}/delete/`,
        {
          method: "DELETE",
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to delete document.");

      await refreshEnrollmentById(editingId);
      if (editingDocId === docId) cancelEditDocument();

      addToast(
        "Document Deleted",
        "Enrollment document removed successfully.",
        "success"
      );
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

  const handleUseSubmittedPhoto = async () => {
    if (!idUploadEnrollmentId) return;

    const enrollment = enrollments.find((e) => e.id === idUploadEnrollmentId);
    if (!enrollment?.id_image_url) {
      addToast("No Photo Available", "No submitted photo found.", "error");
      return;
    }

    setIdUploading(true);
    try {
      // The photo is already stored as id_image in the enrollment
      addToast(
        "Photo Confirmed",
        "Student's submitted 2x2 photo is now set as their ID photo.",
        "success"
      );
      closeIdUploadModal();

      // Auto-open ID generator after confirming photo
      if (enrollment && enrollment.id) {
        const studentData = prepareIdData(enrollment);
        setSelectedStudentForId(studentData);
        setIdGeneratorOpen(true);
      }
    } catch (err) {
      console.error("Error using submitted photo:", err);
      addToast("Failed", "Could not confirm photo.", "error");
    } finally {
      setIdUploading(false);
    }
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

      const res = await apiFetch(
        `/api/enrollments/${idUploadEnrollmentId}/upload-id-image/`,
        {
          method: "POST",
          body: form,
        }
      );

      const data = await res.json().catch(() => ({}));
      if (!res.ok) throw new Error(data.detail || "Failed to upload ID image.");

      addToast("ID Uploaded", "Student ID image uploaded successfully.", "success");
      closeIdUploadModal();

      // Use the response data if available, otherwise fetch
      let updatedRow = data.enrollment || data;
      
      // If response doesn't have full enrollment data, fetch from server
      if (!updatedRow.id || updatedRow.id !== idUploadEnrollmentId) {
        await fetchEnrollments();
        updatedRow = enrollments.find((e) => e.id === idUploadEnrollmentId);
      }

      // Auto-open ID generator after upload
      if (updatedRow && updatedRow.id) {
        const studentData = prepareIdData(updatedRow);
        setSelectedStudentForId(studentData);
        setIdGeneratorOpen(true);
      }
    } catch (err) {
      addToast("Upload Failed", err.message || "Could not upload ID image.", "error");
    } finally {
      setIdUploading(false);
    }
  };

const openIdGenerator = (row) => {
  const enrollment = row?.raw || row;

  // If student has no photo yet, open upload modal first
  if (!enrollment?.id_image_url) {
    setIdUploadEnrollmentId(enrollment?.id);
    setIdUploadOpen(true);
    return;
  }

  // Otherwise directly open ID generator
  const studentData = prepareIdData(enrollment);
  setSelectedStudentForId(studentData);
  setIdGeneratorOpen(true);
};

  const closeIdGenerator = () => {
    setIdGeneratorOpen(false);
    setSelectedStudentForId(null);
  };

  const handleEnrollmentPreview = () => {
    console.log('Enrollment preview button clicked!', { normalized });
    
    const previewData = normalized.map((enr) => ({
      "Student Name": enr.studentName || "N/A",
      "Grade Level": enr.gradeLevel || "N/A",
      "Section": enr.sectionName || "N/A",
      "Status": enr.statusText || "N/A",
      "Payment Method": enr.paymentMethod || "N/A",
      "Academic Year": enr.academicYear || "N/A",
    }));

    console.log('Enrollment preview data:', previewData);
    setEnrollmentPreviewData(previewData);
    setEnrollmentPreviewOpen(true);
  };

  const renderEnrollmentSkeletonRows = () =>
    Array.from({ length: ENROLLMENT_SKELETON_ROWS }).map((_, rowIdx) => (
      <tr key={`enrollment-skeleton-row-${rowIdx}`}>
        {Array.from({ length: ENROLLMENT_SKELETON_COLUMNS }).map((__, colIdx) => (
          <td key={`enrollment-skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`enrollment-skeleton-line ${
                colIdx === 0 ? "w-lg" : colIdx === ENROLLMENT_SKELETON_COLUMNS - 1 ? "w-sm" : "w-md"
              }`}
            />
          </td>
        ))}
      </tr>
    ));

  const isInitialLoading = loading && enrollments.length === 0;
  const lockImportantFields = Boolean(
    editingId &&
      ["ACTIVE", "COMPLETED"].includes(
        String(modalStatus || formData.status || "").toUpperCase()
      )
  );

  return (
    <div className="enrollment-management">
      <Toast toasts={toasts} onDismiss={dismissToast} />

      <div className="enrollment-stats-section">
        {isInitialLoading ? (
          <>
            <div className="enrollment-stats-header enrollment-stats-header--skeleton">
              <div className="enrollment-skeleton-line enrollment-skeleton-title" />
              <div className="enrollment-skeleton-actions">
                <div className="enrollment-skeleton-line enrollment-skeleton-action" />
                <div className="enrollment-skeleton-line enrollment-skeleton-action" />
                <div className="enrollment-skeleton-line enrollment-skeleton-action" />
                <div className="enrollment-skeleton-line enrollment-skeleton-action" />
              </div>
            </div>

            <StatsGrid className="unified-stats-grid">
              <div className="unified-stat-card enrollment-skeleton-stat-card">
                <div className="enrollment-skeleton-line w-md" />
                <div className="enrollment-skeleton-line w-sm" />
              </div>
              <div className="unified-stat-card enrollment-skeleton-stat-card">
                <div className="enrollment-skeleton-line w-md" />
                <div className="enrollment-skeleton-line w-sm" />
              </div>
              <div className="unified-stat-card enrollment-skeleton-stat-card">
                <div className="enrollment-skeleton-line w-md" />
                <div className="enrollment-skeleton-line w-sm" />
              </div>
              <div className="unified-stat-card enrollment-skeleton-stat-card">
                <div className="enrollment-skeleton-line w-md" />
                <div className="enrollment-skeleton-line w-sm" />
              </div>
              <div className="unified-stat-card enrollment-skeleton-stat-card">
                <div className="enrollment-skeleton-line w-md" />
                <div className="enrollment-skeleton-line w-sm" />
              </div>
            </StatsGrid>
          </>
        ) : (
          <>
            <div className="enrollment-stats-header">
              <div className="enrollment-stats-title">Enrollment Overview</div>
              <div className="header-actions enrollment-header-actions">
                <button className="btn-primary enrollment-btn-primary" onClick={openCreateModal}>
                  + Add Enrollee
                </button>

                <button className="btn-icon enrollment-btn-icon" onClick={fetchEnrollments} title="Refresh">
                  <RefreshCw size={16} />
                </button>

                <button
                  className="btn-icon enrollment-btn-icon"
                  onClick={handleEnrollmentPreview}
                  title="View and Export Enrollment Data"
                >
                  <FileText size={16} />
                </button>

                <button
                  className={`btn-icon enrollment-btn-icon ${settingsOpen ? "btn-icon--active enrollment-btn-icon--active" : ""}`}
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
                subtitle={
                  stats.total
                    ? `${Math.round((stats.active / stats.total) * 100)}% of total`
                    : "—"
                }
                subtitleType="positive"
              />
              <StatCard
                label="Pending"
                value={stats.pending}
                icon={<Clock size={20} />}
                color="yellow"
                subtitle={
                  stats.total
                    ? `${Math.round((stats.pending / stats.total) * 100)}% of total`
                    : "—"
                }
              />
              <StatCard
                label="Declined"
                value={stats.dropped}
                icon={<UserMinus size={20} />}
                color="red"
                subtitle={
                  stats.total
                    ? `${Math.round((stats.dropped / stats.total) * 100)}% of total`
                    : "—"
                }
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
          </>
        )}
      </div>

      {settingsOpen && (
        <div className="settings-panel">
          <div className="settings-panel__header">
            <div className="settings-panel__title-row">
              <Calendar size={16} className="settings-panel__title-icon" />
              <span className="settings-panel__title-text">
                Enrollment Window & School Year
              </span>
            </div>

            <button
              onClick={() => setSettingsOpen(false)}
              className="settings-panel__close-btn"
            >
              <XCircle size={16} />
            </button>
          </div>

          {settingsLoading ? (
            <div className="settings-panel__loading">
              Loading settings…
            </div>
          ) : (
            <>
              <div className="settings-panel__status">
                <div
                  className={`settings-panel__status-badge ${
                    window_.isOpen ? "settings-panel__status-badge--open" : "settings-panel__status-badge--closed"
                  }`}
                >
                  {window_.isOpen ? <CheckCircle size={13} /> : <XCircle size={13} />}
                  {window_.isOpen
                    ? `Open — ${window_.daysLeft} day${
                        window_.daysLeft !== 1 ? "s" : ""
                      } left`
                    : "Closed"}
                </div>

                <div className="settings-panel__status-text">
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
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, open_date: e.target.value }))
                    }
                  />

                  {draft.open_date && (
                    <button
                      onClick={() => setDraft((p) => ({ ...p, open_date: "" }))}
                      className="settings-panel__clear-btn"
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

                  <div className="settings-panel__days-row">
                    <input
                      type="number"
                      min={1}
                      max={60}
                      className="settings-panel__input settings-panel__days-input"
                      value={draft.window_days}
                      onChange={(e) =>
                        setDraft((p) => ({ ...p, window_days: e.target.value }))
                      }
                    />
                    <span className="settings-panel__days-text">days</span>
                  </div>
                </div>
              </div>

              <div className="settings-panel__actions">
                <button
                  className="btn-primary enrollment-btn-primary"
                  onClick={handleSaveSettings}
                  disabled={settingsSaving}
                >
                  {settingsSaving ? (
                    "Saving…"
                  ) : (
                    <>
                      <CheckCircle size={13} /> Save Settings
                    </>
                  )}
                </button>

                <button
                  className="btn-secondary enrollment-btn-secondary"
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

      {isInitialLoading ? (
        <>
          <div className="enrollment-controls enrollment-controls--skeleton">
            <div className="enrollment-skeleton-line w-lg" />
            <div className="enrollment-skeleton-line w-md" />
            <div className="enrollment-skeleton-line w-md" />
            <div className="enrollment-skeleton-line w-sm" />
          </div>

        </>
      ) : (
        <>
          <div className={`enrollment-controls ${mobileFiltersOpen ? "mobile-filters-open" : ""}`}>
            <div className="search-box enrollment-search-box">
              <Search size={16} />
              <input
                type="text"
                placeholder="Search by student, parent name, phone, or section…"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>

            <button
              type="button"
              className={`mobile-filter-toggle ${mobileFiltersOpen ? "active" : ""}`}
              onClick={() => setMobileFiltersOpen((prev) => !prev)}
              aria-expanded={mobileFiltersOpen}
              aria-label="Toggle filter options"
            >
              <Filter size={14} />
              {mobileFiltersOpen ? "Hide Filters" : "Show Filters"}
            </button>

            <div className={`enrollment-controls-advanced ${mobileFiltersOpen ? "open" : ""}`}>

            <div className="filter-box enrollment-filter-box">
              <Filter size={16} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
              >
                {FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <div className="filter-box enrollment-filter-box">
              <Filter size={16} />
              <select
                value={filterPromotionStatus}
                onChange={(e) => setFilterPromotionStatus(e.target.value)}
              >
                {PROMOTION_FILTER_OPTIONS.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              className="filter-reset-btn enrollment-filter-reset-btn"
              onClick={() => {
                setSearchTerm("");
                setFilterStatus("All");
                setFilterPromotionStatus("All");
              }}
              title="Reset all filters"
            >
              <XCircle size={14} /> Reset Filters
            </button>
            </div>
          </div>
        </>
      )}

      <div className="enrollments-container">
        {isInitialLoading ? (
          <div className="enrollments-table-scroll enrollments-table-scroll--skeleton">
            <table className="enrollments-table enrollments-table--skeleton" aria-hidden="true">
              <thead>
                <tr>
                  {Array.from({ length: ENROLLMENT_SKELETON_COLUMNS }).map((_, idx) => (
                    <th key={`enrollment-skeleton-head-${idx}`}>
                      <div className="enrollment-skeleton-line enrollment-skeleton-head" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderEnrollmentSkeletonRows()}</tbody>
            </table>
          </div>
        ) : filteredEnrollments.length === 0 ? (
          <div className="no-results enrollment-no-results">
            <div className="enrollment-no-results__title">
              No enrollment records found
            </div>
            <div className="enrollment-no-results__subtitle">
              Try changing the search keyword or status filter.
            </div>
          </div>
        ) : (
          <div className="enrollments-table-scroll">
            <table className="enrollments-table">
              <thead>
                <tr>
                  <th>Student</th>
                  <th>Enrollment Date</th>
                  <th>Status</th>
                  <th>Promotion Ready</th>
                  <th>Parent / Guardian</th>
                  <th>Approve / Decline</th>
                  <th>Actions</th>
                </tr>
              </thead>

              <tbody>
                {paginatedEnrollments.map((row) => (
                  <tr key={row.id}>
                    <td>
                      <div className="table-row-content table-row-content--student">
                        <StudentCell row={row} />
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--date">
                        {row.enrollmentDate
                          ? new Date(row.enrollmentDate).toLocaleDateString()
                          : "—"}
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--status">
                        <StatusBadge code={row.statusCode} />
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--promotion">
                        {row.statusCode === "ACTIVE" && (
                          (() => {
                            const promotion = getPromotionReadiness(row);
                            return (
                              <div
                                className={`promotion-ready-badge ${promotion.status}`}
                                title={promotion.reason}
                              >
                                {promotion.status === "ready" && "✓ Ready"}
                                {promotion.status === "completed" && "✓ Completed"}
                                {promotion.status === "ineligible" && "✕ Ineligible"}
                              </div>
                            );
                          })()
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--parent">
                        <ParentCell row={row} />
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--approval">
                        {row.statusCode === "PENDING" ? (
                          <div className="approve-decline-group">
                            <button
                              className="btn-approve enrollment-btn-approve table-btn-approve"
                              onClick={() => openPreApproveConfirm(row)}
                              title="Approve"
                              aria-label="Approve"
                            >
                              <CheckCircle size={getResponsiveIconSize()} />
                            </button>
                            <button
                              className="btn-decline enrollment-btn-decline table-btn-decline"
                              onClick={() => handleDecline(row.id)}
                              title="Decline"
                              aria-label="Decline"
                            >
                              <XCircle size={getResponsiveIconSize()} />
                            </button>
                          </div>
                        ) : row.statusCode === "ACTIVE" ? (
                          <span className="table-inline-status table-inline-status--approved">
                            <CheckCircle size={getResponsiveIconSize()} /> Approved
                          </span>
                        ) : row.statusCode === "DROPPED" ? (
                          <span className="table-inline-status table-inline-status--declined">
                            <XCircle size={getResponsiveIconSize()} /> Declined
                          </span>
                        ) : row.statusCode === "COMPLETED" ? (
                          <span className="table-inline-status table-inline-status--completed">
                            <CheckCircle size={getResponsiveIconSize()} /> Completed
                          </span>
                        ) : (
                          <span className="table-inline-status--muted">—</span>
                        )}
                      </div>
                    </td>

                    <td>
                      <div className="table-row-content table-row-content--actions">
                        <div className="action-buttons enrollment-action-buttons action-buttons--start">
                          <TableActionMenu
                            row={row}
                            gradeLabel={gradeLabel}
                            getNextGrade={getNextGrade}
                            onView={() => openModal(row, "view")}
                            onEdit={() => openModal(row, "edit")}
                            onDelete={() => handleDeleteEnrollment(row.id)}
                            onIdUpload={() => openIdUploadModal(row)}
                            onPromote={() => handlePromote(row)}
                            onGenerateId={() => openIdGenerator(row)}
                          />
                        </div>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!isInitialLoading && (
          <Pagination
            currentPage={enrollPage}
            totalPages={enrollTotalPages}
            onPageChange={setEnrollPage}
            totalItems={filteredEnrollments.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        )}
      </div>

      <EnrollmentDetailsModal
        modalOpen={modalOpen}
        editingId={editingId}
        modalMode={modalMode}
        formData={formData}
        modalStatus={modalStatus}
        editingAcademicYear={editingAcademicYear}
        isReadOnly={isReadOnly}
        sectionsLoading={sectionsLoading}
        filteredSections={filteredSections}
        gradeOptions={gradeOptions}
        currentDocs={currentDocs}
        paymentProof={currentPaymentProof}
        lockImportantFields={lockImportantFields}
        studentPhoto={editingId ? enrollments.find((e) => e.id === editingId)?.id_image_url : null}
        docUploadType={docUploadType}
        docUploadLabel={docUploadLabel}
        docSaving={docSaving}
        editingDocId={editingDocId}
        editingDocLabel={editingDocLabel}
        editingDocType={editingDocType}
        setEditingAcademicYear={setEditingAcademicYear}
        setDocUploadType={setDocUploadType}
        setDocUploadLabel={setDocUploadLabel}
        setDocUploadFile={setDocUploadFile}
        setEditingDocLabel={setEditingDocLabel}
        setEditingDocType={setEditingDocType}
        setEditingDocFile={setEditingDocFile}
        onClose={closeModal}
        onEnterEditMode={handleEnterEditMode}
        onInputChange={handleInputChange}
        onParentChange={handleParentChange}
        onSaveAcademicYear={handleSaveAcademicYear}
        onApprove={handleApproveModal}
        onDecline={handleDeclineModal}
        onSaveEnrollment={handleSaveEnrollment}
        onUploadDocument={handleUploadDocument}
        onStartEditDocument={startEditDocument}
        onCancelEditDocument={cancelEditDocument}
        onUpdateDocument={handleUpdateDocument}
        onDeleteDocument={handleDeleteDocument}
        onOpenIdUploadModal={() => {
          if (editingId) {
            openIdUploadModal(normalized.find((r) => r.id === editingId));
          }
        }}
        calcAge={calcAge}
        todayISO={todayISO}
        gradeLabel={gradeLabel}
        validateAgeForGrade={validateAgeForGrade}
        DOCUMENT_TYPE_OPTIONS={DOCUMENT_TYPE_OPTIONS}
        GRADE_AGE_RULES={GRADE_AGE_RULES}
      />

      <IdUploadModal
        idUploadOpen={idUploadOpen}
        idUploadPreview={idUploadPreview}
        idUploading={idUploading}
        submittedStudentPhoto={
          idUploadEnrollmentId
            ? enrollments.find((e) => e.id === idUploadEnrollmentId)?.id_image_url
            : null
        }
        onClose={closeIdUploadModal}
        onSelectImage={handleIdImageSelect}
        onClearImage={() => {
          setIdUploadFile(null);
          setIdUploadPreview(null);
        }}
        onUpload={handleUploadIdImage}
        onUseSubmittedPhoto={handleUseSubmittedPhoto}
      />

      {/* Payment Proof Modal */}
      {paymentProofModalOpen && (
        <div className="payment-proof-overlay" onClick={() => setPaymentProofModalOpen(false)}>
          <div className="payment-proof-panel" onClick={(e) => e.stopPropagation()}>
            <div className="payment-proof-panel__header">
              <h3 className="payment-proof-panel__title">
                Review Payment Proof
              </h3>
              <button
                onClick={() => setPaymentProofModalOpen(false)}
                className="payment-proof-panel__close"
              >
                ×
              </button>
            </div>

            {(() => {
              const proof = proofs.find(p => p.id === selectedProofId);
              if (!proof) return <div>Proof not found</div>;

              return (
                <div>
                  <div className="payment-proof-panel__section">
                    <label className="payment-proof-panel__label">
                      Student Name
                    </label>
                    <div className="payment-proof-panel__value">
                      {proof.student_name || "N/A"}
                    </div>
                  </div>

                  <div className="payment-proof-panel__section">
                    <label className="payment-proof-panel__label">
                      Reference Number
                    </label>
                    <div className="payment-proof-panel__value">
                      {proof.reference_number}
                    </div>
                  </div>

                  <div className="payment-proof-panel__section">
                    <label className="payment-proof-panel__label payment-proof-panel__image-label">
                      Payment Proof Image
                    </label>
                    {proof.proof_image_url ? (
                      <img
                        src={proof.proof_image_url}
                        alt="Payment proof"
                        className="payment-proof-panel__image"
                        onClick={() => {
                          setImageViewerOpen(true);
                          setSelectedImageUrl(proof.proof_image_url);
                        }}
                      />
                    ) : (
                      <div className="payment-proof-panel__empty">
                        No image available
                      </div>
                    )}
                  </div>

                  <div className="payment-proof-panel__footer">
                    <button
                      onClick={() => setPaymentProofModalOpen(false)}
                      className="payment-proof-panel__button"
                    >
                      Close
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
        </div>
      )}

      {/* Image Overlay - Place this OUTSIDE all modals */}
      {imageViewerOpen && selectedImageUrl && (
        <div className="image-viewer-overlay" onClick={() => setImageViewerOpen(false)}>
          <button
            onClick={() => setImageViewerOpen(false)}
            className="image-viewer-overlay__close"
          >
            <XCircle size={32} />
          </button>
          <img
            src={selectedImageUrl}
            alt="Payment proof full view"
            className="image-viewer-overlay__image"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      <DeclineDialog
        declineDialogOpen={declineDialogOpen}
        declineSubmitting={declineSubmitting}
        declineReason={declineReason}
        targetName={getDeclineTargetName()}
        onClose={closeDeclineDialog}
        onChangeReason={setDeclineReason}
        onConfirm={confirmDecline}
      />

      <IdCardGenerator
        isOpen={idGeneratorOpen}
        onClose={closeIdGenerator}
        studentData={selectedStudentForId || {}}
        schoolInfo={schoolInfo}
      />

      {preApproveConfirmOpen && preApproveTargetRow && (
        <div className="approve-enrollment-overlay" onClick={closePreApproveConfirm}>
          <div className="approve-enrollment-panel pre-approve-panel" onClick={(e) => e.stopPropagation()}>
            <div className="approve-enrollment-panel__header">
              <h3 className="approve-enrollment-panel__title">Confirm Enrollment Details</h3>
              <button
                onClick={closePreApproveConfirm}
                className="approve-enrollment-panel__close"
              >
                ×
              </button>
            </div>

            <div className="pre-approve-note">
              Please verify the student information below before approving this enrollment.
            </div>

            <div className="approve-enrollment-panel__grid">
              <div>
                <div className="approve-enrollment-panel__meta-label">Student Name</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.studentName || "—"}</div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Birth Date</div>
                <div className="approve-enrollment-panel__meta-value">
                  {preApproveTargetRow.raw?.birth_date
                    ? `${preApproveTargetRow.raw.birth_date} (${calcAge(preApproveTargetRow.raw.birth_date)} years old)`
                    : "—"}
                </div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Education Level</div>
                <div className="approve-enrollment-panel__meta-value">
                  {preApproveTargetRow.raw?.education_level
                    ? String(preApproveTargetRow.raw.education_level)
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    : "—"}
                </div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Student Type</div>
                <div className="approve-enrollment-panel__meta-value">
                  {preApproveTargetRow.raw?.student_type
                    ? String(preApproveTargetRow.raw.student_type)
                        .replace(/_/g, " ")
                        .replace(/\b\w/g, (c) => c.toUpperCase())
                    : "—"}
                </div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Grade Level</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.gradeLevel || "—"}</div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Academic Year</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.academicYear || "—"}</div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Payment Mode</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.paymentMode || "—"}</div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">Payment Method</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.paymentMethod || "—"}</div>
              </div>
              <div>
                <div className="approve-enrollment-panel__meta-label">LRN</div>
                <div className="approve-enrollment-panel__meta-value">{preApproveTargetRow.raw?.lrn || "—"}</div>
              </div>
            </div>

            <label className="pre-approve-check">
              <input
                type="checkbox"
                checked={preApproveChecked}
                onChange={(e) => setPreApproveChecked(e.target.checked)}
              />
              I have reviewed and confirmed that the student's details are correct.
            </label>

            <div className="approve-enrollment-panel__actions">
              <button
                onClick={closePreApproveConfirm}
                className="approve-enrollment-panel__cancel"
              >
                Back
              </button>
              <button
                onClick={proceedToApproveDialog}
                disabled={!preApproveChecked}
                className="approve-enrollment-panel__submit"
              >
                Continue to Approval
              </button>
            </div>
          </div>
        </div>
      )}

       {approveDialogOpen && approveTargetRow && (
        <div className="approve-enrollment-overlay" onClick={closeApproveDialog}>
          <div className="approve-enrollment-panel" onClick={(e) => e.stopPropagation()}>
            <div className="approve-enrollment-panel__header">
              <h3 className="approve-enrollment-panel__title">
                Approve Enrollment
              </h3>
              <button
                onClick={closeApproveDialog}
                className="approve-enrollment-panel__close"
              >
                ×
              </button>
            </div>

            <div className="approve-enrollment-panel__grid">
              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Student
                </div>
                <div className="approve-enrollment-panel__meta-value">{approveTargetRow.studentName}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Enrollment ID
                </div>
                <div className="approve-enrollment-panel__meta-value">#{approveTargetRow.id}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Grade Level
                </div>
                <div className="approve-enrollment-panel__meta-value">{approveTargetRow.gradeLevel}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Academic Year
                </div>
                <div className="approve-enrollment-panel__meta-value">{approveTargetRow.academicYear || "—"}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Payment Mode
                </div>
                <div className="approve-enrollment-panel__meta-value">{approveTargetRow.paymentMode || "—"}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Payment Method
                </div>
                <div className="approve-enrollment-panel__meta-value">{approveTargetRow.paymentMethod || "—"}</div>
              </div>

              <div>
                <div className="approve-enrollment-panel__meta-label">
                  Student Submitted Amount
                </div>
                <div className="approve-enrollment-panel__meta-value">
                  {Number(approveTargetRow.submittedPaymentAmount || 0) > 0
                    ? `Php ${Number(approveTargetRow.submittedPaymentAmount).toFixed(2)}`
                    : "—"}
                </div>
              </div>
            </div>

            <div className="approve-enrollment-panel__section">
              <div className="approve-enrollment-panel__section-title">
                Proof of Payment
              </div>

              {approveTargetRow.paymentProof?.proof_image_url ? (
                <img
                  src={approveTargetRow.paymentProof.proof_image_url}
                  alt="Proof of payment"
                  className="approve-enrollment-panel__proof-image"
                />
              ) : (
                <div className="approve-enrollment-panel__empty">
                  No payment proof image found.
                </div>
              )}
            </div>

            <div className="approve-enrollment-panel__field">
              <label className="approve-enrollment-panel__label">
                Payment Amount
              </label>
              <input
                type="number"
                step="0.01"
                min={Number(approveMinimumAmount || 0)}
                value={approveAmount}
                onChange={(e) => setApproveAmount(e.target.value)}
                onWheel={(e) => e.currentTarget.blur()}
                placeholder="Please confirm the payment amount before approval"
                className="approve-enrollment-panel__input"
              />
              {Number(approveMinimumAmount || 0) > 0 ? (
                <div className="approve-enrollment-panel__meta-label" style={{ marginTop: 6 }}>
                  Minimum required amount: Php {Number(approveMinimumAmount).toFixed(2)}
                </div>
              ) : null}
              {String(approveTargetRow?.raw?.payment_mode || "").trim().toLowerCase() === "cash" && Number(approveCashFullAmount || 0) > 0 ? (
                <div className="approve-enrollment-panel__meta-label" style={{ marginTop: 6 }}>
                  Cash mode full payment required: Php {Number(approveCashFullAmount).toFixed(2)}
                </div>
              ) : null}
            </div>
              <div className="approve-enrollment-panel__field">
              <label className="approve-enrollment-panel__label">
                Payment Method
              </label>
              <select
                value={approvePaymentMethod}
                onChange={(e) => setApprovePaymentMethod(e.target.value)}
                className="approve-enrollment-panel__select"
              >
                <option value="CASH">Cash</option>
                <option value="GCASH">GCash</option>
                <option value="BANK_TRANSFER">Bank Transfer</option>
                <option value="OTHER">Other</option>
              </select>
            </div>
            <div className="approve-enrollment-panel__field">
              <label className="approve-enrollment-panel__label">
                Admin Remarks
              </label>
              <textarea
                rows={3}
                value={approveRemarks}
                onChange={(e) => setApproveRemarks(e.target.value)}
                placeholder="Optional remarks..."
                className="approve-enrollment-panel__textarea"
              />
            </div>

            <div className="approve-enrollment-panel__actions">
              <button
                onClick={closeApproveDialog}
                className="approve-enrollment-panel__cancel"
              >
                Cancel
              </button>
              <button
                onClick={handleApproveConfirm}
                disabled={approveSubmitting}
                className="approve-enrollment-panel__submit"
              >
                {approveSubmitting ? "Approving..." : "Approve Enrollment"}
              </button>
            </div>
          </div>
        </div>
      )}

      <PreviewModal
        isOpen={enrollmentPreviewOpen}
        onClose={() => setEnrollmentPreviewOpen(false)}
        title="Enrollment Management Report"
        data={enrollmentPreviewData}
        columns={[
          { key: "Student Name", label: "Student Name" },
          { key: "Grade Level", label: "Grade Level" },
          { key: "Section", label: "Section" },
          { key: "Status", label: "Status" },
          { key: "Payment Method", label: "Payment Method" },
          { key: "Academic Year", label: "Academic Year" },
        ]}
        filename="Enrollment-Management-Report"
      />
    </div>
  );
}