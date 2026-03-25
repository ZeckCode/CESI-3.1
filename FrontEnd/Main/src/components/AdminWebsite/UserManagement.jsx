import React, { useState, useEffect, useCallback, useMemo } from 'react';
import {
  Plus, Edit2, Search, Filter, Users,
  BookOpen, GraduationCap, Save, X, UserCheck, UserX, RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../api/apiFetch';
import StatCard, { StatsGrid } from './StatCard';
import Pagination from './Pagination';
import '../AdminWebsiteCSS/UserManagement.css';

/* ─────────────────────────────────────────────
   EMAIL FORMATTING & VALIDATION HELPERS
───────────────────────────────────────────── */
const normalizeEmail = (email) => String(email || '').trim().toLowerCase();

const formatTeacherEmail = (firstName, lastName) => {
  const first = (firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const last = (lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return first && last ? `${first}.${last}@cesi.edu.ph` : '';
};

const formatStudentEmail = (lastName, firstName) => {
  const last = (lastName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  const first = (firstName || '').trim().toLowerCase().replace(/[^a-z0-9]/g, '');
  return last && first ? `${last}.${first}@cesi.edu.ph` : '';
};

const isValidTeacherEmail = (email) => {
  const normalized = normalizeEmail(email);
  return /^[a-z0-9]+\.[a-z0-9]+@cesi\.edu\.ph$/.test(normalized);
};

const isValidStudentEmail = (email) => {
  const normalized = normalizeEmail(email);
  return /^[a-z0-9]+\.[a-z0-9]+@cesi\.edu\.ph$/.test(normalized);
};

const isValidAdminEmail = (email) => {
  const normalized = normalizeEmail(email);
  return normalized === 'cesi.admin@cesi.edu.ph' || /^admin|^cesi\.admin@cesi\.edu\.ph$/.test(normalized);
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
  const [studentPage, setStudentPage] = useState(1);
  const [teacherPage, setTeacherPage] = useState(1);
  const ITEMS_PER_PAGE = 10;

  // create teacher modal
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [createForm, setCreateForm] = useState({
    username: '', email: '', password: '',
    subject: '', section_teacher: '', employee_id: '',
  });
  const [createError, setCreateError] = useState('');
  const [emailHint, setEmailHint] = useState('');
  const [creating, setCreating] = useState(false);

  // inline assignment editing (teachers)
  const [editingId, setEditingId] = useState(null);
  const [assignForm, setAssignForm] = useState({ subject: '', section: '', employee_id: '' });
  const [assignError, setAssignError] = useState('');

  // student edit modal
  const [editingStudent, setEditingStudent] = useState(null);
  const [studentForm, setStudentForm] = useState({});
  const [studentEditError, setStudentEditError] = useState('');
  const [savingStudent, setSavingStudent] = useState(false);

  // ── fetchers ──
  const fetchStudents = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/users/?role=PARENT_STUDENT');
      if (res.ok) setStudents(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/users/?role=TEACHER');
      if (res.ok) setTeachers(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchActiveEnrollments = useCallback(async () => {
    try {
      const res = await apiFetch('/api/enrollments/?status=ACTIVE');
      if (res.ok) setActiveEnrollments(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/subjects/');
      if (res.ok) setSubjects(await res.json());
    } catch (e) { console.error(e); }
  }, []);

  const fetchSections = useCallback(async () => {
    try {
      const res = await apiFetch('/api/accounts/sections/');
      if (res.ok) setSections(await res.json());
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
    const byEmail = new Map();

    activeEnrollments.forEach((e) => {
      if (e.parent_user) byParentUser.set(e.parent_user, e);
      const email = String(e.email || '').trim().toLowerCase();
      if (email) byEmail.set(email, e);
    });

    return { byParentUser, byEmail };
  }, [activeEnrollments]);

  const enrollmentForUser = (u) => {
    const byParent = activeEnrollmentMaps.byParentUser.get(u.id);
    if (byParent) return byParent;
    const email = String(u.email || '').trim().toLowerCase();
    if (!email) return null;
    return activeEnrollmentMaps.byEmail.get(email) || null;
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

  // ── filter ──
  const filteredStudents = students.filter((u) => {
    const name = studentName(u).toLowerCase();
    const parent = parentName(u).toLowerCase();
    const matchSearch =
      name.includes(searchTerm.toLowerCase()) ||
      parent.includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase());
      const statusCode = String(u.status || "INACTIVE").toUpperCase();
const matchStatus = filterStatus === "All" || statusCode === filterStatus.toUpperCase();
    return matchSearch && matchStatus;
  });

  const filteredTeachers = teachers.filter((u) => {
    const subjectName = u.teacher_profile?.subject?.name || '';
    const matchSearch =
      u.username.toLowerCase().includes(searchTerm.toLowerCase()) ||
      u.email.toLowerCase().includes(searchTerm.toLowerCase()) ||
      subjectName.toLowerCase().includes(searchTerm.toLowerCase());
   const statusCode = String(u.status || "INACTIVE").toUpperCase();
const matchStatus = filterStatus === "All" || statusCode === filterStatus.toUpperCase();
    return matchSearch && matchStatus;
  });

  // ── pagination slicing ──
  const studentTotalPages = Math.ceil(filteredStudents.length / ITEMS_PER_PAGE);
  const paginatedStudents = filteredStudents.slice((studentPage - 1) * ITEMS_PER_PAGE, studentPage * ITEMS_PER_PAGE);
  const teacherTotalPages = Math.ceil(filteredTeachers.length / ITEMS_PER_PAGE);
  const paginatedTeachers = filteredTeachers.slice((teacherPage - 1) * ITEMS_PER_PAGE, teacherPage * ITEMS_PER_PAGE);

  // reset page on filter/search/tab changes
  useEffect(() => { setStudentPage(1); setTeacherPage(1); }, [searchTerm, filterStatus, activeTab]);

  // ── create teacher ──
  const handleCreateTeacher = async () => {
    setCreateError('');
    setEmailHint('');
    if (!createForm.username || !createForm.email || !createForm.password) {
      setCreateError('Username, email and password are required.');
      return;
    }
    if (!isValidTeacherEmail(createForm.email)) {
      setCreateError('Email must follow teacher format: firstname.lastname@cesi.edu.ph');
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
      if (createForm.subject) body.subject = parseInt(createForm.subject);
      if (createForm.section_teacher) body.section_teacher = parseInt(createForm.section_teacher);

      const res = await apiFetch('/api/accounts/admin/create-user/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.detail || data.errors?.detail || JSON.stringify(data.errors || data));
      }
      setShowCreateForm(false);
      setCreateForm({ username: '', email: '', password: '', subject: '', section_teacher: '', employee_id: '' });
      fetchTeachers();
    } catch (e) {
      setCreateError(e.message);
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
      setStudentEditError('Student first and last name are required.');
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
      closeStudentEdit();
      fetchStudents();
    } catch (e) {
      setStudentEditError(e.message);
    } finally {
      setSavingStudent(false);
    }
  };

  // ── inline assignment ──
  const startEdit = (teacher) => {
    setEditingId(teacher.id);
    setAssignForm({
      subject: teacher.teacher_profile?.subject?.id || '',
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
        subject: assignForm.subject ? parseInt(assignForm.subject) : null,
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
        throw new Error(err.detail || JSON.stringify(err));
      }
      setEditingId(null);
      fetchTeachers();
    } catch (e) {
      setAssignError(e.message);
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
    assigned: teachers.filter((t) => t.teacher_profile?.subject).length,
  };

  if (loading) {
    return (
      <div className="user-management">
        <div style={{ textAlign: 'center', padding: '3rem', color: '#94a3b8' }}>Loading users…</div>
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
            onClick={() => { setActiveTab('students'); setSearchTerm(''); setFilterStatus('All'); }}
          >
            <GraduationCap size={18} /> Students ({studentStats.total})
          </button>
          <button
            className={`tab-btn ${activeTab === 'teachers' ? 'active' : ''}`}
            onClick={() => { setActiveTab('teachers'); setSearchTerm(''); setFilterStatus('All'); }}
          >
            <BookOpen size={18} /> Teachers ({teacherStats.total})
          </button>
        </div>
        {activeTab === 'teachers' && (
          <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
            <button className="btn-secondary" onClick={() => refreshAll(true)} disabled={refreshing} title="Refresh latest data from database">
              <RefreshCw size={16} /> {refreshing ? 'Refreshing…' : 'Refresh'}
            </button>
            <button className="btn-primary" onClick={() => setShowCreateForm(true)}>
              <Plus size={18} /> Add New Teacher
            </button>
          </div>
        )}
        {activeTab === 'students' && (
          <button className="btn-secondary" onClick={() => refreshAll(true)} disabled={refreshing} title="Refresh latest data from database">
            <RefreshCw size={16} /> {refreshing ? 'Refreshing…' : 'Refresh'}
          </button>
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
                <label>Subject</label>
                <select value={createForm.subject}
                  onChange={(e) => setCreateForm({ ...createForm, subject: e.target.value })}>
                  <option value="">— None —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
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

      {/* Search & Filter */}
      <div className="user-controls">
        <div className="search-box">
          <Search size={18} />
          <input
            type="text"
            placeholder={activeTab === 'students'
              ? 'Search students by name, parent, or email...'
              : 'Search teachers by name, subject, or email...'}
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
        </div>
        <div className="filter-box">
          <Filter size={18} />
          <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)}>
            <option value="All">All Status</option>
            <option value="Active">Active Only</option>
            <option value="Inactive">Inactive Only</option>
          </select>
        </div>
      </div>

      {/* ── STUDENTS TABLE ── */}
      {activeTab === 'students' && (
        <div className="users-container">
          {filteredStudents.length > 0 ? (
            <>
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
                    <td>
                      <div className="action-buttons">
                        <button className="btn-edit" onClick={() => openStudentEdit(u)} title="Edit Student">
                          <Edit2 size={16} />
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
            <table className="users-table">
              <thead>
                <tr>
                  <th>Username</th>
                  <th>Email</th>
                  <th>Employee ID</th>
                  <th>Subject</th>
                  <th>Assigned Section</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {paginatedTeachers.map((u) => {
                  const isEditing = editingId === u.id;
                  const tp = u.teacher_profile;
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
                          <select className="inline-select" value={assignForm.subject}
                            onChange={(e) => setAssignForm({ ...assignForm, subject: e.target.value })}>
                            <option value="">— None —</option>
                            {subjects.map((s) => <option key={s.id} value={s.id}>{s.name}</option>)}
                          </select>
                        ) : tp?.subject ? (
                          <span className="badge-subject">{tp.subject.name}</span>
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
                      <td><span className={`status-badge ${u.status.toLowerCase()}`}>{u.status}</span></td>
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
    </div>
  );
};

export default UserManagement;
