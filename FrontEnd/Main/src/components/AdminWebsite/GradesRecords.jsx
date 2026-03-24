import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertCircle,
  Calendar,
  CheckCircle,
  ChevronDown,
  ChevronUp,
  Clock,
  Download,
  FileText,
  Filter,
  History,
  Search,
  TrendingUp,
  Users,
  XCircle,
} from 'lucide-react';
import Pagination from './Pagination';
import { apiFetchData } from '../api/apiFetch';
import '../AdminWebsiteCSS/GradesRecords.css';

const ITEMS_PER_PAGE = 10;

const GRADE_ORDER = {
  'Pre-Kinder': -1,
  Kinder: 0,
  'Grade 1': 1,
  'Grade 2': 2,
  'Grade 3': 3,
  'Grade 4': 4,
  'Grade 5': 5,
  'Grade 6': 6,
};

const todayString = () => new Date().toISOString().slice(0, 10);

const toGradeLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const raw = String(value).trim();
  const normalized = raw.toLowerCase().replace(/\s+/g, ' ');

  if (/^grade\s*grade\s*(\d)$/i.test(raw)) {
    return `Grade ${raw.match(/(\d)$/)[1]}`;
  }
  if (/^gradegrade\s*(\d)$/i.test(raw)) {
    return `Grade ${raw.match(/(\d)$/)[1]}`;
  }

  const map = {
    '-1': 'Pre-Kinder',
    prek: 'Pre-Kinder',
    'pre-kinder': 'Pre-Kinder',
    '0': 'Kinder',
    kinder: 'Kinder',
    '1': 'Grade 1',
    grade1: 'Grade 1',
    'grade 1': 'Grade 1',
    '2': 'Grade 2',
    grade2: 'Grade 2',
    'grade 2': 'Grade 2',
    '3': 'Grade 3',
    grade3: 'Grade 3',
    'grade 3': 'Grade 3',
    '4': 'Grade 4',
    grade4: 'Grade 4',
    'grade 4': 'Grade 4',
    '5': 'Grade 5',
    grade5: 'Grade 5',
    'grade 5': 'Grade 5',
    '6': 'Grade 6',
    grade6: 'Grade 6',
    'grade 6': 'Grade 6',
  };
  return map[normalized] || raw;
};
const gradeChipClass = (grade) => {
  if (grade === null || grade === undefined || grade === '') return 'gr-grade gr-grade-pending';
  const numeric = Number(grade);
  if (Number.isNaN(numeric)) return 'gr-grade gr-grade-pending';
  if (numeric >= 90) return 'gr-grade gr-grade-excellent';
  if (numeric >= 80) return 'gr-grade gr-grade-good';
  if (numeric >= 75) return 'gr-grade gr-grade-fair';
  return 'gr-grade gr-grade-needs-improvement';
};

const resolveAttendanceOverallStatus = ({ present, absent, late, excused }) => {
  const attended = present + late + excused;
  if (absent > 0 && attended > 0) return 'partial';
  if (absent > 0) return 'absent';
  if (late > 0) return 'partial';
  if (present > 0) return 'present';
  if (excused > 0) return 'excused';
  return 'unknown';
};

/* Helper: format attendance status for display */
const formatAttendanceStatus = (status) => {
  const statusMap = {
    'present': 'Present',
    'absent': 'Absent',
    'partial': 'Partial',
    'late': 'Late',
    'excused': 'Excused',
    'unknown': 'Unknown'
  };
  return statusMap[String(status || '').toLowerCase()] || String(status || 'Unknown');
};

const escapeCsvValue = (value) => {
  const text = String(value ?? '');
  if (text.includes(',') || text.includes('"') || text.includes('\n')) {
    return `"${text.replace(/"/g, '""')}"`;
  }
  return text;
};

const downloadCsv = (rows, fileName) => {
  const csv = rows.map((row) => row.map(escapeCsvValue).join(',')).join('\n');
  const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
};

