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
import Pagination from './Pagination';
import { apiFetchData } from '../api/apiFetch';
import '../AdminWebsiteCSS/GradesRecords.css';
import PreviewModal from '../PreviewModal';

const ITEMS_PER_PAGE = 10;
const TABLE_SKELETON_ROWS = 6;

const todayString = () => new Date().toISOString().slice(0, 10);

const normalizeGradeLevel = (value) => {
  if (value === null || value === undefined || value === '') return null;
  const raw = String(value).trim().toLowerCase();

  if (raw === 'prek' || raw === 'pre-kinder' || raw === 'pre kinder') return -1;
  if (raw === 'kinder' || raw === '0') return 0;

  const match = raw.match(/^grade\s*(\d+)$/);
  if (match) return Number(match[1]);

  const num = Number(raw.replace(/[^0-9]/g, ''));
  if (!Number.isNaN(num)) return num;

  return null;
};

const toGradeLabel = (value) => {
  if (value === null || value === undefined || value === '') return '—';
  const normalized = normalizeGradeLevel(value);

  if (normalized === -1) return 'Pre-Kinder';
  if (normalized === 0) return 'Kinder';
  if (normalized !== null) return `Grade ${normalized}`;

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
      const gradedStudents = Number(summary.graded_students || 0);
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
          }.`,
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

  const skeletonColumns = activeTab === 'grades' ? 9 : activeTab === 'history' ? 6 : 7;

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
          Remarks: row.remarks || '—',
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
        }));
      }

      setPreviewData(previewData);
      setShowPreview(true);
    } catch (err) {
      console.error('Error opening preview:', err);
      alert('Failed to open preview. Please try again.');
    }
  };

  const exportCurrentView = () => {
    try {
      const wb = XLSX.utils.book_new();
      const timestamp = new Date().toISOString().slice(0, 10);
      let filename = '';

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

        const sheet = XLSX.utils.json_to_sheet(gradesData);
        sheet['!cols'] = [
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 12 },
          { wch: 12 },
          { wch: 12 },
        ];
        XLSX.utils.book_append_sheet(wb, sheet, 'Current Grades');
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
          Remarks: row.remarks || '—',
          Teacher: row.teacher_name || '—',
        }));

        const sheet = XLSX.utils.json_to_sheet(historyData);
        sheet['!cols'] = [
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 20 },
          { wch: 12 },
          { wch: 12 },
          { wch: 15 },
          { wch: 15 },
        ];
        XLSX.utils.book_append_sheet(wb, sheet, 'Academic History');
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

        const sheet = XLSX.utils.json_to_sheet(attendanceData);
        sheet['!cols'] = [
          { wch: 15 },
          { wch: 15 },
          { wch: 20 },
          { wch: 15 },
          { wch: 15 },
          { wch: 15 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 10 },
          { wch: 30 },
        ];
        XLSX.utils.book_append_sheet(wb, sheet, 'Attendance');
        filename = `admin-attendance-${selectedDate}-${timestamp}.xlsx`;
      }

      XLSX.writeFile(wb, filename);
      alert(`✓ Export successful! File: ${filename}`);
    } catch (err) {
      console.error('Error exporting data:', err);
      alert('Failed to export data. Please try again.');
    }
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
            <div className="gr-stat-change">{historyStats.totalRecords === 0 ? 'No history yet' : historyStats.totalRecords < 100 ? 'Growing database' : historyStats.totalRecords < 500 ? 'Good documentation' : 'Comprehensive records'}</div>
          </div>

          <div className="gr-stat-card gr-stat-green">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Students With History</span>
              <Users size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.uniqueStudents}</div>
            <div className="gr-stat-change positive">{historyStats.uniqueStudents === 0 ? 'No tracked students' : 'Student tracking active'}</div>
          </div>

          <div className="gr-stat-card gr-stat-yellow">
            <div className="gr-stat-header">
              <span className="gr-stat-label">School Years</span>
              <Calendar size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.schoolYears}</div>
            <div className="gr-stat-change">{historyStats.schoolYears < 2 ? 'Limited history' : historyStats.schoolYears < 5 ? 'Growing records' : 'Long-term tracking'}</div>
          </div>

          <div className="gr-stat-card gr-stat-purple">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Average Final Grade</span>
              <TrendingUp size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{historyStats.averageFinal ?? '—'}</div>
            <div className="gr-stat-change positive">{historyStats.averageFinal >= 80 ? 'Excellent performance' : historyStats.averageFinal >= 70 ? 'Good average' : historyStats.averageFinal >= 60 ? 'Fair average' : historyStats.averageFinal ? 'Below target' : 'No grades yet'}</div>
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
            <div className="gr-stat-change">{attendanceStats.totalRecords === 0 ? 'No records for this date' : 'Records tracked'}</div>
          </div>

          <div className="gr-stat-card gr-stat-green">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Present</span>
              <CheckCircle size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.present}</div>
            <div className="gr-stat-change positive">{attendanceStats.totalRecords > 0 ? `${Math.round((attendanceStats.present / attendanceStats.totalRecords) * 100)}% attendance` : 'No data'}</div>
          </div>

          <div className="gr-stat-card gr-stat-red">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Absent</span>
              <XCircle size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.absent}</div>
            <div className="gr-stat-change">{attendanceStats.absent === 0 ? 'All present!' : attendanceStats.absent < 5 ? 'Few absences' : 'Review needed!'}</div>
          </div>

          <div className="gr-stat-card gr-stat-yellow">
            <div className="gr-stat-header">
              <span className="gr-stat-label">Late / Excused</span>
              <Clock size={24} className="gr-stat-icon" />
            </div>
            <div className="gr-stat-value">{attendanceStats.late + attendanceStats.excused}</div>
            <div className="gr-stat-change">{(attendanceStats.late + attendanceStats.excused) === 0 ? 'None recorded' : 'Justified absences'}</div>
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
          <div className="gr-stat-change">{(summary.total_students ?? 0) === 0 ? 'No students monitored' : (summary.total_students ?? 0) < 30 ? 'Small class' : (summary.total_students ?? 0) < 100 ? 'Good enrollment' : 'Large class'}</div>
        </div>

        <div className="gr-stat-card gr-stat-green">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Students With Grades</span>
            <CheckCircle size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.graded_students ?? 0}</div>
          <div className="gr-stat-change positive">{(summary.total_students ?? 0) > 0 ? `${Math.round(((summary.graded_students ?? 0) / (summary.total_students ?? 1)) * 100)}% graded` : 'No grades yet'}</div>
        </div>

        <div className="gr-stat-card gr-stat-yellow">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Pending / Partial</span>
            <AlertCircle size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.pending_grades ?? 0}</div>
          <div className="gr-stat-change">{(summary.pending_grades ?? 0) === 0 ? 'All grades submitted!' : (summary.pending_grades ?? 0) < 10 ? 'Few pending' : 'Review needed!'}</div>
        </div>

        <div className="gr-stat-card gr-stat-purple">
          <div className="gr-stat-header">
            <span className="gr-stat-label">Average Grade</span>
            <TrendingUp size={24} className="gr-stat-icon" />
          </div>
          <div className="gr-stat-value">{summary.average_grade ?? '—'}</div>
          <div className="gr-stat-change positive">{summary.average_grade >= 80 ? 'Excellent performance' : summary.average_grade >= 70 ? 'Good average' : summary.average_grade >= 60 ? 'Fair average' : summary.average_grade ? 'Below target' : 'No grades yet'}</div>
        </div>
      </div>
    );
  };

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
                  <th>History</th>
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
                            <span className="gr-muted">@{student.student_username}</span>
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
                        <td data-label="History">
                          <div className="gr-stack">
                            <span>
                              {student.history_count} record{student.history_count === 1 ? '' : 's'}
                            </span>
                            <span className="gr-muted">
                              {student.latest_history_year || 'No prior year'}
                            </span>
                          </div>
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
                                    <span
                                      className={`gr-status-badge gr-status-${String(
                                        subject.remarks || ''
                                      ).toLowerCase() || 'pending'}`}
                                    >
                                      {subject.remarks || '—'}
                                    </span>
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
            { key: 'School Year', label: 'SCHOOL YEAR', align: 'left' },
            { key: 'Student Name', label: 'STUDENT NAME', align: 'left' },
            { key: 'Student Number', label: 'STUDENT NUMBER', align: 'left' },
            { key: 'Grade Level', label: 'GRADE LEVEL', align: 'center' },
            { key: 'Section', label: 'SECTION', align: 'center' },
            { key: 'Subject', label: 'SUBJECT', align: 'center' },
            { key: 'Subject Code', label: 'SUBJECT CODE', align: 'center' },
            { key: 'Final Grade', label: 'FINAL GRADE', align: 'center' },
            { key: 'Remarks', label: 'REMARKS', align: 'center' },
            { key: 'Teacher', label: 'TEACHER', align: 'center' },
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
      />
    </main>
  );
};

export default GradesRecords;