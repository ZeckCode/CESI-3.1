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
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import jsPDF from 'jspdf';
import Pagination from './Pagination';
import AdminTable from './AdminTable';
import StatCard, { StatsGrid } from './StatCard';
import { apiFetchData } from '../api/apiFetch';
import '../AdminWebsiteCSS/GradesRecords.css';
import PreviewModal from '../PreviewModal';

const ITEMS_PER_PAGE = 10;
const TABLE_SKELETON_ROWS = 6;

const todayString = () => new Date().toISOString().slice(0, 10);

const normalizeGradeLevel = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();

  if (raw === '-1' || raw === 'prek' || raw === 'pre-kinder' || raw === 'pre kinder') return -1;
  if (raw === 'kinder' || raw === '0') return 0;

  const match = raw.match(/^grade\s*(-?\d+)$/);
  if (match) return Number(match[1]);

  const numericMatch = raw.match(/-?\d+/);
  const num = numericMatch ? Number(numericMatch[0]) : Number.NaN;
  if (!Number.isNaN(num)) return num;

  return null;
};

const toGradeLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const normalized = normalizeGradeLevel(value);

  if (normalized === -1) return 'Pre-Kinder';
  if (normalized === 0) return 'Kinder';
  if (normalized !== null && normalized >= 1 && normalized <= 6) return `Grade ${normalized}`;

  const raw = String(value).trim();
  const lower = raw.toLowerCase();

  if (lower === 'prek' || lower === 'pre-kinder' || lower === 'pre kinder') return 'Pre-Kinder';
  if (lower === 'kinder') return 'Kinder';

  if (/^grade\s*grade\s*(\d+)$/i.test(raw)) {
    return `Grade ${raw.match(/(\d+)$/)[1]}`;
  }
  if (/^gradegrade\s*(\d+)$/i.test(raw)) {
    return `Grade ${raw.match(/(\d+)$/)[1]}`;
  }

  const map = {
    '-1': 'Pre-Kinder',
    prek: 'Pre-Kinder',
    'pre-kinder': 'Pre-Kinder',
    'pre kinder': 'Pre-Kinder',
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

  return map[lower] || raw;
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

const getStudentKey = (student) =>
  String(student?.student_number || student?.student_id || student?.student_username || '');

const getHistoryGroupKey = (record) => {
  const base =
    record?.student_number ||
    record?.student ||
    record?.student_id ||
    record?.student_username ||
    record?.student_name ||
    'unknown';
  return `${base}::${record?.school_year || 'unknown'}`;
};

const safeValue = (value) => (value === null || value === undefined || value === '' ? '—' : value);

const escapeHtml = (value) =>
  String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');

const REPORT_CARD_MONTHS = ['Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec', 'Jan', 'Feb', 'Mar', 'Apr'];

const getReportCardAttendanceSummary = (reportCardData) => {
  if (!reportCardData || !Array.isArray(reportCardData.attendance_summary)) {
    return [];
  }
  return reportCardData.attendance_summary;
};

const getReportCardMonthValue = (subjectRow, monthLabel) => {
  if (!subjectRow || !Array.isArray(subjectRow.months)) return 0;
  const match = subjectRow.months.find((item) => item.month === monthLabel);
  return match ? Number(match.present_days || 0) : 0;
};

const GradesRecords = () => {
  const [activeTab, setActiveTab] = useState('grades');
  const [searchTerm, setSearchTerm] = useState('');
  const [filterGrade, setFilterGrade] = useState('all');
  const [filterSection, setFilterSection] = useState('all');
  const [filterStatus, setFilterStatus] = useState('all');
  const [filterSchoolYear, setFilterSchoolYear] = useState('all');
  const [selectedDate, setSelectedDate] = useState(todayString());
  const [quarter, setQuarter] = useState(1);
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [expandedHistoryKey, setExpandedHistoryKey] = useState(null);
  const [expandedAttendanceStudentId, setExpandedAttendanceStudentId] = useState(null);
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [gradeMonitoring, setGradeMonitoring] = useState({ summary: {}, students: [], quarter: 1 });
  const [historyRecords, setHistoryRecords] = useState([]);
  const [attendanceRecords, setAttendanceRecords] = useState([]);

  const [showPreview, setShowPreview] = useState(false);
  const [previewData, setPreviewData] = useState([]);
  const [isReportCardOpen, setIsReportCardOpen] = useState(false);
  const [reportCardLoading, setReportCardLoading] = useState(false);
  const [reportCardError, setReportCardError] = useState('');
  const [reportCardData, setReportCardData] = useState(null);
  const [reportCardRemark, setReportCardRemark] = useState('');

  const filterGradeValue = useMemo(() => {
    if (filterGrade === 'all') return null;
    return normalizeGradeLevel(filterGrade);
  }, [filterGrade]);

  useEffect(() => {
    let cancelled = false;

    const loadData = async () => {
      setLoading(true);
      setError('');

      try {
        if (activeTab === 'grades') {
          const params = new URLSearchParams({
            quarter: String(quarter),
            page: String(page),
          });

          if (filterGrade && filterGrade !== 'all') {
            params.set('grade_level', filterGrade);
          }

          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|')
              ? filterSection.split('|')[1]
              : filterSection;
            if (sectionName) params.set('section', sectionName);
          }

          const gradesData = await apiFetchData(`/api/grades/admin-monitoring/?${params.toString()}`);
          if (cancelled) return;

          const validGradesData =
            gradesData && typeof gradesData === 'object'
              ? {
                  summary: gradesData.summary || {},
                  students: Array.isArray(gradesData.students) ? gradesData.students : [],
                  quarter,
                }
              : { summary: {}, students: [], quarter };

          setGradeMonitoring(validGradesData);
          setHistoryRecords([]);
          setAttendanceRecords([]);
        } else if (activeTab === 'history') {
          const historyParams = new URLSearchParams({ page: String(page) });

          if (filterGrade && filterGrade !== 'all') historyParams.set('grade_level', filterGrade);

          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|')
              ? filterSection.split('|')[1]
              : filterSection;
            if (sectionName) historyParams.set('section', sectionName);
          }

          if (filterStatus && filterStatus !== 'all') {
            historyParams.set('status', filterStatus);
          }

          if (filterSchoolYear && filterSchoolYear !== 'all') {
            historyParams.set('school_year', filterSchoolYear);
          }

          const historyData = await apiFetchData(`/api/grades/academic-history/?${historyParams.toString()}`);
          if (cancelled) return;

          const validHistoryData = Array.isArray(historyData)
            ? historyData
            : Array.isArray(historyData?.results)
            ? historyData.results
            : [];

          setHistoryRecords(validHistoryData);
          setGradeMonitoring({ summary: {}, students: [], quarter });
          setAttendanceRecords([]);
        } else if (activeTab === 'attendance') {
          const attendanceParams = new URLSearchParams({
            date: selectedDate,
            page: String(page),
          });

          if (filterGrade && filterGrade !== 'all') attendanceParams.set('grade_level', filterGrade);

          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|')
              ? filterSection.split('|')[1]
              : filterSection;
            if (sectionName) attendanceParams.set('section', sectionName);
          }

          const attendanceData = await apiFetchData(`/api/attendance/records/?${attendanceParams.toString()}`);
          if (cancelled) return;

          const validAttendanceData = Array.isArray(attendanceData)
            ? attendanceData
            : Array.isArray(attendanceData?.results)
            ? attendanceData.results
            : [];

          setAttendanceRecords(validAttendanceData);
          setGradeMonitoring({ summary: {}, students: [], quarter });
          setHistoryRecords([]);
        }
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
  }, [activeTab, quarter, selectedDate, page, filterGrade, filterSection, filterStatus, filterSchoolYear]);

  useEffect(() => {
    setPage(1);
  }, [activeTab, searchTerm, filterGrade, filterSection, filterStatus, filterSchoolYear, quarter, selectedDate]);

  useEffect(() => {
    setExpandedAttendanceStudentId(null);
    setExpandedHistoryKey(null);
  }, [activeTab, selectedDate, filterGrade, filterSection, filterStatus, searchTerm, filterSchoolYear]);

  useEffect(() => {
    setExpandedStudentId(null);
    setExpandedHistoryKey(null);
    setExpandedAttendanceStudentId(null);
  }, [activeTab]);

  useEffect(() => {
    setFilterSection('all');
  }, [filterGrade]);

  const gradeOptions = useMemo(() => {
    return [
      'Pre-Kinder',
      'Kinder',
      'Grade 1',
      'Grade 2',
      'Grade 3',
      'Grade 4',
      'Grade 5',
      'Grade 6',
    ];
  }, []);

  const sectionOptions = useMemo(() => {
    const items = new Map();

    const gradeMatches = (gradeValue) =>
      filterGrade === 'all' || toGradeLabel(gradeValue) === filterGrade;

    const sourceRows =
      activeTab === 'grades'
        ? gradeMonitoring.students
        : activeTab === 'history'
        ? historyRecords
        : attendanceRecords;

    sourceRows.forEach((row) => {
      const rawGrade = row.grade_level_label || row.grade_level || '';
      const gradeLabel = toGradeLabel(rawGrade);
      const sectionName = row.section_name || '';

      if (!sectionName) return;
      if (!gradeMatches(rawGrade)) return;

      const key = `${gradeLabel}|${sectionName}`;
      items.set(key, { value: key, label: `${gradeLabel} — ${sectionName}` });
    });

    return [...items.values()].sort((a, b) => a.label.localeCompare(b.label));
  }, [activeTab, filterGrade, gradeMonitoring.students, historyRecords, attendanceRecords]);

  const schoolYearOptions = useMemo(() => {
    const years = new Set();
    historyRecords.forEach((row) => {
      if (row.school_year) years.add(row.school_year);
    });
    return [...years].sort((a, b) => b.localeCompare(a));
  }, [historyRecords]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return gradeMonitoring.students.filter((student) => {
      const matchesSearch =
        !query ||
        [
          student.student_name,
          student.student_username,
          student.student_number,
          student.section_name,
        ].some((value) => String(value || '').toLowerCase().includes(query));

      const rowGrade = normalizeGradeLevel(student.grade_level_label || student.grade_level);
      const gradeLabel = toGradeLabel(student.grade_level_label || student.grade_level);

      const matchesGrade =
        filterGradeValue === null ||
        (rowGrade !== null && rowGrade === filterGradeValue) ||
        gradeLabel === filterGrade;

      const studentSectionKey = `${gradeLabel}|${student.section_name || ''}`;
      const matchesSection =
        filterSection === 'all' ||
        student.section_name === filterSection ||
        studentSectionKey === filterSection;

      const matchesStatus = filterStatus === 'all' || student.status === filterStatus;

      return matchesSearch && matchesGrade && matchesSection && matchesStatus;
    });
  }, [filterGrade, filterGradeValue, filterSection, filterStatus, gradeMonitoring.students, searchTerm]);

  const filteredHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return historyRecords.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.student_name,
          record.student_username,
          record.student_number,
          record.subject_name,
          record.subject_code,
          record.school_year,
          record.teacher_name,
        ].some((value) => String(value || '').toLowerCase().includes(query));

      const gradeLabel = toGradeLabel(record.grade_level);
      const recordSectionKey = `${gradeLabel}|${record.section_name || ''}`;

      const matchesGrade = filterGrade === 'all' || gradeLabel === filterGrade;
      const matchesSection =
        filterSection === 'all' ||
        record.section_name === filterSection ||
        recordSectionKey === filterSection;
      const matchesSchoolYear =
        filterSchoolYear === 'all' || record.school_year === filterSchoolYear;
      const matchesStatus =
        filterStatus === 'all' || String(record.remarks || '').toLowerCase() === filterStatus;

      return matchesSearch && matchesGrade && matchesSection && matchesSchoolYear && matchesStatus;
    });
  }, [filterGrade, filterSection, filterStatus, filterSchoolYear, historyRecords, searchTerm]);

  const filteredHistoryGroups = useMemo(() => {
    const groups = new Map();

    filteredHistory.forEach((record) => {
      const key = getHistoryGroupKey(record);
      if (!groups.has(key)) {
        groups.set(key, {
          key,
          student: record.student,
          student_number: record.student_number,
          student_name: record.student_name,
          student_username: record.student_username,
          grade_level: record.grade_level,
          section_name: record.section_name,
          school_year: record.school_year,
          subjects: [],
        });
      }
      groups.get(key).subjects.push(record);
    });

    groups.forEach((group) => {
      group.subjects.sort((a, b) =>
        String(a.subject_name || '').localeCompare(String(b.subject_name || ''))
      );
    });

    return [...groups.values()].sort((a, b) => {
      const yearA = String(a.school_year || '');
      const yearB = String(b.school_year || '');
      if (yearA !== yearB) return yearB.localeCompare(yearA);
      return String(a.student_name || '').localeCompare(String(b.student_name || ''));
    });
  }, [filteredHistory]);

  const filteredAttendanceRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();

    return attendanceRecords.filter((record) => {
      const matchesSearch =
        !query ||
        [
          record.student_name,
          record.student_username,
          record.student_number,
          record.section_name,
          record.subject_name,
          record.subject_code,
          record.marked_by_name,
        ].some((value) => String(value || '').toLowerCase().includes(query));

      const rowGrade = normalizeGradeLevel(record.grade_level);
      const gradeLabel = toGradeLabel(record.grade_level);

      const matchesGrade =
        filterGradeValue === null ||
        (rowGrade !== null && rowGrade === filterGradeValue) ||
        gradeLabel === filterGrade;

      const recordSectionKey = `${gradeLabel}|${record.section_name || ''}`;
      const matchesSection =
        filterSection === 'all' ||
        record.section_name === filterSection ||
        recordSectionKey === filterSection;

      return matchesSearch && matchesGrade && matchesSection;
    });
  }, [attendanceRecords, filterGrade, filterGradeValue, filterSection, searchTerm]);

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

  const descriptiveInsights = useMemo(() => {
    if (activeTab === 'grades') {
      const summary = gradeMonitoring.summary || {};
      const totalStudents = Number(summary.total_students || filteredStudents.length || 0);
      const gradedStudents = Number(
        summary.graded_students ??
          filteredStudents.filter((student) => student.status !== 'pending').length ??
          0
      );
      const pendingGrades = Number(
        summary.pending_grades ?? Math.max(totalStudents - gradedStudents, 0)
      );

      const completionRate =
        totalStudents > 0 ? Math.round((gradedStudents / totalStudents) * 100) : 0;

      const highPerformers = filteredStudents.filter(
        (student) => Number(student.average_grade) >= 90
      ).length;

      const atRisk = filteredStudents.filter((student) => {
        const numeric = Number(student.average_grade);
        return !Number.isNaN(numeric) && numeric < 75;
      }).length;

      return [
        {
          title: 'Quarter Coverage',
          body: `Quarter ${quarter} has ${gradedStudents}/${totalStudents} students with recorded grades (${completionRate}% completion).`,
        },
        {
          title: 'Pending Workload',
          body:
            pendingGrades === 0
              ? 'No pending grade records detected in current filters.'
              : `${pendingGrades} student${pendingGrades === 1 ? '' : 's'} still need quarter grading completion.`,
        },
        {
          title: 'Performance Signal',
          body: `${highPerformers} student${highPerformers === 1 ? '' : 's'} are high-performing (90+), while ${atRisk} student${
            atRisk === 1 ? '' : 's'
          } are below 75 and may need intervention support.`,
        },
      ];
    }

    if (activeTab === 'history') {
      const passingCount = filteredHistory.filter((record) =>
        ['passed', 'promoted'].includes(String(record.remarks || '').toLowerCase())
      ).length;

      const passRate =
        filteredHistory.length > 0
          ? Math.round((passingCount / filteredHistory.length) * 100)
          : null;

      const latestYear = filteredHistory
        .map((record) => record.school_year)
        .filter(Boolean)
        .sort((a, b) => String(b).localeCompare(String(a)))[0];

      return [
        {
          title: 'Historical Coverage',
          body: `Filtered view includes ${historyStats.totalRecords} records across ${historyStats.schoolYears} school year${
            historyStats.schoolYears === 1 ? '' : 's'
          } and ${historyStats.uniqueStudents} students.`,
        },
        {
          title: 'Achievement Trend',
          body:
            passRate === null
              ? 'No historical remarks available to compute pass trend.'
              : `Pass/promote indicators are at ${passRate}% for the current filtered history set.`,
        },
        {
          title: 'Recent Snapshot',
          body: `Latest school year in view is ${latestYear || 'not available'} with average final grade ${
            historyStats.averageFinal ?? '—'
          } .`,
        },
      ];
    }

    const presentRate =
      attendanceStats.totalRecords > 0
        ? Math.round((attendanceStats.present / attendanceStats.totalRecords) * 100)
        : 0;

    const absentStudents = filteredAttendanceStudents.filter(
      (student) => student.overall_status === 'absent'
    ).length;

    const partialStudents = filteredAttendanceStudents.filter(
      (student) => student.overall_status === 'partial'
    ).length;

    return [
      {
        title: 'Daily Attendance Health',
        body: `For ${selectedDate}, present entries are ${attendanceStats.present}/${attendanceStats.totalRecords} (${presentRate}%).`,
      },
      {
        title: 'Risk Watchlist',
        body: `${absentStudents} student${absentStudents === 1 ? '' : 's'} are fully absent and ${partialStudents} student${
          partialStudents === 1 ? '' : 's'
        } have partial attendance patterns.`,
      },
      {
        title: 'Punctuality Signal',
        body: `${attendanceStats.late} late and ${attendanceStats.excused} excused entries recorded for this date.`,
      },
    ];
  }, [
    activeTab,
    gradeMonitoring.summary,
    filteredStudents,
    quarter,
    filteredHistory,
    historyStats.totalRecords,
    historyStats.schoolYears,
    historyStats.uniqueStudents,
    historyStats.averageFinal,
    attendanceStats.totalRecords,
    attendanceStats.present,
    attendanceStats.late,
    attendanceStats.excused,
    filteredAttendanceStudents,
    selectedDate,
  ]);

  const activeRows =
    activeTab === 'grades'
      ? filteredStudents
      : activeTab === 'history'
      ? filteredHistoryGroups
      : filteredAttendanceStudents;

  const skeletonColumns = activeTab === 'grades' ? 8 : activeTab === 'history' ? 6 : 7;

  const renderTableSkeletonRows = () =>
    Array.from({ length: TABLE_SKELETON_ROWS }).map((_, rowIdx) => (
      <tr key={`gr-skeleton-row-${rowIdx}`}>
        {Array.from({ length: skeletonColumns }).map((__, colIdx) => (
          <td key={`gr-skeleton-cell-${rowIdx}-${colIdx}`}>
            <div
              className={`gr-skeleton-line ${
                colIdx === 0 ? 'w-md' : colIdx === skeletonColumns - 1 ? 'w-sm' : 'w-lg'
              }`}
            />
          </td>
        ))}
      </tr>
    ));

  const totalPages = Math.max(1, Math.ceil(activeRows.length / ITEMS_PER_PAGE));
  const paginatedRows = activeRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

  const renderStats = () => {
    if (activeTab === 'grades') {
      const summary = gradeMonitoring.summary || {};
      const totalStudents = Number(summary.total_students || filteredStudents.length || 0);
      const gradedStudents = Number(
        summary.graded_students ??
          filteredStudents.filter((student) => student.status !== 'pending').length ??
          0
      );
      const pendingStudents = Math.max(totalStudents - gradedStudents, 0);
      const averageGradeValue = filteredStudents.length
        ? filteredStudents.reduce((sum, student) => {
            const value = Number(student.average_grade);
            return Number.isFinite(value) ? sum + value : sum;
          }, 0) / filteredStudents.length
        : 0;

      return (
        <StatsGrid>
          <StatCard
            label="Total Students"
            value={totalStudents}
            icon={<Users size={18} />}
            color="blue"
            subtitle="Current quarter view"
          />
          <StatCard
            label="Graded"
            value={gradedStudents}
            icon={<CheckCircle size={18} />}
            color="green"
            subtitle={`${Math.round((gradedStudents / Math.max(totalStudents, 1)) * 100)}% completion`}
          />
          <StatCard
            label="Pending"
            value={pendingStudents}
            icon={<Clock size={18} />}
            color="yellow"
            subtitle="Need grading"
          />
          <StatCard
            label="Average"
            value={Number.isFinite(averageGradeValue) ? averageGradeValue.toFixed(2) : '0.00'}
            icon={<TrendingUp size={18} />}
            color="purple"
            subtitle="on filtered students"
          />
        </StatsGrid>
      );
    }

    if (activeTab === 'history') {
      const totalStudents = historyStats.uniqueStudents || 0;
      const totalRecords = historyStats.totalRecords || 0;
      const averageFinal = historyStats.averageFinal ?? '0.00';

      return (
        <StatsGrid>
          <StatCard
            label="Student Records"
            value={totalStudents}
            icon={<Users size={18} />}
            color="blue"
            subtitle="Unique students"
          />
          <StatCard
            label="Published Grades"
            value={totalRecords}
            icon={<FileText size={18} />}
            color="green"
            subtitle="Academic entries"
          />
          <StatCard
            label="School Years"
            value={historyStats.schoolYears || 0}
            icon={<Calendar size={18} />}
            color="yellow"
            subtitle="Covered"
          />
          <StatCard
            label="Avg Final"
            value={averageFinal}
            icon={<TrendingUp size={18} />}
            color="purple"
            subtitle="Across filtered records"
          />
        </StatsGrid>
      );
    }

    const totalStudents = attendanceStats.uniqueStudents || 0;
    const present = attendanceStats.present || 0;
    const absent = attendanceStats.absent || 0;
    const late = attendanceStats.late || 0;

    return (
      <StatsGrid>
        <StatCard
          label="Students"
          value={totalStudents}
          icon={<Users size={18} />}
          color="blue"
          subtitle="Tracked for date"
        />
        <StatCard
          label="Present"
          value={present}
          icon={<CheckCircle size={18} />}
          color="green"
          subtitle="Attendance entries"
        />
        <StatCard
          label="Absent"
          value={absent}
          icon={<XCircle size={18} />}
          color="red"
          subtitle="Unexcused"
        />
        <StatCard
          label="Late"
          value={late}
          icon={<Clock size={18} />}
          color="yellow"
          subtitle="Tardy entries"
        />
      </StatsGrid>
    );
  };

  const handleOpenPreview = () => {
    try {
      let previewData = [];

      if (activeTab === 'grades') {
        previewData = filteredStudents.map((row) => ({
          'Student Number': row.student_number || '—',
          'Student Name': row.student_name,
          'Grade Level': toGradeLabel(row.grade_level_label || row.grade_level),
          Section: row.section_name,
          'Graded Subjects': `${row.graded_subjects}/${row.total_subjects}`,
          'Average Grade': row.average_grade ?? '—',
          Status: row.status,
          'History Count': row.history_count,
        }));
      } else if (activeTab === 'history') {
        previewData = filteredHistory.map((row) => ({
          'School Year': row.school_year,
          'Student Name': row.student_name,
          'Student Number': row.student_number || '—',
          'Grade Level': toGradeLabel(row.grade_level),
          Section: row.section_name || '—',
          Subject: row.subject_name,
          'Subject Code': row.subject_code || '—',
          'Final Grade': row.final_grade ?? '—',
          Teacher: row.teacher_name || '—',
        }));
      } else if (activeTab === 'attendance') {
        previewData = filteredAttendanceStudents.map((row) => ({
          Date: selectedDate,
          'Student Number': row.student_number || '—',
          'Student Name': row.student_name,
          'Grade Level': toGradeLabel(row.grade_level),
          Section: row.section_name || '—',
          'Overall Status': row.overall_status,
          Present: row.present,
          Late: row.late,
          Excused: row.excused,
          Absent: row.absent,
          'Subject Details': row.subjects.map((s) => `${s.subject_name} (${s.status})`).join('; '),
        }));
      }

      setPreviewData(previewData);
      setShowPreview(true);
    } catch (err) {
      console.error('Error opening preview:', err);
      alert('Failed to open preview. Please try again.');
    }
  };

  const exportCurrentView = async () => {
    try {
      const wb = new ExcelJS.Workbook();
      const timestamp = new Date().toISOString().slice(0, 10);
      let filename = '';

      const createStyledWorksheet = (sheetName, columnDefs, data) => {
        const ws = wb.addWorksheet(sheetName);
        
        // Set column widths
        columnDefs.forEach((colDef, index) => {
          ws.getColumn(index + 1).width = colDef.width;
        });

        // Add manual header row
        const headerRow = ws.addRow(columnDefs.map(col => col.header));
        
        // Style header cells
        headerRow.eachCell((cell) => {
          cell.alignment = { horizontal: 'center', vertical: 'center', wrapText: true };
          cell.font = { bold: true, color: { rgb: 'FFFFFFFF' }, size: 11 };
          cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { rgb: 'FF667EEA' } };
          cell.border = {
            top: { style: 'thin', color: { rgb: 'FF000000' } },
            left: { style: 'thin', color: { rgb: 'FF000000' } },
            bottom: { style: 'thin', color: { rgb: 'FF000000' } },
            right: { style: 'thin', color: { rgb: 'FF000000' } }
          };
        });

        // Add data rows with alignment
        data.forEach((rowData) => {
          const dataRow = ws.addRow(columnDefs.map(col => rowData[col.key] || ''));
          
          // Style data cells with alignment based on column
          dataRow.eachCell((cell, colNumber) => {
            const colDef = columnDefs[colNumber - 1];
            // Left align Student Name and Teacher columns, center align others
            const align = colDef && (colDef.key === 'Student Name' || colDef.key === 'Teacher') ? 'left' : 'center';
            cell.alignment = { horizontal: align, vertical: 'center' };
            cell.border = {
              top: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
              left: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
              bottom: { style: 'thin', color: { rgb: 'FFD3D3D3' } },
              right: { style: 'thin', color: { rgb: 'FFD3D3D3' } }
            };
          });
        });
      };

      if (activeTab === 'grades') {
        const gradesData = filteredStudents.map((row) => ({
          'Student Number': row.student_number || '—',
          'Student Name': row.student_name,
          'Grade Level': toGradeLabel(row.grade_level_label || row.grade_level),
          Section: row.section_name,
          'Graded Subjects': `${row.graded_subjects}/${row.total_subjects}`,
          'Average Grade': row.average_grade ?? '—',
          Status: row.status,
          'History Count': row.history_count,
        }));

        createStyledWorksheet('Current Grades', [
          { header: 'Student Number', key: 'Student Number', width: 15 },
          { header: 'Student Name', key: 'Student Name', width: 20 },
          { header: 'Grade Level', key: 'Grade Level', width: 15 },
          { header: 'Section', key: 'Section', width: 15 },
          { header: 'Graded Subjects', key: 'Graded Subjects', width: 15 },
          { header: 'Average Grade', key: 'Average Grade', width: 15 },
          { header: 'Status', key: 'Status', width: 12 },
          { header: 'History Count', key: 'History Count', width: 15 },
        ], gradesData);

        filename = `admin-current-grades-q${quarter}-${timestamp}.xlsx`;
      } else if (activeTab === 'history') {
        const historyData = filteredHistory.map((row) => ({
          'School Year': row.school_year,
          'Student Name': row.student_name,
          'Student Number': row.student_number || '—',
          'Grade Level': toGradeLabel(row.grade_level),
          Section: row.section_name || '—',
          Subject: row.subject_name,
          'Subject Code': row.subject_code || '—',
          'Final Grade': row.final_grade ?? '—',
          Teacher: row.teacher_name || '—',
        }));

        createStyledWorksheet('Academic History', [
          { header: 'School Year', key: 'School Year', width: 15 },
          { header: 'Student Name', key: 'Student Name', width: 20 },
          { header: 'Student Number', key: 'Student Number', width: 15 },
          { header: 'Grade Level', key: 'Grade Level', width: 15 },
          { header: 'Section', key: 'Section', width: 15 },
          { header: 'Subject', key: 'Subject', width: 20 },
          { header: 'Subject Code', key: 'Subject Code', width: 12 },
          { header: 'Final Grade', key: 'Final Grade', width: 12 },
          { header: 'Teacher', key: 'Teacher', width: 15 },
        ], historyData);

        filename = `admin-academic-history-${timestamp}.xlsx`;
      } else if (activeTab === 'attendance') {
        const attendanceData = filteredAttendanceStudents.map((row) => ({
          Date: selectedDate,
          'Student Number': row.student_number || '—',
          'Student Name': row.student_name,
          'Grade Level': toGradeLabel(row.grade_level),
          Section: row.section_name || '—',
          'Overall Status': row.overall_status,
          Present: row.present,
          Late: row.late,
          Excused: row.excused,
          Absent: row.absent,
          'Subject Details': row.subjects.map((s) => `${s.subject_name} (${s.status})`).join('; '),
        }));

        createStyledWorksheet('Attendance', [
          { header: 'Date', key: 'Date', width: 15 },
          { header: 'Student Number', key: 'Student Number', width: 15 },
          { header: 'Student Name', key: 'Student Name', width: 20 },
          { header: 'Grade Level', key: 'Grade Level', width: 15 },
          { header: 'Section', key: 'Section', width: 15 },
          { header: 'Overall Status', key: 'Overall Status', width: 15 },
          { header: 'Present', key: 'Present', width: 10 },
          { header: 'Late', key: 'Late', width: 10 },
          { header: 'Excused', key: 'Excused', width: 10 },
          { header: 'Absent', key: 'Absent', width: 10 },
          { header: 'Subject Details', key: 'Subject Details', width: 30 },
        ], attendanceData);

        filename = `admin-attendance-${selectedDate}-${timestamp}.xlsx`;
      }

      // Generate buffer and download
      const buffer = await wb.xlsx.writeBuffer();
      const blob = new Blob([buffer], { type: 'application/octet-stream' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);
      
      alert(`✓ Export successful! File: ${filename}`);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    }
  };

  const exportCurrentViewPDF = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const timestamp = new Date().toISOString().slice(0, 10);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;

      // Add title
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text(`Grades Records - Current Grades (Q${quarter})`, margin, 15);

      // Add underline
      doc.setDrawColor(0, 123, 255);
      doc.setLineWidth(1);
      doc.line(margin, 18, pageWidth - margin, 18);

      // Add timestamp
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 25);

      const gradesData = filteredStudents.map((row) => ({
        'Student Number': row.student_number || '—',
        'Student Name': row.student_name,
        'Grade Level': toGradeLabel(row.grade_level_label || row.grade_level),
        Section: row.section_name,
        'Graded Subjects': `${row.graded_subjects}/${row.total_subjects}`,
        'Average Grade': row.average_grade ?? '—',
        Status: row.status,
        'History Count': row.history_count,
      }));

      const headers = ['STUDENT NUMBER', 'STUDENT NAME', 'GRADE LEVEL', 'SECTION', 'GRADED SUBJECTS', 'AVERAGE GRADE', 'STATUS', 'HISTORY COUNT'];
      const keys = ['Student Number', 'Student Name', 'Grade Level', 'Section', 'Graded Subjects', 'Average Grade', 'Status', 'History Count'];

      const rows = gradesData.map(row => keys.map(key => row[key]));

      // Column widths: Student Number narrower, Student Name wider, others proportional
      const studentNumberWidth = usableWidth * 0.15;
      const studentNameWidth = usableWidth * 0.15;
      const remainingWidth = usableWidth - studentNumberWidth - studentNameWidth;
      const otherColWidth = remainingWidth / (headers.length - 2);

      const getColWidth = (idx) => {
        if (idx === 0) return studentNumberWidth;
        if (idx === 1) return studentNameWidth;
        return otherColWidth;
      };

      const headerRowHeight = 10;
      const rowHeight = 10;
      let yPos = 32;

      // Draw header row
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);

        doc.setFillColor(0, 123, 255);
        doc.rect(xPos, yPos, colW, headerRowHeight, 'F');
        doc.setDrawColor(0, 123, 255);
        doc.setLineWidth(0.5);
        doc.rect(xPos, yPos, colW, headerRowHeight);

        if (idx < headers.length - 1) {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(1.5);
          doc.line(xPos + colW, yPos, xPos + colW, yPos + headerRowHeight);
        }
      });

      // Draw header text
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);
        const centerX = xPos + colW / 2;
        doc.text(header, centerX, yPos + 6, { maxWidth: colW - 2, align: 'center' });
      });

      yPos += headerRowHeight;

      // Draw body rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      rows.forEach((row, rowIdx) => {
        if (yPos + rowHeight > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        const isEvenRow = rowIdx % 2 === 0;
        const bgColor = isEvenRow ? [255, 255, 255] : [245, 245, 245];

        // Draw all cells
        row.forEach((cell, colIdx) => {
          let xPos = margin;
          for (let i = 0; i < colIdx; i++) {
            xPos += getColWidth(i);
          }
          const colW = getColWidth(colIdx);

          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(xPos, yPos, colW, rowHeight, 'F');

          doc.setDrawColor(200, 200, 200);
          doc.setLineWidth(0.3);
          doc.rect(xPos, yPos, colW, rowHeight);
        });

        // Draw text
        doc.setTextColor(0, 0, 0);
        row.forEach((cell, colIdx) => {
          let xPos = margin;
          for (let i = 0; i < colIdx; i++) {
            xPos += getColWidth(i);
          }
          const colW = getColWidth(colIdx);

          // Left align Student Name (index 1), center align everything else
          if (colIdx === 1) {
            doc.text(String(cell), xPos + 2, yPos + 5, { maxWidth: colW - 4 });
          } else {
            const centerX = xPos + colW / 2;
            doc.text(String(cell), centerX, yPos + 5, { maxWidth: colW - 4, align: 'center' });
          }
        });

        yPos += rowHeight;
      });

      doc.save(`admin-current-grades-q${quarter}-${timestamp}.pdf`);
      alert('✓ PDF file downloaded successfully!');
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const exportCurrentViewHistoryPDF = async () => {
    try {
      const doc = new jsPDF('l', 'mm', 'a4');
      const timestamp = new Date().toISOString().slice(0, 10);
      const pageWidth = doc.internal.pageSize.getWidth();
      const pageHeight = doc.internal.pageSize.getHeight();
      const margin = 10;
      const usableWidth = pageWidth - 2 * margin;

      // Add title
      doc.setFontSize(14);
      doc.setFont(undefined, 'bold');
      doc.setTextColor(0, 0, 0);
      doc.text('Grades Records - Academic History', margin, 15);

      // Add underline
      doc.setDrawColor(0, 123, 255);
      doc.setLineWidth(1);
      doc.line(margin, 18, pageWidth - margin, 18);

      // Add timestamp
      doc.setFontSize(10);
      doc.setFont(undefined, 'normal');
      doc.setTextColor(0, 0, 0);
      doc.text(`Generated: ${new Date().toLocaleString()}`, margin, 25);

      const historyData = filteredHistory.map((row) => ({
        'School Year': row.school_year,
        'Student Name': row.student_name,
        'Student Number': row.student_number || '—',
        'Grade Level': toGradeLabel(row.grade_level),
        Section: row.section_name || '—',
        Subject: row.subject_name,
        'Subject Code': row.subject_code || '—',
        'Final Grade': row.final_grade ?? '—',
        Teacher: row.teacher_name || '—',
      }));

      const headers = ['SCHOOL YEAR', 'STUDENT NAME', 'STUDENT NUMBER', 'GRADE LEVEL', 'SECTION', 'SUBJECT', 'SUBJECT CODE', 'FINAL GRADE', 'TEACHER'];
      const keys = ['School Year', 'Student Name', 'Student Number', 'Grade Level', 'Section', 'Subject', 'Subject Code', 'Final Grade', 'Teacher'];

      const rows = historyData.map(row => keys.map(key => row[key]));

      // Column widths: School Year narrow, Student Name wider, Teacher normal, others proportional
      const schoolYearWidth = usableWidth * 0.10;
      const studentNameWidth = usableWidth * 0.15;
      const teacherWidth = usableWidth * 0.12;
      const remainingWidth = usableWidth - schoolYearWidth - studentNameWidth - teacherWidth;
      const otherColWidth = remainingWidth / (headers.length - 3);

      const getColWidth = (idx) => {
        if (idx === 0) return schoolYearWidth;
        if (idx === 1) return studentNameWidth;
        if (idx === 8) return teacherWidth;
        return otherColWidth;
      };

      const headerRowHeight = 10;
      const rowHeight = 10;
      let yPos = 32;

      // Draw header row
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);

        doc.setFillColor(0, 123, 255);
        doc.rect(xPos, yPos, colW, headerRowHeight, 'F');
        doc.setDrawColor(0, 123, 255);
        doc.setLineWidth(0.5);
        doc.rect(xPos, yPos, colW, headerRowHeight);

        if (idx < headers.length - 1) {
          doc.setDrawColor(255, 255, 255);
          doc.setLineWidth(1.5);
          doc.line(xPos + colW, yPos, xPos + colW, yPos + headerRowHeight);
        }
      });

      // Draw header text
      doc.setTextColor(255, 255, 255);
      doc.setFont(undefined, 'bold');
      doc.setFontSize(8);
      headers.forEach((header, idx) => {
        let xPos = margin;
        for (let i = 0; i < idx; i++) {
          xPos += getColWidth(i);
        }
        const colW = getColWidth(idx);
        const centerX = xPos + colW / 2;
        doc.text(header, centerX, yPos + 6, { maxWidth: colW - 2, align: 'center' });
      });

      yPos += headerRowHeight;

      // Draw body rows
      doc.setFont(undefined, 'normal');
      doc.setFontSize(8);

      rows.forEach((row, rowIdx) => {
        if (yPos + rowHeight > pageHeight - 20) {
          doc.addPage();
          yPos = margin;
        }

        const isEvenRow = rowIdx % 2 === 0;
        const bgColor = isEvenRow ? [255, 255, 255] : [245, 245, 245];

        // Draw all cells
        row.forEach((cell, colIdx) => {
          let xPos = margin;
          for (let i = 0; i < colIdx; i++) {
            xPos += getColWidth(i);
          }
          const colW = getColWidth(colIdx);

          doc.setFillColor(bgColor[0], bgColor[1], bgColor[2]);
          doc.rect(xPos, yPos, colW, rowHeight, 'F');

          doc.setDrawColor(200, 210, 220);
          doc.rect(xPos, yPos, colW, rowHeight, 'S');

          if (colIdx === 0) {
            doc.text(String(cell), xPos + 2, yPos + 4.2, { maxWidth: colW - 4 });
          } else {
            doc.text(String(cell), xPos + colW / 2, yPos + 4.8, { align: 'center' });
          }
          xPos += colW;
        });

        yPos += rowHeight;
      });

      const summaryY = yPos + 8;
      doc.setFillColor(217, 230, 246);
      doc.rect(margin, summaryY, totalWidth, 10, 'F');
      doc.setDrawColor(0, 0, 0);
      doc.rect(margin, summaryY, totalWidth, 10, 'S');
      doc.setFont(undefined, 'bold');
      doc.text('General Average', margin + 2, summaryY + 6.8);
      doc.setFont(undefined, 'normal');
      doc.text(String(safeValue(reportCardData.general_average)), margin + totalWidth * 0.72, summaryY + 6.8, { align: 'center' });

      const signatureY = pageHeight - 28;
      doc.setDrawColor(80, 80, 80);
      doc.line(margin, signatureY, pageWidth / 2 - 18, signatureY);
      doc.line(pageWidth / 2 + 18, signatureY, pageWidth - margin, signatureY);
      doc.setFont(undefined, 'normal');
      doc.text('Parent Signature', margin + 18, signatureY + 6);
      doc.text('Teacher Signature', pageWidth / 2 + 35, signatureY + 6);

      const fileSuffix = new Date().toISOString().slice(0, 10);
      const fileStudent = String(student.student_number || student.id || 'student').replace(/\s+/g, '-');
      doc.save(`report-card-${fileStudent}-${fileSuffix}.pdf`);
    } catch (err) {
      console.error('Error exporting PDF:', err);
      alert('Failed to export PDF. Please try again.');
    }
  };

  const openReportCard = async (student) => {
    const studentId = student?.student_id ?? student?.id;
    if (!studentId) {
      alert('Student ID is missing for this row.');
      return;
    }

    setIsReportCardOpen(true);
    setReportCardData(null);
    setReportCardLoading(true);
    setReportCardError('');
    setReportCardRemark('');

    try {
      const data = await apiFetchData(`/api/grades/admin-report-card/${studentId}/`);
      setReportCardData(data || null);
    } catch (err) {
      setReportCardData(null);
      setReportCardError(err.message || 'Failed to load report card data.');
    } finally {
      setReportCardLoading(false);
    }
  };

  const closeReportCard = () => {
    setIsReportCardOpen(false);
    setReportCardData(null);
    setReportCardError('');
    setReportCardRemark('');
  };

  const downloadReportCardPDF = () => {
    if (!reportCardData || !reportCardData.student) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const student = reportCardData.student;
    const subjects = Array.isArray(reportCardData.subjects) ? reportCardData.subjects : [];

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Student Report Card', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    let infoY = 30;
    doc.text(`School Year: ${safeValue(reportCardData.school_year)}`, margin, infoY);
    infoY += 6;
    doc.text(`Name: ${safeValue(student.student_name)}`, margin, infoY);
    infoY += 6;
    doc.text(`Student Number: ${safeValue(student.student_number)}`, margin, infoY);
    infoY += 6;
    doc.text(`Grade / Section: ${safeValue(student.grade_level_label)} - ${safeValue(student.section_name)}`, margin, infoY);

    const tableTopY = 52;
    const headerHeight = 9;
    const leftPad = 2;
    const totalWidth = pageWidth - margin * 2;
    const subjectWidth = totalWidth * 0.34;
    const remarkWidth = totalWidth * 0.16;
    const gradeWidth = (totalWidth - subjectWidth - remarkWidth) / 5;
    const colWidths = [subjectWidth, gradeWidth, gradeWidth, gradeWidth, gradeWidth, gradeWidth, remarkWidth];
    const headers = ['Learning Area', 'Q1', 'Q2', 'Q3', 'Q4', 'Final', 'Remarks'];

    let currentY = tableTopY + headerHeight;
    doc.setFillColor(78, 141, 216);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');

    let x = margin;
    headers.forEach((header, index) => {
      const cellWidth = colWidths[index];
      doc.rect(x, tableTopY, cellWidth, headerHeight, 'F');
      doc.text(header, index === 0 ? x + leftPad : x + cellWidth / 2, tableTopY + 6, {
        align: index === 0 ? 'left' : 'center',
      });
      x += cellWidth;
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');

    subjects.forEach((row, rowIndex) => {
      const rowValues = [
        row.subject_name || '—',
        safeValue(row.q1),
        safeValue(row.q2),
        safeValue(row.q3),
        safeValue(row.q4),
        safeValue(row.final_grade),
        row.remarks || 'PASSED',
      ];

      const wrappedText = doc.splitTextToSize(String(rowValues[0]), colWidths[0] - 4);
      const rowHeight = Math.max(8, wrappedText.length * 4 + 2);

      if (currentY + rowHeight > pageHeight - 42) {
        doc.addPage();
        currentY = 16;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(246, 249, 252);
        doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
      }

      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.25);
      let cellX = margin;
      rowValues.forEach((cell, cellIndex) => {
        const cellWidth = colWidths[cellIndex];
        doc.rect(cellX, currentY, cellWidth, rowHeight, 'S');

        if (cellIndex === 0) {
          doc.text(wrappedText, cellX + leftPad, currentY + 4, { maxWidth: cellWidth - 4 });
        } else {
          doc.text(String(cell), cellX + cellWidth / 2, currentY + 4.5, { align: 'center' });
        }

        cellX += cellWidth;
      });

      currentY += rowHeight;
    });

    const averageBoxY = currentY + 8;
    doc.setFillColor(223, 233, 246);
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, averageBoxY, totalWidth, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('General Average', margin + 2, averageBoxY + 6.8);
    doc.setFont(undefined, 'normal');
    doc.text(String(safeValue(reportCardData.general_average)), margin + totalWidth * 0.72, averageBoxY + 6.8, { align: 'center' });

    const remarkY = averageBoxY + 18;
    if (reportCardRemark.trim()) {
      doc.setFont(undefined, 'bold');
      doc.text('Admin Remark:', margin, remarkY);
      doc.setFont(undefined, 'normal');
      const wrappedRemark = doc.splitTextToSize(reportCardRemark.trim(), pageWidth - margin * 2);
      doc.text(wrappedRemark, margin, remarkY + 6);
    }

    const signatureY = pageHeight - 28;
    doc.setDrawColor(60, 60, 60);
    doc.line(margin, signatureY, pageWidth / 2 - 18, signatureY);
    doc.line(pageWidth / 2 + 18, signatureY, pageWidth - margin, signatureY);
    doc.setFont(undefined, 'normal');
    doc.text('Parent Signature', margin + 16, signatureY + 6);
    doc.text('Teacher Signature', pageWidth / 2 + 32, signatureY + 6);

    const fileSuffix = new Date().toISOString().slice(0, 10);
    const fileStudent = String(student.student_number || student.id || 'student').replace(/\s+/g, '-');
    doc.save(`report-card-${fileStudent}-${fileSuffix}.pdf`);
  };

  const printReportCard = () => {
    if (!reportCardData || !reportCardData.student) return;

    const doc = new jsPDF('p', 'mm', 'a4');
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const margin = 12;
    const student = reportCardData.student;
    const subjects = Array.isArray(reportCardData.subjects) ? reportCardData.subjects : [];

    doc.setFillColor(255, 255, 255);
    doc.rect(0, 0, pageWidth, pageHeight, 'F');

    doc.setFontSize(18);
    doc.setFont(undefined, 'bold');
    doc.text('Student Report Card', pageWidth / 2, 18, { align: 'center' });

    doc.setFontSize(10);
    doc.setFont(undefined, 'normal');
    let infoY = 30;
    doc.text(`School Year: ${safeValue(reportCardData.school_year)}`, margin, infoY);
    infoY += 6;
    doc.text(`Name: ${safeValue(student.student_name)}`, margin, infoY);
    infoY += 6;
    doc.text(`Student Number: ${safeValue(student.student_number)}`, margin, infoY);
    infoY += 6;
    doc.text(`Grade / Section: ${safeValue(student.grade_level_label)} - ${safeValue(student.section_name)}`, margin, infoY);

    const tableTopY = 52;
    const headerHeight = 9;
    const leftPad = 2;
    const totalWidth = pageWidth - margin * 2;
    const subjectWidth = totalWidth * 0.34;
    const remarkWidth = totalWidth * 0.16;
    const gradeWidth = (totalWidth - subjectWidth - remarkWidth) / 5;
    const colWidths = [subjectWidth, gradeWidth, gradeWidth, gradeWidth, gradeWidth, gradeWidth, remarkWidth];
    const headers = ['Learning Area', 'Q1', 'Q2', 'Q3', 'Q4', 'Final', 'Remarks'];

    let currentY = tableTopY + headerHeight;
    doc.setFillColor(78, 141, 216);
    doc.setTextColor(255, 255, 255);
    doc.setFont(undefined, 'bold');

    let x = margin;
    headers.forEach((header, index) => {
      const cellWidth = colWidths[index];
      doc.rect(x, tableTopY, cellWidth, headerHeight, 'F');
      doc.text(header, index === 0 ? x + leftPad : x + cellWidth / 2, tableTopY + 6, {
        align: index === 0 ? 'left' : 'center',
      });
      x += cellWidth;
    });

    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'normal');

    subjects.forEach((row, rowIndex) => {
      const rowValues = [
        row.subject_name || '—',
        safeValue(row.q1),
        safeValue(row.q2),
        safeValue(row.q3),
        safeValue(row.q4),
        safeValue(row.final_grade),
        row.remarks || 'PASSED',
      ];

      const wrappedText = doc.splitTextToSize(String(rowValues[0]), colWidths[0] - 4);
      const rowHeight = Math.max(8, wrappedText.length * 4 + 2);

      if (currentY + rowHeight > pageHeight - 42) {
        doc.addPage();
        currentY = 16;
      }

      if (rowIndex % 2 === 0) {
        doc.setFillColor(246, 249, 252);
        doc.rect(margin, currentY, totalWidth, rowHeight, 'F');
      }

      doc.setDrawColor(200, 210, 220);
      doc.setLineWidth(0.25);
      let cellX = margin;
      rowValues.forEach((cell, cellIndex) => {
        const cellWidth = colWidths[cellIndex];
        doc.rect(cellX, currentY, cellWidth, rowHeight, 'S');

        if (cellIndex === 0) {
          doc.text(wrappedText, cellX + leftPad, currentY + 4, { maxWidth: cellWidth - 4 });
        } else {
          doc.text(String(cell), cellX + cellWidth / 2, currentY + 4.5, { align: 'center' });
        }

        cellX += cellWidth;
      });

      currentY += rowHeight;
    });

    const averageBoxY = currentY + 8;
    doc.setFillColor(223, 233, 246);
    doc.setDrawColor(0, 0, 0);
    doc.rect(margin, averageBoxY, totalWidth, 10, 'F');
    doc.setTextColor(0, 0, 0);
    doc.setFont(undefined, 'bold');
    doc.text('General Average', margin + 2, averageBoxY + 6.8);
    doc.setFont(undefined, 'normal');
    doc.text(String(safeValue(reportCardData.general_average)), margin + totalWidth * 0.72, averageBoxY + 6.8, { align: 'center' });

    const remarkY = averageBoxY + 18;
    if (reportCardRemark.trim()) {
      doc.setFont(undefined, 'bold');
      doc.text('Admin Remark:', margin, remarkY);
      doc.setFont(undefined, 'normal');
      const wrappedRemark = doc.splitTextToSize(reportCardRemark.trim(), pageWidth - margin * 2);
      doc.text(wrappedRemark, margin, remarkY + 6);
    }

    const signatureY = pageHeight - 28;
    doc.setDrawColor(60, 60, 60);
    doc.line(margin, signatureY, pageWidth / 2 - 18, signatureY);
    doc.line(pageWidth / 2 + 18, signatureY, pageWidth - margin, signatureY);
    doc.setFont(undefined, 'normal');
    doc.text('Parent Signature', margin + 16, signatureY + 6);
    doc.text('Teacher Signature', pageWidth / 2 + 32, signatureY + 6);

    const pdfBlob = doc.output('blob');
    const pdfUrl = URL.createObjectURL(pdfBlob);
    const printWindow = window.open(pdfUrl, '_blank', 'noopener,noreferrer');

    if (printWindow) {
      printWindow.focus();
      setTimeout(() => {
        try {
          printWindow.print();
        } catch (error) {
          console.warn('Print preview blocked:', error);
        }
        setTimeout(() => URL.revokeObjectURL(pdfUrl), 1500);
      }, 600);
    } else {
      alert('Please allow pop-ups to print the report card.');
      URL.revokeObjectURL(pdfUrl);
    }
  };

  const attendanceSummary = useMemo(() => [], [reportCardData]);

  const reportCardStudent = reportCardData?.student ?? null;

  return (
    <main className="grades-records-main">
      <section className="gr-section">
        {loading ? (
          <div className="gr-monitor-card gr-skeleton-panel">
            <div>
              <div className="gr-skeleton-line gr-skeleton-title" />
              <div className="gr-skeleton-line gr-skeleton-subtitle" />
            </div>
            <div className="gr-monitor-meta">
              <div className="gr-skeleton-line gr-skeleton-pill" />
              <div className="gr-skeleton-line gr-skeleton-pill" />
            </div>
          </div>
        ) : (
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
        )}
      </section>

      {!loading && error && (
        <section className="gr-section">
          <div className="gr-error-box">
            <AlertCircle size={18} />
            <span>{error}</span>
          </div>
        </section>
      )}

      <section className="gr-section">
        {loading ? (
          <div className="gr-stats-grid">
            {Array.from({ length: 4 }).map((_, idx) => (
              <div key={`gr-skeleton-stat-${idx}`} className="gr-stat-card gr-skeleton-stat-card">
                <div className="gr-skeleton-line w-md" />
                <div className="gr-skeleton-line w-sm" />
              </div>
            ))}
          </div>
        ) : (
          renderStats()
        )}
      </section>

      <section className="gr-section">
        {loading ? (
          <div className="gr-insights-panel gr-skeleton-panel">
            <div className="gr-insights-header">
              <div className="gr-skeleton-line gr-skeleton-insight-title" />
              <div className="gr-skeleton-line gr-skeleton-insight-subtitle" />
            </div>
            <div className="gr-insights-grid">
              {Array.from({ length: 3 }).map((_, idx) => (
                <article key={`gr-skeleton-insight-${idx}`} className="gr-insight-card">
                  <div className="gr-skeleton-line w-md" style={{ marginBottom: 8 }} />
                  <div className="gr-skeleton-line w-lg" style={{ marginBottom: 6 }} />
                  <div className="gr-skeleton-line w-sm" />
                </article>
              ))}
            </div>
          </div>
        ) : (
          <div className="gr-insights-panel">
            <div className="gr-insights-header">
              <h3 className="gr-insights-title">Descriptive Analysis</h3>
              <p className="gr-insights-subtitle">
                Context-aware interpretation of the current {activeTab} view.
              </p>
            </div>

            <div className="gr-insights-grid">
              {descriptiveInsights.map((insight) => (
                <article key={insight.title} className="gr-insight-card">
                  <h4 className="gr-insight-card-title">{insight.title}</h4>
                  <p className="gr-insight-card-text">{insight.body}</p>
                </article>
              ))}
            </div>
          </div>
        )}
      </section>

      {loading ? (
        <div className="gr-tabs-container gr-tabs-skeleton">
          <div className="gr-skeleton-line gr-skeleton-tab" />
          <div className="gr-skeleton-line gr-skeleton-tab" />
          <div className="gr-skeleton-line gr-skeleton-tab" />
        </div>
      ) : (
        <div className="gr-tabs-container">
          <button
            className={`gr-tab-button ${activeTab === 'grades' ? 'gr-tab-active' : ''}`}
            onClick={() => setActiveTab('grades')}
          >
            <FileText size={18} />
            Current Grades
          </button>
          <button
            className={`gr-tab-button ${activeTab === 'history' ? 'gr-tab-active' : ''}`}
            onClick={() => setActiveTab('history')}
          >
            <History size={18} />
            Academic Records
          </button>
          <button
            className={`gr-tab-button ${activeTab === 'attendance' ? 'gr-tab-active' : ''}`}
            onClick={() => setActiveTab('attendance')}
          >
            <Calendar size={18} />
            Attendance
          </button>
        </div>
      )}

      <section className="gr-section">
        {loading ? (
          <div className="gr-section-header gr-section-header-skeleton">
            <div>
              <div className="gr-skeleton-line gr-skeleton-section-title" />
              <div className="gr-skeleton-line gr-skeleton-section-subtitle" />
            </div>
            <div className="gr-header-actions">
              <div className="gr-skeleton-line gr-skeleton-control" />
              <div className="gr-skeleton-line gr-skeleton-control" />
            </div>
          </div>
        ) : (
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
                <select
                  value={quarter}
                  onChange={(e) => setQuarter(Number(e.target.value))}
                  className="gr-filter-select gr-inline-select"
                >
                  <option value={1}>Quarter 1</option>
                  <option value={2}>Quarter 2</option>
                  <option value={3}>Quarter 3</option>
                  <option value={4}>Quarter 4</option>
                </select>
              )}

              {activeTab === 'attendance' && (
                <input
                  type="date"
                  value={selectedDate}
                  onChange={(e) => setSelectedDate(e.target.value)}
                  className="gr-date-input"
                />
              )}

              <button className="gr-btn-primary" onClick={handleOpenPreview} disabled={loading}>
                <Download size={18} />
                View & Export
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="gr-filters-container gr-filters-skeleton">
            <div className="gr-skeleton-line gr-skeleton-search" />
            <div className="gr-skeleton-line gr-skeleton-filter" />
            <div className="gr-skeleton-line gr-skeleton-filter" />
            <div className="gr-skeleton-line gr-skeleton-filter" />
          </div>
        ) : (
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
              <select
                value={filterGrade}
                onChange={(e) => setFilterGrade(e.target.value)}
                className="gr-filter-select"
              >
                <option value="all">All Grade Levels</option>
                {gradeOptions.map((grade) => (
                  <option key={grade} value={grade}>
                    {grade}
                  </option>
                ))}
              </select>
            </div>

            <div className="gr-filter-group">
              <Filter size={20} />
              <select
                value={filterSection}
                onChange={(e) => setFilterSection(e.target.value)}
                className="gr-filter-select"
              >
                <option value="all">All Sections</option>
                {sectionOptions.map((section) => (
                  <option key={section.value} value={section.value}>
                    {section.label}
                  </option>
                ))}
              </select>
            </div>

            {activeTab === 'history' && (
              <div className="gr-filter-group">
                <Filter size={20} />
                <select
                  value={filterSchoolYear}
                  onChange={(e) => setFilterSchoolYear(e.target.value)}
                  className="gr-filter-select"
                >
                  <option value="all">All School Years</option>
                  {schoolYearOptions.map((year) => (
                    <option key={year} value={year}>
                      {year}
                    </option>
                  ))}
                </select>
              </div>
            )}

            <div className="gr-filter-group">
              <Filter size={20} />
              <select
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="gr-filter-select"
              >
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
        )}

        <div className="gr-table-container">
          {loading ? (
            <table className="gr-table gr-table-skeleton" aria-hidden="true">
              <thead>
                <tr>
                  {Array.from({ length: skeletonColumns }).map((_, idx) => (
                    <th key={`gr-skeleton-head-${idx}`}>
                      <div className="gr-skeleton-line gr-skeleton-head" />
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>{renderTableSkeletonRows()}</tbody>
            </table>
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
                  <th>Actions</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((student) => {
                  const studentKey = getStudentKey(student);
                  const expanded = expandedStudentId === studentKey;

                  return (
                    <React.Fragment key={studentKey}>
                      <tr>
                        <td data-label="Student #" className="gr-student-id">
                          {student.student_number || '—'}
                        </td>
                        <td data-label="Student" className="gr-student-name">
                          <div className="gr-stack">
                            <span>{student.student_name}</span>
                          </div>
                        </td>
                        <td data-label="Grade Level">
                          {toGradeLabel(student.grade_level_label || student.grade_level)}
                        </td>
                        <td data-label="Section">{student.section_name}</td>
                        <td data-label="Graded Subjects">
                          {student.graded_subjects}/{student.total_subjects}
                        </td>
                        <td data-label="Average">
                          {student.average_grade !== null ? (
                            <span className={gradeChipClass(student.average_grade)}>
                              {student.average_grade}
                            </span>
                          ) : (
                            <span className="gr-muted">—</span>
                          )}
                        </td>
                        <td data-label="Status">
                          <span className={`gr-status-badge gr-status-${student.status}`}>
                            {student.status}
                          </span>
                        </td>
                        <td data-label="Report Card">
                          <button
                            className="gr-btn-report"
                            onClick={() => openReportCard(student)}
                            title="Open student report card"
                          >
                            Report Card
                          </button>
                        </td>
                        <td data-label="Details">
                          <button
                            className="gr-btn-icon"
                            onClick={() =>
                              setExpandedStudentId(expanded ? null : studentKey)
                            }
                            title="Toggle subject breakdown"
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="gr-expand-row">
                          <td colSpan={9}>
                            <div className="gr-subject-list">
                              {(student.subject_breakdown || []).map((subject) => (
                                <div key={subject.subject_id} className="gr-subject-card">
                                  <div className="gr-subject-top">
                                    <strong>{subject.subject_name}</strong>
                                    <span className="gr-subject-code">{subject.subject_code}</span>
                                  </div>
                                  <div>
                                    {subject.quarter_grade !== null ? (
                                      <span className={gradeChipClass(subject.quarter_grade)}>
                                        {subject.quarter_grade}
                                      </span>
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
                  <th>Subjects</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((group) => {
                  const expanded = expandedHistoryKey === group.key;

                  return (
                    <React.Fragment key={group.key}>
                      <tr>
                        <td data-label="School Year">{group.school_year}</td>
                        <td data-label="Student" className="gr-student-name">
                          <div className="gr-stack">
                            <span>{group.student_name}</span>
                            <span className="gr-muted">
                              {group.student_number || '@' + group.student_username}
                            </span>
                          </div>
                        </td>
                        <td data-label="Grade Level">{toGradeLabel(group.grade_level)}</td>
                        <td data-label="Section">{group.section_name || '—'}</td>
                        <td data-label="Subjects">{group.subjects.length}</td>
                        <td data-label="Details">
                          <button
                            className="gr-btn-icon"
                            onClick={() =>
                              setExpandedHistoryKey(expanded ? null : group.key)
                            }
                            title="Toggle published subject grades"
                          >
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>

                      {expanded && (
                        <tr className="gr-expand-row">
                          <td colSpan={6}>
                            <div className="gr-subject-list">
                              {group.subjects.map((subject) => (
                                <div key={subject.id} className="gr-subject-card">
                                  <div className="gr-subject-top">
                                    <strong>{subject.subject_name}</strong>
                                    <span className="gr-subject-code">
                                      {subject.subject_code || '—'}
                                    </span>
                                  </div>
                                  <div className="gr-stack">
                                    {subject.final_grade !== null ? (
                                      <span className={gradeChipClass(subject.final_grade)}>
                                        {subject.final_grade}
                                      </span>
                                    ) : (
                                      <span className="gr-muted">—</span>
                                    )}
                                    <span className="gr-muted">
                                      {subject.teacher_name || '—'}
                                    </span>
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
                        <td data-label="Student #" className="gr-student-id">
                          {record.student_number || '—'}
                        </td>
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
                            {record.overall_status}
                          </span>
                        </td>
                        <td data-label="Subjects">{record.total_subjects}</td>
                        <td data-label="Details">
                          <button
                            className="gr-btn-icon"
                            onClick={() =>
                              setExpandedAttendanceStudentId(expanded ? null : record.student)
                            }
                            title="Toggle subject attendance details"
                          >
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
                                    <span className={`gr-attendance-badge gr-att-${subject.status}`}>
                                      {subject.status}
                                    </span>
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

          {!loading && (
            <Pagination
              currentPage={page}
              totalPages={totalPages}
              onPageChange={setPage}
              totalItems={activeRows.length}
              itemsPerPage={ITEMS_PER_PAGE}
            />
          )}
        </div>
      </section>

      {isReportCardOpen && (
        <div className="gr-report-modal-overlay" onClick={closeReportCard}>
          <div className="gr-report-modal" onClick={(e) => e.stopPropagation()}>
            <div className="gr-report-header">
              <div>
                <h3>Student Report Card</h3>
                {!reportCardLoading && reportCardData?.student && (
                  <p>
                    {reportCardData.student.student_name} - {reportCardData.student.grade_level_label} - {reportCardData.student.section_name}
                  </p>
                )}
              </div>
              <button className="gr-btn-icon" onClick={closeReportCard} title="Close report card">X</button>
            </div>

            <div className="gr-report-body">
              {reportCardLoading && <div className="gr-empty">Loading report card...</div>}
              {!reportCardLoading && reportCardError && (
                <div className="gr-error-box">
                  <AlertCircle size={18} />
                  <span>{reportCardError}</span>
                </div>
              )}

              {!reportCardLoading && !reportCardError && reportCardData && (
                <>
                  <div className="gr-report-meta">
                    <div><strong>School Year:</strong> {safeValue(reportCardData.school_year)}</div>
                    <div><strong>Student Number:</strong> {safeValue(reportCardData.student?.student_number)}</div>
                  </div>

                  <div className="gr-report-table-wrap">
                    <table className="gr-report-table">
                      <thead>
                        <tr>
                          <th>Learning Area</th>
                          <th>Q1</th>
                          <th>Q2</th>
                          <th>Q3</th>
                          <th>Q4</th>
                          <th>Final Grade</th>
                          <th>Remarks</th>
                        </tr>
                      </thead>
                      <tbody>
                        {(reportCardData.subjects || []).map((row) => (
                          <tr key={row.subject_id}>
                            <td>{safeValue(row.subject_name || '—')}</td>
                            <td>{safeValue(row.q1)}</td>
                            <td>{safeValue(row.q2)}</td>
                            <td>{safeValue(row.q3)}</td>
                            <td>{safeValue(row.q4)}</td>
                            <td>{safeValue(row.final_grade)}</td>
                            <td>{safeValue(row.remarks || 'PASSED')}</td>
                          </tr>
                        ))}
                      </tbody>
                      <tfoot>
                        <tr>
                          <td>General Average</td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td></td>
                          <td>{safeValue(reportCardData.general_average)}</td>
                          <td>{safeValue(reportCardData.overall_remarks)}</td>
                        </tr>
                      </tfoot>
                    </table>
                  </div>

                  <div className="gr-report-remark">
                    <label htmlFor="gr-admin-remark">Admin Remark (included in PDF/Print)</label>
                    <textarea
                      id="gr-admin-remark"
                      value={reportCardRemark}
                      onChange={(e) => setReportCardRemark(e.target.value)}
                      placeholder="Enter admin remark before printing or saving as PDF"
                      rows={3}
                    />
                  </div>
                </>
              )}
            </div>

            <div className="gr-report-footer">
              <button className="gr-btn-secondary" onClick={printReportCard} disabled={reportCardLoading || !reportCardData}>
                Print
              </button>
              <button className="gr-btn-primary" onClick={downloadReportCardPDF} disabled={reportCardLoading || !reportCardData}>
                Save as PDF
              </button>
              <button className="gr-btn-icon" onClick={closeReportCard}>Close</button>
            </div>
          </div>
        </div>
      )}

      <PreviewModal
        isOpen={showPreview}
        onClose={() => setShowPreview(false)}
        title={`Grades Records - ${activeTab.charAt(0).toUpperCase() + activeTab.slice(1)}`}
        data={previewData}
        columns={
          activeTab === 'grades' ? [
            { key: 'Student Number', label: 'STUDENT NUMBER', align: 'left' },
            { key: 'Student Name', label: 'STUDENT NAME', align: 'left' },
            { key: 'Grade Level', label: 'GRADE LEVEL', align: 'center' },
            { key: 'Section', label: 'SECTION', align: 'center' },
            { key: 'Graded Subjects', label: 'GRADED SUBJECTS', align: 'center' },
            { key: 'Average Grade', label: 'AVERAGE GRADE', align: 'center' },
            { key: 'Status', label: 'STATUS', align: 'center' },
            { key: 'History Count', label: 'HISTORY COUNT', align: 'center' },
          ] : activeTab === 'history' ? [
            { key: 'School Year', label: 'SCHOOL YEAR', align: 'center' },
            { key: 'Student Name', label: 'STUDENT NAME', align: 'left' },
            { key: 'Student Number', label: 'STUDENT NUMBER', align: 'center' },
            { key: 'Grade Level', label: 'GRADE LEVEL', align: 'center' },
            { key: 'Section', label: 'SECTION', align: 'center' },
            { key: 'Subject', label: 'SUBJECT', align: 'center' },
            { key: 'Subject Code', label: 'SUBJECT CODE', align: 'center' },
            { key: 'Final Grade', label: 'FINAL GRADE', align: 'center' },
            { key: 'Teacher', label: 'TEACHER', align: 'left' },
          ] : [
            { key: 'Date', label: 'DATE', align: 'left' },
            { key: 'Student Number', label: 'STUDENT NUMBER', align: 'left' },
            { key: 'Student Name', label: 'STUDENT NAME', align: 'left' },
            { key: 'Grade Level', label: 'GRADE LEVEL', align: 'center' },
            { key: 'Section', label: 'SECTION', align: 'center' },
            { key: 'Overall Status', label: 'OVERALL STATUS', align: 'center' },
            { key: 'Present', label: 'PRESENT', align: 'center' },
            { key: 'Late', label: 'LATE', align: 'center' },
            { key: 'Excused', label: 'EXCUSED', align: 'center' },
            { key: 'Absent', label: 'ABSENT', align: 'center' },
          ]
        }
        filename={`GradesRecords_${activeTab}`}
        onDownloadExcel={exportCurrentView}
        onDownloadPDF={activeTab === 'grades' ? exportCurrentViewPDF : activeTab === 'history' ? exportCurrentViewHistoryPDF : undefined}
      />
    </main>
  );
};

export default GradesRecords;