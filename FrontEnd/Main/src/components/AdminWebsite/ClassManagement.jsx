import React, { useState, useEffect, useCallback } from 'react';
import {
  Plus, Edit2, Trash2, Search, Filter, Clock, Users, BookOpen,
  Calendar, Save, X, UserCheck, Zap, ChevronDown, CheckSquare,
  Home, AlertTriangle, Settings, AlertCircle, RefreshCw,
} from 'lucide-react';
import StatCard, { StatsGrid } from './StatCard';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/AdminClassManagement.css';

/* ───────────────────────── helpers ───────────────────────── */
const GRADE_LEVELS = [
  { value: 0, label: 'Kinder' },
  { value: 1, label: 'Grade 1' },
  { value: 2, label: 'Grade 2' },
  { value: 3, label: 'Grade 3' },
  { value: 4, label: 'Grade 4' },
  { value: 5, label: 'Grade 5' },
  { value: 6, label: 'Grade 6' },
];

const DAYS = [
  { value: 'MON', label: 'Monday', short: 'Mon' },
  { value: 'TUE', label: 'Tuesday', short: 'Tue' },
  { value: 'WED', label: 'Wednesday', short: 'Wed' },
  { value: 'THU', label: 'Thursday', short: 'Thu' },
  { value: 'FRI', label: 'Friday', short: 'Fri' },
];

/* Default rooms - these should match what's in the database */
const DEFAULT_ROOMS = [
  { code: '1F-A', name: 'First Floor Room A' },
  { code: '1F-B', name: 'First Floor Room B' },
  { code: '2F-A', name: 'Second Floor Room A' },
  { code: '2F-B', name: 'Second Floor Room B' },
  { code: '3F-A', name: 'Third Floor Room A' },
  { code: '3F-B', name: 'Third Floor Room B' },
  { code: '3F-C', name: 'Third Floor Room C' },
];

const TIME_SLOTS = [
  { hour: 7.5, label: '7:30 AM' },
  { hour: 8, label: '8:00 AM' },
  { hour: 8.5, label: '8:30 AM' },
  { hour: 9, label: '9:00 AM' },
  { hour: 9.5, label: '9:30 AM' },
  { hour: 10, label: '10:00 AM' },
  { hour: 10.5, label: '10:30 AM' },
  { hour: 11, label: '11:00 AM' },
  { hour: 11.5, label: '11:30 AM' },
  { hour: 12, label: '12:00 PM' },
  { hour: 12.5, label: '12:30 PM' },
  { hour: 13, label: '1:00 PM' },
  { hour: 13.5, label: '1:30 PM' },
  { hour: 14, label: '2:00 PM' },
  { hour: 14.5, label: '2:30 PM' },
  { hour: 15, label: '3:00 PM' },
  { hour: 15.5, label: '3:30 PM' },
  { hour: 16, label: '4:00 PM' },
  { hour: 16.5, label: '4:30 PM' },
];

const gradeLabel = (lvl) => GRADE_LEVELS.find((g) => g.value === lvl)?.label ?? `Grade ${lvl}`;
const gradeCodeForLevel = (lvl) => {
  const map = {
    0: 'kinder',
    1: 'grade1',
    2: 'grade2',
    3: 'grade3',
    4: 'grade4',
    5: 'grade5',
    6: 'grade6',
  };
  return map[lvl] || '';
};
const dayLabel = (code) => DAYS.find((d) => d.value === code)?.label ?? code;
const dayShort = (code) => DAYS.find((d) => d.value === code)?.short ?? code;

/* Subject color palette - more distinct and readable */
const COLORS = [
  { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },  // Blue
  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },  // Green
  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },  // Amber
  { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },  // Pink
  { bg: '#e0e7ff', text: '#3730a3', border: '#6366f1' },  // Indigo
  { bg: '#d1fae5', text: '#065f46', border: '#10b981' },  // Emerald
  { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },  // Orange
  { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },  // Purple
];
const colorFor = (id) => COLORS[id % COLORS.length];

/* helper: convert HH:MM:SS time string to decimal hour */
const timeToDecimal = (t) => {
  if (!t) return 0;
  const [h, m] = t.split(':').map(Number);
  return h + m / 60;
};

/* helper: format time for display */
const formatTime = (t) => {
  if (!t) return '';
  const [h, m] = t.split(':').map(Number);
  const period = h >= 12 ? 'PM' : 'AM';
  const hour = h > 12 ? h - 12 : h === 0 ? 12 : h;
  return `${hour}:${m.toString().padStart(2, '0')} ${period}`;
};

