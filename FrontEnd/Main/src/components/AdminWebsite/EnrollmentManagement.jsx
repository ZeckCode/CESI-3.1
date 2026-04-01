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
} from "lucide-react";

import StatCard, { StatsGrid } from "./StatCard";
import Pagination from "./Pagination";
import Toast from "../Global/Toast";
import "../AdminWebsiteCSS/EnrollmentManagement.css";
import { apiFetch } from "../api/apiFetch";

import {
  FILTER_OPTIONS,
  DOCUMENT_TYPE_OPTIONS,
} from "./Enrollment/enrollmentConstants";

import {
  gradeLabel,
  statusLabel,
  matchesStatusFilter,
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

import { StatusBadge, FeeBadge } from "./Enrollment/EnrollmentBadges";
import { StudentCell, ParentCell } from "./Enrollment/EnrollmentCells";
import { exportToPDF } from "./Enrollment/exportEnrollmentPDF";
import DeclineDialog from "./Enrollment/DeclineDialog";
import IdUploadModal from "./Enrollment/IdUploadModal";
import TableActionMenu from "./TableActionMenu";
import EnrollmentDetailsModal from "./Enrollment/EnrollmentDetailsModal";

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

  const [declineDialogOpen, setDeclineDialogOpen] = useState(false);
  const [declineTargetId, setDeclineTargetId] = useState(null);
  const [declineReason, setDeclineReason] = useState("");
  const [declineSubmitting, setDeclineSubmitting] = useState(false);

  // Payment Proof States
  const [proofs, setProofs] = useState([]);
  const [loadingProofs, setLoadingProofs] = useState(false);
  const [paymentProofModalOpen, setPaymentProofModalOpen] = useState(false);
  const [selectedProofId, setSelectedProofId] = useState(null);
  const [approvalRemarks, setApprovalRemarks] = useState("");
  const [isApprovingProof, setIsApprovingProof] = useState(false);
  const [isRejectingProof, setIsRejectingProof] = useState(false);

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
  };

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

  useEffect(() => {
    fetchEnrollments();
    fetchSettings();
    fetchSections();
    fetchProofs();
  }, [fetchSettings, fetchSections, fetchProofs]);

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

  const handleApproveProof = async () => {
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

  const handleRejectProof = async () => {
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

  const normalized = useMemo(
    () =>
      enrollments.map((e) => {
        const statusCode = String(e.status || "PENDING").toUpperCase();
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
          fee: e.payment_mode || "Pending",
          paymentMode: e.payment_mode || "—",
          paymentMethod: e.payment_method || "—",
          paymentProof: proofs.find(p => p.enrollment_id === e.id) || null,
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
    [enrollments, sections, proofs]
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

  const isReadOnly = (modalMode === "view" && editingId !== null);

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
    setEditingId(e.id);
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
    setEditingAcademicYear(false);
    setFormData({ ...emptyForm(), academic_year: window_.academicYear });
    setModalOpen(true);
  };

  const closeModal = () => {
    setModalOpen(false);
    setModalMode("view");
    setEditingId(null);
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
        addToast("Reset Failed", JSON.stringify(data), "error");
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
      return false;
    }

    return true;
  };

  const handleApprove = async (id) => {
    const row = normalized.find((r) => r.id === id);
    if (!row) return;
    if (!validateBeforeApprove(row)) return;

    try {
      const body = row.raw?.section ? { section: row.raw.section } : {};

      const res = await apiFetch(`/api/enrollments/${id}/mark_active/`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });

      let data = {};
      let text = "";

      try {
        data = await res.json();
      } catch {
        text = await res.text().catch(() => "");
      }

      if (!res.ok) {
        throw new Error(
          (data && data.detail) ||
            (data && data.error) ||
            text ||
            JSON.stringify(data) ||
            "Approval failed"
        );
      }

      await fetchEnrollments();
      addToast(
        "Approved",
        "Enrollment approved successfully. May now be processed to ID.",
        "success"
      );
    } catch (err) {
      addToast(
        "Approval Failed",
        err.message || "Could not approve enrollment.",
        "error"
      );
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

      addToast(
        "Enrollment Declined",
        "Enrollment was declined successfully.",
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
        addToast("Save Failed", JSON.stringify(data), "error");
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
      : "/api/enrollments/";

    try {
      const res = await apiFetch(url, {
        method: editingId ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
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
              <XCircle size={16} />
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
                    ? `Open — ${window_.daysLeft} day${
                        window_.daysLeft !== 1 ? "s" : ""
                      } left`
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
                    onChange={(e) =>
                      setDraft((p) => ({ ...p, open_date: e.target.value }))
                    }
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
                  {settingsSaving ? (
                    "Saving…"
                  ) : (
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
                <th>Enrollment Date</th>
                <th>Status</th>
                <th>Fee Status</th>
                <th>Payment Method</th>
                <th>Payment Proof</th>
                <th>Parent / Guardian</th>
                <th>Approve / Decline</th>
                <th>Actions</th>
              </tr>
            </thead>

            <tbody>
              {paginatedEnrollments.map((row) => (
                <tr key={row.id}>
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

                  <td>
                    {row.enrollmentDate
                      ? new Date(row.enrollmentDate).toLocaleDateString()
                      : "—"}
                  </td>

                  <td>
                    <StatusBadge code={row.statusCode} />
                  </td>

                  <td>
                    <FeeBadge fee={row.fee} />
                  </td>

                  <td>
                    <div style={{ fontSize: 12, color: "#475569", fontWeight: 500 }}>
                      {row.paymentMethod === "online" ? (
                        <span style={{ background: "#dbeafe", color: "#1e40af", padding: "3px 8px", borderRadius: 3, display: "inline-block" }}>
                          Online
                        </span>
                      ) : row.paymentMethod === "onsite" ? (
                        <span style={{ background: "#e0e7ff", color: "#4338ca", padding: "3px 8px", borderRadius: 3, display: "inline-block" }}>
                          Onsite
                        </span>
                      ) : (
                        <span style={{ color: "#94a3b8" }}>—</span>
                      )}
                      {" "}
                      {row.paymentMode === "cash" ? (
                        <span style={{ background: "#fef3c7", color: "#92400e", padding: "3px 8px", borderRadius: 3, display: "inline-block", marginLeft: 4 }}>
                          Cash
                        </span>
                      ) : row.paymentMode === "installment" ? (
                        <span style={{ background: "#fce7f3", color: "#831843", padding: "3px 8px", borderRadius: 3, display: "inline-block", marginLeft: 4 }}>
                          Installment
                        </span>
                      ) : null}
                    </div>
                  </td>

                  <td>
                    {row.paymentProof ? (
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: 4,
                          cursor: "pointer",
                        }}
                        onClick={() => {
                          setSelectedProofId(row.paymentProof.id);
                          setPaymentProofModalOpen(true);
                        }}
                      >
                        {row.paymentProof.proof_image_url ? (
                          <img
                            src={row.paymentProof.proof_image_url}
                            alt="Payment proof"
                            style={{
                              width: 40,
                              height: 40,
                              objectFit: "cover",
                              borderRadius: 3,
                              border: "1px solid #e2e8f0",
                            }}
                          />
                        ) : (
                          <div
                            style={{
                              width: 40,
                              height: 40,
                              background: "#f1f5f9",
                              borderRadius: 3,
                              display: "flex",
                              alignItems: "center",
                              justifyContent: "center",
                              fontSize: 10,
                              color: "#94a3b8",
                            }}
                          >
                            No IMG
                          </div>
                        )}
                        <span
                          style={{
                            fontSize: 11,
                            padding: "2px 6px",
                            background:
                              row.paymentProof.status === "approved"
                                ? "#dcfce7"
                                : row.paymentProof.status === "rejected"
                                ? "#fee2e2"
                                : "#fef3c7",
                            color:
                              row.paymentProof.status === "approved"
                                ? "#16a34a"
                                : row.paymentProof.status === "rejected"
                                ? "#dc2626"
                                : "#92400e",
                            borderRadius: 3,
                            fontWeight: 500,
                          }}
                        >
                          {row.paymentProof.status}
                        </span>
                      </div>
                    ) : (
                      <span style={{ color: "#94a3b8", fontSize: 12 }}>No proof</span>
                    )}
                  </td>

                  <td>
                    <ParentCell row={row} />
                  </td>

                  <td>
                    {row.statusCode === "PENDING" ? (
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
                      <TableActionMenu
                        row={row}
                        gradeLabel={gradeLabel}
                        getNextGrade={getNextGrade}
                        onEdit={() => openModal(row, "edit")}
                        onDelete={() => handleDeleteEnrollment(row.id)}
                        onIdUpload={() => openIdUploadModal(row)}
                        onPromote={() => handlePromote(row)}
                      />
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
        onClose={closeIdUploadModal}
        onSelectImage={handleIdImageSelect}
        onClearImage={() => {
          setIdUploadFile(null);
          setIdUploadPreview(null);
        }}
        onUpload={handleUploadIdImage}
      />

      {/* Payment Proof Approval Modal */}
      {paymentProofModalOpen && selectedProofId && (
        <div style={{
          position: "fixed",
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
          background: "rgba(0, 0, 0, 0.5)",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          zIndex: 1000,
        }} onClick={() => setPaymentProofModalOpen(false)}>
          <div style={{
            background: "#fff",
            borderRadius: 8,
            boxShadow: "0 10px 40px rgba(0, 0, 0, 0.2)",
            maxWidth: 600,
            width: "90%",
            maxHeight: "80vh",
            overflow: "auto",
            padding: 24,
          }} onClick={(e) => e.stopPropagation()}>
            <div style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 20,
              borderBottom: "1px solid #e2e8f0",
              paddingBottom: 16,
            }}>
              <h3 style={{ margin: 0, fontSize: 18, fontWeight: 600, color: "#1e293b" }}>
                Review Payment Proof
              </h3>
              <button
                onClick={() => setPaymentProofModalOpen(false)}
                style={{
                  background: "none",
                  border: "none",
                  fontSize: 20,
                  cursor: "pointer",
                  color: "#64748b",
                }}
              >
                ×
              </button>
            </div>

            {(() => {
              const proof = proofs.find(p => p.id === selectedProofId);
              if (!proof) return <div>Proof not found</div>;

              return (
                <div>
                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}>
                      Student Name
                    </label>
                    <div style={{ fontSize: 14, color: "#1e293b" }}>
                      {proof.student_name || "N/A"}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}>
                      Reference Number
                    </label>
                    <div style={{ fontSize: 14, color: "#1e293b" }}>
                      {proof.reference_number}
                    </div>
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      marginBottom: 8,
                    }}>
                      Payment Proof Image
                    </label>
                    {proof.proof_image_url ? (
                      <img
                        src={proof.proof_image_url}
                        alt="Payment proof"
                        style={{
                          width: "100%",
                          maxHeight: 300,
                          objectFit: "contain",
                          borderRadius: 6,
                          border: "1px solid #e2e8f0",
                        }}
                      />
                    ) : (
                      <div style={{
                        width: "100%",
                        height: 200,
                        background: "#f1f5f9",
                        borderRadius: 6,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        color: "#94a3b8",
                      }}>
                        No image available
                      </div>
                    )}
                  </div>

                  <div style={{ marginBottom: 16 }}>
                    <label style={{
                      display: "block",
                      fontSize: 12,
                      fontWeight: 600,
                      color: "#64748b",
                      textTransform: "uppercase",
                      marginBottom: 4,
                    }}>
                      Admin Remarks
                    </label>
                    <textarea
                      value={approvalRemarks}
                      onChange={(e) => setApprovalRemarks(e.target.value)}
                      placeholder="Enter remarks (optional)"
                      style={{
                        width: "100%",
                        padding: 10,
                        border: "1px solid #e2e8f0",
                        borderRadius: 4,
                        fontSize: 13,
                        fontFamily: "inherit",
                        minHeight: 80,
                        resize: "vertical",
                      }}
                    />
                  </div>

                  <div style={{
                    display: "flex",
                    gap: 12,
                    marginTop: 24,
                    borderTop: "1px solid #e2e8f0",
                    paddingTop: 16,
                  }}>
                    <button
                      onClick={() => setPaymentProofModalOpen(false)}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        border: "1px solid #e2e8f0",
                        background: "#f8fafc",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: "pointer",
                        color: "#475569",
                        transition: "all 0.2s",
                      }}
                      onHover={(e) => {
                        e.currentTarget.style.background = "#f1f5f9";
                      }}
                    >
                      Cancel
                    </button>
                    <button
                      onClick={handleRejectProof}
                      disabled={isRejectingProof}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        border: "1px solid #fca5a5",
                        background: "#fee2e2",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: isRejectingProof ? "not-allowed" : "pointer",
                        color: "#dc2626",
                        opacity: isRejectingProof ? 0.6 : 1,
                        transition: "all 0.2s",
                      }}
                    >
                      {isRejectingProof ? "Rejecting..." : "Reject"}
                    </button>
                    <button
                      onClick={handleApproveProof}
                      disabled={isApprovingProof}
                      style={{
                        flex: 1,
                        padding: "10px 16px",
                        border: "1px solid #86efac",
                        background: "#dcfce7",
                        borderRadius: 4,
                        fontSize: 13,
                        fontWeight: 500,
                        cursor: isApprovingProof ? "not-allowed" : "pointer",
                        color: "#16a34a",
                        opacity: isApprovingProof ? 0.6 : 1,
                        transition: "all 0.2s",
                      }}
                    >
                      {isApprovingProof ? "Approving..." : "Approve"}
                    </button>
                  </div>
                </div>
              );
            })()}
          </div>
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
    </div>
  );
}