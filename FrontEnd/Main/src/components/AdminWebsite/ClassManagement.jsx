import React, { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import {
  Plus, Edit2, Trash2, Filter, Clock, Users, BookOpen, FileDown , 
  Calendar, Save, X, UserCheck, Zap, Download,
  Home, AlertTriangle, Settings, AlertCircle, RefreshCw,
  Copy
} from 'lucide-react';
import StatCard, { StatsGrid } from './StatCard';
import { apiFetch } from '../api/apiFetch';
import '../AdminWebsiteCSS/AdminClassManagement.css';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import PreviewModal from '../PreviewModal';
import Toast from '../Global/Toast';

/* ───────────────────────── helpers ───────────────────────── */
const GRADE_LEVELS = [
  { value: 'prek', label: 'Pre-Kinder' },
  { value: 'kinder', label: 'Kinder' },
  { value: 'grade1', label: 'Grade 1' },
  { value: 'grade2', label: 'Grade 2' },
  { value: 'grade3', label: 'Grade 3' },
  { value: 'grade4', label: 'Grade 4' },
  { value: 'grade5', label: 'Grade 5' },
  { value: 'grade6', label: 'Grade 6' },
];

const DAYS = [
  { value: 'MON', label: 'Monday', short: 'Mon' },
  { value: 'TUE', label: 'Tuesday', short: 'Tue' },
  { value: 'WED', label: 'Wednesday', short: 'Wed' },
  { value: 'THU', label: 'Thursday', short: 'Thu' },
  { value: 'FRI', label: 'Friday', short: 'Fri' },
];

const normalizeGradeCode = (value) => {
  if (value === null || value === undefined) return '';

  const v = String(value).trim().toLowerCase();

  const map = {
    '0': 'kinder',
    '1': 'grade1',
    '2': 'grade2',
    '3': 'grade3',
    '4': 'grade4',
    '5': 'grade5',
    '6': 'grade6',
    'kinder': 'kinder',
    'grade1': 'grade1',
    'grade2': 'grade2',
    'grade3': 'grade3',
    'grade4': 'grade4',
    'grade5': 'grade5',
    'grade6': 'grade6',
    'grade 1': 'grade1',
    'grade 2': 'grade2',
    'grade 3': 'grade3',
    'grade 4': 'grade4',
    'grade 5': 'grade5',
    'grade 6': 'grade6',
    'pre-kinder': 'prek',
    'pre kinder': 'prek',
    'pre_kinder': 'prek',
    'prekindergarten': 'prek',
    'pre-kindergarten': 'prek',
    'prek': 'prek',
  };

  return map[v] || '';
};

const gradeCodeForLevel = (lvl) => normalizeGradeCode(lvl);

const gradeLabel = (lvl) => {
  const code = normalizeGradeCode(lvl);
  const labels = {
    prek: 'Pre-Kinder',
    kinder: 'Kinder',
    grade1: 'Grade 1',
    grade2: 'Grade 2',
    grade3: 'Grade 3',
    grade4: 'Grade 4',
    grade5: 'Grade 5',
    grade6: 'Grade 6',
  };
  return labels[code] || String(lvl || '—');
};

const dayShort = (code) => DAYS.find((d) => d.value === code)?.short ?? code;

const getEnrollmentSectionId = (enrollment) => {
  if (!enrollment) return null;
  const raw = enrollment.section;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSectionRoomId = (section) => {
  if (!section) return null;
  const raw = section.room;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSectionSchoolYearId = (section) => {
  if (!section) return null;
  const raw = section.school_year;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getScheduleSectionId = (schedule) => {
  if (!schedule) return null;
  const raw = schedule.section;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getScheduleTeacherUserId = (schedule) => {
  if (!schedule) return null;
  const raw = schedule.teacher;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getScheduleSchoolYearId = (schedule) => {
  if (!schedule) return null;
  const raw = schedule.school_year;
  if (raw === null || raw === undefined || raw === '') return null;
  if (typeof raw === 'object') {
    const nestedId = Number(raw.id);
    return Number.isFinite(nestedId) ? nestedId : null;
  }
  const parsed = Number(raw);
  return Number.isFinite(parsed) ? parsed : null;
};

const getSectionCapacityLimit = (section, rooms) => {
  const roomId = getSectionRoomId(section);
  const linkedRoom = roomId
    ? (rooms || []).find((room) => Number(room.id) === Number(roomId))
    : null;

  const roomCapacity = Number(linkedRoom?.capacity);
  if (Number.isFinite(roomCapacity) && roomCapacity > 0) return roomCapacity;

  const sectionCapacity = Number(section?.capacity);
  if (Number.isFinite(sectionCapacity) && sectionCapacity > 0) return sectionCapacity;

  return 40;
};

const formatSectionApiError = (payload, fallback = 'Request failed.') => {
  if (!payload) return fallback;

  if (typeof payload === 'string') {
    return payload.trim() || fallback;
  }

  if (typeof payload !== 'object') {
    return fallback;
  }

  if (payload.detail) {
    return String(payload.detail);
  }

  const priorityKeys = ['adviser', 'room', 'grade_level', 'name', 'school_year', 'non_field_errors'];
  for (const key of priorityKeys) {
    const value = payload[key];
    if (Array.isArray(value) && value.length > 0) {
      return value.map((item) => String(item)).join(' ');
    }
    if (typeof value === 'string' && value.trim()) {
      return value;
    }
  }

  const firstEntry = Object.entries(payload).find(([, value]) => value !== null && value !== undefined);
  if (firstEntry) {
    const [field, value] = firstEntry;
    if (Array.isArray(value) && value.length > 0) {
      return `${field}: ${value.map((item) => String(item)).join(' ')}`;
    }
    if (typeof value === 'string' && value.trim()) {
      return `${field}: ${value}`;
    }
  }

  return fallback;
};

const gradeRoomPrefix = (gradeLevel) => {
  const code = normalizeGradeCode(gradeLevel);
  const map = {
    prek: 'PREK',
    kinder: 'KD',
    grade1: 'G1',
    grade2: 'G2',
    grade3: 'G3',
    grade4: 'G4',
    grade5: 'G5',
    grade6: 'G6',
  };
  return map[code] || 'GEN';
};

const buildNextRoomCode = (gradeLevel, rooms) => {
  const prefix = `${gradeRoomPrefix(gradeLevel)}-RM`;
  const existing = new Set((rooms || []).map((r) => String(r.code || '').trim().toUpperCase()));
  let sequence = 1;
  while (sequence <= 999) {
    const candidate = `${prefix}${String(sequence).padStart(2, '0')}`;
    if (!existing.has(candidate)) {
      return { code: candidate, sequence };
    }
    sequence += 1;
  }
  return { code: `${prefix}${Date.now()}`, sequence: 0 };
};

const buildNextSectionName = (gradeLevel, sections, sourceName) => {
  const normalizedGrade = normalizeGradeCode(gradeLevel);
  const gradeSections = (sections || []).filter(
    (s) => normalizeGradeCode(s.grade_level) === normalizedGrade
  );
  const existingNames = new Set(
    gradeSections.map((s) => String(s.name || '').trim().toLowerCase()).filter(Boolean)
  );

  const baseName = String(sourceName || '').trim() || 'Section';

  let sequence = 2;
  while (sequence <= 999) {
    const candidate = `${baseName} ${sequence}`;
    if (!existingNames.has(candidate.toLowerCase())) return candidate;
    sequence += 1;
  }

  return `${baseName} ${Date.now()}`;
};

/* Helper: determine if a class is Ongoing (has active students) or Expired (no active students) */
const getClassStatus = (section, enrollments) => {
  const gradeCode = normalizeGradeCode(section.grade_level);
  const activeForGrade = enrollments.filter(
    (e) => normalizeGradeCode(e.grade_level) === gradeCode && e.status === 'ACTIVE'
  );
  const assignedToSection = activeForGrade.filter(
    (e) => Number(getEnrollmentSectionId(e)) === Number(section.id)
  );
  // Ongoing if has active students; Expired if no active students
  return assignedToSection.length > 0 ? 'ONGOING' : 'EXPIRED';
};

/* Subject color palette - more distinct and readable */
const COLORS = [
  { bg: '#dbeafe', text: '#1e40af', border: '#3b82f6' },
  { bg: '#dcfce7', text: '#166534', border: '#22c55e' },
  { bg: '#fef3c7', text: '#92400e', border: '#f59e0b' },
  { bg: '#fce7f3', text: '#9d174d', border: '#ec4899' },
  { bg: '#e0e7ff', text: '#3730a3', border: '#6366f1' },
  { bg: '#d1fae5', text: '#065f46', border: '#10b981' },
  { bg: '#ffedd5', text: '#9a3412', border: '#f97316' },
  { bg: '#f3e8ff', text: '#6b21a8', border: '#a855f7' },
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

/* helper: normalize time string into sortable HH:MM:SS key */
const normalizeTimeKey = (t) => {
  if (!t) return '';
  const [h = '00', m = '00', s = '00'] = String(t).split(':');
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
};

/* ═══════════════════════ MAIN COMPONENT ═══════════════════════ */
const ClassManagement = () => {
  const CM_SKELETON_TABS = 5;
  const CM_SKELETON_CLASS_CARDS = 3;
  const [activeTab, setActiveTab] = useState('classes');
  const [loading, setLoading] = useState(true);
  const [classPreviewOpen, setClassPreviewOpen] = useState(false);
  const [classPreviewData, setClassPreviewData] = useState([]);
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

  /* data from API */
  const [sections, setSections] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [teachers, setTeachers] = useState([]);
  const [enrollments, setEnrollments] = useState([]);
  const [schedules, setSchedules] = useState([]);
  const [rooms, setRooms] = useState([]);
  const [schoolYears, setSchoolYears] = useState([]);

  const activeSchoolYear = useMemo(
    () => schoolYears.find((sy) => sy.is_active) || null,
    [schoolYears]
  );

  /* fetchers */
  const fetchSections = useCallback(async () => {
    try {
      const r = await apiFetch('/api/accounts/sections/');
      if (r.ok) setSections(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSubjects = useCallback(async () => {
    try {
      const r = await apiFetch('/api/accounts/subjects/');
      if (r.ok) setSubjects(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchTeachers = useCallback(async () => {
    try {
      const r = await apiFetch('/api/accounts/users/?role=TEACHER');
      if (r.ok) setTeachers(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchEnrollments = useCallback(async () => {
    try {
      const r = await apiFetch('/api/enrollments/');
      if (r.ok) setEnrollments(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSchedules = useCallback(async () => {
    try {
      const r = await apiFetch('/api/classmanagement/schedules/');
      if (r.ok) setSchedules(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchRooms = useCallback(async () => {
    try {
      const r = await apiFetch('/api/classmanagement/rooms/');
      if (r.ok) setRooms(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  const fetchSchoolYears = useCallback(async () => {
    try {
      const r = await apiFetch('/api/classmanagement/school-years/');
      if (r.ok) setSchoolYears(await r.json());
    } catch (e) {
      console.error(e);
    }
  }, []);

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([
        fetchSections(),
        fetchSubjects(),
        fetchTeachers(),
        fetchEnrollments(),
        fetchSchedules(),
        fetchRooms(),
        fetchSchoolYears(),
      ]);
      setLoading(false);
    })();
  }, [
    fetchSections,
    fetchSubjects,
    fetchTeachers,
    fetchEnrollments,
    fetchSchedules,
    fetchRooms,
    fetchSchoolYears,
  ]);

  /* stats */
  const totalStudents = sections.reduce((s, sec) => s + (sec.student_count || 0), 0);

  /* single refresh-all helper so deletes in one tab update counts everywhere */
  const refreshAll = useCallback(
    () =>
      Promise.all([
        fetchSections(),
        fetchSubjects(),
        fetchTeachers(),
        fetchEnrollments(),
        fetchSchedules(),
        fetchRooms(),
        fetchSchoolYears(),
      ]),
    [
      fetchSections,
      fetchSubjects,
      fetchTeachers,
      fetchEnrollments,
      fetchSchedules,
      fetchRooms,
      fetchSchoolYears,
    ]
  );

  // Print Function for Class Management
  const printClassesToPDF = (sections, enrollments) => {
    console.log('Print button clicked!', { sections, enrollments });
    
    if (!sections || sections.length === 0) {
      alert('No sections available to export');
      return;
    }

    const previewData = sections.map((sec) => ({
      "Section": sec.name || "N/A",
      "Grade Level": sec.grade_level || "N/A",
      "Room": sec.room_code || "TBA",
      "Students": enrollments.filter((e) => String(e.section?.id || e.section) === String(sec.id)).length,
      "Capacity": sec.capacity || "N/A",
    }));

    console.log('Preview data:', previewData);
    setClassPreviewData(previewData);
    setClassPreviewOpen(true);
  };

  if (loading) {
    return (
      <div className="admin-class-management">
        <div className="cm-stats-section cm-skeleton-panel">
          <div className="cm-stats-header cm-skeleton-header">
            <div className="cm-skeleton-line cm-skeleton-title" />
            <div className="cm-skeleton-actions">
              <div className="cm-skeleton-line cm-skeleton-icon-btn" />
              <div className="cm-skeleton-line cm-skeleton-icon-btn" />
            </div>
          </div>
          <StatsGrid>
            <div className="unified-stat-card cm-skeleton-stat-card">
              <div className="cm-skeleton-line w-md" />
              <div className="cm-skeleton-line w-sm" />
            </div>
            <div className="unified-stat-card cm-skeleton-stat-card">
              <div className="cm-skeleton-line w-md" />
              <div className="cm-skeleton-line w-sm" />
            </div>
            <div className="unified-stat-card cm-skeleton-stat-card">
              <div className="cm-skeleton-line w-md" />
              <div className="cm-skeleton-line w-sm" />
            </div>
            <div className="unified-stat-card cm-skeleton-stat-card">
              <div className="cm-skeleton-line w-md" />
              <div className="cm-skeleton-line w-sm" />
            </div>
          </StatsGrid>
        </div>

        <div className="admin-tabs-container cm-skeleton-tabs">
          {Array.from({ length: CM_SKELETON_TABS }).map((_, idx) => (
            <div key={`cm-skeleton-tab-${idx}`} className="cm-skeleton-line cm-skeleton-tab" />
          ))}
        </div>

        <div className="admin-section-header cm-skeleton-section-head" style={{ marginBottom: 16 }}>
          <div className="cm-skeleton-line cm-skeleton-section-title" />
          <div className="cm-skeleton-line cm-skeleton-btn" />
        </div>

        <div className="admin-classes-grid cm-skeleton-grid">
          {Array.from({ length: CM_SKELETON_CLASS_CARDS }).map((_, idx) => (
            <div key={`cm-skeleton-card-${idx}`} className="admin-class-card cm-skeleton-card" aria-hidden="true">
              <div className="admin-class-card-header cm-skeleton-card-header">
                <div>
                  <div className="cm-skeleton-line w-md" />
                  <div className="cm-skeleton-line w-sm" style={{ marginTop: 8 }} />
                </div>
              </div>
              <div className="admin-class-card-body">
                <div className="cm-skeleton-line w-lg" style={{ marginBottom: 10 }} />
                <div className="cm-skeleton-line w-md" style={{ marginBottom: 10 }} />
                <div className="cm-skeleton-line w-sm" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="admin-class-management">
      <div className="cm-stats-section">
        <div className="cm-stats-header">
          <div className="cm-stats-title">Overview</div>
          <div className="cm-header-actions">
            <button className="cm-btn-icon" onClick={refreshAll} title="Refresh">
              <RefreshCw size={16} />
            </button>
            <button className="cm-btn-icon" onClick={() => printClassesToPDF(sections, enrollments)} title="Export Classes">
              <FileDown size={18} />
            </button>
          </div>
        </div>
        <StatsGrid>
          <StatCard
            label="Sections"
            value={sections.length}
            icon={<BookOpen size={20} />}
            color="blue"
            subtitle="Total classes"
          />
          <StatCard
            label="Total Students"
            value={totalStudents}
            icon={<Users size={20} />}
            color="green"
            subtitle={sections.length ? `Across ${sections.length} sections` : '—'}
          />
          <StatCard
            label="Subjects"
            value={subjects.length}
            icon={<BookOpen size={20} />}
            color="yellow"
            subtitle={subjects.length ? `${subjects.length} registered` : '—'}
          />
          <StatCard
            label="Schedule Entries"
            value={schedules.length}
            icon={<Clock size={20} />}
            color="purple"
            subtitle={schedules.length ? `${schedules.length} slots` : '—'}
          />
        </StatsGrid>
      </div>

      <div className="admin-tabs-container">
        <button
          className={`admin-tab-btn ${activeTab === 'classes' ? 'active' : ''}`}
          onClick={() => setActiveTab('classes')}
        >
          <BookOpen size={18} /> Classes ({sections.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'schedule' ? 'active' : ''}`}
          onClick={() => setActiveTab('schedule')}
        >
          <Calendar size={18} /> Schedules ({schedules.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'subjects' ? 'active' : ''}`}
          onClick={() => setActiveTab('subjects')}
        >
          <BookOpen size={18} /> Subjects ({subjects.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'rooms' ? 'active' : ''}`}
          onClick={() => setActiveTab('rooms')}
        >
          <Home size={18} /> Rooms ({rooms.length})
        </button>
        <button
          className={`admin-tab-btn ${activeTab === 'schoolyear' ? 'active' : ''}`}
          onClick={() => setActiveTab('schoolyear')}
        >
          <Settings size={18} /> School Year
        </button>
      </div>

      {activeTab === 'classes' && (
        <ClassesTab
          sections={sections}
          teachers={teachers}
          rooms={rooms}
          enrollments={enrollments}
          schedules={schedules}
          onRefresh={refreshAll}
          addToast={addToast}
        />
      )}
      {activeTab === 'schedule' && (
        <SchedulesTab
          sections={sections}
          subjects={subjects}
          teachers={teachers}
          schedules={schedules}
          rooms={rooms}
          schoolYears={schoolYears}
          activeSchoolYear={activeSchoolYear}
          onRefresh={refreshAll}
          addToast={addToast}
        />
      )}
      {activeTab === 'subjects' && (
        <SubjectsTab subjects={subjects} teachers={teachers} onRefresh={refreshAll} addToast={addToast} />
      )}
      {activeTab === 'rooms' && (
        <RoomsTab rooms={rooms} schedules={schedules} onRefresh={refreshAll} addToast={addToast} />
      )}
      {activeTab === 'schoolyear' && (
        <SchoolYearTab schoolYears={schoolYears} onRefresh={refreshAll} addToast={addToast} />
      )}

      <PreviewModal
        isOpen={classPreviewOpen}
        onClose={() => setClassPreviewOpen(false)}
        title="Class Management Report"
        data={classPreviewData}
        columns={[
          { key: 'Section', label: 'Section' },
          { key: 'Grade Level', label: 'Grade Level' },
          { key: 'Room', label: 'Room' },
          { key: 'Students', label: 'Students' },
          { key: 'Capacity', label: 'Capacity' },
        ]}
        filename="Class-Management-Report"
      />
      
      <Toast toasts={toasts} dismissToast={dismissToast} />
    </div>
  );
};

/* ═════════════════════════════════════════════════════════
   CLASSES TAB — sections list + homeroom teacher
   ═════════════════════════════════════════════════════════ */
function ClassesTab({ sections, teachers, rooms, enrollments, schedules, onRefresh, addToast }) {
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({ name: '', grade_level: '', adviser: '', room: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [capacityActionMessage, setCapacityActionMessage] = useState('');
  const [openingSectionId, setOpeningSectionId] = useState(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [assigningEnrollmentId, setAssigningEnrollmentId] = useState(null);
  const [classFilterGrade, setClassFilterGrade] = useState('');
  const [classFilterText, setClassFilterText] = useState('');
  const [studentSearchIn, setStudentSearchIn] = useState('');
  const [studentSearchOut, setStudentSearchOut] = useState('');
  const [swipedId, setSwipedId] = useState(null);
  const swipeStartX = useRef(0);

  const filteredSections = useMemo(() => {
    return sections.filter((sec) => {
      const gradeCode = normalizeGradeCode(sec.grade_level);
      const matchesGrade =
        !classFilterGrade ||
        classFilterGrade === 'all' ||
        gradeCode === classFilterGrade ||
        gradeLabel(sec.grade_level) === classFilterGrade;
      const text = classFilterText.trim().toLowerCase();
      const matchesText =
        !text ||
        (sec.name || '').toLowerCase().includes(text) ||
        (sec.room_code || '').toLowerCase().includes(text) ||
        (sec.adviser_name || '').toLowerCase().includes(text) ||
        gradeLabel(sec.grade_level).toLowerCase().includes(text);
      return matchesGrade && matchesText;
    });
  }, [sections, classFilterGrade, classFilterText]);

  const hasActiveClassFilter =
    (classFilterGrade && classFilterGrade !== 'all') || classFilterText.trim() !== '';

  const clearClassFilter = () => {
    setClassFilterGrade('');
    setClassFilterText('');
  };

  const sectionCapacityEntries = useMemo(() => {
    return sections.map((sec) => {
      const capacity = getSectionCapacityLimit(sec, rooms);
      const activeAssigned = enrollments.filter((e) => {
        return e.status === 'ACTIVE' && Number(getEnrollmentSectionId(e)) === Number(sec.id);
      });
      const unassignedSameGrade = enrollments.filter((e) => {
        return (
          e.status === 'ACTIVE' &&
          normalizeGradeCode(e.grade_level) === normalizeGradeCode(sec.grade_level) &&
          !getEnrollmentSectionId(e)
        );
      });

      const assignedCount = activeAssigned.length;
      const freeSlots = Math.max(capacity - assignedCount, 0);

      return {
        section: sec,
        assignedCount,
        capacity,
        freeSlots,
        availableSameGrade: unassignedSameGrade.length,
        isFull: assignedCount >= capacity,
      };
    });
  }, [sections, enrollments, rooms]);

  const gradeAvailableSlots = useMemo(() => {
    return sectionCapacityEntries.reduce((acc, entry) => {
      const gradeCode = normalizeGradeCode(entry.section.grade_level);
      acc[gradeCode] = (acc[gradeCode] || 0) + entry.freeSlots;
      return acc;
    }, {});
  }, [sectionCapacityEntries]);

  const fullSections = useMemo(() => {
    return sectionCapacityEntries
      .filter((entry) => {
        const gradeCode = normalizeGradeCode(entry.section.grade_level);
        return entry.isFull && (gradeAvailableSlots[gradeCode] || 0) === 0;
      })
      .sort((a, b) => {
        if (a.section.grade_level === b.section.grade_level) {
          return String(a.section.name).localeCompare(String(b.section.name));
        }
        return String(a.section.grade_level).localeCompare(String(b.section.grade_level));
      });
  }, [sectionCapacityEntries, gradeAvailableSlots]);

  const openNewRoomAndSection = async (fullEntry) => {
    if (!fullEntry?.section) return;

    const section = fullEntry.section;
    const sectionTitle = `${gradeLabel(section.grade_level)} - ${section.name}`;
    const gradeCode = normalizeGradeCode(section.grade_level);

    const sameGradeAvailableSections = sectionCapacityEntries.filter((entry) => {
      return (
        normalizeGradeCode(entry.section.grade_level) === gradeCode &&
        Number(entry.section.id) !== Number(section.id) &&
        entry.freeSlots > 0
      );
    });

    if (sameGradeAvailableSections.length > 0) {
      const sample = sameGradeAvailableSections
        .slice(0, 2)
        .map((entry) => `${entry.section.name} (${entry.freeSlots} slot${entry.freeSlots > 1 ? 's' : ''})`)
        .join(', ');

      setCapacityActionMessage(
        `Cannot open a new class yet. ${gradeLabel(section.grade_level)} still has available slots in: ${sample}.`
      );
      return;
    }

    const shouldOpen = window.confirm(
      `${sectionTitle} is already full (${fullEntry.assignedCount}/${fullEntry.capacity}).\n\nOpen a new room and section for ${gradeLabel(section.grade_level)} now?`
    );
    if (!shouldOpen) return;

    setCapacityActionMessage('');
    setOpeningSectionId(section.id);

    let createdRoomId = null;

    try {
      const roomSeed = buildNextRoomCode(section.grade_level, rooms);
      const currentRoom = rooms.find(
        (r) => Number(r.id) === Number(getSectionRoomId(section))
      );
      const roomCapacity = Number(currentRoom?.capacity) > 0
        ? Number(currentRoom.capacity)
        : Number(section.capacity) > 0
        ? Number(section.capacity)
        : 40;

      const roomPayload = {
        code: roomSeed.code,
        name: `${gradeLabel(section.grade_level)} Expansion Room ${roomSeed.sequence || 'New'}`,
        capacity: roomCapacity,
        is_active: true,
      };

      const roomRes = await apiFetch('/api/classmanagement/rooms/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(roomPayload),
      });
      const roomData = await roomRes.json().catch(() => ({}));
      if (!roomRes.ok) {
        throw new Error(roomData.detail || JSON.stringify(roomData) || 'Failed to create room.');
      }

      createdRoomId = roomData.id;

      const newSectionName = buildNextSectionName(section.grade_level, sections, section.name);
      const sectionPayload = {
        name: newSectionName,
        grade_level: section.grade_level,
        capacity: roomCapacity,
        adviser: null,
        room: createdRoomId,
      };

      const sectionRes = await apiFetch('/api/accounts/sections/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(sectionPayload),
      });
      const sectionData = await sectionRes.json().catch(() => ({}));
      if (!sectionRes.ok) {
        throw new Error(sectionData.detail || JSON.stringify(sectionData) || 'Failed to create section.');
      }

      await onRefresh();
      setCapacityActionMessage(
        `New class opened for ${gradeLabel(section.grade_level)}: ${sectionData.name} in room ${roomData.code}.`
      );
    } catch (e) {
      if (createdRoomId) {
        await apiFetch(`/api/classmanagement/rooms/${createdRoomId}/`, {
          method: 'DELETE',
        }).catch(() => null);
      }
      setCapacityActionMessage(e.message || 'Unable to open a new room and section right now.');
    } finally {
      setOpeningSectionId(null);
    }
  };

  const teacherProfiles = useMemo(
    () =>
      teachers
        .filter((t) => t.teacher_profile)
        .map((t) => ({
          userId: t.id,
          profileId: t.teacher_profile.id,
          username: t.username,
        })),
    [teachers]
  );

  const currentEditSection = useMemo(() => {
    if (!editId) return null;
    return sections.find((sec) => Number(sec.id) === Number(editId)) || null;
  }, [sections, editId]);

  const eligibleAdviserUserIds = useMemo(() => {
    const eligible = new Set();
    if (!currentEditSection) return eligible;

    const sectionId = Number(currentEditSection.id);
    const sectionSchoolYearId = getSectionSchoolYearId(currentEditSection);

    schedules.forEach((schedule) => {
      const scheduleSectionId = getScheduleSectionId(schedule);
      const teacherUserId = getScheduleTeacherUserId(schedule);
      const scheduleSchoolYearId = getScheduleSchoolYearId(schedule);

      if (!Number.isFinite(scheduleSectionId) || !Number.isFinite(teacherUserId)) {
        return;
      }

      if (scheduleSectionId !== sectionId) {
        return;
      }

      if (sectionSchoolYearId !== null) {
        if (!Number.isFinite(scheduleSchoolYearId) || scheduleSchoolYearId !== sectionSchoolYearId) {
          return;
        }
      }

      eligible.add(teacherUserId);
    });

    return eligible;
  }, [currentEditSection, schedules]);

  const occupiedAdviserIds = useMemo(() => {
    const occupied = new Set();
    sections.forEach((sec) => {
      if (Number(sec.id) === Number(editId)) return;
      const adviserId = Number(sec.adviser);
      if (Number.isFinite(adviserId)) {
        occupied.add(adviserId);
      }
    });
    return occupied;
  }, [sections, editId]);

  const adviserOptions = useMemo(
    () =>
      teacherProfiles.map((teacher) => {
        const isCurrentSelection = String(form.adviser || '') === String(teacher.profileId);
        const isOccupied = occupiedAdviserIds.has(Number(teacher.profileId)) && !isCurrentSelection;
        const isEligibleForSection =
          !!currentEditSection && eligibleAdviserUserIds.has(Number(teacher.userId));
        const isDisabled = isOccupied || !isEligibleForSection;
        const reason = isOccupied
          ? 'Already adviser'
          : !isEligibleForSection
          ? currentEditSection
            ? 'No schedule in this section/year'
            : 'Assign after schedules exist'
          : '';

        return {
          ...teacher,
          isOccupied,
          isEligibleForSection,
          isDisabled,
          reason,
        };
      }),
    [teacherProfiles, occupiedAdviserIds, form.adviser, currentEditSection, eligibleAdviserUserIds]
  );

  const occupiedRoomIds = useMemo(() => {
    const occupied = new Set();
    sections.forEach((sec) => {
      if (Number(sec.id) === Number(editId)) return;
      const roomId = getSectionRoomId(sec);
      if (roomId !== null && roomId !== undefined) {
        occupied.add(Number(roomId));
      }
    });
    return occupied;
  }, [sections, editId]);

  const availableRooms = useMemo(() => {
    const selectedRoomId = Number(form.room);

    return rooms.filter((room) => {
      const roomId = Number(room.id);
      if (!Number.isFinite(roomId)) return false;

      const isCurrentRoom = Number.isFinite(selectedRoomId) && selectedRoomId === roomId;
      const isUnused = !occupiedRoomIds.has(roomId);
      return (room.is_active || isCurrentRoom) && (isCurrentRoom || isUnused);
    });
  }, [rooms, occupiedRoomIds, form.room]);

  const openNew = () => {
    setEditId(null);
    setForm({ name: '', grade_level: '', adviser: '', room: '' });
    setError('');
    setShowForm(true);
  };

  const openEdit = (sec) => {
    setEditId(sec.id);
    setForm({
      name: sec.name,
      grade_level: String(sec.grade_level),
      adviser: sec.adviser ? String(sec.adviser) : '',
      room: sec.room ? String(sec.room) : '',
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name) {
      setError('Section name is required.');
      return;
    }

    if (!editId) {
      if (form.grade_level === '' || !form.grade_level) {
        setError('Grade level is required. Please select a valid grade level from the dropdown.');
        return;
      }
      const validGradeLevels = GRADE_LEVELS.map((g) => String(g.value));
      if (!validGradeLevels.includes(String(form.grade_level))) {
        setError('Invalid grade level selected. Please choose from the available options.');
        return;
      }

      if (form.adviser) {
        setError('Assign adviser after creating the section and adding schedule entries for that teacher.');
        return;
      }
    }

    if (editId && form.adviser) {
      const selectedAdviser = adviserOptions.find(
        (option) => String(option.profileId) === String(form.adviser)
      );
      if (selectedAdviser && !selectedAdviser.isEligibleForSection) {
        setError('Selected adviser must have at least one schedule in this section and school year.');
        return;
      }
    }

    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        adviser: form.adviser ? Number(form.adviser) : null,
        room: form.room ? Number(form.room) : null,
      };
      if (!editId) {
        payload.grade_level = String(form.grade_level);
      }

      const url = editId ? `/api/accounts/sections/${editId}/` : '/api/accounts/sections/';
      const r = await apiFetch(url, {
        method: editId ? 'PATCH' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      if (!r.ok) {
        const e = await r.json().catch(() => null);
        throw new Error(formatSectionApiError(e, `Save failed (${r.status})`));
      }
      setShowForm(false);
      await onRefresh();
    } catch (e) {
      setError(e.message || 'Failed to save section.');
    } finally {
      setSaving(false);
    }
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
    setStudentSearchIn('');
    setStudentSearchOut('');
    setShowStudentsModal(true);
  };

  const closeStudentsModal = () => {
    setShowStudentsModal(false);
    setSelectedSection(null);
    setAssigningEnrollmentId(null);
    setStudentSearchIn('');
    setStudentSearchOut('');
    setSwipedId(null);
  };

  const handleSwipeStart = (e, id) => {
    swipeStartX.current = e.touches[0].clientX;
  };

  const handleSwipeEnd = (e, id) => {
    const deltaX = e.changedTouches[0].clientX - swipeStartX.current;
    if (deltaX < -40) {
      // Swiped left — reveal remove
      setSwipedId(id);
    } else if (deltaX > 40) {
      // Swiped right — hide
      setSwipedId(null);
    }
  };

  const handleRowClick = (id) => {
    setSwipedId((prev) => (prev === id ? null : id));
  };

  const assignStudentToSection = async (enrollmentId, sectionId) => {
    if (
      selectedSectionLive &&
      Number(sectionId) === Number(selectedSectionLive.id) &&
      isSelectedSectionFull
    ) {
      alert(
        `This section is already full (${inSection.length}/${selectedSectionCapacity}). Remove a student first or open a new room and section.`
      );
      return;
    }

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

  const selectedSectionLive = selectedSection
    ? sections.find((s) => Number(s.id) === Number(selectedSection.id)) || selectedSection
    : null;

  const activeGradeEnrollments = selectedSectionLive
    ? enrollments.filter((e) => {
        const enrollmentGrade = normalizeGradeCode(e.grade_level);
        const sectionGrade = normalizeGradeCode(selectedSectionLive.grade_level);
        return enrollmentGrade === sectionGrade && e.status === 'ACTIVE';
      })
    : [];

  const inSection = activeGradeEnrollments.filter(
    (e) => Number(getEnrollmentSectionId(e)) === Number(selectedSectionLive?.id)
  );

  const availableForSection = activeGradeEnrollments.filter(
    (e) => Number(getEnrollmentSectionId(e)) !== Number(selectedSectionLive?.id)
  );

  const selectedSectionCapacity = selectedSectionLive
    ? getSectionCapacityLimit(selectedSectionLive, rooms)
    : 0;
  const isSelectedSectionFull = selectedSectionLive
    ? inSection.length >= selectedSectionCapacity
    : false;

  const studentNameOf = (e) =>
    `${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_username || '—';

  const filteredInSection = studentSearchIn.trim()
    ? inSection.filter((e) => {
        const q = studentSearchIn.trim().toLowerCase();
        return (
          studentNameOf(e).toLowerCase().includes(q) ||
          (e.student_number || '').toLowerCase().includes(q)
        );
      })
    : inSection;

  const filteredAvailable = studentSearchOut.trim()
    ? availableForSection.filter((e) => {
        const q = studentSearchOut.trim().toLowerCase();
        return (
          studentNameOf(e).toLowerCase().includes(q) ||
          (e.student_number || '').toLowerCase().includes(q)
        );
      })
    : availableForSection;

  const capacityPercent =
    selectedSectionCapacity > 0
      ? Math.min(100, Math.round((inSection.length / selectedSectionCapacity) * 100))
      : 0;

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Sections &amp; Homeroom Teachers</h2>
        <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
          <button className="admin-btn-primary" onClick={openNew}>
            <Plus size={18} /> Add Section
          </button>
        </div>
      </div>

      {fullSections.length > 0 && (
        <div className="cm-capacity-alert">
          <div className="cm-capacity-alert-head">
            <AlertTriangle size={18} />
            <div>
              <strong>
                Capacity alert: {fullSections.length} section{fullSections.length > 1 ? 's are' : ' is'} full
              </strong>
              <p>
                These sections reached full capacity. You can open a new room and section for the same grade level with one click.
              </p>
            </div>
          </div>

          <div className="cm-capacity-alert-list">
            {fullSections.map((entry) => (
              <div className="cm-capacity-alert-item" key={entry.section.id}>
                <div>
                  <div className="cm-capacity-alert-title">
                    {gradeLabel(entry.section.grade_level)} - {entry.section.name}
                  </div>
                  <div className="cm-capacity-alert-meta">
                    <span>{entry.assignedCount}/{entry.capacity} enrolled</span>
                    <span>{entry.availableSameGrade} unassigned in grade</span>
                    <span>{entry.section.room_code ? `Current room: ${entry.section.room_code}` : 'Current room: Unassigned'}</span>
                  </div>
                </div>

                <button
                  className="admin-btn-primary cm-capacity-alert-btn"
                  onClick={() => openNewRoomAndSection(entry)}
                  disabled={openingSectionId === entry.section.id}
                >
                  {openingSectionId === entry.section.id ? 'Opening...' : 'Open Room + Section'}
                </button>
              </div>
            ))}
          </div>

          {capacityActionMessage && (
            <div className="cm-capacity-alert-msg">{capacityActionMessage}</div>
          )}
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>{editId ? 'Edit Section' : 'Add Section'}</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowForm(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>
            {error && <div style={{ color: '#ef4444', marginBottom: 8 }}>{error}</div>}

            <div className="admin-form-group">
              <label>Section Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Gentleness"
              />
            </div>

            {!editId ? (
              <div className="admin-form-group">
                <label>Grade Level *</label>
                <select
                  value={form.grade_level}
                  onChange={(e) => setForm({ ...form, grade_level: e.target.value })}
                >
                  <option value="">Select…</option>
                  {GRADE_LEVELS.map((g) => (
                    <option key={g.value} value={g.value}>
                      {g.label}
                    </option>
                  ))}
                </select>
              </div>
            ) : (
              <div className="admin-form-group">
                <label>Grade Level</label>
                <input type="text" value={gradeLabel(form.grade_level)} readOnly />
              </div>
            )}

            <div className="admin-form-group">
              <label>Homeroom Teacher (Adviser)</label>
              <select
                value={form.adviser}
                onChange={(e) => setForm({ ...form, adviser: e.target.value })}
              >
                <option value="">— None —</option>
                {adviserOptions.map((t) => (
                  <option key={t.profileId} value={t.profileId} disabled={t.isDisabled}>
                    {t.username}{t.reason ? ` (${t.reason})` : ''}
                  </option>
                ))}
              </select>
              {!editId && (
                <small style={{ color: '#64748b' }}>
                  Adviser assignment is available after schedules are created for this section.
                </small>
              )}
              {editId && adviserOptions.every((option) => !option.isEligibleForSection) && (
                <small style={{ color: '#64748b' }}>
                  No eligible advisers yet. Add at least one schedule entry in this section and school year.
                </small>
              )}
            </div>

            <div className="admin-form-group">
              <label>Assigned Room</label>
              <select
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              >
                <option value="">— None —</option>
                {availableRooms.map((room) => (
                  <option key={room.id} value={room.id}>
                    {room.code}
                  </option>
                ))}
              </select>
              {availableRooms.length === 0 && (
                <small style={{ color: '#64748b' }}>
                  No available rooms. Create a new room or unassign one from another section.
                </small>
              )}
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-class-filter-bar">
        <select
          className="admin-filter-select"
          value={classFilterGrade}
          onChange={(e) => setClassFilterGrade(e.target.value)}
          aria-label="Filter by grade level"
        >
          <option value="">All Grades</option>
          {GRADE_LEVELS.map((g) => (
            <option key={g.value} value={g.value}>
              {g.label}
            </option>
          ))}
        </select>
        <input
          className="admin-filter-input"
          type="text"
          value={classFilterText}
          onChange={(e) => setClassFilterText(e.target.value)}
          placeholder="Search name, room, adviser…"
          aria-label="Search classes"
        />
        {hasActiveClassFilter && (
          <button className="admin-filter-clear" onClick={clearClassFilter} type="button">
            Clear
          </button>
        )}
      </div>

      <div className="admin-classes-grid">
        {sections.length === 0 && (
          <div className="admin-no-results">
            <BookOpen size={48} />
            <p>No sections yet. Add one to get started.</p>
          </div>
        )}

        {sections.length > 0 && filteredSections.length === 0 && (
          <div className="admin-no-results">
            <Filter size={40} />
            <p>No sections match your filter.</p>
          </div>
        )}

        {filteredSections.map((sec) => {
          const sectionSchedules = schedules.filter((s) => Number(s.section) === Number(sec.id));
          const subjectIds = [...new Set(sectionSchedules.map((s) => s.subject))];

          const gradeCode = normalizeGradeCode(sec.grade_level);

          const activeForGrade = enrollments.filter(
            (e) => normalizeGradeCode(e.grade_level) === gradeCode && e.status === 'ACTIVE'
          );

          const pendingForGrade = enrollments.filter(
            (e) => normalizeGradeCode(e.grade_level) === gradeCode && e.status === 'PENDING'
          );

          const assignedToSection = activeForGrade.filter(
            (e) => Number(getEnrollmentSectionId(e)) === Number(sec.id)
          );

          const unassignedForGrade = activeForGrade.filter((e) => !getEnrollmentSectionId(e));

          return (
            <div key={sec.id} className="admin-class-card">
              <div className="admin-class-card-header">
                <div>
                  <h3>{gradeLabel(sec.grade_level)} — {sec.name}</h3>
                  <p className="admin-class-grade">{gradeLabel(sec.grade_level)}</p>
                </div>
                <div className="admin-card-actions">
                  <button
                    className="admin-btn-primary"
                    onClick={() => openStudentsModal(sec)}
                    title="Manage Students"
                    style={{ padding: '8px 10px' }}
                  >
                    <Users size={16} />
                  </button>
                  <button className="admin-btn-edit" onClick={() => openEdit(sec)} title="Edit">
                    <Edit2 size={16} />
                  </button>
                  {getClassStatus(sec, enrollments) === 'EXPIRED' && (
                    <button
                      className="admin-btn-delete"
                      onClick={() => handleDelete(sec.id)}
                      title="Delete - Only available for expired classes"
                    >
                      <Trash2 size={16} />
                    </button>
                  )}
                </div>
              </div>

              <div className="admin-class-card-body">
                <div className="admin-info-row">
                  <span className="label">Adviser:</span>
                  <span className="value">
                    {sec.adviser_name || <em style={{ color: '#94a3b8' }}>Unassigned</em>}
                  </span>
                </div>

                <div className="admin-info-row">
                  <span className="label">Room:</span>
                  <span className="value">
                    {sec.room_code || <em style={{ color: '#94a3b8' }}>Unassigned</em>}
                  </span>
                </div>

                <div className="admin-info-row">
                  <span className="label">Active Assigned:</span>
                  <span className="value">
                    <Users size={14} /> {assignedToSection.length}
                  </span>
                </div>

                <div className="admin-info-row">
                  <span className="label">Unassigned (Same Grade):</span>
                  <span className="value">{unassignedForGrade.length}</span>
                </div>

                <div className="admin-info-row">
                  <span className="label">Pending Approvals:</span>
                  <span className="value">{pendingForGrade.length}</span>
                </div>

                <div className="admin-info-row">
                  <span className="label">Subjects:</span>
                  <span className="value">{subjectIds.length} scheduled</span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {showStudentsModal && selectedSection && (
        <div className="admin-modal-overlay" onClick={closeStudentsModal}>
          <div
            className="admin-modal-content admin-manage-students-modal"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 960 }}
          >
            <div className="admin-modal-header">
              <div>
                <h2>
                  {gradeLabel(selectedSectionLive?.grade_level)} — {selectedSectionLive?.name}
                </h2>
                <span className="admin-ms-subtitle">Manage Students</span>
              </div>
              <button className="admin-modal-close-btn" onClick={closeStudentsModal} title="Close" type="button">
                <X size={20} />
              </button>
            </div>

            {/* ── Capacity bar ── */}
            <div className="admin-ms-capacity">
              <div className="admin-ms-capacity-header">
                <span className="admin-ms-capacity-label">
                  <Users size={16} /> {inSection.length} / {selectedSectionCapacity || '—'} enrolled
                </span>
                <span className={`admin-ms-capacity-pct ${capacityPercent >= 100 ? 'full' : capacityPercent >= 80 ? 'warn' : ''}`}>
                  {capacityPercent}%
                </span>
              </div>
              <div className="admin-ms-progress-track">
                <div
                  className={`admin-ms-progress-fill ${capacityPercent >= 100 ? 'full' : capacityPercent >= 80 ? 'warn' : ''}`}
                  style={{ width: `${capacityPercent}%` }}
                />
              </div>
            </div>

            {isSelectedSectionFull && (
              <div className="admin-warning-box" style={{ marginBottom: 16 }}>
                <AlertTriangle size={18} />
                <span>
                  This section is full. Remove a student or open a new room and section to add more.
                </span>
              </div>
            )}

            {/* ── Two-column layout ── */}
            <div className="admin-ms-columns">
              {/* ── Left: Students in this section ── */}
              <div className="admin-ms-col">
                <div className="admin-ms-col-header">
                  <h3>In This Section</h3>
                  <span className="admin-ms-count">{inSection.length}</span>
                </div>
                <div className="admin-ms-search">
                  <input
                    type="text"
                    placeholder="Search student…"
                    value={studentSearchIn}
                    onChange={(e) => setStudentSearchIn(e.target.value)}
                  />
                </div>
                <div className="admin-ms-list">
                  {filteredInSection.length === 0 ? (
                    <div className="admin-ms-empty">
                      {studentSearchIn.trim() ? 'No students match your search.' : 'No students assigned yet.'}
                    </div>
                  ) : (
                    filteredInSection.map((e) => (
                      <div
                        key={e.id}
                        className={`admin-ms-student-row admin-ms-swipe-row ${swipedId === e.id ? 'swiped' : ''}`}
                        onTouchStart={(ev) => handleSwipeStart(ev, e.id)}
                        onTouchEnd={(ev) => handleSwipeEnd(ev, e.id)}
                        onClick={() => handleRowClick(e.id)}
                      >
                        <button
                          className="admin-ms-remove-btn"
                          disabled={assigningEnrollmentId === e.id}
                          onClick={(ev) => { ev.stopPropagation(); removeStudentFromSection(e.id); }}
                        >
                          {assigningEnrollmentId === e.id ? '…' : 'Remove'}
                        </button>
                        <div className="admin-ms-swipe-inner">
                          <div className="admin-ms-student-info">
                            <div className="admin-ms-student-avatar">
                              {studentNameOf(e).charAt(0).toUpperCase()}
                            </div>
                            <div className="admin-ms-student-text">
                              <div className="admin-ms-student-name">{studentNameOf(e)}</div>
                              <div className="admin-ms-student-meta">#{e.student_number || '—'}</div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </div>

              {/* ── Right: Available students ── */}
              <div className="admin-ms-col">
                <div className="admin-ms-col-header">
                  <h3>Available</h3>
                  <span className="admin-ms-count">{availableForSection.length}</span>
                </div>
                <div className="admin-ms-search">
                  <input
                    type="text"
                    placeholder="Search student…"
                    value={studentSearchOut}
                    onChange={(e) => setStudentSearchOut(e.target.value)}
                  />
                </div>
                <div className="admin-ms-list">
                  {filteredAvailable.length === 0 ? (
                    <div className="admin-ms-empty">
                      {studentSearchOut.trim() ? 'No students match your search.' : 'No other approved students for this grade.'}
                    </div>
                  ) : (
                    filteredAvailable.map((e) => {
                      const currentSection = sections.find(
                        (s) => Number(s.id) === Number(getEnrollmentSectionId(e))
                      );
                      return (
                        <div key={e.id} className="admin-ms-student-row">
                          <div className="admin-ms-student-info">
                            <div className="admin-ms-student-avatar">
                              {studentNameOf(e).charAt(0).toUpperCase()}
                            </div>
                            <div className="admin-ms-student-text">
                              <div className="admin-ms-student-name">{studentNameOf(e)}</div>
                              <div className="admin-ms-student-meta">
                                {currentSection
                                  ? `${gradeLabel(currentSection.grade_level)} — ${currentSection.name}`
                                  : 'Unassigned'}
                              </div>
                            </div>
                          </div>
                          <button
                            className="admin-ms-add-btn"
                            disabled={assigningEnrollmentId !== null || isSelectedSectionFull}
                            onClick={() => assignStudentToSection(e.id, selectedSectionLive.id)}
                          >
                            {assigningEnrollmentId === e.id
                              ? 'Adding…'
                              : isSelectedSectionFull
                              ? 'Full'
                              : 'Add'}
                          </button>
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
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
function SchedulesTab({ sections, subjects, teachers, schedules, rooms, schoolYears, activeSchoolYear, onRefresh }) {
  const kinderSection =
    sections.find((s) => normalizeGradeCode(s.grade_level) === 'kinder') || null;
  const defaultSection = kinderSection || sections[0] || null;

  const [filterSection, setFilterSection] = useState(defaultSection ? String(defaultSection.id) : '');
  const [view, setView] = useState('timeline');
  const [showForm, setShowForm] = useState(false);
  const [editId, setEditId] = useState(null);
  const [form, setForm] = useState({
    teacher: '',
    subject: '',
    section: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    room: '',
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [conflictWarning, setConflictWarning] = useState(null);
  const [selected, setSelected] = useState(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);
  const [showBulkEdit, setShowBulkEdit] = useState(false);
  const [bulkForm, setBulkForm] = useState({
    teacher: '',
    subject: '',
    section: '',
    day_of_week: '',
    start_time: '',
    end_time: '',
    room: '',
  });
  const [bulkSaving, setBulkSaving] = useState(false);

  const [showCopyDayModal, setShowCopyDayModal] = useState(false);
  const [copySourceDay, setCopySourceDay] = useState('MON');
  const [copyTargetDays, setCopyTargetDays] = useState(new Set(['TUE', 'WED', 'THU', 'FRI']));
  const [copyGenerating, setCopyGenerating] = useState(false);
  const [viewSchoolYear, setViewSchoolYear] = useState(activeSchoolYear?.id ? String(activeSchoolYear.id) : '');
  const [viewSections, setViewSections] = useState([]);
  const [viewSchedules, setViewSchedules] = useState([]);
  const [viewYearLoading, setViewYearLoading] = useState(false);
  const [viewLoadError, setViewLoadError] = useState('');

  useEffect(() => {
    if (activeSchoolYear?.id) {
      const activeId = String(activeSchoolYear.id);
      setViewSchoolYear((prev) => prev || activeId);
    }
  }, [activeSchoolYear]);

  const refreshViewYearData = useCallback(async () => {
    if (!viewSchoolYear) {
      setViewSections([]);
      setViewSchedules([]);
      setViewLoadError('');
      return;
    }

    setViewYearLoading(true);
    setViewLoadError('');
    try {
      const [sectionsRes, schedulesRes] = await Promise.all([
        apiFetch(`/api/accounts/sections/?school_year=${encodeURIComponent(viewSchoolYear)}`),
        apiFetch(`/api/classmanagement/schedules/?school_year=${encodeURIComponent(viewSchoolYear)}`),
      ]);

      if (!sectionsRes.ok) {
        const e = await sectionsRes.json().catch(() => ({}));
        throw new Error(e.detail || 'Failed to load sections for selected school year.');
      }

      if (!schedulesRes.ok) {
        const e = await schedulesRes.json().catch(() => ({}));
        throw new Error(e.detail || 'Failed to load schedules for selected school year.');
      }

      const [sectionsData, schedulesData] = await Promise.all([sectionsRes.json(), schedulesRes.json()]);
      setViewSections(Array.isArray(sectionsData) ? sectionsData : []);
      setViewSchedules(Array.isArray(schedulesData) ? schedulesData : []);
    } catch (e) {
      setViewLoadError(e.message || 'Failed to load selected school year data.');
      setViewSections([]);
      setViewSchedules([]);
    } finally {
      setViewYearLoading(false);
    }
  }, [viewSchoolYear]);

  useEffect(() => {
    refreshViewYearData();
  }, [refreshViewYearData]);

  const scopedSections = viewSchoolYear ? viewSections : sections;
  const scopedSchedules = viewSchoolYear ? viewSchedules : schedules;

  const filtered = filterSection
    ? scopedSchedules.filter((s) => String(s.section) === filterSection)
    : scopedSchedules;

  const timelineStartSlots = useMemo(() => {
    const uniqueSlots = new Set(
      filtered
        .map((scheduleEntry) => normalizeTimeKey(scheduleEntry.start_time))
        .filter(Boolean)
    );

    return Array.from(uniqueSlots).sort((a, b) => timeToDecimal(a) - timeToDecimal(b));
  }, [filtered]);

  useEffect(() => {
    if (!scopedSections.length) {
      setFilterSection('');
      return;
    }

    const hasSelected = scopedSections.some((section) => String(section.id) === String(filterSection));
    if (!hasSelected) {
      setFilterSection(String(scopedSections[0].id));
    }
  }, [scopedSections, filterSection]);

  const availableSourceDays = useMemo(() => {
    const presentDays = new Set(filtered.map((s) => s.day_of_week));
    return DAYS.filter((day) => presentDays.has(day.value));
  }, [filtered]);

  const selectedSectionData = scopedSections.find((s) => String(s.id) === String(form.section));

  const sectionRoomName = selectedSectionData?.room_code
    ? `${selectedSectionData.room_code}${selectedSectionData.room_name ? ` (${selectedSectionData.room_name})` : ''}`
    : 'Not assigned';

  const teacherCanHandleSubject = (teacher, subjectId) => {
    if (!teacher?.teacher_profile || !Number.isFinite(subjectId)) return false;

    const profile = teacher.teacher_profile;
    const toSubjectId = (rawSubject) => {
      if (rawSubject === null || rawSubject === undefined || rawSubject === '') return null;
      const id = typeof rawSubject === 'number' ? rawSubject : Number(rawSubject?.id ?? rawSubject);
      return Number.isFinite(id) ? id : null;
    };

    const multiSubjects = Array.isArray(profile.subjects) ? profile.subjects : [];
    const linkedSubjectIds = multiSubjects
      .map(toSubjectId)
      .filter((id) => id !== null);

    const legacySubjectId = toSubjectId(profile.subject);
    if (legacySubjectId !== null) linkedSubjectIds.push(legacySubjectId);

    return linkedSubjectIds.some((id) => Number(id) === Number(subjectId));
  };

  const teacherOptions = useMemo(() => {
    if (!form.subject) return [];
    const selectedSubjectId = Number(form.subject);
    if (!Number.isFinite(selectedSubjectId)) return [];

    return teachers.filter((teacher) => teacherCanHandleSubject(teacher, selectedSubjectId));
  }, [teachers, form.subject]);

  const toggleSelect = (id) =>
    setSelected((prev) => {
      const n = new Set(prev);
      n.has(id) ? n.delete(id) : n.add(id);
      return n;
    });

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
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || JSON.stringify(data) || 'Failed');
      alert(`Successfully deleted ${data.deleted_count} entries.`);
      setSelected(new Set());
      await Promise.all([onRefresh(), refreshViewYearData()]);
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Is the backend running?'
        : e.message;
      alert('Delete failed: ' + msg);
    } finally {
      setBulkDeleting(false);
    }
  };

  const openBulkEdit = () => {
    setBulkForm({
      teacher: '',
      subject: '',
      section: '',
      day_of_week: '',
      start_time: '',
      end_time: '',
      room: '',
    });
    setShowBulkEdit(true);
  };

  const handleBulkEdit = async () => {
    const ids = [...selected].filter((id) => filtered.some((s) => s.id === id));
    if (ids.length === 0) return;

    const updates = {};
    Object.entries(bulkForm).forEach(([k, v]) => {
      if (v) updates[k] = k === 'start_time' || k === 'end_time' ? v + ':00' : v;
    });

    if (Object.keys(updates).length === 0) {
      alert('Fill in at least one field to update.');
      return;
    }

    setBulkSaving(true);
    try {
      const r = await apiFetch('/api/classmanagement/schedules/bulk-update/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ ids, updates }),
      });
      const data = await r.json();
      if (!r.ok) throw new Error(data.detail || 'Failed');
      alert(`Updated ${data.updated_count} schedule entries.`);
      setShowBulkEdit(false);
      setSelected(new Set());
      await Promise.all([onRefresh(), refreshViewYearData()]);
    } catch (e) {
      alert(e.message);
    } finally {
      setBulkSaving(false);
    }
  };

  const openNew = () => {
    setEditId(null);
    setForm({
      teacher: '',
      subject: '',
      section: filterSection || '',
      day_of_week: '',
      start_time: '',
      end_time: '',
      room: '',
    });
    setError('');
    setConflictWarning(null);
    setShowForm(true);
  };

  const openEdit = (sch) => {
    setEditId(sch.id);
    setForm({
      teacher: sch.teacher ? String(sch.teacher) : '',
      subject: sch.subject ? String(sch.subject) : '',
      section: String(sch.section),
      day_of_week: sch.day_of_week,
      start_time: sch.start_time?.slice(0, 5) || '',
      end_time: sch.end_time?.slice(0, 5) || '',
      room: sch.room ? String(sch.room) : '',
    });
    setError('');
    setConflictWarning(null);
    setShowForm(true);
  };

  const handleSave = async () => {
    // Subject is optional (non-subject entries like breaks, extension periods)
    if (!form.section || !form.day_of_week || !form.start_time || !form.end_time) {
      setError('Section, Day, Start Time, and End Time are required.');
      return;
    }

    if (form.subject && !form.teacher) {
      setError('Teacher is required when a Subject is selected.');
      return;
    }

    setSaving(true);
    setError('');
    setConflictWarning(null);

    try {
      const selectedSection = scopedSections.find((s) => String(s.id) === String(form.section));
      const roomId = selectedSection?.room || null;
      const teacherId = form.subject && form.teacher ? Number(form.teacher) : null;

      const payload = {
        teacher: teacherId,
        subject: form.subject ? Number(form.subject) : null,
        section: Number(form.section),
        day_of_week: form.day_of_week,
        start_time: form.start_time + ':00',
        end_time: form.end_time + ':00',
        room: roomId ? Number(roomId) : null,
      };

      const url = editId
        ? `/api/classmanagement/schedules/${editId}/`
        : '/api/classmanagement/schedules/';

      const r = await apiFetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        if (e.conflicts) setConflictWarning(e.conflicts);

        const toMessage = (value) => {
          if (!value) return '';
          if (Array.isArray(value)) return value.join(' ');
          return String(value);
        };

        const validationMessage =
          toMessage(e.non_field_errors)
          || toMessage(e.end_time)
          || toMessage(e.start_time)
          || toMessage(e.subject)
          || toMessage(e.teacher)
          || toMessage(e.section);

        throw new Error(e.detail || validationMessage || JSON.stringify(e));
      }

      setShowForm(false);
      await Promise.all([onRefresh(), refreshViewYearData()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
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
      await refreshViewYearData();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Is the backend running?'
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  const toggleCopyTargetDay = (day) => {
    setCopyTargetDays((prev) => {
      const next = new Set(prev);
      if (next.has(day)) next.delete(day);
      else next.add(day);
      return next;
    });
  };

  const handleCopyDay = async () => {
    if (!filterSection) {
      alert('Please select a section first.');
      return;
    }

    if (availableSourceDays.length === 0) {
      alert('This section has no schedule entries yet. Add schedules before copying a day.');
      return;
    }

    const initialSource = availableSourceDays[0].value;
    setCopySourceDay(initialSource);

    const defaultTargets = availableSourceDays
      .map((d) => d.value)
      .filter((d) => d !== initialSource);

    setCopyTargetDays(new Set(defaultTargets));
    setShowCopyDayModal(true);
  };

  const handleCopySubmit = async () => {
    if (!copySourceDay || copyTargetDays.size === 0) {
      alert('Select source day and at least one target day.');
      return;
    }

    setCopyGenerating(true);
    try {
      const payload = {
        section: Number(filterSection),
        source_day: copySourceDay,
        target_days: Array.from(copyTargetDays),
      };

      const r = await apiFetch('/api/classmanagement/schedules/copy-day/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const contentType = r.headers.get('content-type') || '';
      let data;

      if (contentType.includes('application/json')) {
        data = await r.json();
      } else {
        const text = await r.text();
        console.error('copy-day returned non-JSON:', text);
        throw new Error(`Server returned ${r.status} ${r.statusText} instead of JSON.`);
      }

      if (!r.ok) {
        throw new Error(data.detail || JSON.stringify(data) || 'Copy failed');
      }

      alert(`Copied ${data.created_count} entries, skipped ${data.skipped_count}.`);
      setShowCopyDayModal(false);
      await Promise.all([onRefresh(), refreshViewYearData()]);
    } catch (e) {
      alert('Copy failed: ' + e.message);
    } finally {
      setCopyGenerating(false);
    }
  };

  return (
    <>
      {activeSchoolYear && (
        <div className="admin-active-year-banner" style={{ marginBottom: 12 }}>
          <div className="active-year-content">
            <Calendar size={18} />
            <div>
              <strong>Active School Year:</strong> {activeSchoolYear.name}
            </div>
          </div>
        </div>
      )}

      <div className="admin-class-controls schedule-controls">
        <div className="admin-filter-box">
          <Filter size={18} />
          <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)}>
            {scopedSections.length === 0 && <option value="">No sections for selected year</option>}
            {scopedSections.map((sec) => (
              <option key={sec.id} value={sec.id}>
                {gradeLabel(sec.grade_level)} — {sec.name}
              </option>
            ))}
          </select>
        </div>

        <div className="admin-filter-box">
          <Calendar size={18} />
          <select value={viewSchoolYear} onChange={(e) => setViewSchoolYear(e.target.value)}>
            <option value="">View school year</option>
            {schoolYears.map((sy) => (
              <option key={sy.id} value={sy.id}>
                {sy.name}{sy.is_active ? ' (Active)' : ''}
              </option>
            ))}
          </select>
        </div>

        <div className="schedule-view-toggle">
          <button
            className={`admin-tab-btn small ${view === 'timeline' ? 'active' : ''}`}
            onClick={() => setView('timeline')}
          >
            Timeline
          </button>
          <button
            className={`admin-tab-btn small ${view === 'table' ? 'active' : ''}`}
            onClick={() => setView('table')}
          >
            Table
          </button>
        </div>

        <button className="admin-btn-primary" onClick={openNew}>
          <Plus size={18} /> Add Entry
        </button>

        <button
          className="admin-btn-primary"
          onClick={handleCopyDay}
          disabled={!filterSection}
          style={{ background: '#0ea5e9' }}
        >
          <Copy size={18} /> Copy Day
        </button>

        {selected.size > 0 && (
          <>
            <button
              className="admin-btn-primary"
              onClick={openBulkEdit}
              style={{ background: '#f59e0b' }}
            >
              <Edit2 size={18} /> Edit Selected ({selected.size})
            </button>
            <button
              className="admin-btn-delete"
              onClick={handleBulkDelete}
              disabled={bulkDeleting}
              style={{ padding: '10px 20px' }}
            >
              <Trash2 size={18} /> {bulkDeleting ? 'Deleting…' : `Delete Selected (${selected.size})`}
            </button>
          </>
        )}
      </div>

      {viewYearLoading && (
        <div style={{ marginBottom: 10, fontSize: 13, color: '#475569' }}>
          Loading selected school year schedules and sections...
        </div>
      )}

      {viewLoadError && (
        <div style={{ marginBottom: 10, fontSize: 13, color: '#b91c1c' }}>
          {viewLoadError}
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 620 }}>
            <div className="admin-modal-header">
              <h2>{editId ? 'Edit Schedule Entry' : 'New Schedule Entry'}</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowForm(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>

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
                      <li key={i}>
                        <span className={`conflict-type ${c.type}`}>{c.type}</span> {c.message}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Section *</label>
                <select
                  value={form.section}
                  onChange={(e) => setForm({ ...form, section: e.target.value })}
                >
                  <option value="">Select…</option>
                  {scopedSections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {gradeLabel(s.grade_level)} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Subject</label>
                <select
                  value={form.subject}
                  onChange={(e) => {
                    const nextSubject = e.target.value;
                    if (!nextSubject) {
                      setForm({ ...form, subject: '', teacher: '' });
                      return;
                    }

                    const nextSubjectId = Number(nextSubject);
                    const currentTeacherStillValid = teachers.some(
                      (teacher) =>
                        String(teacher.id) === String(form.teacher)
                        && teacherCanHandleSubject(teacher, nextSubjectId)
                    );

                    setForm({
                      ...form,
                      subject: nextSubject,
                      teacher: currentTeacherStillValid ? form.teacher : '',
                    });
                  }}
                >
                  <option value="">Free Period (No subject, no teacher)</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>
                  Teacher
                  <span style={{ color: '#94a3b8', fontSize: '12px' }}>
                    {form.subject ? ' (Required for subject)' : ' (Disabled for Free Period)'}
                  </span>
                </label>
                <select
                  value={form.teacher}
                  onChange={(e) => setForm({ ...form, teacher: e.target.value })}
                  disabled={!form.subject}
                >
                  {!form.subject && <option value="">Free Period - No Teacher</option>}
                  {form.subject && <option value="">Select teacher…</option>}
                  {form.subject && teacherOptions.length === 0 && (
                    <option value="" disabled>
                      No teachers assigned to selected subject
                    </option>
                  )}
                  {form.subject && teacherOptions.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Day *</label>
                <select
                  value={form.day_of_week}
                  onChange={(e) => setForm({ ...form, day_of_week: e.target.value })}
                >
                  <option value="">Select…</option>
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="admin-form-group">
                <label>Start Time *</label>
                <input
                  type="time"
                  value={form.start_time}
                  onChange={(e) => setForm({ ...form, start_time: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>End Time *</label>
                <input
                  type="time"
                  value={form.end_time}
                  onChange={(e) => setForm({ ...form, end_time: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>Room (auto-assigned)</label>
                <input type="text" value={sectionRoomName} readOnly />
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      {showBulkEdit && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 620 }}>
            <div className="admin-modal-header">
              <h2>Bulk Edit — {selected.size} Entries</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowBulkEdit(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>
            <p style={{ color: '#6b7280', fontSize: 13, marginBottom: 12 }}>
              Only fields you fill in will be changed. Leave blank to keep current values.
            </p>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Section</label>
                <select
                  value={bulkForm.section}
                  onChange={(e) => setBulkForm({ ...bulkForm, section: e.target.value })}
                >
                  <option value="">— Keep current —</option>
                  {sections.map((s) => (
                    <option key={s.id} value={s.id}>
                      {gradeLabel(s.grade_level)} — {s.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Subject</label>
                <select
                  value={bulkForm.subject}
                  onChange={(e) => setBulkForm({ ...bulkForm, subject: e.target.value })}
                >
                  <option value="">— Keep current —</option>
                  {subjects.map((s) => (
                    <option key={s.id} value={s.id}>
                      {s.name}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Teacher</label>
                <select
                  value={bulkForm.teacher}
                  onChange={(e) => setBulkForm({ ...bulkForm, teacher: e.target.value })}
                >
                  <option value="">— Keep current —</option>
                  {teachers.map((t) => (
                    <option key={t.id} value={t.id}>
                      {t.username}
                    </option>
                  ))}
                </select>
              </div>

              <div className="admin-form-group">
                <label>Day</label>
                <select
                  value={bulkForm.day_of_week}
                  onChange={(e) => setBulkForm({ ...bulkForm, day_of_week: e.target.value })}
                >
                  <option value="">— Keep current —</option>
                  {DAYS.map((d) => (
                    <option key={d.value} value={d.value}>
                      {d.label}
                    </option>
                  ))}
                </select>
              </div>
            </div>

            <div className="admin-form-row" style={{ gridTemplateColumns: '1fr 1fr 1fr' }}>
              <div className="admin-form-group">
                <label>Start Time</label>
                <input
                  type="time"
                  value={bulkForm.start_time}
                  onChange={(e) => setBulkForm({ ...bulkForm, start_time: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>End Time</label>
                <input
                  type="time"
                  value={bulkForm.end_time}
                  onChange={(e) => setBulkForm({ ...bulkForm, end_time: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>Room</label>
                <select value={bulkForm.room} onChange={(e) => setBulkForm({ ...bulkForm, room: e.target.value })}>
                  <option value="">— Keep current —</option>
                  {rooms
                    .filter((r) => r.is_active)
                    .map((r) => (
                      <option key={r.id} value={r.id}>
                        {r.code}
                      </option>
                    ))}
                </select>
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowBulkEdit(false)}>
                Cancel
              </button>
              <button
                className="admin-btn-primary"
                onClick={handleBulkEdit}
                disabled={bulkSaving}
                style={{ background: '#f59e0b' }}
              >
                {bulkSaving ? 'Updating…' : `Update ${selected.size} Entries`}
              </button>
            </div>
          </div>
        </div>
      )}

      {showCopyDayModal && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content" style={{ maxWidth: 520 }}>
            <div className="admin-modal-header">
              <h2>Copy Schedule Day</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowCopyDayModal(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Source Day</label>
              <select value={copySourceDay} onChange={(e) => setCopySourceDay(e.target.value)}>
                {availableSourceDays.length === 0 ? (
                  <option value="">No source day available</option>
                ) : (
                  availableSourceDays.map((day) => (
                    <option key={day.value} value={day.value}>
                      {day.label}
                    </option>
                  ))
                )}
              </select>
            </div>

            <div style={{ marginBottom: 20 }}>
              <label style={{ display: 'block', marginBottom: 8, fontWeight: 600 }}>Target Days</label>
              <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, 1fr)', gap: 8 }}>
                {DAYS.map((day) => (
                  <label key={day.value} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={copyTargetDays.has(day.value)}
                      disabled={day.value === copySourceDay}
                      onChange={() => toggleCopyTargetDay(day.value)}
                    />
                    {day.short}
                  </label>
                ))}
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowCopyDayModal(false)}>
                Cancel
              </button>
              <button
                className="admin-btn-primary"
                onClick={handleCopySubmit}
                disabled={copyGenerating || copyTargetDays.size === 0}
                style={{ background: '#0ea5e9' }}
              >
                {copyGenerating ? 'Copying…' : 'Copy to Target Day(s)'}
              </button>
            </div>
          </div>
        </div>
      )}

      {view === 'table' && (
        <div className="admin-schedule-container">
          <table className="admin-schedule-table enhanced-table">
            <thead>
              <tr>
                <th style={{ width: 40, textAlign: 'center' }}>
                  <input type="checkbox" checked={allSelected} onChange={toggleAll} title="Select all" />
                </th>
                <th>Section</th>
                <th>Subject</th>
                <th>Teacher</th>
                <th>Day</th>
                <th>Time</th>
                <th>Room</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {filtered.length === 0 && (
                <tr>
                  <td colSpan="8" style={{ textAlign: 'center', color: '#94a3b8', padding: 24 }}>
                    No schedule entries.
                  </td>
                </tr>
              )}

              {filtered.map((s) => {
                const colors = colorFor(s.subject);
                return (
                  <tr key={s.id} className={selected.has(s.id) ? 'row-selected' : ''}>
                    <td style={{ textAlign: 'center' }}>
                      <input
                        type="checkbox"
                        checked={selected.has(s.id)}
                        onChange={() => toggleSelect(s.id)}
                      />
                    </td>
                    <td>
                      <span className="section-badge">{s.section_name}</span>
                    </td>
                    <td>
                      <span
                        className="subject-badge"
                        style={{
                          backgroundColor: colors.bg,
                          color: colors.text,
                          borderColor: colors.border,
                        }}
                      >
                        {s.subject_name}
                      </span>
                    </td>
                    <td>
                      <span className="teacher-name">{s.teacher_name}</span>
                    </td>
                    <td>
                      <span className="day-badge">{dayShort(s.day_of_week)}</span>
                    </td>
                    <td>
                      <span className="time-display">
                        <Clock size={14} /> {formatTime(s.start_time)} – {formatTime(s.end_time)}
                      </span>
                    </td>
                    <td>
                      {(s.room_code || s.section_room_code) ? (
                        <span className="room-badge">
                          <Home size={14} /> {s.room_code || s.section_room_code}
                        </span>
                      ) : (
                        <span className="no-room">—</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        <button className="admin-btn-edit" onClick={() => openEdit(s)} title="Edit">
                          <Edit2 size={16} />
                        </button>
                        <button className="admin-btn-delete" onClick={() => handleDelete(s.id)} title="Delete">
                          <Trash2 size={16} />
                        </button>
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {view === 'timeline' && (
        <>
          {filtered.length > 0 && (
            <div className="bulk-select-bar">
              <label
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                  cursor: 'pointer',
                  fontSize: 13,
                  color: '#4b5563',
                }}
              >
                <input type="checkbox" checked={allSelected} onChange={toggleAll} />
                {allSelected ? 'Deselect all' : `Select all ${filtered.length} entries`}
              </label>
              {selected.size > 0 && (
                <span style={{ fontSize: 13, color: '#3b82f6', fontWeight: 600 }}>
                  {selected.size} selected
                </span>
              )}
            </div>
          )}

          <div className="admin-schedule-container timeline-container">
            <div className="timeline-scroll">
              <div
                className="timeline-grid"
                style={{ gridTemplateColumns: `90px repeat(${DAYS.length}, 1fr)` }}
              >
                <div className="timeline-time-header">
                  <Clock size={16} />
                </div>
                {DAYS.map((d) => (
                  <div key={d.value} className="timeline-day-header">
                    {d.label}
                  </div>
                ))}

                {timelineStartSlots.length === 0 ? (
                  <div className="timeline-empty-calendar" style={{ gridColumn: '1 / -1' }}>
                    No schedule entries.
                  </div>
                ) : (
                  timelineStartSlots.map((slot) => (
                    <React.Fragment key={slot}>
                      <div className="timeline-time-cell">{formatTime(slot)}</div>

                      {DAYS.map((d) => {
                        const entries = filtered
                          .filter(
                            (s) => s.day_of_week === d.value && normalizeTimeKey(s.start_time) === slot
                          )
                          .sort((a, b) => timeToDecimal(a.end_time) - timeToDecimal(b.end_time));

                        return (
                          <div key={`${d.value}-${slot}`} className="timeline-cell">
                            {entries.map((entry) => {
                              const colors = colorFor(entry.subject);
                              const roomCode = entry.room_code || entry.section_room_code || '';
                              return (
                                <div
                                  key={entry.id}
                                  className={`timeline-block ${
                                    selected.has(entry.id) ? 'timeline-block--selected' : ''
                                  }`}
                                  style={{
                                    backgroundColor: colors.bg,
                                    borderLeftColor: colors.border,
                                    color: colors.text,
                                  }}
                                  title={`${entry.subject_name} — ${entry.teacher_name}\n${formatTime(
                                    entry.start_time
                                  )}–${formatTime(entry.end_time)}${
                                    roomCode ? ' • Room ' + roomCode : ''
                                  }\nClick to select · Double-click to edit`}
                                  onClick={() => toggleSelect(entry.id)}
                                  onDoubleClick={() => openEdit(entry)}
                                >
                                  <input
                                    type="checkbox"
                                    checked={selected.has(entry.id)}
                                    onChange={() => toggleSelect(entry.id)}
                                    onClick={(e) => e.stopPropagation()}
                                    className="timeline-checkbox"
                                  />
                                  <div className="timeline-block-title">{entry.subject_name}</div>
                                  <div className="timeline-block-meta">{entry.teacher_name}</div>
                                  <div className="timeline-block-meta">
                                    {formatTime(entry.start_time)} – {formatTime(entry.end_time)}
                                  </div>
                                  {roomCode && (
                                    <div className="timeline-block-room">
                                      <Home size={10} /> {roomCode}
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        );
                      })}
                    </React.Fragment>
                  ))
                )}
              </div>
            </div>
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
  const [form, setForm] = useState({ name: '', code: '', assigned_teachers: [''] });
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);
  const [editingId, setEditingId] = useState(null);
  const [editForm, setEditForm] = useState({ name: '', code: '', assigned_teachers: [''] });

  const normalizeTeacherIds = (ids) => {
    const values = (ids || [])
      .map((id) => Number(id))
      .filter((id) => Number.isFinite(id));
    return [...new Set(values)];
  };

  const addTeacherPicker = (setter) => {
    setter((prev) => ({
      ...prev,
      assigned_teachers: [...(prev.assigned_teachers || []), ''],
    }));
  };

  const updateTeacherPicker = (setter, index, value) => {
    setter((prev) => {
      const next = [...(prev.assigned_teachers || [''])];
      next[index] = value;
      return { ...prev, assigned_teachers: next };
    });
  };

  const removeTeacherPicker = (setter, index) => {
    setter((prev) => {
      const next = [...(prev.assigned_teachers || [''])];
      next.splice(index, 1);
      return { ...prev, assigned_teachers: next.length ? next : [''] };
    });
  };

  const isTeacherOptionDisabled = (selectedIds, candidateId, currentIndex) => {
    return (selectedIds || []).some(
      (id, idx) => idx !== currentIndex && String(id) === String(candidateId)
    );
  };

  const handleCreate = async () => {
    setFormError('');
    if (!form.name || !form.code) {
      setFormError('Name and code are required.');
      return;
    }
    setSaving(true);
    try {
      const payload = { name: form.name, code: form.code };
      const teacherIds = normalizeTeacherIds(form.assigned_teachers);
      if (teacherIds.length > 0) {
        payload.assigned_teachers = teacherIds;
      }

      const r = await apiFetch('/api/accounts/subjects/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || JSON.stringify(e));
      }

      setShowForm(false);
      setForm({ name: '', code: '', assigned_teachers: [''] });
      await onRefresh();
    } catch (e) {
      setFormError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const startEdit = (subj) => {
    const currentTeachers = Array.isArray(subj.teachers)
      ? subj.teachers
          .map((teacher) => teacher?.id)
          .filter((id) => id !== null && id !== undefined)
          .map((id) => String(id))
      : [''];

    setEditingId(subj.id);
    setEditForm({
      name: subj.name,
      code: subj.code,
      assigned_teachers: currentTeachers.length ? currentTeachers : [''],
    });
  };

  const saveEdit = async (id) => {
    try {
      const payload = {
        name: editForm.name,
        code: editForm.code,
        assigned_teachers: normalizeTeacherIds(editForm.assigned_teachers),
      };

      const r = await apiFetch(`/api/accounts/subjects/${id}/`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || JSON.stringify(e) || 'Failed to update');
      }

      setEditingId(null);
      await onRefresh();
    } catch (e) {
      alert(e.message);
    }
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

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Subject Management</h2>
        <button className="admin-btn-primary" onClick={() => setShowForm(true)}>
          <Plus size={18} /> Add Subject
        </button>
      </div>

      {showForm && (
        <div className="admin-modal-overlay" onClick={() => setShowForm(false)}>
          <div className="admin-modal-content" onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Add Subject</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowForm(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>
            {formError && <div style={{ color: '#ef4444', marginBottom: 8 }}>{formError}</div>}

            <div className="admin-form-group">
              <label>Subject Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. Mathematics"
              />
            </div>

            <div className="admin-form-group">
              <label>Subject Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. MATH"
              />
            </div>

            <div className="admin-form-group">
              <label>Assign Teachers</label>
              {(form.assigned_teachers || []).map((teacherId, idx) => (
                <div key={`new-teacher-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                  <select
                    value={teacherId}
                    onChange={(e) => updateTeacherPicker(setForm, idx, e.target.value)}
                    style={{ flex: 1 }}
                  >
                    <option value="">— Select teacher —</option>
                    {teachers.map((t) => (
                      <option
                        key={t.id}
                        value={t.id}
                        disabled={isTeacherOptionDisabled(form.assigned_teachers, t.id, idx)}
                      >
                        {t.username}
                      </option>
                    ))}
                  </select>
                  <button
                    type="button"
                    className="admin-btn-edit"
                    onClick={() => addTeacherPicker(setForm)}
                    title="Add teacher"
                  >
                    <Plus size={14} />
                  </button>
                  <button
                    type="button"
                    className="admin-btn-delete"
                    onClick={() => removeTeacherPicker(setForm, idx)}
                    title="Remove teacher"
                    disabled={(form.assigned_teachers || []).length === 1}
                  >
                    <X size={14} />
                  </button>
                </div>
              ))}
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleCreate} disabled={saving}>
                {saving ? 'Saving…' : 'Save Subject'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-schedule-container">
        {subjects.length > 0 ? (
          <table className="admin-schedule-table enhanced-table">
            <thead>
              <tr>
                <th>Subject Name</th>
                <th>Code</th>
                <th>Assigned Teachers</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              {subjects.map((s) => {
                const isEditing = editingId === s.id;
                const assigned = Array.isArray(s.teachers) ? s.teachers : [];

                return (
                  <tr key={s.id}>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          value={editForm.name}
                          onChange={(e) => setEditForm({ ...editForm, name: e.target.value })}
                          style={{ width: '100%' }}
                        />
                      ) : (
                        <strong>{s.name}</strong>
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <input
                          className="inline-input"
                          value={editForm.code}
                          onChange={(e) => setEditForm({ ...editForm, code: e.target.value })}
                          style={{ width: 80 }}
                        />
                      ) : (
                        s.code
                      )}
                    </td>
                    <td>
                      {isEditing ? (
                        <div>
                          {(editForm.assigned_teachers || []).map((teacherId, idx) => (
                            <div key={`edit-teacher-${s.id}-${idx}`} style={{ display: 'flex', gap: 8, marginBottom: 6 }}>
                              <select
                                className="inline-select"
                                value={teacherId}
                                onChange={(e) => updateTeacherPicker(setEditForm, idx, e.target.value)}
                                style={{ width: '100%' }}
                              >
                                <option value="">— Select teacher —</option>
                                {teachers.map((t) => (
                                  <option
                                    key={t.id}
                                    value={t.id}
                                    disabled={isTeacherOptionDisabled(editForm.assigned_teachers, t.id, idx)}
                                  >
                                    {t.username}
                                  </option>
                                ))}
                              </select>
                              <button
                                type="button"
                                className="admin-btn-edit"
                                onClick={() => addTeacherPicker(setEditForm)}
                                title="Add teacher"
                              >
                                <Plus size={14} />
                              </button>
                              <button
                                type="button"
                                className="admin-btn-delete"
                                onClick={() => removeTeacherPicker(setEditForm, idx)}
                                title="Remove teacher"
                                disabled={(editForm.assigned_teachers || []).length === 1}
                              >
                                <X size={14} />
                              </button>
                            </div>
                          ))}
                        </div>
                      ) : assigned.length > 0 ? (
                        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                          <UserCheck size={14} />
                          {assigned.map((teacher) => teacher.username).join(', ')}
                        </span>
                      ) : (
                        <span style={{ color: '#94a3b8' }}>Unassigned</span>
                      )}
                    </td>
                    <td>
                      <div className="action-buttons">
                        {isEditing ? (
                          <>
                            <button className="admin-btn-edit" onClick={() => saveEdit(s.id)} title="Save">
                              <Save size={16} />
                            </button>
                            <button className="admin-btn-delete" onClick={() => setEditingId(null)} title="Cancel">
                              <X size={16} />
                            </button>
                          </>
                        ) : (
                          <>
                            <button className="admin-btn-edit" onClick={() => startEdit(s)} title="Edit">
                              <Edit2 size={16} />
                            </button>
                            <button className="admin-btn-delete" onClick={() => handleDelete(s.id)} title="Delete">
                              <Trash2 size={16} />
                            </button>
                          </>
                        )}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        ) : (
          <div className="admin-no-results">
            <BookOpen size={48} />
            <p>No subjects yet. Add one above.</p>
          </div>
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
    setForm({
      code: room.code,
      name: room.name || '',
      capacity: room.capacity || 40,
      is_active: room.is_active,
    });
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.code) {
      setError('Room code is required.');
      return;
    }

    setSaving(true);
    setError('');
    try {
      const url = editId ? `/api/classmanagement/rooms/${editId}/` : '/api/classmanagement/rooms/';
      const r = await apiFetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      if (!r.ok) {
        const e = await r.json().catch(() => ({}));
        throw new Error(e.detail || JSON.stringify(e));
      }

      setShowForm(false);
      await onRefresh();
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
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

  const getRoomUsage = (roomId) => schedules.filter((s) => s.room === roomId).length;

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>Room Management</h2>
        <button className="admin-btn-primary" onClick={openNew}>
          <Plus size={18} /> Add Room
        </button>
      </div>

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>{editId ? 'Edit Room' : 'Add Room'}</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowForm(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>
            {error && (
              <div className="admin-error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="admin-form-group">
              <label>Room Code *</label>
              <input
                type="text"
                value={form.code}
                onChange={(e) => setForm({ ...form, code: e.target.value })}
                placeholder="e.g. 1F-A"
              />
            </div>

            <div className="admin-form-group">
              <label>Room Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. First Floor Room A"
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Capacity</label>
                <input
                  type="number"
                  value={form.capacity}
                  onChange={(e) =>
                    setForm({ ...form, capacity: parseInt(e.target.value, 10) || 40 })
                  }
                  min="1"
                />
              </div>

              <div className="admin-form-group">
                <label>Status</label>
                <select
                  value={form.is_active ? 'active' : 'inactive'}
                  onChange={(e) =>
                    setForm({ ...form, is_active: e.target.value === 'active' })
                  }
                >
                  <option value="active">Active</option>
                  <option value="inactive">Inactive</option>
                </select>
              </div>
            </div>

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-rooms-grid">
        {rooms.length === 0 ? (
          <div className="admin-no-results">
            <Home size={48} />
            <p>No rooms yet. Add one to get started.</p>
          </div>
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
                    <span>
                      <Users size={14} /> Capacity: {room.capacity}
                    </span>
                    <span>
                      <Calendar size={14} /> {usage} schedules
                    </span>
                  </div>
                </div>

                <div className="room-card-actions">
                  <button className="admin-btn-edit" onClick={() => openEdit(room)}>
                    <Edit2 size={16} /> Edit
                  </button>
                  <button className="admin-btn-delete" onClick={() => handleDelete(room.id)}>
                    <Trash2 size={16} />
                  </button>
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

  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [templateStatus, setTemplateStatus] = useState({ type: '', message: '' });
  const [showTemplatesModal, setShowTemplatesModal] = useState(false);
  const [templateSourceYearId, setTemplateSourceYearId] = useState('');
  const [templateTargetYearId, setTemplateTargetYearId] = useState('');
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [clearExistingBeforeApply, setClearExistingBeforeApply] = useState(true);
  const [savingTemplate, setSavingTemplate] = useState(false);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [deletingTemplateId, setDeletingTemplateId] = useState(null);
  const [createTemplateId, setCreateTemplateId] = useState('');

  const activeYear = useMemo(
    () => schoolYears.find((sy) => sy.is_active) || null,
    [schoolYears]
  );

  const isLocalHost =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  const missingTemplateEndpointMessage = isLocalHost
    ? 'Schedule template endpoint is not available on the local backend yet. Restart your backend and ensure latest classmanagement URLs are loaded.'
    : 'Schedule template endpoint is not available on the server yet. Please deploy the latest backend updates.';

  const toMessage = (value) => {
    if (!value) return '';
    if (Array.isArray(value)) return value.join(' ');
    if (typeof value === 'string') return value;
    return '';
  };

  const parseApiErrorMessage = (payload, fallback = 'Request failed.') => {
    if (!payload) return fallback;
    return (
      toMessage(payload.detail)
      || toMessage(payload.non_field_errors)
      || toMessage(payload.source_school_year)
      || toMessage(payload.school_year_id)
      || toMessage(payload.target_school_year)
      || toMessage(payload.name)
      || fallback
    );
  };

  const fetchTemplates = useCallback(async () => {
    setTemplateLoading(true);
    try {
      const r = await apiFetch('/api/classmanagement/schedules/templates/');
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error('Failed to load templates.');
      }

      const data = await r.json().catch(() => []);
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      setSelectedTemplateId((prev) => {
        if (!list.length) return '';
        const exists = list.some((tpl) => String(tpl.id) === String(prev));
        return exists ? String(prev) : String(list[0].id);
      });
    } catch (e) {
      setTemplates([]);
      setSelectedTemplateId('');
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to load templates.' });
    } finally {
      setTemplateLoading(false);
    }
  }, [missingTemplateEndpointMessage]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  useEffect(() => {
    if (schoolYears.length === 0) {
      setTemplateSourceYearId('');
      setTemplateTargetYearId('');
      return;
    }

    const fallbackYearId = activeYear ? String(activeYear.id) : String(schoolYears[0].id);

    setTemplateSourceYearId((prev) => {
      const valid = schoolYears.some((sy) => String(sy.id) === String(prev));
      return valid ? prev : fallbackYearId;
    });

    setTemplateTargetYearId((prev) => {
      const valid = schoolYears.some((sy) => String(sy.id) === String(prev));
      return valid ? prev : fallbackYearId;
    });
  }, [schoolYears, activeYear]);

  const formatDate = (dateStr) => {
    if (!dateStr) return '';
    const date = new Date(dateStr);
    return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  };

  const saveTemplateFromSourceYear = async (sourceYearId) => {
    if (!sourceYearId) {
      setTemplateStatus({ type: 'error', message: 'Select a source school year first.' });
      return false;
    }

    const sourceYear = schoolYears.find((sy) => String(sy.id) === String(sourceYearId));
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const templateName = `${sourceYear?.name || 'School Year'} Template ${timestamp}`;

    setSavingTemplate(true);
    setTemplateStatus({ type: '', message: '' });
    try {
      const r = await apiFetch('/api/classmanagement/schedules/templates/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: templateName,
          source_school_year: Number(sourceYearId),
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error(parseApiErrorMessage(data, 'Failed to save template.'));
      }

      setTemplateStatus({
        type: 'success',
        message: `Saved template "${data.name}" from ${sourceYear?.name || 'selected school year'} with ${data.entry_count || 0} schedule entries.`,
      });
      await fetchTemplates();
      return true;
    } catch (e) {
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to save template.' });
      return false;
    } finally {
      setSavingTemplate(false);
    }
  };

  const applyTemplateToYear = async (templateId, targetYearId, options = {}) => {
    const { confirm = true, clearExisting = clearExistingBeforeApply, silentStatus = false } = options;

    if (!templateId) {
      const message = 'Please select a template first.';
      if (!silentStatus) setTemplateStatus({ type: 'error', message });
      return { ok: false, message };
    }
    if (!targetYearId) {
      const message = 'Please select a target school year first.';
      if (!silentStatus) setTemplateStatus({ type: 'error', message });
      return { ok: false, message };
    }

    const selectedTemplate = templates.find((tpl) => String(tpl.id) === String(templateId));
    const targetYear = schoolYears.find((sy) => String(sy.id) === String(targetYearId));

    if (confirm) {
      const confirmed = window.confirm(
        `Apply template "${selectedTemplate?.name || templateId}" to ${targetYear?.name || 'selected school year'}?\n\n` +
          `Clear existing schedules first: ${clearExisting ? 'Yes' : 'No'}`
      );
      if (!confirmed) {
        return { ok: false, message: 'Cancelled' };
      }
    }

    setApplyingTemplate(true);
    if (!silentStatus) {
      setTemplateStatus({ type: '', message: '' });
    }

    try {
      const r = await apiFetch(`/api/classmanagement/schedules/templates/${templateId}/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_year_id: Number(targetYearId),
          clear_existing: clearExisting,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error(parseApiErrorMessage(data, 'Failed to apply template.'));
      }

      await onRefresh();

      if (!silentStatus) {
        const existingSectionsUsed = data.existing_sections_used || 0;
        const existingRoomsUsed = data.existing_rooms_used || 0;
        const fallbackTeacherAssignments = data.fallback_teacher_assignments || 0;
        const adviserReassignments = data.adviser_reassignments || 0;
        const adviserConflicts = data.adviser_conflicts || 0;
        const missingTeacherRefs = data.missing_teacher_references || 0;
        const blueprintText = data.section_blueprints_applied
          ? ` Section blueprints synced: ${data.section_blueprints_applied}.`
          : '';
        const diagnosticsText =
          fallbackTeacherAssignments || adviserReassignments || adviserConflicts || missingTeacherRefs
            ? ` Fallback teacher assignments: ${fallbackTeacherAssignments}. Adviser reassignments: ${adviserReassignments}. Adviser conflicts: ${adviserConflicts}. Missing teacher refs: ${missingTeacherRefs}.`
            : '';
        const warningText = data.warnings_count ? ` ${data.warnings_count} warning(s).` : '';
        setTemplateStatus({
          type: 'success',
          message:
            `Applied template successfully to ${targetYear?.name || 'selected year'}. ` +
            `Created ${data.created_count || 0} schedules, ${data.created_sections || 0} new sections (${existingSectionsUsed} existing reused), ` +
            `${data.created_rooms || 0} new rooms (${existingRoomsUsed} existing reused).` +
            (data.cleared_count ? ` Cleared ${data.cleared_count} existing schedules first.` : '') +
            blueprintText +
            diagnosticsText +
            warningText,
        });
      }

      return { ok: true, data };
    } catch (e) {
      if (!silentStatus) {
        setTemplateStatus({ type: 'error', message: e.message || 'Failed to apply template.' });
      }
      return { ok: false, message: e.message || 'Failed to apply template.' };
    } finally {
      setApplyingTemplate(false);
    }
  };

  const deleteTemplate = async (templateId) => {
    const template = templates.find((tpl) => String(tpl.id) === String(templateId));
    const confirmed = window.confirm(`Delete template "${template?.name || templateId}"?`);
    if (!confirmed) return;

    setDeletingTemplateId(templateId);
    try {
      const r = await apiFetch(`/api/classmanagement/schedules/templates/${templateId}/`, {
        method: 'DELETE',
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error(parseApiErrorMessage(data, 'Failed to delete template.'));
      }

      setTemplateStatus({ type: 'success', message: `Deleted template "${template?.name || templateId}".` });
      await fetchTemplates();
    } catch (e) {
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to delete template.' });
    } finally {
      setDeletingTemplateId(null);
    }
  };

  const openNew = () => {
    setEditId(null);
    const currentYear = new Date().getFullYear();
    const month = new Date().getMonth();
    const yearStart = month >= 5 ? currentYear : currentYear - 1;

    setForm({
      name: `${yearStart}-${yearStart + 1}`,
      start_date: `${yearStart}-06-01`,
      end_date: `${yearStart + 1}-03-31`,
      is_active: false,
    });
    setCreateTemplateId('');
    setError('');
    setShowForm(true);
  };

  const openEdit = (sy) => {
    setEditId(sy.id);
    setForm({
      name: sy.name,
      start_date: sy.start_date,
      end_date: sy.end_date,
      is_active: sy.is_active,
    });
    setCreateTemplateId('');
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      setError('All fields are required.');
      return;
    }

    if (!editId && !createTemplateId) {
      const confirmedBlank = window.confirm(
        'Create this school year without applying a template?\n\nYou can apply one later from the Template Center.'
      );
      if (!confirmedBlank) return;
    }

    setSaving(true);
    setError('');
    try {
      const url = editId
        ? `/api/classmanagement/school-years/${editId}/`
        : '/api/classmanagement/school-years/';

      const r = await apiFetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(parseApiErrorMessage(data, 'Failed to save school year.'));
      }

      if (!editId && createTemplateId && data?.id) {
        const applyResult = await applyTemplateToYear(createTemplateId, data.id, {
          confirm: false,
          clearExisting: true,
          silentStatus: true,
        });

        if (!applyResult.ok) {
          await onRefresh();
          await fetchTemplates();
          setShowForm(false);
          setTemplateStatus({
            type: 'error',
            message:
              `School year "${data.name || form.name}" was created, but template apply failed: ` +
              `${applyResult.message || 'Unknown error'}`,
          });
          return;
        }

        const applied = applyResult.data || {};
        const existingSectionsUsed = applied.existing_sections_used || 0;
        const existingRoomsUsed = applied.existing_rooms_used || 0;
        setTemplateStatus({
          type: 'success',
          message:
            `Created "${data.name || form.name}" and applied template. ` +
            `Created ${applied.created_count || 0} schedules, ${applied.created_sections || 0} new sections (${existingSectionsUsed} existing reused), ` +
            `${applied.created_rooms || 0} new rooms (${existingRoomsUsed} existing reused).`,
        });
      } else if (!editId && !createTemplateId) {
        setTemplateStatus({
          type: 'success',
          message: `Created "${data.name || form.name}" as a blank school year. You can apply a template anytime from Template Center.`,
        });
      }

      setShowForm(false);
      setCreateTemplateId('');
      await Promise.all([onRefresh(), fetchTemplates()]);
    } catch (e) {
      setError(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleActivate = async (id) => {
    if (!window.confirm('Activate this school year? This will deactivate all other school years and preserve existing schedules/sections.')) {
      return;
    }

    try {
      const r = await apiFetch(`/api/classmanagement/school-years/${id}/activate/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reset_class_data: false }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        throw new Error(parseApiErrorMessage(data, 'Activation failed'));
      }

      alert(
        `Activated ${data.name || 'school year'} with data preserved.\n\n` +
          'For a blank slate, create a new school year and apply templates as needed.'
      );

      await onRefresh();
    } catch (e) {
      alert('Activation failed: ' + e.message);
    }
  };

  const handleDelete = async (id) => {
    if (!window.confirm('Delete this school year? This may also delete related schedules.')) return;
    try {
      const r = await apiFetch(`/api/classmanagement/school-years/${id}/`, { method: 'DELETE' });
      if (!r.ok) {
        const err = await r.json().catch(() => ({}));
        throw new Error(parseApiErrorMessage(err, `Delete failed (${r.status})`));
      }
      await onRefresh();
    } catch (e) {
      const msg = e.message?.includes('Failed to fetch')
        ? 'Cannot connect to server. Is the backend running?'
        : e.message;
      alert('Delete failed: ' + msg);
    }
  };

  return (
    <>
      <div className="admin-section-header" style={{ marginBottom: 16 }}>
        <h2>School Year Management</h2>
        <button className="admin-btn-primary" onClick={openNew}>
          <Plus size={18} /> Add School Year
        </button>
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

      <div className="sy-template-center">
        <div className="sy-template-center-head">
          <h3>Schedule Template Center</h3>
          <button
            className="admin-btn-secondary"
            onClick={() => setShowTemplatesModal(true)}
            disabled={templateLoading}
          >
            <BookOpen size={16} /> View All Templates
          </button>
        </div>

        <div className="sy-template-grid">
          <div className="sy-template-box">
            <div className="sy-template-title">Save Template</div>
            <label>Source School Year</label>
            <select value={templateSourceYearId} onChange={(e) => setTemplateSourceYearId(e.target.value)}>
              <option value="">Select source year</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.name}{sy.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>
            <button
              className="admin-btn-primary"
              onClick={() => saveTemplateFromSourceYear(templateSourceYearId)}
              disabled={savingTemplate || !templateSourceYearId}
              style={{ marginTop: 10, background: '#0f766e' }}
            >
              <Save size={16} /> {savingTemplate ? 'Saving…' : 'Save Template'}
            </button>
          </div>

          <div className="sy-template-box">
            <div className="sy-template-title">Apply Template</div>
            <label>Template</label>
            <select
              value={selectedTemplateId}
              onChange={(e) => setSelectedTemplateId(e.target.value)}
              disabled={templateLoading || templates.length === 0}
            >
              {templates.length === 0 ? (
                <option value="">No templates available</option>
              ) : (
                templates.map((tpl) => (
                  <option key={tpl.id} value={tpl.id}>
                    {tpl.name}
                  </option>
                ))
              )}
            </select>

            <label style={{ marginTop: 8 }}>Target School Year</label>
            <select value={templateTargetYearId} onChange={(e) => setTemplateTargetYearId(e.target.value)}>
              <option value="">Select target year</option>
              {schoolYears.map((sy) => (
                <option key={sy.id} value={sy.id}>
                  {sy.name}{sy.is_active ? ' (Active)' : ''}
                </option>
              ))}
            </select>

            <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, marginTop: 10, fontSize: 12 }}>
              <input
                type="checkbox"
                checked={clearExistingBeforeApply}
                onChange={(e) => setClearExistingBeforeApply(e.target.checked)}
              />
              Clear existing schedules first
            </label>

            <button
              className="admin-btn-primary"
              onClick={() => applyTemplateToYear(selectedTemplateId, templateTargetYearId, { confirm: true })}
              disabled={applyingTemplate || !selectedTemplateId || !templateTargetYearId}
              style={{ marginTop: 10, background: '#1d4ed8' }}
            >
              <Download size={16} /> {applyingTemplate ? 'Applying…' : 'Apply Template'}
            </button>
          </div>
        </div>

        {templateStatus.message && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 12px',
              borderRadius: 8,
              border: `1px solid ${templateStatus.type === 'error' ? '#fca5a5' : '#86efac'}`,
              background: templateStatus.type === 'error' ? '#fef2f2' : '#f0fdf4',
              color: templateStatus.type === 'error' ? '#991b1b' : '#166534',
              fontSize: 13,
            }}
          >
            {templateStatus.message}
          </div>
        )}
      </div>

      {showTemplatesModal && (
        <div className="admin-modal-overlay" onClick={() => setShowTemplatesModal(false)}>
          <div className="admin-modal-content" style={{ maxWidth: 860 }} onClick={(e) => e.stopPropagation()}>
            <div className="admin-modal-header">
              <h2>Schedule Templates</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowTemplatesModal(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>

            {templateLoading ? (
              <div style={{ padding: 20, color: '#64748b' }}>Loading templates…</div>
            ) : templates.length === 0 ? (
              <div className="admin-no-results" style={{ padding: 20 }}>
                <BookOpen size={28} />
                <p>No templates yet.</p>
              </div>
            ) : (
              <div className="admin-schedule-container" style={{ marginBottom: 0 }}>
                <table className="admin-schedule-table enhanced-table">
                  <thead>
                    <tr>
                      <th>Name</th>
                      <th>Source Year</th>
                      <th>Entries</th>
                      <th>Created By</th>
                      <th>Updated</th>
                      <th>Actions</th>
                    </tr>
                  </thead>
                  <tbody>
                    {templates.map((tpl) => (
                      <tr key={tpl.id}>
                        <td>{tpl.name}</td>
                        <td>{tpl.source_school_year_name || '—'}</td>
                        <td>{tpl.entry_count ?? 0}</td>
                        <td>{tpl.created_by_username || '—'}</td>
                        <td>{tpl.updated_at ? new Date(tpl.updated_at).toLocaleString() : '—'}</td>
                        <td>
                          <button
                            className="admin-btn-delete"
                            onClick={() => deleteTemplate(tpl.id)}
                            disabled={deletingTemplateId === tpl.id}
                          >
                            <Trash2 size={16} /> {deletingTemplateId === tpl.id ? 'Deleting…' : 'Delete'}
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {showForm && (
        <div className="admin-modal-overlay">
          <div className="admin-modal-content">
            <div className="admin-modal-header">
              <h2>{editId ? 'Edit School Year' : 'Add School Year'}</h2>
              <button className="admin-modal-close-btn" onClick={() => setShowForm(false)} title="Close" type="button">
                <X size={20} />
              </button>
            </div>
            {error && (
              <div className="admin-error-box">
                <AlertCircle size={18} />
                <span>{error}</span>
              </div>
            )}

            <div className="admin-form-group">
              <label>School Year Name *</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="e.g. 2025-2026"
              />
            </div>

            <div className="admin-form-row">
              <div className="admin-form-group">
                <label>Start Date *</label>
                <input
                  type="date"
                  value={form.start_date}
                  onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                />
              </div>

              <div className="admin-form-group">
                <label>End Date *</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                />
              </div>
            </div>

            {!editId && (
              <div className="admin-form-group">
                <label>Optional: Apply Template After Create</label>
                <select value={createTemplateId} onChange={(e) => setCreateTemplateId(e.target.value)}>
                  <option value="">No template (create blank school year)</option>
                  {templates.map((tpl) => (
                    <option key={tpl.id} value={tpl.id}>
                      {tpl.name}
                    </option>
                  ))}
                </select>
                <div style={{ marginTop: 6, fontSize: 12, color: '#64748b' }}>
                  If no template is selected, you will be asked to confirm blank setup.
                </div>
              </div>
            )}

            <div className="admin-form-actions">
              <button className="admin-btn-secondary" onClick={() => setShowForm(false)}>
                Cancel
              </button>
              <button className="admin-btn-primary" onClick={handleSave} disabled={saving}>
                {saving ? 'Saving…' : editId ? 'Update' : 'Create'}
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="admin-school-years-list">
        {schoolYears.length === 0 ? (
          <div className="admin-no-results">
            <Calendar size={48} />
            <p>No school years yet. Add one to get started.</p>
          </div>
        ) : (
          schoolYears.map((sy) => {
            const isExpired = sy.status === 'EXPIRED';
            const isOngoing = sy.status === 'ONGOING';
            const canDelete = isExpired;

            return (
              <div key={sy.id} className={`admin-school-year-card ${sy.is_active ? 'active' : ''}`}>
                <div className="sy-card-header">
                  <div className="sy-name">{sy.name}</div>
                  <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                    {sy.is_active && <span className="sy-active-badge">ACTIVE</span>}
                    <span
                      className={`sy-status-badge ${isExpired ? 'expired' : 'ongoing'}`}
                      title={isExpired ? 'Past end date' : 'Within school year dates'}
                    >
                      {isExpired ? 'EXPIRED' : 'ONGOING'}
                    </span>
                  </div>
                </div>

                <div className="sy-card-body">
                  <div className="sy-dates">
                    <Calendar size={14} />
                    <span>
                      {formatDate(sy.start_date)} – {formatDate(sy.end_date)}
                    </span>
                  </div>
                  {isExpired && (
                    <div style={{ color: '#ef4444', fontSize: '12px', marginTop: '8px' }}>
                      This school year has expired. Only deletion is allowed.
                    </div>
                  )}

                  <div className="sy-template-inline-actions">
                    <button
                      className="admin-btn-primary-outline"
                      onClick={() => saveTemplateFromSourceYear(String(sy.id))}
                      disabled={savingTemplate}
                    >
                      <Save size={14} /> Save Template
                    </button>
                    <button
                      className="admin-btn-primary-outline"
                      onClick={() => applyTemplateToYear(selectedTemplateId, String(sy.id), { confirm: true })}
                      disabled={!selectedTemplateId || applyingTemplate}
                    >
                      <Download size={14} /> Apply Selected Template
                    </button>
                  </div>
                </div>

                <div className="sy-card-actions">
                  {!sy.is_active && isOngoing && (
                    <button
                      className="admin-btn-primary"
                      onClick={() => handleActivate(sy.id)}
                      style={{ background: '#10b981' }}
                    >
                      <Zap size={16} /> Activate
                    </button>
                  )}
                  <button
                    className="admin-btn-edit"
                    onClick={() => openEdit(sy)}
                    title="Edit"
                  >
                    <Edit2 size={16} />
                  </button>
                  <button
                    className="admin-btn-delete"
                    onClick={() => handleDelete(sy.id)}
                    disabled={!canDelete}
                    title={
                      sy.is_active
                        ? 'Cannot delete active year'
                        : isExpired
                        ? 'Delete'
                        : 'Cannot delete ongoing year'
                    }
                  >
                    <Trash2 size={16} />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

    </>
  );
}

export default ClassManagement;