/* helper: does this schedule overlap the given time slot? */
const overlapsHour = (s, dayCode, slotHour) => {
  if (s.day_of_week !== dayCode) return false;
  const sh = timeToDecimal(s.start_time);
  const eh = timeToDecimal(s.end_time);
  // Check if the slot falls within the schedule's time range
  return sh <= slotHour && eh > slotHour;
};

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
const ClassManagement = () => {
  const [activeTab, setActiveTab] = useState('classes');
  const [loading, setLoading] = useState(true);

  /* data from API */
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  /* fetchers */
  const fetchSections = useCallback(async () => {
    try { const r = await apiFetch('/api/accounts/sections/'); if (r.ok) setSections(await r.json()); } catch (e) { console.error(e); }
  }, []);
  const fetchSubjects = useCallback(async () => {
    try { const r = await apiFetch('/api/accounts/subjects/'); if (r.ok) setSubjects(await r.json()); } catch (e) { console.error(e); }
  }, []);
  const fetchTeachers = useCallback(async () => {
    try { const r = await apiFetch('/api/accounts/users/?role=TEACHER'); if (r.ok) setTeachers(await r.json()); } catch (e) { console.error(e); }
  }, []);
  const fetchEnrollments = useCallback(async () => {
    try {
      const r = await apiFetch('/api/enrollments/?status=ACTIVE');
      if (r.ok) setEnrollments(await r.json());
    } catch (e) { console.error(e); }
  }, []);
  const fetchSchedules = useCallback(async () => {
    try { const r = await apiFetch('/api/classmanagement/schedules/'); if (r.ok) setSchedules(await r.json()); } catch (e) { console.error(e); }
  }, []);
  const fetchRooms = useCallback(async () => {
    try { const r = await apiFetch('/api/classmanagement/rooms/'); if (r.ok) setRooms(await r.json()); } catch (e) { console.error(e); }
  }, []);
  const fetchSchoolYears = useCallback(async () => {
    try { const r = await apiFetch('/api/classmanagement/school-years/'); if (r.ok) setSchoolYears(await r.json()); } catch (e) { console.error(e); }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchSections(), fetchSubjects(), fetchTeachers(), fetchEnrollments(), fetchSchedules(), fetchRooms(), fetchSchoolYears()]);
      setLoading(false);
    })();
  }, [fetchSections, fetchSubjects, fetchTeachers, fetchEnrollments, fetchSchedules, fetchRooms, fetchSchoolYears]);

  /* stats */
  const totalStudents = sections.reduce((s, sec) => s + (sec.student_count || 0), 0);

  /* single refresh-all helper so deletes in one tab update counts everywhere */
  const refreshAll = useCallback(() =>
    Promise.all([fetchSections(), fetchSubjects(), fetchTeachers(), fetchEnrollments(), fetchSchedules(), fetchRooms(), fetchSchoolYears()]),
    [fetchSections, fetchSubjects, fetchTeachers, fetchEnrollments, fetchSchedules, fetchRooms, fetchSchoolYears]);

  if (loading) return (
    <div className="admin-class-management">
      <div className="admin-loading-spinner">
        <div className="spinner"></div>
        <p>Loading class management data...</p>
      </div>
    </div>
  );

  return (
    <div className="admin-class-management">

      {/* ── OVERVIEW STATS + ACTIONS ── */}
      <div className="cm-stats-section">
        <div className="cm-stats-header">
          <div className="cm-stats-title">Overview</div>
          <div className="cm-header-actions">
            <button className="cm-btn-icon" onClick={refreshAll} title="Refresh">
              <RefreshCw size={16} />
            </button>
          </div>
        </div>
        <StatsGrid>
          <StatCard label="Sections" value={sections.length} icon={<BookOpen size={20} />} color="blue" subtitle="Total classes" />
          <StatCard label="Total Students" value={totalStudents} icon={<Users size={20} />} color="green" subtitle={sections.length ? `Across ${sections.length} sections` : '—'} />
          <StatCard label="Subjects" value={subjects.length} icon={<BookOpen size={20} />} color="yellow" subtitle={subjects.length ? `${subjects.length} registered` : '—'} />
          <StatCard label="Schedule Entries" value={schedules.length} icon={<Clock size={20} />} color="purple" subtitle={schedules.length ? `${schedules.length} slots` : '—'} />
        </StatsGrid>
      </div>

      {/* Tabs */}
      <div className="admin-tabs-container">
        <button className={`admin-tab-btn ${activeTab === 'classes' ? 'active' : ''}`} onClick={() => setActiveTab('classes')}>
          <BookOpen size={18} /> Classes ({sections.length})
        </button>
        <button className={`admin-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`} onClick={() => setActiveTab('schedule')}>
          <Calendar size={18} /> Schedules ({schedules.length})
        </button>
        <button className={`admin-tab-btn ${activeTab === 'subjects' ? 'active' : ''}`} onClick={() => setActiveTab('subjects')}>
          <BookOpen size={18} /> Subjects ({subjects.length})
        </button>
        <button className={`admin-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`} onClick={() => setActiveTab('rooms')}>
          <Home size={18} /> Rooms ({rooms.length})
        </button>
        <button className={`admin-tab-btn ${activeTab === 'schoolyear' ? 'active' : ''}`} onClick={() => setActiveTab('schoolyear')}>
          <Settings size={18} /> School Year
        </button>
      </div>

      {activeTab === 'classes' && (
        <ClassesTab sections={sections} teachers={teachers} rooms={rooms} enrollments={enrollments} schedules={schedules}
          onRefresh={refreshAll} />
      )}
      {activeTab === 'schedule' && (
        <SchedulesTab sections={sections} subjects={subjects} teachers={teachers} schedules={schedules} rooms={rooms} onRefresh={refreshAll} />
      )}
      {activeTab === 'subjects' && (
        <SubjectsTab subjects={subjects} teachers={teachers} onRefresh={refreshAll} />
      )}
      {activeTab === 'rooms' && (
        <RoomsTab rooms={rooms} schedules={schedules} onRefresh={refreshAll} />
      )}
      {activeTab === 'schoolyear' && (
        <SchoolYearTab schoolYears={schoolYears} onRefresh={refreshAll} />
      )}
    </div>
  );
};

/* ═════════════════════════════════════════════════════════
   CLASSES TAB — sections list + homeroom teacher
   ═════════════════════════════════════════════════════════ */
