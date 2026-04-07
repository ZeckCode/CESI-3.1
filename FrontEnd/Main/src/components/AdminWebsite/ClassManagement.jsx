import React, { useState, useEffect, useCallback, useMemo } from 'react';
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
  const [activeTab, setActiveTab] = useState('classes');
  const [loading, setLoading] = useState(true);
  const [classPreviewOpen, setClassPreviewOpen] = useState(false);
  const [classPreviewData, setClassPreviewData] = useState([]);

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
        <div className="admin-loading-spinner">
          <div className="spinner"></div>
          <p>Loading class management data...</p>
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
        />
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
  const [capacityActionMessage, setCapacityActionMessage] = useState('');
  const [openingSectionId, setOpeningSectionId] = useState(null);
  const [showStudentsModal, setShowStudentsModal] = useState(false);
  const [selectedSection, setSelectedSection] = useState(null);
  const [assigningEnrollmentId, setAssigningEnrollmentId] = useState(null);

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

  const teacherProfiles = teachers
    .filter((t) => t.teacher_profile)
    .map((t) => ({
      userId: t.id,
      profileId: t.teacher_profile.id,
      username: t.username,
    }));

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
    if (form.grade_level === '' || !form.grade_level) {
      setError('Grade level is required. Please select a valid grade level from the dropdown.');
      return;
    }
    const validGradeLevels = GRADE_LEVELS.map((g) => String(g.value));
    if (!validGradeLevels.includes(String(form.grade_level))) {
      setError('Invalid grade level selected. Please choose from the available options.');
      return;
    }
    setSaving(true);
    setError('');
    try {
      const payload = {
        name: form.name,
        grade_level: String(form.grade_level),
        adviser: form.adviser ? Number(form.adviser) : null,
        room: form.room ? Number(form.room) : null,
      };
      const url = editId ? `/api/accounts/sections/${editId}/` : '/api/accounts/sections/';
      const r = await apiFetch(url, {
        method: editId ? 'PUT' : 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
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

            <div className="admin-form-group">
              <label>Homeroom Teacher (Adviser)</label>
              <select
                value={form.adviser}
                onChange={(e) => setForm({ ...form, adviser: e.target.value })}
              >
                <option value="">— None —</option>
                {teacherProfiles.map((t) => (
                  <option key={t.profileId} value={t.profileId}>
                    {t.username}
                  </option>
                ))}
              </select>
            </div>

            <div className="admin-form-group">
              <label>Assigned Room</label>
              <select
                value={form.room}
                onChange={(e) => setForm({ ...form, room: e.target.value })}
              >
                <option value="">— None —</option>
                {rooms
                  .filter((room) => room.is_active)
                  .map((room) => (
                    <option key={room.id} value={room.id}>
                      {room.code}
                    </option>
                  ))}
              </select>
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

      <div className="admin-classes-grid">
        {sections.length === 0 && (
          <div className="admin-no-results">
            <BookOpen size={48} />
            <p>No sections yet. Add one to get started.</p>
          </div>
        )}

        {sections.map((sec) => {
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
                  <span className="label">Homeroom:</span>
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
            className="admin-modal-content"
            onClick={(e) => e.stopPropagation()}
            style={{ maxWidth: 760 }}
          >
            <div className="admin-modal-header">
              <h2>
                Manage Students: {gradeLabel(selectedSectionLive?.grade_level)} - {selectedSectionLive?.name}
              </h2>
              <button className="admin-modal-close-btn" onClick={closeStudentsModal} title="Close" type="button">
                <X size={20} />
              </button>
            </div>

            <p style={{ color: '#64748b', marginTop: 0, marginBottom: 14 }}>
              Approved enrollments for this grade can be assigned to this class. This automatically
              syncs with attendance lists.
            </p>

            <h3 style={{ margin: '8px 0' }}>
              Students In This Section ({inSection.length}/{selectedSectionCapacity || 0})
            </h3>
            {inSection.length === 0 ? (
              <div className="admin-no-results" style={{ padding: 16 }}>
                <p>No students assigned yet.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 180, overflow: 'auto', marginBottom: 14 }}>
                <table className="admin-schedule-table enhanced-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Student No.</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {inSection.map((e) => (
                      <tr key={e.id}>
                        <td>
                          {`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_username}
                        </td>
                        <td>{e.student_number || '—'}</td>
                        <td>
                          <button
                            className="admin-btn-delete-small"
                            disabled={assigningEnrollmentId === e.id}
                            onClick={() => removeStudentFromSection(e.id)}
                          >
                            Remove
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}

            <h3 style={{ margin: '8px 0' }}>
              Available Approved Students ({availableForSection.length})
            </h3>
            {isSelectedSectionFull && (
              <div className="admin-warning-box" style={{ marginBottom: 12 }}>
                <AlertTriangle size={18} />
                <span>
                  This section is full ({inSection.length}/{selectedSectionCapacity}). Remove a student or open a new room and section.
                </span>
              </div>
            )}
            {availableForSection.length === 0 ? (
              <div className="admin-no-results" style={{ padding: 16 }}>
                <p>No other approved students for this grade.</p>
              </div>
            ) : (
              <div style={{ maxHeight: 220, overflow: 'auto' }}>
                <table className="admin-schedule-table enhanced-table">
                  <thead>
                    <tr>
                      <th>Student</th>
                      <th>Current Class</th>
                      <th>Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {availableForSection.map((e) => {
                      const currentSection = sections.find(
                        (s) => Number(s.id) === Number(getEnrollmentSectionId(e))
                      );
                      return (
                        <tr key={e.id}>
                          <td>
                            {`${e.first_name || ''} ${e.last_name || ''}`.trim() || e.student_username}
                          </td>
                          <td>
                            {currentSection
                              ? `${gradeLabel(currentSection.grade_level)} - ${currentSection.name}`
                              : 'Unassigned'}
                          </td>
                          <td>
                            <button
                              className="admin-btn-primary"
                              disabled={assigningEnrollmentId !== null || isSelectedSectionFull}
                              onClick={() => assignStudentToSection(e.id, selectedSectionLive.id)}
                              style={{ padding: '8px 12px' }}
                            >
                              {assigningEnrollmentId === e.id
                                ? 'Adding...'
                                : isSelectedSectionFull
                                ? 'Full'
                                : 'Add'}
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
  const [templates, setTemplates] = useState([]);
  const [templateLoading, setTemplateLoading] = useState(false);
  const [viewSchoolYear, setViewSchoolYear] = useState(activeSchoolYear?.id ? String(activeSchoolYear.id) : '');
  const [viewSections, setViewSections] = useState([]);
  const [viewSchedules, setViewSchedules] = useState([]);
  const [viewYearLoading, setViewYearLoading] = useState(false);
  const [selectedTemplateId, setSelectedTemplateId] = useState('');
  const [clearExistingBeforeApply, setClearExistingBeforeApply] = useState(true);
  const [applyingTemplate, setApplyingTemplate] = useState(false);
  const [templateStatus, setTemplateStatus] = useState({ type: '', message: '' });

  const isLocalHost =
    typeof window !== 'undefined' && ['localhost', '127.0.0.1'].includes(window.location.hostname);

  const missingTemplateEndpointMessage = isLocalHost
    ? 'Schedule template endpoint is not available on the local backend yet. Restart your backend and ensure latest classmanagement URLs are loaded.'
    : 'Schedule template endpoint is not available on the server yet. Please deploy the latest backend updates.';

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
      const data = await r.json();
      const list = Array.isArray(data) ? data : [];
      setTemplates(list);
      setTemplateStatus((prev) => (prev.type === 'error' ? prev : { type: '', message: '' }));
      setSelectedTemplateId((prev) => {
        if (!list.length) return '';
        const hasPrev = list.some((t) => String(t.id) === String(prev));
        return hasPrev ? String(prev) : String(list[0].id);
      });
    } catch (e) {
      console.error(e);
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
    if (activeSchoolYear?.id) {
      const activeId = String(activeSchoolYear.id);
      setViewSchoolYear((prev) => prev || activeId);
    }
  }, [activeSchoolYear]);

  const refreshViewYearData = useCallback(async () => {
    if (!viewSchoolYear) {
      setViewSections([]);
      setViewSchedules([]);
      return;
    }

    setViewYearLoading(true);
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
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to load selected school year data.' });
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

  const handleSaveTemplate = async () => {
    const sourceYearId = viewSchoolYear || (activeSchoolYear?.id ? String(activeSchoolYear.id) : '');
    if (!sourceYearId) {
      setTemplateStatus({ type: 'error', message: 'Please choose a school year from the top dropdown first.' });
      return;
    }

    const sourceYear = schoolYears.find((sy) => String(sy.id) === String(sourceYearId)) || activeSchoolYear;
    const now = new Date();
    const timestamp = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(
      now.getDate()
    ).padStart(2, '0')} ${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
    const templateName = `${sourceYear?.name || 'Selected School Year'} Template ${timestamp}`;

    try {
      setTemplateStatus({ type: '', message: '' });
      const payload = {
        name: templateName.trim(),
        source_school_year: Number(sourceYearId),
      };

      const r = await apiFetch('/api/classmanagement/schedules/templates/', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error(data.detail || JSON.stringify(data) || 'Failed to save template.');
      }

      setTemplateStatus({
        type: 'success',
        message:
          `Saved template "${data.name}" from ${sourceYear?.name || 'selected school year'} ` +
          `with ${data.entry_count || 0} schedule entries.`,
      });
      await Promise.all([fetchTemplates(), refreshViewYearData()]);
    } catch (e) {
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to save template.' });
    }
  };

  const handleApplyTemplate = async () => {
    const targetYearId = activeSchoolYear?.id ? String(activeSchoolYear.id) : '';
    if (!selectedTemplateId) {
      setTemplateStatus({ type: 'error', message: 'Please select a template first.' });
      return;
    }
    if (!targetYearId) {
      setTemplateStatus({ type: 'error', message: 'No active school year available as template target.' });
      return;
    }

    const selectedTemplate = templates.find((tpl) => String(tpl.id) === String(selectedTemplateId));
    const targetYear = schoolYears.find((sy) => String(sy.id) === String(targetYearId)) || activeSchoolYear;

    const confirmed = window.confirm(
      `Apply template "${selectedTemplate?.name || selectedTemplateId}" to ${targetYear?.name || 'selected school year'}?\n\n` +
        `Clear existing schedules first: ${clearExistingBeforeApply ? 'Yes' : 'No'}`
    );
    if (!confirmed) return;

    setApplyingTemplate(true);
    try {
      setTemplateStatus({ type: '', message: '' });
      const r = await apiFetch(`/api/classmanagement/schedules/templates/${selectedTemplateId}/apply/`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          school_year_id: Number(targetYearId),
          clear_existing: clearExistingBeforeApply,
        }),
      });

      const data = await r.json().catch(() => ({}));
      if (!r.ok) {
        if (r.status === 404) {
          throw new Error(missingTemplateEndpointMessage);
        }
        throw new Error(data.detail || JSON.stringify(data) || 'Failed to apply template.');
      }

      setTemplateStatus({
        type: 'success',
        message:
          `Applied template successfully. Created ${data.created_count || 0} schedules.` +
          (data.cleared_count ? ` Cleared ${data.cleared_count} existing schedules first.` : ''),
      });

      await Promise.all([onRefresh(), refreshViewYearData()]);
    } catch (e) {
      setTemplateStatus({ type: 'error', message: e.message || 'Failed to apply template.' });
    } finally {
      setApplyingTemplate(false);
    }
  };

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
        throw new Error(e.detail || JSON.stringify(e));
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

        <button
          className="admin-btn-primary"
          onClick={handleSaveTemplate}
          style={{ background: '#0f766e' }}
        >
          <Save size={18} /> Save Template
        </button>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <select
            value={selectedTemplateId}
            onChange={(e) => setSelectedTemplateId(e.target.value)}
            disabled={templateLoading || templates.length === 0}
            style={{ minWidth: 180 }}
          >
            {templates.length === 0 ? (
              <option value="">No templates</option>
            ) : (
              templates.map((tpl) => (
                <option key={tpl.id} value={tpl.id}>
                  {tpl.name}
                </option>
              ))
            )}
          </select>

          <span style={{ fontSize: 12, color: '#475569' }}>
            Target: {activeSchoolYear?.name || 'No active year'}
          </span>

          <label style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 12 }}>
            <input
              type="checkbox"
              checked={clearExistingBeforeApply}
              onChange={(e) => setClearExistingBeforeApply(e.target.checked)}
            />
            Clear existing
          </label>

          <button
            className="admin-btn-primary"
            onClick={handleApplyTemplate}
            disabled={applyingTemplate || !selectedTemplateId || !activeSchoolYear}
            style={{ background: '#1d4ed8' }}
          >
            <Download size={18} /> {applyingTemplate ? 'Applying…' : 'Apply Template'}
          </button>
        </div>

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

      <div style={{ marginBottom: 10, fontSize: 12, color: '#64748b' }}>
        Templates include schedules with section, room, and subject references from the selected source year.
      </div>

      {templateStatus.message && (
        <div
          style={{
            marginTop: 10,
            marginBottom: 10,
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
    setError('');
    setShowForm(true);
  };

  const handleSave = async () => {
    if (!form.name || !form.start_date || !form.end_date) {
      setError('All fields are required.');
      return;
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
        throw new Error(data.detail || 'Activation failed');
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

  const activeYear = schoolYears.find((sy) => sy.is_active);

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
            const canEdit = !isExpired && !sy.is_active;
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