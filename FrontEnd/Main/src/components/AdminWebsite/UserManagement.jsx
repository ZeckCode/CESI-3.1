import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Search, Filter, Users,
  BookOpen, GraduationCap, Save, X, UserCheck, UserX, RefreshCw, ArrowRightLeft, FileUp, Trash2,
} from 'lucide-react';
import { apiFetch } from '../api/apiFetch';
import Toast from '../Global/Toast';
import StatCard, { StatsGrid } from './StatCard';
import Pagination from './Pagination';
import '../AdminWebsiteCSS/UserManagement.css';

/* ─────────────────────────────────────────────
   EMAIL FORMATTING & VALIDATION HELPERS
───────────────────────────────────────────── */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const isValidTeacherEmail = (email) => {
  const normalized = normalizeEmail(email);
  return /^[a-z0-9]+\.[a-z0-9]+@cesi\.edu\.ph$/.test(normalized);
};

const UserManagement = () => {
  // ── data ──
  const [students, setStudents] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [activeEnrollments, setActiveEnrollments] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [sections, setSections] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [lastUpdated, setLastUpdated] = useState(null);

  // ── UI ──
  const [activeTab, setActiveTab] = useState('students');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterStatus, setFilterStatus] = useState('All');
  const [transferDecisionFilter, setTransferDecisionFilter] = useState('All');
  const [studentPage, setStudentPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const [transferPage, setTransferPage] = useState(1);
  const ITEMS_PER_PAGE = 10;
  const SKELETON_ROW_COUNT = 6;

  // create teacher modal
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '', email: '', password: '',
    subjects: [''], section_teacher: '', employee_id: '',
  });
  const [createError, setCreateError] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [creating, setCreating] = useState(false);

  // inline assignment editing (teachers)
  const [editingId, setEditingId] = useState(null);
  const [assignForm, setAssignForm] = useState({ subjects: [''], section: '', employee_id: '' });
  const [assignError, setAssignError] = useState('');

  // student edit modal
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({});
  const [studentEditError, setStudentEditError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);
  const [showTransferForm, setShowTransferForm] = useState(false);
  const [transferStudent, setTransferStudent] = useState(null);
  const [transferForm, setTransferForm] = useState({
    decision: 'PENDING',
    transfer_date: '',
    transfer_reason: '',
    destination_school_name: '',
    destination_school_address: '',
    destination_school_contact: '',
    transfer_reference_number: '',
    transfer_notes: '',
    allow_transfer_with_balance: false,
    transfer_clearance: null,
  });
  const [transferError, setTransferError] = useState('');
  const [savingTransfer, setSavingTransfer] = useState(false);
  const [deleteTargetUser, setDeleteTargetUser] = useState(null);
  const [deletingUser, setDeletingUser] = useState(false);
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

  // ── fetchers ──
  // Helper to accept either raw array responses or paginated { results: [...] }
  const parseListResponse = async (res) => {
    try {
      const contentType = (res.headers && res.headers.get ? res.headers.get('content-type') : '') || '';
      let data = null;
      if (contentType.includes('application/json')) {
        data = await res.json().catch(() => null);
      } else {
        data = await res.text().catch(() => null);
      }

      if (Array.isArray(data)) return data;
      if (data && Array.isArray(data.results)) return data.results;
      if (data && Array.isArray(data.data)) return data.data;
      if (data && Array.isArray(data.items)) return data.items;
      // Unexpected shape: log for debugging and return empty list
      console.warn('parseListResponse: unexpected response shape', data);
      return [];
    } catch (err) {
      console.error('parseListResponse error', err);
      return [];
    }
  };

  const fetchStudents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/users/?role=PARENT_STUDENT');
      if (res.ok) setStudents(await parseListResponse(res));
      else {
        const err = await res.json().catch(() => null);
        console.error('fetchStudents failed', res.status, err);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/users/?role=TEACHER');
      if (res.ok) setTeachers(await parseListResponse(res));
      else {
        const err = await res.json().catch(() => null);
        console.error('fetchTeachers failed', res.status, err);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchActiveEnrollments = useCallback(async () => {
    try {
      const res = await apiFetch('/api/enrollments/?status=ACTIVE');
      if (res.ok) setActiveEnrollments(await parseListResponse(res));
      else {
        const err = await res.json().catch(() => null);
        console.error('fetchActiveEnrollments failed', res.status, err);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/subjects/');
      if (res.ok) setSubjects(await parseListResponse(res));
      else {
        const err = await res.json().catch(() => null);
        console.error('fetchSubjects failed', res.status, err);
      }
    } catch (e) { console.error(e); }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/sections/');
      if (res.ok) setSections(await parseListResponse(res));
      else {
        const err = await res.json().catch(() => null);
        console.error('fetchSections failed', res.status, err);
      }
    } catch (e) { console.error(e); }
  }, []);

  const refreshAll = useCallback(async (showSpinner = false) => {
    if (showSpinner) setRefreshing(true);
    try {
      await Promise.all([fetchStudents(), fetchTeachers(), fetchActiveEnrollments(), fetchSubjects(), fetchSections()]);
      setLastUpdated(new Date());
    } finally {
      if (showSpinner) setRefreshing(false);
    }
  }, [fetchStudents, fetchTeachers, fetchActiveEnrollments, fetchSubjects, fetchSections]);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await refreshAll(false);
      setLoading(false);
    })();
  }, [refreshAll]);

  useEffect(() => {
    // Keep user/teacher tables synced with backend edits from other modules.
    const intervalId = window.setInterval(() => {
      refreshAll(false);
    }, 15000);

    const onFocus = () => refreshAll(false);
    const onVisible = () => {
      if (document.visibilityState === 'visible') refreshAll(false);
    };

    window.addEventListener('focus', onFocus);
    document.addEventListener('visibilitychange', onVisible);

    return () => {
      window.clearInterval(intervalId);
      window.removeEventListener('focus', onFocus);
      document.removeEventListener('visibilitychange', onVisible);
    };
  }, [refreshAll]);

  // ── helpers ──
  const studentName = (u) => {
    const p = u.profile;
    if (!p) return u.username;
    return `${p.student_first_name} ${p.student_last_name}`;
  };
    const gradeLabelFromProfile = (raw) => {
    if (raw == null) return "—";

    const v = String(raw).trim();

    // Already pretty labels
    const pretty = new Set([
      "Pre-Kinder", "Kinder",
      "Grade 1", "Grade 2", "Grade 3", "Grade 4", "Grade 5", "Grade 6",
    ]);
    if (pretty.has(v)) return v;

    // Numeric legacy: "1".."6"
    if (/^\d+$/.test(v)) return `Grade ${v}`;

    // Code-based: prek/kinder/grade1..grade6
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
      const key = v.toLowerCase();
      return map[key] || v; // fallback: show whatever it is
    };

  const parentName = (u) => {
    const p = u.profile;
    if (!p) return '—';
    return `${p.parent_first_name} ${p.parent_last_name}`;
  };

  const activeEnrollmentMaps = useMemo(() => {
    const byParentUser = new Map();

    activeEnrollments.forEach((e) => {
      if (e.parent_user) byParentUser.set(e.parent_user, e);
    });

    return { byParentUser };
  }, [activeEnrollments]);

  const enrollmentForUser = (u) => {
    return activeEnrollmentMaps.byParentUser.get(u.id) || null;
  };

  const sectionById = useMemo(() => {
    const m = new Map();
    sections.forEach((s) => m.set(s.id, s));
    return m;
  }, [sections]);

  const studentNameDisplay = (u) => {
    const p = u.profile;
    if (p?.student_first_name || p?.student_last_name) {
      return `${p.student_first_name || ''} ${p.student_last_name || ''}`.trim();
    }
    const e = enrollmentForUser(u);
    if (e?.first_name || e?.last_name) {
      return `${e.first_name || ''} ${e.last_name || ''}`.trim();
    }
    return u.username;
  };

  const studentGradeDisplay = (u) => {
    const pGrade = u.profile?.grade_level;
    if (pGrade) return gradeLabelFromProfile(pGrade);
    const e = enrollmentForUser(u);
    return e?.grade_level ? gradeLabelFromProfile(e.grade_level) : '—';
  };

  const studentSectionDisplay = (u) => {
    const pSection = u.profile?.section;
    if (pSection?.name) return pSection.name;
    const e = enrollmentForUser(u);
    const sec = e?.section ? sectionById.get(e.section) : null;
    return sec?.name || '—';
  };

  const parentNameDisplay = (u) => {
    const p = u.profile;
    if (p?.parent_first_name || p?.parent_last_name) {
      return `${p.parent_first_name || ''} ${p.parent_last_name || ''}`.trim();
    }
    const e = enrollmentForUser(u);
    const pi = e?.parent_info;
    const fallback = pi?.guardian_name || pi?.mother_name || pi?.father_name;
    return fallback || '—';
  };

  const contactDisplay = (u) => {
    const pContact = u.profile?.contact_number;
    if (pContact) return pContact;
    const e = enrollmentForUser(u);
    return e?.mobile_number || e?.telephone_number || '—';
  };

  const sectionLabel = (section) => {
    if (!section) return '—';
    const prefix = Number(section.grade_level) === 0 ? 'K' : `G${section.grade_level}`;
    return `${prefix} – ${section.name}`;
  };

  const teacherSubjects = (teacher) => {
    const multi = Array.isArray(teacher?.teacher_profile?.subjects)
      ? teacher.teacher_profile.subjects
      : [];
    if (multi.length > 0) return multi;

    const legacy = teacher?.teacher_profile?.subject;
    return legacy ? [legacy] : [];
  };

  const normalizeSubjectIds = (subjectIds) => {
    const values = (subjectIds || [])
      .map((id) => Number(id))
      .filter((id) => Number.isInteger(id) && id > 0);
    return [...new Set(values)];
  };

  const extractErrorMessage = (payload, fallback = 'Request failed.') => {
    if (!payload) return fallback;

    const stringifyValue = (value) => {
      if (!value) return '';
      if (Array.isArray(value)) return value.join(' ');
      if (typeof value === 'string') return value;
      return '';
    };

    return (
      stringifyValue(payload.detail)
      || stringifyValue(payload.non_field_errors)
      || stringifyValue(payload.subjects)
      || stringifyValue(payload.subject)
      || stringifyValue(payload.section)
      || stringifyValue(payload.section_teacher)
      || stringifyValue(payload.email)
      || stringifyValue(payload.errors?.detail)
      || fallback
    );
  };

  const addSubjectPicker = (setter) => {
    setter((prev) => ({
      ...prev,
      subjects: [...(prev.subjects || []), ''],
    }));
  };

  const updateSubjectPicker = (setter, index, value) => {
    setter((prev) => {
      const next = [...(prev.subjects || [''])];
      next[index] = value;
      return { ...prev, subjects: next };
    });
  };

  const removeSubjectPicker = (setter, index) => {
    setter((prev) => {
      const next = [...(prev.subjects || [''])];
      next.splice(index, 1);
      return { ...prev, subjects: next.length ? next : [''] };
    });
  };

  const isSubjectOptionDisabled = (selectedIds, candidateId, currentIndex) => {
    return (selectedIds || []).some(
      (id, idx) => idx !== currentIndex && String(id) === String(candidateId)
    );
  };

  const normalizedStatus = (value) => String(value || 'INACTIVE').toUpperCase();
  const normalizedTransferStatus = (value) => String(value || 'NONE').toUpperCase();

  // ── filter ──
  const filteredStudents = students.filter((u) => {
    const name = studentName(u).toLowerCase();
    const parent = parentName(u).toLowerCase();
    const matchSearch =
      name.includes(searchTerm.toLowerCase()) ||
      parent.includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
    const statusCode = normalizedStatus(u.status);
    const matchStatus = filterStatus === 'All' || statusCode === filterStatus.toUpperCase();
    return matchSearch && matchStatus;
  });

  const filteredTeachers = teachers.filter((u) => {
    const subjectName = teacherSubjects(u).map((s) => s?.name || '').join(' ');
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subjectName.toLowerCase().includes(searchTerm.toLowerCase());
    const statusCode = normalizedStatus(u.status);
    const matchStatus = filterStatus === 'All' || statusCode === filterStatus.toUpperCase();
    return matchSearch && matchStatus;
  });

  const transferRequests = students.filter((u) => normalizedTransferStatus(u.profile?.transfer_status) !== 'NONE');

  const filteredTransferRequests = transferRequests.filter((u) => {
    const transferStatus = normalizedTransferStatus(u.profile?.transfer_status);
    const matchStatus = transferDecisionFilter === 'All' || transferStatus === transferDecisionFilter.toUpperCase();

    const haystack = [
      studentNameDisplay(u),
      parentNameDisplay(u),
      u.email,
      u.profile?.destination_school_name,
      u.profile?.transfer_reason,
      u.profile?.transfer_reference_number,
    ]
      .filter(Boolean)
      .join(' ')
      .toLowerCase();

    const matchSearch = haystack.includes(searchTerm.toLowerCase());
    return matchStatus && matchSearch;
  });

  // ── pagination slicing ──
  const studentTotalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * ITEMS_PER_PAGE, studentPage * ITEMS_PER_PAGE);
  const teacherTotalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE);
  const paginatedTeachers = filteredTeachers.slice((teacherPage - 1) * ITEMS_PER_PAGE, teacherPage * ITEMS_PER_PAGE);
  const transferTotalPages = Math.ceil(filteredTransferRequests.length / ITEMS_PER_PAGE);
  const paginatedTransfers = filteredTransferRequests.slice((transferPage - 1) * ITEMS_PER_PAGE, transferPage * ITEMS_PER_PAGE);

  // reset page on filter/search/tab changes
  useEffect(() => { setStudentPage(1); setTeacherPage(1); setTransferPage(1); }, [searchTerm, filterStatus, transferDecisionFilter, activeTab]);

  // ── create teacher ──
  const handleCreateTeacher = async () => {
    setCreateError('');
    setEmailHint('');
    if (!createForm.username || !createForm.email || !createForm.password) {
      const msg = 'Username, email and password are required.';
      setCreateError(msg);
      addToast('Validation Error', msg, 'error');
      return;
    }
    if (!isValidTeacherEmail(createForm.email)) {
      const msg = 'Email must follow teacher format: firstname.lastname@cesi.edu.ph';
      setCreateError(msg);
      addToast('Invalid Email', msg, 'error');
      return;
    }
    setCreating(true);
    try {
      const body = {
        username: createForm.username,
        email: createForm.email,
        password: createForm.password,
        role: 'TEACHER',
        employee_id: createForm.employee_id || '',
      };
      const subjectIds = normalizeSubjectIds(createForm.subjects);
      if (subjectIds.length > 0) {
        body.subjects = subjectIds;
      }
      if (createForm.section_teacher) body.section_teacher = parseInt(createForm.section_teacher);

      const res = await apiFetch('/api/accounts/admin/create-user/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(extractErrorMessage(data, 'Failed to create teacher.'));
      }
      addToast('Success', 'Teacher created successfully!', 'success');
      setShowCreateForm(false);
      setCreateForm({ username: '', email: '', password: '', subjects: [''], section_teacher: '', employee_id: '' });
      await fetchTeachers();
    } catch (e) {
      setCreateError(e.message);
      addToast('Error', e.message, 'error');
    } finally {
      setCreating(false);
    }
  };

  // ── student edit ──
  const openStudentEdit = (u) => {
    const p = u.profile || {};
    setEditingStudent(u);
    setStudentForm({
      student_first_name: p.student_first_name || '',
      student_middle_name: p.student_middle_name || '',
      student_last_name: p.student_last_name || '',
      grade_level: p.grade_level || '',
      lrn: p.lrn || '',
      section: p.section?.id || '',
      parent_first_name: p.parent_first_name || '',
      parent_middle_name: p.parent_middle_name || '',
      parent_last_name: p.parent_last_name || '',
      contact_number: p.contact_number || '',
      email: u.email || '',
    });
    setStudentEditError('');
  };

  const closeStudentEdit = () => {
    setEditingStudent(null);
    setStudentEditError('');
  };

  const handleSaveStudent = async () => {
    setStudentEditError('');
    if (!studentForm.student_first_name || !studentForm.student_last_name) {
      const msg = 'Student first and last name are required.';
      setStudentEditError(msg);
      addToast('Validation Error', msg, 'error');
      return;
    }
    setSavingStudent(true);
    try {
      const body = { ...studentForm };
      body.section = body.section ? parseInt(body.section) : null;
      const res = await apiFetch(`/api/accounts/users/${editingStudent.id}/update-student/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err.detail || JSON.stringify(err));
      }
      addToast('Success', 'Student information updated successfully!', 'success');
      closeStudentEdit();
      fetchStudents();
    } catch (e) {
      setStudentEditError(e.message);
      addToast('Error', e.message, 'error');
    } finally {
      setSavingStudent(false);
    }
  };

  const openTransferModal = (u) => {
    const p = u?.profile || {};
    const status = normalizedTransferStatus(p.transfer_status);
    const normalizedDecision = ["PENDING", "APPROVED", "REJECTED"].includes(status) ? status : "PENDING";
    setTransferStudent(u);
    setTransferError('');
    setTransferForm({
      decision: normalizedDecision,
      transfer_date: p.transfer_date || '',
      transfer_reason: p.transfer_reason || '',
      destination_school_name: p.destination_school_name || '',
      destination_school_address: p.destination_school_address || '',
      destination_school_contact: p.destination_school_contact || '',
      transfer_reference_number: p.transfer_reference_number || '',
      transfer_notes: p.transfer_notes || '',
      allow_transfer_with_balance: Boolean(p.allow_transfer_with_balance),
      transfer_clearance: null,
    });
    setShowTransferForm(true);
  };

  const closeTransferModal = () => {
    setShowTransferForm(false);
    setTransferStudent(null);
    setTransferError('');
  };

  const formatDateTime = (value) => {
    if (!value) return '—';
    const dt = new Date(value);
    if (Number.isNaN(dt.getTime())) return '—';
    return dt.toLocaleString();
  };

  const submitTransferDecision = async () => {
    if (!transferStudent) return;

    setTransferError('');
    setSavingTransfer(true);
    try {
      const formData = new FormData();
      formData.append('decision', transferForm.decision);
      if (transferForm.transfer_date) formData.append('transfer_date', transferForm.transfer_date);
      formData.append('transfer_reason', transferForm.transfer_reason || '');
      formData.append('destination_school_name', transferForm.destination_school_name || '');
      formData.append('destination_school_address', transferForm.destination_school_address || '');
      formData.append('destination_school_contact', transferForm.destination_school_contact || '');
      formData.append('transfer_reference_number', transferForm.transfer_reference_number || '');
      formData.append('transfer_notes', transferForm.transfer_notes || '');
      formData.append('allow_transfer_with_balance', transferForm.allow_transfer_with_balance ? 'true' : 'false');
      if (transferForm.transfer_clearance) {
        formData.append('transfer_clearance', transferForm.transfer_clearance);
      }

      const res = await apiFetch(`/api/accounts/users/${transferStudent.id}/transfer/`, {
        method: 'POST',
        body: formData,
      });

      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to save transfer decision.'));
      }

      addToast('Success', 'Transfer decision saved successfully.', 'success');
      closeTransferModal();
      await fetchStudents();
    } catch (e) {
      setTransferError(e.message);
      addToast('Error', e.message, 'error');
    } finally {
      setSavingTransfer(false);
    }
  };

  const printTransferClearance = () => {
    if (!transferStudent) {
      addToast('Print Error', 'No selected student for clearance printing.', 'error');
      return;
    }

    const student = studentNameDisplay(transferStudent) || 'N/A';
    const grade = studentGradeDisplay(transferStudent) || 'N/A';
    const section = studentSectionDisplay(transferStudent) || 'N/A';
    const parent = parentNameDisplay(transferStudent) || 'N/A';
    const dateValue = transferForm.transfer_date || new Date().toISOString().slice(0, 10);
    const decisionLabel = transferForm.decision === 'APPROVED'
      ? 'Approved'
      : transferForm.decision === 'REJECTED'
        ? 'Rejected'
        : 'Pending';

    const printWindow = window.open('', '_blank', 'width=900,height=1200');
    if (!printWindow) {
      addToast('Print Blocked', 'Enable pop-ups to print transfer clearance.', 'warning');
      return;
    }

    const escapeHtml = (value) => String(value || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#039;');

    const html = `
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8" />
        <title>Transfer Clearance - ${escapeHtml(student)}</title>
        <style>
          body { font-family: Arial, sans-serif; margin: 28px; color: #111827; }
          .header { text-align: center; margin-bottom: 24px; }
          .header h1 { margin: 0 0 6px; font-size: 22px; }
          .header p { margin: 0; color: #4b5563; }
          .card { border: 1px solid #d1d5db; border-radius: 8px; padding: 16px; margin-bottom: 16px; }
          .grid { display: grid; grid-template-columns: 1fr 1fr; gap: 10px 16px; }
          .row { margin: 8px 0; }
          .label { color: #4b5563; font-size: 12px; margin-bottom: 2px; }
          .value { font-size: 14px; font-weight: 600; white-space: pre-wrap; word-break: break-word; }
          .full { grid-column: 1 / -1; }
          .signatures { margin-top: 28px; display: grid; grid-template-columns: 1fr 1fr; gap: 30px; }
          .sig-line { border-top: 1px solid #111827; margin-top: 38px; padding-top: 6px; font-size: 12px; color: #374151; }
          @media print {
            body { margin: 12mm; }
          }
        </style>
      </head>
      <body>
        <div class="header">
          <h1>Caloocan Evangelical School Inc.</h1>
          <p>Student Transfer Clearance</p>
        </div>

        <div class="card">
          <div class="grid">
            <div>
              <div class="label">Student Name</div>
              <div class="value">${escapeHtml(student)}</div>
            </div>
            <div>
              <div class="label">Clearance Date</div>
              <div class="value">${escapeHtml(dateValue)}</div>
            </div>
            <div>
              <div class="label">Grade Level</div>
              <div class="value">${escapeHtml(grade)}</div>
            </div>
            <div>
              <div class="label">Section</div>
              <div class="value">${escapeHtml(section)}</div>
            </div>
            <div>
              <div class="label">Parent / Guardian</div>
              <div class="value">${escapeHtml(parent)}</div>
            </div>
            <div>
              <div class="label">Decision</div>
              <div class="value">${escapeHtml(decisionLabel)}</div>
            </div>
            <div class="full">
              <div class="label">Destination School</div>
              <div class="value">${escapeHtml(transferForm.destination_school_name || 'N/A')}</div>
            </div>
            <div class="full">
              <div class="label">Destination Address</div>
              <div class="value">${escapeHtml(transferForm.destination_school_address || 'N/A')}</div>
            </div>
            <div>
              <div class="label">Destination Contact</div>
              <div class="value">${escapeHtml(transferForm.destination_school_contact || 'N/A')}</div>
            </div>
            <div>
              <div class="label">Reference Number</div>
              <div class="value">${escapeHtml(transferForm.transfer_reference_number || 'N/A')}</div>
            </div>
            <div class="full">
              <div class="label">Reason for Transfer</div>
              <div class="value">${escapeHtml(transferForm.transfer_reason || 'N/A')}</div>
            </div>
            <div class="full">
              <div class="label">Admin Notes</div>
              <div class="value">${escapeHtml(transferForm.transfer_notes || 'N/A')}</div>
            </div>
          </div>
        </div>

        <div class="signatures">
          <div>
            <div class="sig-line">Prepared by (Admin)</div>
          </div>
          <div>
            <div class="sig-line">Parent / Guardian Signature</div>
          </div>
        </div>
      </body>
      </html>
    `;

    printWindow.document.open();
    printWindow.document.write(html);
    printWindow.document.close();
    printWindow.focus();
    printWindow.print();
  };

  const openDeleteUserModal = (u) => {
    setDeleteTargetUser(u);
  };

  const closeDeleteUserModal = () => {
    if (deletingUser) return;
    setDeleteTargetUser(null);
  };

  const handleDeleteUser = async () => {
    if (!deleteTargetUser) return;
    const displayName = studentNameDisplay(deleteTargetUser) || deleteTargetUser.username || `ID ${deleteTargetUser.id}`;

    try {
      setDeletingUser(true);
      const res = await apiFetch(`/api/accounts/users/${deleteTargetUser.id}/`, { method: 'DELETE' });
      const payload = await res.json().catch(() => ({}));
      if (!res.ok) {
        throw new Error(extractErrorMessage(payload, 'Failed to delete user.'));
      }
      addToast('Deleted', `${displayName} and related records were deleted.`, 'success');
      setDeleteTargetUser(null);
      await refreshAll(true);
    } catch (e) {
      addToast('Delete Failed', e.message, 'error');
    } finally {
      setDeletingUser(false);
    }
  };

  // ── inline assignment ──
  const startEdit = (teacher) => {
    const existingSubjectIds = teacherSubjects(teacher)
      .map((s) => s?.id)
      .filter((id) => id !== null && id !== undefined)
      .map((id) => String(id));

    setEditingId(teacher.id);
    setAssignForm({
      subjects: existingSubjectIds.length ? existingSubjectIds : [''],
      section: teacher.teacher_profile?.section?.id || '',
      employee_id: teacher.teacher_profile?.employee_id || '',
    });
    setAssignError('');
  };

  const cancelEdit = () => { setEditingId(null); setAssignError(''); };

  const saveAssignment = async (userId) => {
    setAssignError('');
    try {
      const body = {
        subjects: normalizeSubjectIds(assignForm.subjects),
        section: assignForm.section ? parseInt(assignForm.section) : null,
        employee_id: assignForm.employee_id || '',
      };
      const res = await apiFetch(`/api/accounts/users/${userId}/assign/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(extractErrorMessage(err, 'Failed to update teacher assignment.'));
      }
      addToast('Success', 'Teacher assignment updated successfully!', 'success');
      setEditingId(null);
      await fetchTeachers();
    } catch (e) {
      setAssignError(e.message);
      addToast('Error', e.message, 'error');
    }
  };

  // ── stats ──
  const studentStats = {
    total: students.length,
    active: students.filter((s) => s.status === 'ACTIVE').length,
    inactive: students.filter((s) => s.status !== 'ACTIVE').length,
  };
  const teacherStats = {
    total: teachers.length,
    active: teachers.filter((t) => t.status === 'ACTIVE').length,
    assigned: teachers.filter((t) => teacherSubjects(t).length > 0).length,
  };
  const transferStats = {
    total: transferRequests.length,
    pending: transferRequests.filter((s) => normalizedTransferStatus(s.profile?.transfer_status) === 'PENDING').length,
    approved: transferRequests.filter((s) => normalizedTransferStatus(s.profile?.transfer_status) === 'APPROVED').length,
    rejected: transferRequests.filter((s) => normalizedTransferStatus(s.profile?.transfer_status) === 'REJECTED').length,
  };

  const skeletonColumnCount = activeTab === 'teachers' ? 7 : 9;

  const renderSkeletonRows = (columnCount) => (
    Array.from({ length: SKELETON_ROW_COUNT }).map((_, rowIdx) => (
      <tr key={`skeleton-row-${rowIdx}`}>
        {Array.from({ length: columnCount }).map((__, colIdx) => (
          <td key={`skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`skeleton-line ${
                colIdx === 0 ? 'w-lg' : colIdx === columnCount - 1 ? 'w-sm' : 'w-md'
              }`}
            />
          </td>
        ))}
      </tr>
    ))
  );

  if (loading) {
    return (
      <div className="user-management">
        <div className="user-header skeleton-header-row">
          <div className="skeleton-line w-xl" />
          <div className="skeleton-header-actions">
            <div className="skeleton-line w-md" />
            <div className="skeleton-line w-sm" />
          </div>
        </div>

        <StatsGrid>
          <div className="stat-card skeleton-stat-card">
            <div className="skeleton-line w-sm" />
            <div className="skeleton-line w-xs" />
          </div>
          <div className="stat-card skeleton-stat-card">
            <div className="skeleton-line w-sm" />
            <div className="skeleton-line w-xs" />
          </div>
          <div className="stat-card skeleton-stat-card">
            <div className="skeleton-line w-sm" />
            <div className="skeleton-line w-xs" />
          </div>
        </StatsGrid>

        <div className="user-controls skeleton-controls">
          <div className="skeleton-line w-full" />
          <div className="skeleton-line w-full" />
        </div>

        <div className="users-container skeleton-container">
          <div className="users-table-scroll-hint">Loading user table...</div>
          <table className="users-table users-table-skeleton" aria-hidden="true">
            <thead>
              <tr>
                {Array.from({ length: skeletonColumnCount }).map((_, idx) => (
                  <th key={`skeleton-head-${idx}`}>
                    <div className="skeleton-line skeleton-header-line" />
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {renderSkeletonRows(skeletonColumnCount)}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  return (
    <div className="user-management">
      {/* Header */}
      <div className="user-header">
        <div className="tabs-container">
          <button
            className={`tab-btn ${activeTab === 'students' ? 'active' : ''}`}
            aria-label="Students"
            onClick={() => { setActiveTab('students'); setSearchTerm(''); setFilterStatus('All'); }}
          >
            <GraduationCap size={18} /> <span className="tab-btn-text">Students ({studentStats.total})</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`}
            aria-label="Teachers"
            onClick={() => { setActiveTab('teachers'); setSearchTerm(''); setFilterStatus('All'); }}
          >
            <BookOpen size={18} /> <span className="tab-btn-text">Teachers ({teacherStats.total})</span>
          </button>
          <button
            className={`tab-btn ${activeTab === 'transfers' ? 'active' : ''}`}
            aria-label="Transfer Requests"
            onClick={() => { setActiveTab('transfers'); setSearchTerm(''); setTransferDecisionFilter('All'); }}
          >
            <ArrowRightLeft size={18} /> <span className="tab-btn-text">Transfer Requests ({transferStats.total})</span>
          </button>
        </div>
        {activeTab === 'teachers' && (
          <div className="user-header-actions">
            <button className="btn-primary header-btn btn-add-teacher" onClick={() => setShowCreateForm(true)} aria-label="Add new teacher">
              <Plus size={18} /> <span className="header-btn-text">Add New Teacher</span>
            </button>
            <button className="btn-secondary header-btn btn-refresh" onClick={() => refreshAll(true)} disabled={refreshing} title="Refresh latest data from database" aria-label={refreshing ? 'Refreshing data' : 'Refresh data'}>
              <RefreshCw size={16} /> <span className="header-btn-text">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        )}
        {activeTab === 'students' && (
          <div className="user-header-actions single-action">
            <button className="btn-secondary header-btn btn-refresh" onClick={() => refreshAll(true)} disabled={refreshing} title="Refresh latest data from database" aria-label={refreshing ? 'Refreshing data' : 'Refresh data'}>
              <RefreshCw size={16} /> <span className="header-btn-text">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        )}
        {activeTab === 'transfers' && (
          <div className="user-header-actions single-action">
            <button className="btn-secondary header-btn btn-refresh" onClick={() => refreshAll(true)} disabled={refreshing} title="Refresh latest transfer requests from database" aria-label={refreshing ? 'Refreshing data' : 'Refresh data'}>
              <RefreshCw size={16} /> <span className="header-btn-text">{refreshing ? 'Refreshing…' : 'Refresh'}</span>
            </button>
          </div>
        )}
      </div>
      {lastUpdated && (
        <div style={{ fontSize: 12, color: '#64748b', marginTop: -8, marginBottom: 10 }}>
          Last synced: {lastUpdated.toLocaleTimeString()}
        </div>
      )}

      {/* Stats */}
      {activeTab === 'students' && (
        <StatsGrid>
          <StatCard label="Total Students" value={studentStats.total} icon={<Users size={20} />} color="blue" />
          <StatCard label="Active" value={studentStats.active} icon={<UserCheck size={20} />} color="green" />
          <StatCard label="Inactive" value={studentStats.inactive} icon={<UserX size={20} />} color="red" />
        </StatsGrid>
      )}
      {activeTab === 'teachers' && (
        <StatsGrid>
          <StatCard label="Total Teachers" value={teacherStats.total} icon={<BookOpen size={20} />} color="blue" />
          <StatCard label="Active" value={teacherStats.active} icon={<UserCheck size={20} />} color="green" />
          <StatCard label="Assigned to Subject" value={teacherStats.assigned} icon={<GraduationCap size={20} />} color="purple" />
        </StatsGrid>
      )}
      {activeTab === 'transfers' && (
        <StatsGrid>
          <StatCard label="Total Requests" value={transferStats.total} icon={<ArrowRightLeft size={20} />} color="blue" />
          <StatCard label="Pending" value={transferStats.pending} icon={<RefreshCw size={20} />} color="red" />
          <StatCard label="Approved" value={transferStats.approved} icon={<UserCheck size={20} />} color="green" />
          <StatCard label="Rejected" value={transferStats.rejected} icon={<UserX size={20} />} color="purple" />
        </StatsGrid>
      )}

      {/* ── Create Teacher Modal ── */}
      {showCreateForm && (
        <div className="modal-overlay" onClick={() => setShowCreateForm(false)}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add New Teacher</h2>
            {createError && <div className="form-error">{createError}</div>}

            <div className="form-group">
              <label>Username *</label>
              <input type="text" value={createForm.username}
                onChange={(e) => setCreateForm({ ...createForm, username: e.target.value })}
                placeholder="teacher_username" />
            </div>
            <div className="form-group">
              <label>Email *</label>
              <input type="email" value={createForm.email}
                onChange={(e) => {
                  const email = e.target.value;
                  setCreateForm({ ...createForm, email });
                  // Provide validation hint for teacher email format
                  if (email.trim()) {
                    if (isValidTeacherEmail(email)) {
                      setEmailHint('✓ Valid teacher email format');
                    } else {
                      setEmailHint('Teacher emails should follow: firstname.lastname@cesi.edu.ph');
                    }
                  } else {
                    setEmailHint('');
                  }
                }}
                placeholder="firstname.lastname@cesi.edu.ph"
                style={{ borderColor: emailHint.includes('✓') ? '#10b981' : createForm.email && !isValidTeacherEmail(createForm.email) ? '#ef4444' : '' }}
              />
              {emailHint && (
                <span style={{ fontSize: 12, color: emailHint.includes('✓') ? '#10b981' : '#ef4444', marginTop: 6, display: 'block' }}>
                  {emailHint}
                </span>
              )}
            </div>
            <div className="form-group">
              <label>Password *</label>
              <input type="password" value={createForm.password}
                onChange={(e) => setCreateForm({ ...createForm, password: e.target.value })}
                placeholder="Min 6 characters" />
            </div>
            <div className="form-row">
              <div className="form-group">
                <label>Subjects</label>
                {(createForm.subjects || []).map((subjectId, idx) => (
                  <div key={`create-subject-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                    <select
                      value={subjectId}
                      onChange={(e) => updateSubjectPicker(setCreateForm, idx, e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">— Select subject —</option>
                      {subjects.map((s) => (
                        <option
                          key={s.id}
                          value={String(s.id)}
                          disabled={isSubjectOptionDisabled(createForm.subjects, s.id, idx)}
                        >
                          {s.name} ({s.code})
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      className="btn-edit"
                      onClick={() => addSubjectPicker(setCreateForm)}
                      title="Add subject"
                    >
                      <Plus size={14} />
                    </button>
                    <button
                      type="button"
                      className="btn-cancel-sm"
                      onClick={() => removeSubjectPicker(setCreateForm, idx)}
                      title="Remove subject"
                      disabled={(createForm.subjects || []).length === 1}
                    >
                      <X size={14} />
                    </button>
                  </div>
                ))}
              </div>
              <div className="form-group">
                <label>Assigned Section</label>
                <select value={createForm.section_teacher}
                  onChange={(e) => setCreateForm({ ...createForm, section_teacher: e.target.value })}>
                  <option value="">— None —</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
                </select>
              </div>
            </div>
            <div className="form-group">
              <label>Employee ID</label>
              <input type="text" value={createForm.employee_id}
                onChange={(e) => setCreateForm({ ...createForm, employee_id: e.target.value })}
                placeholder="Optional" />
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={() => setShowCreateForm(false)}>Cancel</button>
              <button className="btn-primary" onClick={handleCreateTeacher} disabled={creating}>
                {creating ? 'Creating…' : 'Create Teacher'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Edit Student Modal ── */}
      {editingStudent && (
        <div className="modal-overlay" onClick={closeStudentEdit}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Edit Student</h2>
            {studentEditError && <div className="form-error">{studentEditError}</div>}

            <div className="form-row">
              <div className="form-group">
                <label>First Name *</label>
                <input type="text" value={studentForm.student_first_name}
                  onChange={(e) => setStudentForm({ ...studentForm, student_first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Middle Name</label>
                <input type="text" value={studentForm.student_middle_name}
                  onChange={(e) => setStudentForm({ ...studentForm, student_middle_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Last Name *</label>
                <input type="text" value={studentForm.student_last_name}
                  onChange={(e) => setStudentForm({ ...studentForm, student_last_name: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>LRN</label>
                <input type="text" value={studentForm.lrn}
                  onChange={(e) => setStudentForm({ ...studentForm, lrn: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Grade Level</label>
                <select value={studentForm.grade_level}
                  onChange={(e) => setStudentForm({ ...studentForm, grade_level: e.target.value })}>
                  <option value="">— Select —</option>
                  <option value="prek">Pre-Kinder</option>
                  <option value="kinder">Kinder</option>
                  <option value="grade1">Grade 1</option>
                  <option value="grade2">Grade 2</option>
                  <option value="grade3">Grade 3</option>
                  <option value="grade4">Grade 4</option>
                  <option value="grade5">Grade 5</option>
                  <option value="grade6">Grade 6</option>
                </select>
              </div>
              <div className="form-group">
                <label>Section</label>
                <select value={studentForm.section}
                  onChange={(e) => setStudentForm({ ...studentForm, section: e.target.value })}>
                  <option value="">— None —</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>{sectionLabel(s)}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Parent First Name</label>
                <input type="text" value={studentForm.parent_first_name}
                  onChange={(e) => setStudentForm({ ...studentForm, parent_first_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Parent Middle Name</label>
                <input type="text" value={studentForm.parent_middle_name}
                  onChange={(e) => setStudentForm({ ...studentForm, parent_middle_name: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Parent Last Name</label>
                <input type="text" value={studentForm.parent_last_name}
                  onChange={(e) => setStudentForm({ ...studentForm, parent_last_name: e.target.value })} />
              </div>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Email</label>
                <input type="email" value={studentForm.email}
                  onChange={(e) => setStudentForm({ ...studentForm, email: e.target.value })} />
              </div>
              <div className="form-group">
                <label>Contact Number</label>
                <input type="text" value={studentForm.contact_number}
                  onChange={(e) => setStudentForm({ ...studentForm, contact_number: e.target.value })} />
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={closeStudentEdit}>Cancel</button>
              <button className="btn-primary" onClick={handleSaveStudent} disabled={savingStudent}>
                {savingStudent ? 'Saving…' : 'Save Changes'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Student Transfer Decision Modal ── */}
      {showTransferForm && transferStudent && (
        <div className="modal-overlay" onClick={closeTransferModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Student Transfer Decision</h2>
            {transferError && <div className="form-error">{transferError}</div>}

            <div className="form-group">
              <label>Student</label>
              <input type="text" value={studentNameDisplay(transferStudent)} readOnly />
            </div>

            <div className="form-group">
              <label>Decision *</label>
              <select
                value={transferForm.decision}
                onChange={(e) => setTransferForm({ ...transferForm, decision: e.target.value })}
              >
                <option value="PENDING">Pending</option>
                <option value="APPROVED">Approve Transfer</option>
                <option value="REJECTED">Reject Transfer</option>
              </select>
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Transfer Date</label>
                <input
                  type="date"
                  value={transferForm.transfer_date}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_date: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Reference Number</label>
                <input
                  type="text"
                  value={transferForm.transfer_reference_number}
                  onChange={(e) => setTransferForm({ ...transferForm, transfer_reference_number: e.target.value })}
                  placeholder="Optional"
                />
              </div>
            </div>

            <div className="form-group">
              <label>Destination School Name</label>
              <input
                type="text"
                value={transferForm.destination_school_name}
                onChange={(e) => setTransferForm({ ...transferForm, destination_school_name: e.target.value })}
              />
            </div>

            <div className="form-row">
              <div className="form-group">
                <label>Destination Contact</label>
                <input
                  type="text"
                  value={transferForm.destination_school_contact}
                  onChange={(e) => setTransferForm({ ...transferForm, destination_school_contact: e.target.value })}
                />
              </div>
              <div className="form-group">
                <label>Clearance File</label>
                <input
                  type="file"
                  accept=".pdf,.jpg,.jpeg,.png"
                  onChange={(e) => setTransferForm({
                    ...transferForm,
                    transfer_clearance: e.target.files && e.target.files.length ? e.target.files[0] : null,
                  })}
                />
              </div>
            </div>

            <div className="form-group">
              <label>Destination School Address</label>
              <input
                type="text"
                value={transferForm.destination_school_address}
                onChange={(e) => setTransferForm({ ...transferForm, destination_school_address: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Transfer Reason</label>
              <input
                type="text"
                value={transferForm.transfer_reason}
                onChange={(e) => setTransferForm({ ...transferForm, transfer_reason: e.target.value })}
              />
            </div>

            <div className="form-group">
              <label>Admin Notes</label>
              <input
                type="text"
                value={transferForm.transfer_notes}
                onChange={(e) => setTransferForm({ ...transferForm, transfer_notes: e.target.value })}
              />
            </div>

            <div className="form-group" style={{ marginTop: -8 }}>
              <label style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <input
                  type="checkbox"
                  checked={transferForm.allow_transfer_with_balance}
                  onChange={(e) => setTransferForm({ ...transferForm, allow_transfer_with_balance: e.target.checked })}
                />
                Allow transfer even when outstanding balance exists
              </label>
            </div>

            <div className="form-group" style={{ background: '#f8fafc', border: '1px solid #e2e8f0', borderRadius: 8, padding: 12 }}>
              <label style={{ marginBottom: 10 }}>Request History / Audit</label>
              <div style={{ fontSize: 13, color: '#334155', display: 'grid', gap: 6 }}>
                <div><strong>Current Request Status:</strong> {normalizedTransferStatus(transferStudent.profile?.transfer_status)}</div>
                <div><strong>Requested At:</strong> {formatDateTime(transferStudent.profile?.transfer_requested_at)}</div>
                <div><strong>Approved At:</strong> {formatDateTime(transferStudent.profile?.transfer_approved_at)}</div>
                <div><strong>Approved By (User ID):</strong> {transferStudent.profile?.transfer_approved_by || '—'}</div>
                <div><strong>Recorded Reason:</strong> {transferStudent.profile?.transfer_reason || '—'}</div>
                <div><strong>Recorded Destination:</strong> {transferStudent.profile?.destination_school_name || '—'}</div>
              </div>
            </div>

            <div className="form-actions">
              <button className="btn-secondary" onClick={closeTransferModal}>Cancel</button>
              <button className="btn-secondary" onClick={printTransferClearance}>Print Clearance</button>
              <button className="btn-primary" onClick={submitTransferDecision} disabled={savingTransfer}>
                <FileUp size={16} /> {savingTransfer ? 'Saving…' : 'Save Decision'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Delete User Confirmation Modal ── */}
      {deleteTargetUser && (
        <div className="modal-overlay" onClick={closeDeleteUserModal}>
          <div className="modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Delete User</h2>
            <div className="form-group">
              <p style={{ margin: 0, color: '#334155', lineHeight: 1.5 }}>
                Delete <strong>{studentNameDisplay(deleteTargetUser) || deleteTargetUser.username || `ID ${deleteTargetUser.id}`}</strong>?
                This will also remove enrollment, academic, and financial records linked to this account. This action cannot be undone.
              </p>
            </div>
            <div className="form-actions">
              <button className="btn-secondary" onClick={closeDeleteUserModal} disabled={deletingUser}>Cancel</button>
              <button className="btn-delete" onClick={handleDeleteUser} disabled={deletingUser}>
                <Trash2 size={16} /> {deletingUser ? 'Deleting…' : 'Yes, Delete'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Search & Filter */}
      <div className="user-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={activeTab === 'students'
              ? 'Search students by name, parent, or email...'
              : activeTab === 'transfers'
                ? 'Search transfer requests by student, parent, destination, reason...'
                : 'Search teachers by name, subject, or email...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={18} />
          {activeTab === 'transfers' ? (
            <select value={transferDecisionFilter} onChange={(e) => setTransferDecisionFilter(e.target.value)}>
              <option value="All">All Decisions</option>
              <option value="Pending">Pending</option>
              <option value="Approved">Approved</option>
              <option value="Rejected">Rejected</option>
            </select>
          ) : (
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
              <option value="All">All Status</option>
              <option value="Active">Active Only</option>
              <option value="Inactive">Inactive Only</option>
              <option value="Suspended">Suspended Only</option>
              <option value="Transferred">Transferred Only</option>
              <option value="New">New Only</option>
            </select>
          )}
        </div>
      </div>

      {/* ── STUDENTS TABLE ── */}
      {activeTab === 'students' && (
        <div className="users-container">
          {filteredStudents.length > 0 ? (
            <>
            <div className="users-table-scroll-hint">← Swipe to scroll →</div>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Student Name</th>
                  <th>LRN</th>
                  <th>Grade Level</th>
                  
                  <th>Section</th>
                  <th>Parent / Guardian</th>
                  <th>Email</th>
                  <th>Contact</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedStudents.map((u) => (
                  <tr key={u.id}>
                    <td><strong>{studentNameDisplay(u)}</strong></td>
                    <td>{u.profile?.lrn || "—"}</td>
                    <td>{studentGradeDisplay(u)}</td>
                    <td>{studentSectionDisplay(u)}</td>
                    <td>{parentNameDisplay(u)}</td>
                    <td><a href={`mailto:${u.email}`}>{u.email}</a></td>
                    <td>{contactDisplay(u)}</td>
                    <td><span className={`user-status-badge ${normalizedStatus(u.status).toLowerCase()}`}>{normalizedStatus(u.status)}</span></td>
                    <td>
                      <div className="action-buttons">
                        <button className="btn-edit" onClick={() => openStudentEdit(u)} title="Edit Student">
                          <Edit2 size={16} />
                        </button>
                        <button className="btn-save" onClick={() => openTransferModal(u)} title="Transfer Workflow">
                          <ArrowRightLeft size={16} />
                        </button>
                        <button className="btn-delete" onClick={() => openDeleteUserModal(u)} title="Delete User and Records">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <Pagination currentPage={studentPage} totalPages={studentTotalPages} onPageChange={setStudentPage} totalItems={filteredStudents.length} itemsPerPage={ITEMS_PER_PAGE} />
            </>
          ) : (
            <div className="no-results"><Users size={48} /><p>No students found.</p></div>
          )}
        </div>
      )}

      {/* ── TEACHERS TABLE ── */}
      {activeTab === 'teachers' && (
        <div className="users-container">
          {assignError && <div className="form-error" style={{ marginBottom: '1rem' }}>{assignError}</div>}
          {filteredTeachers.length > 0 ? (
            <>
            <div className="users-table-scroll-hint">← Swipe to scroll →</div>
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Employee ID</th>
                  <th>Subjects</th>
                  <th>Assigned Section</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTeachers.map((u) => {
                  const isEditing = editingId === u.id;
                  const tp = u.teacher_profile;
                  const subjectList = teacherSubjects(u);
                  return (
                    <tr key={u.id}>
                      <td><strong>{u.username}</strong></td>
                      <td>{u.email}</td>
                      <td>
                        {isEditing ? (
                          <input type="text" className="inline-input" value={assignForm.employee_id}
                            onChange={(e) => setAssignForm({ ...assignForm, employee_id: e.target.value })} />
                        ) : (tp?.employee_id || '—')}
                      </td>
                      <td>
                        {isEditing ? (
                          <div>
                            {(assignForm.subjects || []).map((subjectId, idx) => (
                              <div key={`assign-subject-${u.id}-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                                <select
                                  className="inline-select"
                                  value={subjectId}
                                  onChange={(e) => updateSubjectPicker(setAssignForm, idx, e.target.value)}
                                  style={{ width: '100%' }}
                                >
                                  <option value="">— Select subject —</option>
                                  {subjects.map((s) => (
                                    <option
                                      key={s.id}
                                      value={String(s.id)}
                                      disabled={isSubjectOptionDisabled(assignForm.subjects, s.id, idx)}
                                    >
                                      {s.name}
                                    </option>
                                  ))}
                                </select>
                                <button
                                  type="button"
                                  className="btn-edit"
                                  onClick={() => addSubjectPicker(setAssignForm)}
                                  title="Add subject"
                                >
                                  <Plus size={14} />
                                </button>
                                <button
                                  type="button"
                                  className="btn-cancel-sm"
                                  onClick={() => removeSubjectPicker(setAssignForm, idx)}
                                  title="Remove subject"
                                  disabled={(assignForm.subjects || []).length === 1}
                                >
                                  <X size={14} />
                                </button>
                              </div>
                            ))}
                          </div>
                        ) : subjectList.length > 0 ? (
                          <span className="badge-subject">{subjectList.map((s) => s.name).join(', ')}</span>
                        ) : (
                          <span className="badge-none">Unassigned</span>
                        )}
                      </td>
                      <td>
                        {isEditing ? (
                          <select className="inline-select" value={assignForm.section}
                            onChange={(e) => setAssignForm({ ...assignForm, section: e.target.value })}>
                            <option value="">— None —</option>
                            {sections.map((s) => <option key={s.id} value={s.id}>{sectionLabel(s)}</option>)}
                          </select>
                        ) : tp?.section ? sectionLabel(tp.section) : '—'}
                      </td>
                      <td><span className={`user-status-badge ${u.status.toLowerCase()}`}>{u.status}</span></td>
                      <td>
                        <div className="action-buttons">
                          {isEditing ? (
                            <>
                              <button className="btn-save" onClick={() => saveAssignment(u.id)} title="Save">
                                <Save size={16} />
                              </button>
                              <button className="btn-cancel-sm" onClick={cancelEdit} title="Cancel">
                                <X size={16} />
                              </button>
                            </>
                          ) : (
                            <button className="btn-edit" onClick={() => startEdit(u)} title="Edit Assignment">
                              <Edit2 size={16} />
                            </button>
                          )}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            <Pagination currentPage={teacherPage} totalPages={teacherTotalPages} onPageChange={setTeacherPage} totalItems={filteredTeachers.length} itemsPerPage={ITEMS_PER_PAGE} />
            </>
          ) : (
            <div className="no-results"><BookOpen size={48} /><p>No teachers found.</p></div>
          )}
        </div>
      )}

      {/* ── TRANSFER REQUESTS TABLE ── */}
      {activeTab === 'transfers' && (
        <div className="users-container">
          {filteredTransferRequests.length > 0 ? (
            <>
              <div className="users-table-scroll-hint">← Swipe to scroll →</div>
              <table className="users-table">
                <thead>
                  <tr>
                    <th>Student Name</th>
                    <th>Parent / Guardian</th>
                    <th>Grade</th>
                    <th>Requested At</th>
                    <th>Destination School</th>
                    <th>Reason</th>
                    <th>Decision</th>
                    <th>Approved At</th>
                    <th>Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {paginatedTransfers.map((u) => (
                    <tr key={`transfer-${u.id}`}>
                      <td><strong>{studentNameDisplay(u)}</strong></td>
                      <td>{parentNameDisplay(u)}</td>
                      <td>{studentGradeDisplay(u)}</td>
                      <td>{formatDateTime(u.profile?.transfer_requested_at)}</td>
                      <td>{u.profile?.destination_school_name || '—'}</td>
                      <td>{u.profile?.transfer_reason || '—'}</td>
                      <td><span className={`user-status-badge ${normalizedTransferStatus(u.profile?.transfer_status).toLowerCase()}`}>{normalizedTransferStatus(u.profile?.transfer_status)}</span></td>
                      <td>{formatDateTime(u.profile?.transfer_approved_at)}</td>
                      <td>
                        <div className="action-buttons">
                          <button className="btn-save" onClick={() => openTransferModal(u)} title="Review Transfer Request">
                            <ArrowRightLeft size={16} />
                          </button>
                          <button className="btn-delete" onClick={() => openDeleteUserModal(u)} title="Delete User and Records">
                            <Trash2 size={16} />
                          </button>
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <Pagination currentPage={transferPage} totalPages={transferTotalPages} onPageChange={setTransferPage} totalItems={filteredTransferRequests.length} itemsPerPage={ITEMS_PER_PAGE} />
            </>
          ) : (
            <div className="no-results"><ArrowRightLeft size={48} /><p>No transfer requests found.</p></div>
          )}
        </div>
      )}
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
};

export default UserManagement;