function ClassesTab({ sections, teachers, rooms, enrollments, schedules, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', grade_level: '', adviser: '', room: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [assigningEnrollmentId, setAssigningEnrollmentId] = useState(null);

  const teacherProfiles = teachers.filter((t) => t.teacher_profile).map((t) => ({
    userId: t.id, profileId: t.teacher_profile.id, username: t.username,
  }));

  const openNew = () => { setEditId(null); setForm({ name: '', grade_level: '', adviser: '', room: '' }); setError(''); setShowForm(true); };
  const openEdit = (sec) => {
    setEditId(sec.id);
    setForm({ name: sec.name, grade_level: String(sec.grade_level), adviser: sec.adviser ? String(sec.adviser) : '', room: sec.room ? String(sec.room) : '' });
    setError(''); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || form.grade_level === '') { setError('Name and grade level are required.'); return; }
    setSaving(true); setError('');
    try {
      const payload = { name: form.name, grade_level: Number(form.grade_level), adviser: form.adviser ? Number(form.adviser) : null, room: form.room ? Number(form.room) : null };
      const url = editId ? `/api/accounts/sections/${editId}/` : '/api/accounts/sections/';
      const r = await apiFetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
      setShowForm(false); await onRefresh();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this section? This will also remove related schedules.')) return;
    try {
      const r = await apiFetch(`/api/accounts/sections/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Delete failed (${r.status})`);
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const openStudentsModal = (sec) => {
    setSelectedSection(sec);
    setShowStudentsModal(true);
  };

  const closeStudentsModal = () => {
    setShowStudentsModal(false);
    setSelectedSection(null);
    setAssigningEnrollmentId(null);
  };

  const assignStudentToSection = async (enrollmentId, sectionId) => {
    setAssigningEnrollmentId(enrollmentId);
    try {
      const r = await apiFetch(`/api/enrollments/${enrollmentId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: sectionId }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || JSON.stringify(data) || 'Failed');
      await onRefresh();
    } catch (e) {
      alert('Assign failed: ' + e.message);
    } finally {
      setAssigningEnrollmentId(null);
    }
  };

  const removeStudentFromSection = async (enrollmentId) => {
    if (!window.confirm('Remove this student from the section?')) return;
    setAssigningEnrollmentId(enrollmentId);
    try {
      const r = await apiFetch(`/api/enrollments/${enrollmentId}/`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ section: null }),
      });
      const data = await r.json().catch(() => ({}));
      if (!r.ok) throw new Error(data.detail || JSON.stringify(data) || 'Failed');
      await onRefresh();
    } catch (e) {
      alert('Remove failed: ' + e.message);
    } finally {
      setAssigningEnrollmentId(null);
    }
  };

  const activeGradeEnrollments = selectedSection
    ? enrollments.filter((e) => e.grade_level === gradeCodeForLevel(selectedSection.grade_level) && e.status === 'ACTIVE')
    : [];

  const inSection = activeGradeEnrollments.filter((e) => e.section === selectedSection?.id);
  const availableForSection = activeGradeEnrollments.filter((e) => e.section !== selectedSection?.id);

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Sections &amp; Homeroom Teachers</h2>
        <button className="admin-btn-primary" onClick={openNew}><Plus size={18} /> Add Section</button>
      </div>

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>{editId ? 'Edit Section' : 'Add Section'}</h2>
            {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}
            <div className="admin-form-group">
              <label>Section Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Gentleness" />
            </div>
            <div className="admin-form-group">
              <label>Grade Level *</label>
              <select value={form.grade_level} onChange={(e) => setForm({ ...form, grade_level: e.target.value })}>
                <option value="">Select…</option>
                {GRADE_LEVELS.map((g) => <option key={g.value} value={g.value}>{g.label}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Homeroom Teacher (Adviser)</label>
              <select value={form.adviser} onChange={(e) => setForm({ ...form, adviser: e.target.value })}>
                <option value="">— None —</option>
                {teacherProfiles.map((t) => <option key={t.profileId} value={t.profileId}>{t.username}</option>)}
              </select>
            </div>
            <div className="admin-form-group">
              <label>Assigned Room</label>
              <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
                <option value="">— None —</option>
                {rooms.filter((room) => room.is_active).map((room) => <option key={room.id} value={room.id}>{room.code}</option>)}
              </select>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-classes-grid">
        {sections.length === 0 && (
          <div className="admin-no-results"><BookOpen size={48} /><p>No sections yet. Add one to get started.</p></div>
        )}
        {sections.map((sec) => {
          const sectionSchedules = schedules.filter((s) => s.section === sec.id);
          const subjectIds = [...new Set(sectionSchedules.map((s) => s.subject))];
          const gradeCode = gradeCodeForLevel(sec.grade_level);
          const activeForGrade = enrollments.filter((e) => e.grade_level === gradeCode && e.status === 'ACTIVE');
          const pendingForGrade = enrollments.filter((e) => e.grade_level === gradeCode && e.status === 'PENDING');
          const assignedToSection = activeForGrade.filter((e) => e.section === sec.id);
          const unassignedForGrade = activeForGrade.filter((e) => !e.section);
          return (
            <div key={sec.id} className="admin-class-card">
              <div className="admin-class-card-header">
                <div>
                  <h3>{gradeLabel(sec.grade_level)} — {sec.name}</h3>
                  <p className="admin-class-grade">{gradeLabel(sec.grade_level)}</p>
                </div>
                <div className="admin-card-actions">
                  <button className="admin-btn-primary" onClick={() => openStudentsModal(sec)} title="Manage Students" style={{ padding: '8px 10px' }}>
                    <Users size={16} />
                  </button>
                  <button className="admin-btn-edit" onClick={() => openEdit(sec)} title="Edit"><Edit2 size={16} /></button>
                  <button className="admin-btn-delete" onClick={() => handleDelete(sec.id)} title="Delete"><Trash2 size={16} /></button>
                </div>
              </div>
              <div className="admin-class-card-body">
                <div className="admin-info-row"><span className="label">Homeroom:</span><span className="value">{sec.adviser_name || <em style={{ color: '#94a3b8' }}>Unassigned</em>}</span></div>
                <div className="admin-info-row"><span className="label">Room:</span><span className="value">{sec.room_code || <em style={{ color: '#94a3b8' }}>Unassigned</em>}</span></div>
                <div className="admin-info-row"><span className="label">Active Assigned:</span><span className="value"><Users size={14} /> {assignedToSection.length}</span></div>
                <div className="admin-info-row"><span className="label">Unassigned (Same Grade):</span><span className="value">{unassignedForGrade.length}</span></div>
                <div className="admin-info-row"><span className="label">Pending Approvals:</span><span className="value">{pendingForGrade.length}</span></div>
                <div className="admin-info-row"><span className="label">Subjects:</span><span className="value">{subjectIds.length} scheduled</span></div>
              </div>
            </div>
          );
        })}
      </div>

      {showStudentsModal && selectedSection && (
        <div className="admin-modal-overlay" onClick={closeStudentsModal}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()} style={{ maxWidth: 760 }}>
            <h2>
              Manage Students: {gradeLabel(selectedSection.grade_level)} - {selectedSection.name}
            </h2>
            <p style={{ color: '#64748b', marginTop: -6, marginBottom: 14 }}>
              Approved enrollments for this grade can be assigned to this class. This automatically syncs with attendance lists.
            </p>

            <h3 style={{ margin: '8px 0' }}>Students In This Section ({inSection.length})</h3>
            {inSection.length === 0 ? (
              <div className="admin-no-results" style={{ padding: 16 }}><p>No students assigned yet.</p></div>
            ) : (
              <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 14 }}>
                <table className="admin-schedule-table enhanced-table">
                  <thead><tr><th>Student</th><th>Student No.</th><th>Action</th></tr></thead>
                  <tbody>
                    {inSection.map((e) => (
                      <tr key={e.id}>
                        <td>{`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_username}</td>
                        <td>{e.student_number || '—'}</td>
                        <td>
                          <button
                            className="admin-btn-delete-small"
                            disabled={assigningEnrollmentId === e.id}
                            onClick={() => removeStudentFromSection(e.id)}>
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ margin: '8px 0' }}>Available Approved Students ({availableForSection.length})</h3>
            {availableForSection.length === 0 ? (
              <div className="admin-no-results" style={{ padding: 16 }}><p>No other approved students for this grade.</p></div>
            ) : (
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                <table className="admin-schedule-table enhanced-table">
                  <thead><tr><th>Student</th><th>Current Class</th><th>Action</th></tr></thead>
                  <tbody>
                    {availableForSection.map((e) => {
                      const currentSection = sections.find((s) => s.id === e.section);
                      return (
                        <tr key={e.id}>
                          <td>{`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_username}</td>
                          <td>{currentSection ? `${gradeLabel(currentSection.grade_level)} - ${currentSection.name}` : 'Unassigned'}</td>
                          <td>
                            <button
                              className="admin-btn-primary"
                              disabled={assigningEnrollmentId === e.id}
                              onClick={() => assignStudentToSection(e.id, selectedSection.id)}
                              style={{ padding: '8px 12px' }}>
                              {assigningEnrollmentId === e.id ? 'Adding...' : 'Add'}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}

            <div className="admin-form-actions" style={{ marginTop: 14 }}>
              <button className="admin-btn-secondary" onClick={closeStudentsModal}>Close</button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════
   SCHEDULES TAB — table + visual timeline + section filter
   ═════════════════════════════════════════════════════════ */
function SchedulesTab({ sections, subjects, teachers, schedules, rooms, onRefresh }) {
  // Default to first Kinder section, or first section if no Kinder
  const kinderSection = sections.find((s) => s.grade_level === 0);
  const defaultSection = kinderSection || sections[0];
  const [filterSection, setFilterSection] = useState(defaultSection ? String(defaultSection.id) : '');
  const [view, setView] = useState('timeline');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ teacher: '', subject: '', section: '', day_of_week: '', start_time: '', end_time: '', room: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);
  const [generating, setGenerating] = useState(false);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({ teacher: '', subject: '', section: '', day_of_week: '', start_time: '', end_time: '', room: '' });
  const [bulkSaving, setBulkSaving] = useState(false);

  const filtered = filterSection ? schedules.filter((s) => String(s.section) === filterSection) : schedules;

  /* selection helpers */
  const toggleSelect = (id) => setSelected((prev) => { const n = new Set(prev); n.has(id) ? n.delete(id) : n.add(id); return n; });
  const toggleAll = () => {
    if (selected.size === filtered.length) setSelected(new Set());
    else setSelected(new Set(filtered.map((s) => s.id)));
  };
  const allSelected = filtered.length > 0 && selected.size === filtered.length;

  const handleBulkDelete = async () => {
    const ids = [...selected].filter((id) => filtered.some((s) => s.id === id));
    if (ids.length === 0) {
      alert('No entries selected. Please select entries first.');
      return;
    }
    if (!window.confirm(`Delete ${ids.length} selected schedule entries?`)) return;
    setBulkDeleting(true);
    try {
      const r = await apiFetch('/api/classmanagement/schedules/bulk-delete/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || JSON.stringify(data) || 'Failed');
      alert(`Successfully deleted ${data.deleted_count} entries.`);
      setSelected(new Set());
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
    finally { setBulkDeleting(false); }
  };

  const openBulkEdit = () => {
    setBulkForm({ teacher: '', subject: '', section: '', day_of_week: '', start_time: '', end_time: '', room: '' });
    setShowBulkEdit(true);
  };
  const handleBulkEdit = async () => {
    const ids = [...selected].filter((id) => filtered.some((s) => s.id === id));
    if (ids.length === 0) return;
    const updates = {};
    Object.entries(bulkForm).forEach(([k, v]) => { if (v) updates[k] = k === 'start_time' || k === 'end_time' ? v + ':00' : v; });
    if (Object.keys(updates).length === 0) { alert('Fill in at least one field to update.'); return; }
    setBulkSaving(true);
    try {
      const r = await apiFetch('/api/classmanagement/schedules/bulk-update/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ ids, updates }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed');
      alert(`Updated ${data.updated_count} schedule entries.`);
      setShowBulkEdit(false);
      setSelected(new Set());
      await onRefresh();
    } catch (e) { alert(e.message); }
    finally { setBulkSaving(false); }
  };

  const openNew = () => {
    setEditId(null);
    setForm({ teacher: '', subject: '', section: filterSection || '', day_of_week: '', start_time: '', end_time: '', room: '' });
    setError(''); setConflictWarning(null); setShowForm(true);
  };
  const openEdit = (sch) => {
    setEditId(sch.id);
    setForm({ teacher: String(sch.teacher), subject: String(sch.subject), section: String(sch.section),
      day_of_week: sch.day_of_week, start_time: sch.start_time?.slice(0, 5) || '', end_time: sch.end_time?.slice(0, 5) || '', 
      room: sch.room ? String(sch.room) : '' });
    setError(''); setConflictWarning(null); setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.teacher || !form.subject || !form.section || !form.day_of_week || !form.start_time || !form.end_time) {
      setError('All fields except Room are required.'); return;
    }
    setSaving(true); setError(''); setConflictWarning(null);
    try {
      const payload = { teacher: Number(form.teacher), subject: Number(form.subject), section: Number(form.section),
        day_of_week: form.day_of_week, start_time: form.start_time + ':00', end_time: form.end_time + ':00', 
        room: form.room ? Number(form.room) : null };
      const url = editId ? `/api/classmanagement/schedules/${editId}/` : '/api/classmanagement/schedules/';
      const r = await apiFetch(url, { method: editId ? 'PUT' : 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { 
        const e = await r.json().catch(() => ({})); 
        // Check if it's a conflict error
        if (e.conflicts) {
          setConflictWarning(e.conflicts);
        }
        throw new Error(e.detail || JSON.stringify(e)); 
      }
      setShowForm(false); await onRefresh();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this schedule entry?')) return;
    try {
      const r = await apiFetch(`/api/classmanagement/schedules/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Delete failed (${r.status})`);
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const handleAutoGenerate = async () => {
    const sec = sections.find((s) => String(s.id) === filterSection);
    const secName = sec ? `${gradeLabel(sec.grade_level)} — ${sec.name}` : 'selected section';
    if (!window.confirm(`Auto-generate schedules for ${secName}?\n\nThis will fill empty slots based on CESI schedule template (with recess and lunch breaks).`)) return;
    setGenerating(true);
    try {
      const payload = { section: Number(filterSection) };
      const r = await apiFetch('/api/classmanagement/schedules/auto-generate/', {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed');
      alert(`Created ${data.created_count} schedule entries.`);
      await onRefresh();
    } catch (e) { alert(e.message); } finally { setGenerating(false); }
  };

  /* Get room name helper */
  const getRoomCode = (roomId) => {
    const room = rooms.find(r => r.id === roomId);
    return room ? room.code : '—';
  };

  return (
    <>
      {/* Controls */}
      <div className="admin-class-controls schedule-controls">
        <div className="admin-filter-box">
          <Filter size={18} />
          <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
            {sections.map((sec) => <option key={sec.id} value={sec.id}>{gradeLabel(sec.grade_level)} — {sec.name}</option>)}
          </select>
        </div>
        <div className="schedule-view-toggle">
          <button className={`admin-tab-btn small ${view === 'timeline' ? 'active' : ''}`} onClick={() => setView('timeline')}>Timeline</button>
          <button className={`admin-tab-btn small ${view === 'table' ? 'active' : ''}`} onClick={() => setView('table')}>Table</button>
        </div>
        <button className="admin-btn-primary" onClick={openNew}><Plus size={18} /> Add Entry</button>
        <button className="admin-btn-primary" onClick={handleAutoGenerate} disabled={generating} style={{ background: '#8b5cf6' }}>
          <Zap size={18} /> {generating ? 'Generating…' : 'Auto-fill'}
        </button>
        {selected.size > 0 && (
          <>
            <button className="admin-btn-primary" onClick={openBulkEdit} style={{ background: '#f59e0b' }}>
              <Edit2 size={18} /> Edit Selected ({selected.size})
            </button>
            <button className="admin-btn-delete" onClick={handleBulkDelete} disabled={bulkDeleting} style={{ padding: '10px 20px' }}>
              <Trash2 size={18} /> {bulkDeleting ? 'Deleting…' : `Delete Selected (${selected.size})`}
            </button>
          </>
        )}
      </div>

      {/* Form Modal */}
      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 620 }}>
            <h2>{editId ? 'Edit Schedule Entry' : 'New Schedule Entry'}</h2>
            {error && (
              <div className="admin-error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}
            {conflictWarning && (
              <div className="admin-warning-box">
                <AlertTriangle size={18} />
                <div>
                  <strong>Schedule Conflicts Detected:</strong>
                  <ul>
                    {conflictWarning.map((c, i) => (
                      <li key={i}><span className={`conflict-type ${c.type}`}>{c.type}</span> {c.message}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Section *</label>
                <select value={form.section} onChange={(e) => setForm({ ...form, section: e.target.value })}>
                  <option value="">Select…</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{gradeLabel(s.grade_level)} — {s.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Subject *</label>
                <select value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })}>
                  <option value="">Select…</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Teacher *</label>
                <select value={form.teacher} onChange={(e) => setForm({ ...form, teacher: e.target.value })}>
                  <option value="">Select…</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Day *</label>
                <select value={form.day_of_week} onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}>
                  <option value="">Select…</option>
                  {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="admin-form-group">
                <label>Start Time *</label>
                <input type="time" value={form.start_time} onChange={(e) => setForm({ ...form, start_time: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label>End Time *</label>
                <input type="time" value={form.end_time} onChange={(e) => setForm({ ...form, end_time: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label>Room</label>
                <select value={form.room} onChange={(e) => setForm({ ...form, room: e.target.value })}>
                  <option value="">— No Room —</option>
                  {rooms.filter(r => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.code} {r.name && `(${r.name})`}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      {/* Bulk Edit Modal */}
      {showBulkEdit && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 620 }}>
            <h2>Bulk Edit — {selected.size} Entries</h2>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>Only fields you fill in will be changed. Leave blank to keep current values.</p>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Section</label>
                <select value={bulkForm.section} onChange={(e) => setBulkForm({ ...bulkForm, section: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {sections.map((s) => <option key={s.id} value={s.id}>{gradeLabel(s.grade_level)} — {s.name}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Subject</label>
                <select value={bulkForm.subject} onChange={(e) => setBulkForm({ ...bulkForm, subject: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {subjects.map((s) => <option key={s.id} value={s.id}>{s.name} ({s.code})</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Teacher</label>
                <select value={bulkForm.teacher} onChange={(e) => setBulkForm({ ...bulkForm, teacher: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {teachers.map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                </select>
              </div>
              <div className="admin-form-group">
                <label>Day</label>
                <select value={bulkForm.day_of_week} onChange={(e) => setBulkForm({ ...bulkForm, day_of_week: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {DAYS.map((d) => <option key={d.value} value={d.value}>{d.label}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="admin-form-group">
                <label>Start Time</label>
                <input type="time" value={bulkForm.start_time} onChange={(e) => setBulkForm({ ...bulkForm, start_time: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label>End Time</label>
                <input type="time" value={bulkForm.end_time} onChange={(e) => setBulkForm({ ...bulkForm, end_time: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label>Room</label>
                <select value={bulkForm.room} onChange={(e) => setBulkForm({ ...bulkForm, room: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {rooms.filter(r => r.is_active).map((r) => <option key={r.id} value={r.id}>{r.code}</option>)}
                </select>
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowBulkEdit(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleBulkEdit} disabled={bulkSaving} style={{ background: '#f59e0b' }}>
                {bulkSaving ? 'Updating…' : `Update ${selected.size} Entries`}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* TABLE VIEW */}
      {view === 'table' && (
        <div className="admin-schedule-container">
          <table className="admin-schedule-table enhanced-table">
            <thead><tr>
              <th style={{ width: 40, textAlign: 'center' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all" />
              </th>
              <th>Section</th><th>Subject</th><th>Teacher</th><th>Day</th><th>Time</th><th>Room</th><th>Actions</th>
            </tr></thead>
            <tbody>
              {filtered.length === 0 && <tr><td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>No schedule entries.</td></tr>}
              {filtered.map((s) => {
                const colors = colorFor(s.subject);
                return (
                  <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input type="checkbox" checked={selected.has(s.id)} onChange={() => toggleSelect(s.id)} />
                    </td>
                    <td><span className="section-badge">{s.section_name}</span></td>
                    <td>
                      <span className="subject-badge" style={{ backgroundColor: colors.bg, color: colors.text, borderColor: colors.border }}>
                        {s.subject_name}
                      </span>
                    </td>
                    <td><span className="teacher-name">{s.teacher_name}</span></td>
                    <td><span className="day-badge">{dayShort(s.day_of_week)}</span></td>
                    <td>
                      <span className="time-display">
                        <Clock size={14} /> {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                    </td>
                    <td>
                      {s.room ? (
                        <span className="room-badge"><Home size={14} /> {s.room_code}</span>
                      ) : (
                        <span className="no-room">—</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="admin-btn-edit" onClick={() => openEdit(s)} title="Edit"><Edit2 size={16} /></button>
                        <button className="admin-btn-delete" onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={16} /></button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* TIMELINE VIEW */}
      {view === 'timeline' && (
        <>
          {filtered.length > 0 && (
            <div className="bulk-select-bar">
              <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', fontSize: 13, color: '#4b5563' }}>
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {allSelected ? 'Deselect all' : `Select all ${filtered.length} entries`}
              </label>
              {selected.size > 0 && <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>{selected.size} selected</span>}
            </div>
          )}
          <div className="admin-schedule-container timeline-container">
            <table className="schedule-timeline-table">
              <thead>
                <tr>
                  <th className="timeline-time-col">Time</th>
                  {DAYS.map((d) => <th key={d.value} className="timeline-day-header">{d.label}</th>)}
                </tr>
              </thead>
              <tbody>
                {TIME_SLOTS.map((slot) => (
                  <tr key={slot.hour} className="timeline-row">
                    <td className="timeline-time-cell">{slot.label}</td>
                    {DAYS.map((d) => {
                      const entries = filtered.filter((s) => overlapsHour(s, d.value, slot.hour));
                      return (
                        <td key={d.value} className="timeline-cell">
                          {entries.map((entry) => {
                            const colors = colorFor(entry.subject);
                            return (
                              <div key={entry.id} 
                                className={`timeline-block ${selected.has(entry.id) ? 'timeline-block--selected' : ''}`}
                                style={{ 
                                  backgroundColor: colors.bg, 
                                  borderLeftColor: colors.border,
                                  color: colors.text 
                                }}
                                title={`${entry.subject_name} — ${entry.teacher_name}\n${formatTime(entry.start_time)}–${formatTime(entry.end_time)}${entry.room_code ? ' • Room ' + entry.room_code : ''}\nClick to select · Double-click to edit`}
                                onClick={() => toggleSelect(entry.id)}
                                onDoubleClick={() => openEdit(entry)}>
                                <input 
                                  type="checkbox" 
                                  checked={selected.has(entry.id)} 
                                  onChange={() => toggleSelect(entry.id)}
                                  onClick={(e) => e.stopPropagation()}
                                  className="timeline-checkbox" />
                                <div className="timeline-block-title">{entry.subject_name}</div>
                                <div className="timeline-block-meta">{entry.teacher_name}</div>
                                {entry.room_code && <div className="timeline-block-room"><Home size={10} /> {entry.room_code}</div>}
                              </div>
                            );
                          })}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </>
  );
}

/* ═════════════════════════════════════════════════════════
   SUBJECTS TAB — full CRUD + teacher assignment
   ═════════════════════════════════════════════════════════ */
function SubjectsTab({ subjects, teachers, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState({ name: '', code: '', assigned_teacher: '' });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', assigned_teacher: '' });

  const handleCreate = async () => {
    setFormError('');
    if (!form.name || !form.code) { setFormError('Name and code are required.'); return; }
    setSaving(true);
    try {
      const payload = { name: form.name, code: form.code };
      if (form.assigned_teacher) payload.assigned_teacher = Number(form.assigned_teacher);
      const r = await apiFetch('/api/accounts/subjects/', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
      setShowForm(false); setForm({ name: '', code: '', assigned_teacher: '' }); await onRefresh();
    } catch (e) { setFormError(e.message); } finally { setSaving(false); }
  };

  const startEdit = (subj) => {
    const cur = subj.teachers?.length > 0 ? String(subj.teachers[0].id) : '';
    setEditingId(subj.id); setEditForm({ name: subj.name, code: subj.code, assigned_teacher: cur });
  };

  const saveEdit = async (id) => {
    try {
      const payload = { name: editForm.name, code: editForm.code, assigned_teacher: editForm.assigned_teacher ? Number(editForm.assigned_teacher) : null };
      const r = await apiFetch(`/api/accounts/subjects/${id}/`, { method: 'PUT', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(payload) });
      if (!r.ok) throw new Error('Failed to update');
      setEditingId(null); await onRefresh();
    } catch (e) { alert(e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this subject? Related schedules and grades will also be removed.')) return;
    try {
      const r = await apiFetch(`/api/accounts/subjects/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Delete failed (${r.status})`);
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const getAvailableTeachers = (curSubjId = null) => {
    const assigned = new Set();
    subjects.forEach((s) => { if (s.id === curSubjId) return; (s.teachers || []).forEach((t) => assigned.add(t.id)); });
    return teachers.filter((t) => !assigned.has(t.id));
  };

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Subject Management</h2>
        <button className="admin-btn-primary" onClick={() => setShowForm(true)}><Plus size={18} /> Add Subject</button>
      </div>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <h2>Add Subject</h2>
            {formError && <div style={{ color: '#ef4444', marginBottom: 8 }}>{formError}</div>}
            <div className="admin-form-group">
              <label>Subject Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. Mathematics" />
            </div>
            <div className="admin-form-group">
              <label>Subject Code *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. MATH" />
            </div>
            <div className="admin-form-group">
              <label>Assign Teacher</label>
              <select value={form.assigned_teacher} onChange={(e) => setForm({ ...form, assigned_teacher: e.target.value })}>
                <option value="">— No teacher —</option>
                {getAvailableTeachers().map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
              </select>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleCreate} disabled={saving}>{saving ? 'Saving…' : 'Save Subject'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-schedule-container">
        {subjects.length > 0 ? (
          <table className="admin-schedule-table enhanced-table">
            <thead><tr><th>ID</th><th>Subject Name</th><th>Code</th><th>Assigned Teacher</th><th>Actions</th></tr></thead>
            <tbody>
              {subjects.map((s) => {
                const isEditing = editingId === s.id;
                const assigned = s.teachers?.length > 0 ? s.teachers[0] : null;
                return (
                  <tr key={s.id}>
                    <td>{s.id}</td>
                    <td>{isEditing ? <input className="inline-input" value={editForm.name} onChange={(e) => setEditForm({ ...editForm, name: e.target.value })} style={{ width: '100%' }} /> : <strong>{s.name}</strong>}</td>
                    <td>{isEditing ? <input className="inline-input" value={editForm.code} onChange={(e) => setEditForm({ ...editForm, code: e.target.value })} style={{ width: 80 }} /> : s.code}</td>
                    <td>
                      {isEditing ? (
                        <select className="inline-select" value={editForm.assigned_teacher} onChange={(e) => setEditForm({ ...editForm, assigned_teacher: e.target.value })} style={{ width: '100%' }}>
                          <option value="">— None —</option>
                          {getAvailableTeachers(s.id).map((t) => <option key={t.id} value={t.id}>{t.username}</option>)}
                          {assigned && !getAvailableTeachers(s.id).find((t) => t.id === assigned.id) && <option value={assigned.id}>{assigned.username}</option>}
                        </select>
                      ) : assigned ? <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}><UserCheck size={14} />{assigned.username}</span> : <span style={{ color: '#94a3b8' }}>Unassigned</span>}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {isEditing ? (
                          <><button className="admin-btn-edit" onClick={() => saveEdit(s.id)} title="Save"><Save size={16} /></button>
                          <button className="admin-btn-delete" onClick={() => setEditingId(null)} title="Cancel"><X size={16} /></button></>
                        ) : (
                          <><button className="admin-btn-edit" onClick={() => startEdit(s)} title="Edit"><Edit2 size={16} /></button>
                          <button className="admin-btn-delete" onClick={() => handleDelete(s.id)} title="Delete"><Trash2 size={16} /></button></>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="admin-no-results"><BookOpen size={48} /><p>No subjects yet. Add one above.</p></div>
        )}
      </div>
    </>
  );
}

/* ═════════════════════════════════════════════════════════
   ROOMS TAB — manage school rooms
   ═════════════════════════════════════════════════════════ */
function RoomsTab({ rooms, schedules, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ code: '', name: '', capacity: 40, is_active: true });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditId(null);
    setForm({ code: '', name: '', capacity: 40, is_active: true });
    setError('');
    setShowForm(true);
  };
  
  const openEdit = (room) => {
    setEditId(room.id);
    setForm({ code: room.code, name: room.name || '', capacity: room.capacity || 40, is_active: room.is_active });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code) { setError('Room code is required.'); return; }
    setSaving(true); setError('');
    try {
      const url = editId ? `/api/classmanagement/rooms/${editId}/` : '/api/classmanagement/rooms/';
      const r = await apiFetch(url, { 
        method: editId ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
      setShowForm(false); await onRefresh();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this room? Schedules using this room will have no room assigned.')) return;
    try {
      const r = await apiFetch(`/api/classmanagement/rooms/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Delete failed (${r.status})`);
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const getRoomUsage = (roomId) => {
    return schedules.filter(s => s.room === roomId).length;
  };

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Room Management</h2>
        <button className="admin-btn-primary" onClick={openNew}><Plus size={18} /> Add Room</button>
      </div>

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>{editId ? 'Edit Room' : 'Add Room'}</h2>
            {error && <div className="admin-error-box"><AlertCircle size={18} /><span>{error}</span></div>}
            <div className="admin-form-group">
              <label>Room Code *</label>
              <input type="text" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="e.g. 1F-A" />
            </div>
            <div className="admin-form-group">
              <label>Room Name</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. First Floor Room A" />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Capacity</label>
                <input type="number" value={form.capacity} onChange={(e) => setForm({ ...form, capacity: parseInt(e.target.value) || 40 })} min="1" />
              </div>
              <div className="admin-form-group">
                <label>Status</label>
                <select value={form.is_active ? 'active' : 'inactive'} onChange={(e) => setForm({ ...form, is_active: e.target.value === 'active' })}>
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-rooms-grid">
        {rooms.length === 0 ? (
          <div className="admin-no-results"><Home size={48} /><p>No rooms yet. Add one to get started.</p></div>
        ) : (
          rooms.map((room) => {
            const usage = getRoomUsage(room.id);
            return (
              <div key={room.id} className={`admin-room-card ${!room.is_active ? 'inactive' : ''}`}>
                <div className="room-card-header">
                  <div className="room-code">{room.code}</div>
                  <span className={`room-status ${room.is_active ? 'active' : 'inactive'}`}>
                    {room.is_active ? 'Active' : 'Inactive'}
                  </span>
                </div>
                <div className="room-card-body">
                  {room.name && <div className="room-name">{room.name}</div>}
                  <div className="room-info">
                    <span><Users size={14} /> Capacity: {room.capacity}</span>
                    <span><Calendar size={14} /> {usage} schedules</span>
                  </div>
                </div>
                <div className="room-card-actions">
                  <button className="admin-btn-edit" onClick={() => openEdit(room)}><Edit2 size={16} /> Edit</button>
                  <button className="admin-btn-delete" onClick={() => handleDelete(room.id)}><Trash2 size={16} /></button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </>
  );
}

/* ═════════════════════════════════════════════════════════
   SCHOOL YEAR TAB — manage school years with activation
   ═════════════════════════════════════════════════════════ */
function SchoolYearTab({ schoolYears, onRefresh }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', start_date: '', end_date: '', is_active: false });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const openNew = () => {
    setEditId(null);
    // Default to next school year name
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const yearStart = month >= 5 ? currentYear : currentYear - 1; // June onwards = new school year
    setForm({ 
      name: `${yearStart}-${yearStart + 1}`, 
      start_date: `${yearStart}-06-01`, 
      end_date: `${yearStart + 1}-03-31`, 
      is_active: false 
    });
    setError('');
    setShowForm(true);
  };

  const openEdit = (sy) => {
    setEditId(sy.id);
    setForm({ 
      name: sy.name, 
      start_date: sy.start_date, 
      end_date: sy.end_date, 
      is_active: sy.is_active 
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) { 
      setError('All fields are required.'); 
      return; 
    }
    setSaving(true); setError('');
    try {
      const url = editId ? `/api/classmanagement/school-years/${editId}/` : '/api/classmanagement/school-years/';
      const r = await apiFetch(url, { 
        method: editId ? 'PUT' : 'POST', 
        headers: { 'Content-Type': 'application/json' }, 
        body: JSON.stringify(form) 
      });
      if (!r.ok) { const e = await r.json().catch(() => ({})); throw new Error(e.detail || JSON.stringify(e)); }
      setShowForm(false); await onRefresh();
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Activate this school year? This will deactivate all other school years.')) return;
    try {
      const r = await apiFetch(`/api/classmanagement/school-years/${id}/activate/`, { method: 'POST' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || 'Activation failed');
      }
      await onRefresh();
    } catch (e) { alert('Activation failed: ' + e.message); }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this school year? This may also delete related schedules.')) return;
    try {
      const r = await apiFetch(`/api/classmanagement/school-years/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(err.detail || `Delete failed (${r.status})`);
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch') 
        ? 'Cannot connect to server. Is the backend running?' 
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const activeYear = schoolYears.find(sy => sy.is_active);

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>School Year Management</h2>
        <button className="admin-btn-primary" onClick={openNew}><Plus size={18} /> Add School Year</button>
      </div>

      {activeYear && (
        <div className="admin-active-year-banner">
          <div className="active-year-content">
            <Settings size={20} />
            <div>
              <strong>Active School Year:</strong> {activeYear.name}
              <span className="active-year-dates">
                ({formatDate(activeYear.start_date)} – {formatDate(activeYear.end_date)})
              </span>
            </div>
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <h2>{editId ? 'Edit School Year' : 'Add School Year'}</h2>
            {error && <div className="admin-error-box"><AlertCircle size={18} /><span>{error}</span></div>}
            <div className="admin-form-group">
              <label>School Year Name *</label>
              <input type="text" value={form.name} onChange={(e) => setForm({ ...form, name: e.target.value })} placeholder="e.g. 2025-2026" />
            </div>
            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Start Date *</label>
                <input type="date" value={form.start_date} onChange={(e) => setForm({ ...form, start_date: e.target.value })} />
              </div>
              <div className="admin-form-group">
                <label>End Date *</label>
                <input type="date" value={form.end_date} onChange={(e) => setForm({ ...form, end_date: e.target.value })} />
              </div>
            </div>
            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>Cancel</button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>{saving ? 'Saving…' : editId ? 'Update' : 'Create'}</button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-school-years-list">
        {schoolYears.length === 0 ? (
          <div className="admin-no-results"><Calendar size={48} /><p>No school years yet. Add one to get started.</p></div>
        ) : (
          schoolYears.map((sy) => (
            <div key={sy.id} className={`admin-school-year-card ${sy.is_active ? 'active' : ''}`}>
              <div className="sy-card-header">
                <div className="sy-name">{sy.name}</div>
                {sy.is_active && <span className="sy-active-badge">ACTIVE</span>}
              </div>
              <div className="sy-card-body">
                <div className="sy-dates">
                  <Calendar size={14} />
                  <span>{formatDate(sy.start_date)} – {formatDate(sy.end_date)}</span>
                </div>
              </div>
              <div className="sy-card-actions">
                {!sy.is_active && (
                  <button className="admin-btn-primary" onClick={() => handleActivate(sy.id)} style={{ background: '#10b981' }}>
                    <Zap size={16} /> Activate
                  </button>
                )}
                <button className="admin-btn-edit" onClick={() => openEdit(sy)}><Edit2 size={16} /></button>
                <button className="admin-btn-delete" onClick={() => handleDelete(sy.id)} disabled={sy.is_active} title={sy.is_active ? 'Cannot delete active year' : 'Delete'}>
                  <Trash2 size={16} />
                </button>
              </div>
            </div>
          ))
        )}
      </div>
    </>
  );
}

export default ClassManagement;