const GradesRecords = () => {
  const [activeTab, setActiveTab] = useState('grades');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [quarter, setQuarter] = useState(1);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [expandedAttendanceStudentId, setExpandedAttendanceStudentId] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradeMonitoring, setGradeMonitoring] = useState({ summary: {}, students: [], quarter: 1 });
  const [historyRecords, setHistoryRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError('');
      try {
        const [gradesData, historyData, attendanceData] = await Promise.all([
          apiFetchData(`/api/grades/admin-monitoring/?quarter=${quarter}`),
          apiFetchData('/api/grades/academic-history/'),
          apiFetchData(`/api/attendance/records/?date=${selectedDate}`),
        ]);

        if (cancelled) return;
        setGradeMonitoring(gradesData || { summary: {}, students: [], quarter });
        setHistoryRecords(Array.isArray(historyData) ? historyData : []);
        setAttendanceRecords(Array.isArray(attendanceData) ? attendanceData : []);
      } catch (fetchError) {
        if (cancelled) return;
        setError(fetchError.message || 'Failed to load grade and records monitoring data.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    loadData();
    return () => {
      cancelled = true;
    };
  }, [quarter, selectedDate]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm, filterGrade, filterSection, filterStatus, quarter, selectedDate]);

  useEffect(() => {
    setExpandedAttendanceStudentId(null);
  }, [activeTab, selectedDate, filterGrade, filterSection, filterStatus, searchTerm]);

  const gradeOptions = useMemo(() => {
    const labels = new Set();
    gradeMonitoring.students.forEach((row) => labels.add(toGradeLabel(row.grade_level_label || row.grade_level)));
    historyRecords.forEach((row) => labels.add(toGradeLabel(row.grade_level)));
    attendanceRecords.forEach((row) => labels.add(toGradeLabel(row.grade_level)));
    return [...labels]
      .filter((value) => value && value !== '—')
      .sort((a, b) => (GRADE_ORDER[a] ?? 999) - (GRADE_ORDER[b] ?? 999));
  }, [attendanceRecords, gradeMonitoring.students, historyRecords]);

  // Section options that narrow based on the selected grade level (cascading filter).
  const sectionOptions = useMemo(() => {
    const gradeMatches = (gradeValue) =>
      filterGrade === 'all' || toGradeLabel(gradeValue) === filterGrade;
    const names = new Set();
    gradeMonitoring.students.forEach((row) => {
      if (gradeMatches(row.grade_level_label || row.grade_level) && row.section_name)
        names.add(row.section_name);
    });
    historyRecords.forEach((row) => {
      if (gradeMatches(row.grade_level) && row.section_name) names.add(row.section_name);
    });
    attendanceRecords.forEach((row) => {
      if (gradeMatches(row.grade_level) && row.section_name) names.add(row.section_name);
    });
    return [...names].sort();
  }, [attendanceRecords, filterGrade, gradeMonitoring.students, historyRecords]);

  // Reset section filter when grade filter changes so stale section selection doesn't ghost-filter.
  useEffect(() => {
    setFilterSection('all');
  }, [filterGrade]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return gradeMonitoring.students.filter((student) => {
      const matchesSearch = !query || [
        student.student_name,
        student.student_username,
        student.student_number,
        student.section_name,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const gradeLabel = toGradeLabel(student.grade_level_label || student.grade_level);
      const matchesGrade = filterGrade === 'all' || gradeLabel === filterGrade;
      const matchesSection = filterSection === 'all' || student.section_name === filterSection;
      const matchesStatus = filterStatus === 'all' || student.status === filterStatus;
      return matchesSearch && matchesGrade && matchesSection && matchesStatus;
    });
  }, [filterGrade, filterSection, filterStatus, gradeMonitoring.students, searchTerm]);

  const filteredHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return historyRecords.filter((record) => {
      const matchesSearch = !query || [
        record.student_name,
        record.student_username,
        record.student_number,
        record.subject_name,
        record.subject_code,
        record.school_year,
        record.teacher_name,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const matchesGrade = filterGrade === 'all' || toGradeLabel(record.grade_level) === filterGrade;
      const matchesSection = filterSection === 'all' || record.section_name === filterSection;
      const matchesStatus = filterStatus === 'all' || String(record.remarks || '').toLowerCase() === filterStatus;
      return matchesSearch && matchesGrade && matchesSection && matchesStatus;
    });
  }, [filterGrade, filterSection, filterStatus, historyRecords, searchTerm]);

  const filteredAttendanceRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    return attendanceRecords.filter((record) => {
      const matchesSearch = !query || [
        record.student_name,
        record.student_username,
        record.student_number,
        record.section_name,
        record.subject_name,
        record.subject_code,
        record.marked_by_name,
      ].some((value) => String(value || '').toLowerCase().includes(query));

      const matchesGrade = filterGrade === 'all' || toGradeLabel(record.grade_level) === filterGrade;
      const matchesSection = filterSection === 'all' || record.section_name === filterSection;
      return matchesSearch && matchesGrade && matchesSection;
    });
  }, [attendanceRecords, filterGrade, filterSection, searchTerm]);

  const filteredAttendanceStudents = useMemo(() => {
    const grouped = new Map();

    filteredAttendanceRecords.forEach((record) => {
      const studentId = record.student;
      if (!grouped.has(studentId)) {
        grouped.set(studentId, {
          student: studentId,
          student_name: record.student_name,
          student_username: record.student_username,
          student_number: record.student_number,
          grade_level: record.grade_level,
          section_name: record.section_name,
          present: 0,
          absent: 0,
          late: 0,
          excused: 0,
          subjects: [],
        });
      }

      const row = grouped.get(studentId);
      const statusKey = String(record.status || '').toUpperCase();
      if (statusKey === 'PRESENT') row.present += 1;
      else if (statusKey === 'ABSENT') row.absent += 1;
      else if (statusKey === 'LATE') row.late += 1;
      else if (statusKey === 'EXCUSED') row.excused += 1;

      row.subjects.push({
        id: record.id,
        subject_name: record.subject_name || '—',
        subject_code: record.subject_code || '—',
        schedule_time: record.schedule_time || '—',
        status: String(record.status || '').toLowerCase() || 'unknown',
      });
    });

    return [...grouped.values()]
      .map((row) => {
        const overall_status = resolveAttendanceOverallStatus(row);
        return {
          ...row,
          overall_status,
          total_subjects: row.subjects.length,
          subjects: row.subjects.sort((a, b) => a.subject_name.localeCompare(b.subject_name)),
        };
      })
      .filter((row) => filterStatus === 'all' || row.overall_status === filterStatus)
      .sort((a, b) => String(a.student_name || '').localeCompare(String(b.student_name || '')));
  }, [filteredAttendanceRecords, filterStatus]);

  const historyStats = useMemo(() => {
    const finalGrades = filteredHistory
      .map((record) => Number(record.final_grade))
      .filter((value) => !Number.isNaN(value));
    return {
      totalRecords: filteredHistory.length,
      uniqueStudents: new Set(filteredHistory.map((record) => record.student)).size,
      schoolYears: new Set(filteredHistory.map((record) => record.school_year)).size,
      averageFinal: finalGrades.length
        ? (finalGrades.reduce((sum, value) => sum + value, 0) / finalGrades.length).toFixed(2)
        : null,
    };
  }, [filteredHistory]);

  const attendanceStats = useMemo(() => {
    const statusCounts = filteredAttendanceRecords.reduce(
      (acc, record) => {
        const statusKey = String(record.status || '').toUpperCase();
        if (statusKey === 'PRESENT') acc.present += 1;
        else if (statusKey === 'ABSENT') acc.absent += 1;
        else if (statusKey === 'LATE') acc.late += 1;
        else if (statusKey === 'EXCUSED') acc.excused += 1;
        return acc;
      },
      { present: 0, absent: 0, late: 0, excused: 0 }
    );

    return {
      totalRecords: filteredAttendanceRecords.length,
      ...statusCounts,
      uniqueStudents: new Set(filteredAttendanceRecords.map((record) => record.student)).size,
    };
  }, [filteredAttendanceRecords]);

  const activeRows =
    activeTab === 'grades'
      ? filteredStudents
      : activeTab === 'history'
      ? filteredHistory
      : filteredAttendanceStudents;

  const totalPages = Math.ceil(activeRows.length / ITEMS_PER_PAGE);
  const paginatedRows = activeRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const exportCurrentView = () => {
    if (activeTab === 'grades') {
      downloadCsv(
        [
          ['Student Number', 'Student', 'Grade Level', 'Section', 'Graded Subjects', 'Average Grade', 'Status', 'Academic History Count'],
          ...filteredStudents.map((row) => [
            row.student_number || '—',
            row.student_name,
            toGradeLabel(row.grade_level_label || row.grade_level),
            row.section_name,
            `${row.graded_subjects}/${row.total_subjects}`,
            row.average_grade ?? '—',
            row.status,
            row.history_count,
          ]),
        ],
        `admin-current-grades-q${quarter}.csv`
      );
      return;
    }

    if (activeTab === 'history') {
      downloadCsv(
        [
          ['School Year', 'Student', 'Student Number', 'Grade Level', 'Section', 'Final Grade', 'Remarks', 'Teacher'],
          ...filteredHistory.map((row) => [
            row.school_year,
            row.student_name,
            row.student_number || '—',
            toGradeLabel(row.grade_level),
            row.section_name || '—',
            row.final_grade ?? '—',
            row.remarks || '—',
            row.teacher_name || '—',
          ]),
        ],
        'admin-academic-history.csv'
      );
      return;
    }

    downloadCsv(
      [
        ['Date', 'Student Number', 'Student', 'Grade Level', 'Section', 'Overall Status', 'Present', 'Late', 'Excused', 'Absent', 'Subject Status Details'],
        ...filteredAttendanceStudents.map((row) => [
          selectedDate,
          row.student_number || '—',
          row.student_name,
          toGradeLabel(row.grade_level),
          row.section_name || '—',
          row.overall_status,
          row.present,
          row.late,
          row.excused,
          row.absent,
          row.subjects.map((s) => `${s.subject_name} (${s.status})`).join('; '),
        ]),
      ],
      `admin-attendance-${selectedDate}.csv`
    );
  };

  const renderStats = () => {
    if (activeTab === 'history') {
      return (
        <div className="gr-stats-grid">
          <div className="gr-stat-card gr-stat-blue">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Academic Records</span>
              <History size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.totalRecords}</div>
            <div className="gr-stat-change">Historical grade rows on file</div>
          </div>

          <div className="gr-stat-card gr-stat-green">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Students With History</span>
              <Users size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.uniqueStudents}</div>
            <div className="gr-stat-change positive">Returning students tracked</div>
          </div>

          <div className="gr-stat-card gr-stat-yellow">
            <div className="gr-stat-header">
              <span className="gr-stat-label">School Years</span>
              <Calendar size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.schoolYears}</div>
            <div className="gr-stat-change">Distinct academic years</div>
          </div>

          <div className="gr-stat-card gr-stat-purple">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Average Final Grade</span>
              <TrendingUp size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.averageFinal ?? '—'}</div>
            <div className="gr-stat-change positive">Across filtered history</div>
          </div>
        </div>
      );
    }

    if (activeTab === 'attendance') {
      return (
        <div className="gr-stats-grid">
          <div className="gr-stat-card gr-stat-blue">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Attendance Records</span>
              <Calendar size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.totalRecords}</div>
            <div className="gr-stat-change">For {selectedDate}</div>
          </div>

          <div className="gr-stat-card gr-stat-green">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Present</span>
              <CheckCircle size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.present}</div>
            <div className="gr-stat-change positive">Subject-period entries</div>
          </div>

          <div className="gr-stat-card gr-stat-red">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Absent</span>
              <XCircle size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.absent}</div>
            <div className="gr-stat-change">Needs follow-up</div>
          </div>

          <div className="gr-stat-card gr-stat-yellow">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Late / Excused</span>
              <Clock size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.late + attendanceStats.excused}</div>
            <div className="gr-stat-change">{attendanceStats.uniqueStudents} unique students</div>
          </div>
        </div>
      );
    }

    const summary = gradeMonitoring.summary || {};
    return (
      <div className="gr-stats-grid">
        <div className="gr-stat-card gr-stat-blue">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Total Students</span>
            <Users size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.total_students ?? 0}</div>
          <div className="gr-stat-change">Active students monitored this quarter</div>
        </div>

        <div className="gr-stat-card gr-stat-green">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Students With Grades</span>
            <CheckCircle size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.graded_students ?? 0}</div>
          <div className="gr-stat-change positive">Any subject graded in Q{quarter}</div>
        </div>

        <div className="gr-stat-card gr-stat-yellow">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Pending / Partial</span>
            <AlertCircle size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.pending_grades ?? 0}</div>
          <div className="gr-stat-change">Students missing quarter grades</div>
        </div>

        <div className="gr-stat-card gr-stat-purple">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Average Grade</span>
            <TrendingUp size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.average_grade ?? '—'}</div>
          <div className="gr-stat-change positive">Quarter {quarter} overall average</div>
        </div>
      </div>
    );
  };

  return (
    <main className="grades-records-main">
      <section className="gr-section">
        <div className="gr-monitor-card">
          <div>
            <h2 className="gr-monitor-title">Grades and Records Monitoring</h2>
            <p className="gr-monitor-subtitle">
              Live admin view for current quarter grades, historical academic records, and attendance entries.
            </p>
          </div>
          <div className="gr-monitor-meta">
            <span className="gr-monitor-pill">Quarter {quarter}</span>
            <span className="gr-monitor-pill">Attendance Date {selectedDate}</span>
          </div>
        </div>
      </section>

      {error && (
        <section className="gr-section">
          <div className="gr-error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </section>
      )}

      <section className="gr-section">{renderStats()}</section>

      <div className="gr-tabs-container">
        <button className={`gr-tab-button ${activeTab === 'grades' ? 'gr-tab-active' : ''}`} onClick={() => setActiveTab('grades')}>
          <FileText size={18} />
          Current Grades
        </button>
        <button className={`gr-tab-button ${activeTab === 'history' ? 'gr-tab-active' : ''}`} onClick={() => setActiveTab('history')}>
          <History size={18} />
          Academic Records
        </button>
        <button className={`gr-tab-button ${activeTab === 'attendance' ? 'gr-tab-active' : ''}`} onClick={() => setActiveTab('attendance')}>
          <Calendar size={18} />
          Attendance
        </button>
      </div>

      <section className="gr-section">
        <div className="gr-section-header">
          <div>
            <h2 className="gr-section-title">
              {activeTab === 'grades'
                ? 'Current Quarter Grades'
                : activeTab === 'history'
                ? 'Academic History Records'
                : 'Attendance Records'}
            </h2>
            <p className="gr-section-subtitle">
              {activeTab === 'grades'
                ? `Student grade completion and quarter ${quarter} subject summaries.`
                : activeTab === 'history'
                ? 'Historical academic records for returning students.'
                : `Per-student attendance summary for ${selectedDate}, with expandable subject-level status.`}
            </p>
          </div>

          <div className="gr-header-actions">
            {activeTab === 'grades' && (
              <select value={quarter} onChange={(e) => setQuarter(Number(e.target.value))} className="gr-filter-select gr-inline-select">
                <option value={1}>Quarter 1</option>
                <option value={2}>Quarter 2</option>
                <option value={3}>Quarter 3</option>
                <option value={4}>Quarter 4</option>
              </select>
            )}
            {activeTab === 'attendance' && (
              <input type="date" value={selectedDate} onChange={(e) => setSelectedDate(e.target.value)} className="gr-date-input" />
            )}
            <button className="gr-btn-primary" onClick={exportCurrentView} disabled={loading}>
              <Download size={18} />
              Export
            </button>
          </div>
        </div>

        <div className="gr-filters-container">
          <div className="gr-search-box">
            <Search size={20} className="gr-search-icon" />
            <input
              type="text"
              placeholder={
                activeTab === 'grades'
                  ? 'Search by student name, username, student number, or section...'
                  : activeTab === 'history'
                  ? 'Search by student, subject, school year, or teacher...'
                  : 'Search by student, number, section, or subject...'
              }
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="gr-search-input"
            />
          </div>

          <div className="gr-filter-group">
            <Filter size={20} />
            <select value={filterGrade} onChange={(e) => setFilterGrade(e.target.value)} className="gr-filter-select">
              <option value="all">All Grade Levels</option>
              {gradeOptions.map((grade) => (
                <option key={grade} value={grade}>{grade}</option>
              ))}
            </select>
          </div>

          <div className="gr-filter-group">
            <Filter size={20} />
            <select value={filterSection} onChange={(e) => setFilterSection(e.target.value)} className="gr-filter-select">
              <option value="all">All Sections</option>
              {sectionOptions.map((section) => (
                <option key={section} value={section}>{section}</option>
              ))}
            </select>
          </div>

          <div className="gr-filter-group">
            <Filter size={20} />
            <select value={filterStatus} onChange={(e) => setFilterStatus(e.target.value)} className="gr-filter-select">
              <option value="all">All Status</option>
              {activeTab === 'grades' && (
                <>
                  <option value="completed">Completed</option>
                  <option value="partial">Partial</option>
                  <option value="pending">Pending</option>
                </>
              )}
              {activeTab === 'history' && (
                <>
                  <option value="passed">Passed</option>
                  <option value="failed">Failed</option>
                  <option value="promoted">Promoted</option>
                  <option value="retained">Retained</option>
                  <option value="incomplete">Incomplete</option>
                </>
              )}
              {activeTab === 'attendance' && (
                <>
                  <option value="present">Present</option>
                  <option value="partial">Partial</option>
                  <option value="absent">Absent</option>
                  <option value="excused">Excused</option>
                </>
              )}
            </select>
          </div>
        </div>

        <div className="gr-table-container">
          {loading ? (
            <div className="gr-empty">Loading monitoring data…</div>
          ) : activeRows.length === 0 ? (
            <div className="gr-empty">No records match the current filters.</div>
          ) : activeTab === 'grades' ? (
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Student #</th>
                  <th>Student</th>
                  <th>Grade Level</th>
                  <th>Section</th>
                  <th>Graded Subjects</th>
                  <th>Average</th>
                  <th>Status</th>
                  <th>History</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((student) => {
                  const expanded = expandedStudentId === student.student_id;
                  return (
                    <React.Fragment key={student.student_id}>
                      <tr>
                        <td data-label="Student #" className="gr-student-id">{student.student_number || '—'}</td>
                        <td data-label="Student" className="gr-student-name">
                          <div className="gr-stack">
                            <span>{student.student_name}</span>
                            <span className="gr-muted">@{student.student_username}</span>
                          </div>
                        </td>
                        <td data-label="Grade Level">{toGradeLabel(student.grade_level_label || student.grade_level)}</td>
                        <td data-label="Section">{student.section_name}</td>
                        <td data-label="Graded Subjects">{student.graded_subjects}/{student.total_subjects}</td>
                        <td data-label="Average">
                          {student.average_grade !== null ? (
                            <span className={gradeChipClass(student.average_grade)}>{student.average_grade}</span>
                          ) : (
                            <span className="gr-muted">—</span>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`gr-status-badge gr-status-${student.status}`}>{student.status}</span>
                        </td>
                        <td data-label="History">
                          <div className="gr-stack">
                            <span>{student.history_count} record{student.history_count === 1 ? '' : 's'}</span>
                            <span className="gr-muted">{student.latest_history_year || 'No prior year'}</span>
                          </div>
                        </td>
                        <td data-label="Details">
                          <button className="gr-btn-icon" onClick={() => setExpandedStudentId(expanded ? null : student.student_id)} title="Toggle subject breakdown">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="gr-expand-row">
                          <td colSpan={9}>
                            <div className="gr-subject-list">
                              {student.subject_breakdown.map((subject) => (
                                <div key={subject.subject_id} className="gr-subject-card">
                                  <div className="gr-subject-top">
                                    <strong>{subject.subject_name}</strong>
                                    <span className="gr-subject-code">{subject.subject_code}</span>
                                  </div>
                                  <div>
                                    {subject.quarter_grade !== null ? (
                                      <span className={gradeChipClass(subject.quarter_grade)}>{subject.quarter_grade}</span>
                                    ) : (
                                      <span className="gr-grade gr-grade-pending">No grade</span>
                                    )}
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          ) : activeTab === 'history' ? (
            <table className="gr-table">
              <thead>
                <tr>
                  <th>School Year</th>
                  <th>Student</th>
                  <th>Grade Level</th>
                  <th>Section</th>
                  <th>Final Grade</th>
                  <th>Remarks</th>
                  <th>Teacher</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((record) => (
                  <tr key={record.id}>
                    <td data-label="School Year">{record.school_year}</td>
                    <td data-label="Student" className="gr-student-name">
                      <div className="gr-stack">
                        <span>{record.student_name}</span>
                        <span className="gr-muted">{record.student_number || '@' + record.student_username}</span>
                      </div>
                    </td>
                    <td data-label="Grade Level">{toGradeLabel(record.grade_level)}</td>
                    <td data-label="Section">{record.section_name || '—'}</td>
                    <td data-label="Final Grade">
                      {record.final_grade !== null ? (
                        <span className={gradeChipClass(record.final_grade)}>{record.final_grade}</span>
                      ) : (
                        <span className="gr-muted">—</span>
                      )}
                    </td>
                    <td data-label="Remarks">
                      <span className={`gr-status-badge gr-status-${String(record.remarks || '').toLowerCase() || 'pending'}`}>
                        {record.remarks || '—'}
                      </span>
                    </td>
                    <td data-label="Teacher">{record.teacher_name || '—'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          ) : (
            <table className="gr-table">
              <thead>
                <tr>
                  <th>Student #</th>
                  <th>Student</th>
                  <th>Grade Level</th>
                  <th>Section</th>
                  <th>Status</th>
                  <th>Subjects</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((record) => {
                  const expanded = expandedAttendanceStudentId === record.student;
                  return (
                    <React.Fragment key={record.student}>
                      <tr>
                        <td data-label="Student #" className="gr-student-id">{record.student_number || '—'}</td>
                        <td data-label="Student" className="gr-student-name">
                          <div className="gr-stack">
                            <span>{record.student_name}</span>
                            <span className="gr-muted">@{record.student_username || '—'}</span>
                          </div>
                        </td>
                        <td data-label="Grade Level">{toGradeLabel(record.grade_level)}</td>
                        <td data-label="Section">{record.section_name || '—'}</td>
                        <td data-label="Status">
                          <span className={`gr-attendance-badge gr-att-${record.overall_status}`}>
                            {formatAttendanceStatus(record.overall_status)}
                          </span>
                        </td>
                        <td data-label="Subjects">{record.total_subjects}</td>
                        <td data-label="Details">
                          <button className="gr-btn-icon" onClick={() => setExpandedAttendanceStudentId(expanded ? null : record.student)} title="Toggle subject attendance details">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="gr-expand-row">
                          <td colSpan={7}>
                            <div className="gr-subject-list">
                              {record.subjects.map((subject) => (
                                <div key={subject.id} className="gr-subject-card">
                                  <div className="gr-subject-top">
                                    <strong>{subject.subject_name}</strong>
                                    <span className="gr-subject-code">{subject.subject_code}</span>
                                  </div>
                                  <div className="gr-stack">
                                    <span className="gr-muted">{subject.schedule_time}</span>
                                    <span className={`gr-attendance-badge gr-att-${subject.status}`}>{formatAttendanceStatus(subject.status)}</span>
                                  </div>
                                </div>
                              ))}
                            </div>
                          </td>
                        </tr>
                      )}
                    </React.Fragment>
                  );
                })}
              </tbody>
            </table>
          )}

          <Pagination
            currentPage={page}
            totalPages={totalPages}
            onPageChange={setPage}
            totalItems={activeRows.length}
            itemsPerPage={ITEMS_PER_PAGE}
          />
        </div>
      </section>
    </main>
  );
};

export default GradesRecords;