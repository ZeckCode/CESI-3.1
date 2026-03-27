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

const ITEMS_PER_PAGE = 10;

const GRADE_ORDER = {
  'Pre-Kinder': -1,
  'Kinder': 0,
  'Grade 1': 1,
  'Grade 2': 2,
  'Grade 3': 3,
  'Grade 4': 4,
  'Grade 5': 5,
  'Grade 6': 6,
};

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
  const [filterSchoolYear, setFilterSchoolYear] = useState('all');
  const [expandedStudentId, setExpandedStudentId] = useState(null);
  const [expandedHistoryStudentId, setExpandedHistoryStudentId] = useState(null);
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
        if (activeTab === 'grades') {
          const params = new URLSearchParams({ quarter: String(quarter), page: String(page) });
          if (filterGrade && filterGrade !== 'all') {
            params.set('grade_level', filterGrade);
          }
          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|') ? filterSection.split('|')[1] : filterSection;
            if (sectionName) params.set('section', sectionName);
          }
          const gradesData = await apiFetchData(`/api/grades/admin-monitoring/?${params.toString()}`);
          if (cancelled) return;

          const validGradesData = gradesData && typeof gradesData === 'object'
            ? {
                summary: gradesData.summary || {},
                students: Array.isArray(gradesData.students) ? gradesData.students : [],
                quarter,
              }
            : { summary: {}, students: [], quarter };

          setGradeMonitoring(validGradesData);
          // Clear other tab data to avoid cross-tab leakage
          setHistoryRecords([]);
          setAttendanceRecords([]);
        } else if (activeTab === 'history') {
          const historyParams = new URLSearchParams({ page: String(page) });
          if (filterGrade && filterGrade !== 'all') historyParams.set('grade_level', filterGrade);
          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|') ? filterSection.split('|')[1] : filterSection;
            if (sectionName) historyParams.set('section', sectionName);
          }
          if (filterStatus && filterStatus !== 'all') historyParams.set('status', filterStatus);
          if (filterSchoolYear && filterSchoolYear !== 'all') historyParams.set('school_year', filterSchoolYear);

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
          const attendanceParams = new URLSearchParams({ date: selectedDate, page: String(page) });
          if (filterGrade && filterGrade !== 'all') attendanceParams.set('grade_level', filterGrade);
          if (filterSection && filterSection !== 'all') {
            const sectionName = filterSection.includes('|') ? filterSection.split('|')[1] : filterSection;
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
        setGradeMonitoring({ summary: {}, students: [], quarter });
        setHistoryRecords([]);
        setAttendanceRecords([]);
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
  }, [activeTab, selectedDate, filterGrade, filterSection, filterStatus, searchTerm]);

  // Reset all expansion states when switching tabs to prevent state leakage
  useEffect(() => {
    setExpandedStudentId(null);
    setExpandedHistoryStudentId(null);
    setExpandedAttendanceStudentId(null);
  }, [activeTab]);

  const activeData = useMemo(() => {
    if (activeTab === 'grades') return Array.isArray(gradeMonitoring.students) ? gradeMonitoring.students : [];
    if (activeTab === 'history') return Array.isArray(historyRecords) ? historyRecords : [];
    if (activeTab === 'attendance') return Array.isArray(attendanceRecords) ? attendanceRecords : [];
    return [];
  }, [activeTab, attendanceRecords, gradeMonitoring.students, historyRecords]);

  const filterGradeValue = useMemo(() => {
    if (filterGrade === 'all') return null;
    return normalizeGradeLevel(filterGrade);
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

    activeData.forEach((row) => {
      const gradeLabel = toGradeLabel(row.grade_level_label || row.grade_level);
      const sectionName = row.section_name || '';
      if (!sectionName) return;
      if (!gradeMatches(row.grade_level_label || row.grade_level)) return;
      const key = `${gradeLabel}|${sectionName}`;
      items.set(key, `${gradeLabel} — ${sectionName}`);
    });

    return [...items.entries()].map(([value, label]) => ({ value, label }));
  }, [activeData, filterGrade]);

  useEffect(() => {
    if (filterSection !== 'all' && !sectionOptions.some((opt) => opt.value === filterSection)) {
      setFilterSection('all');
    }
  }, [filterSection, sectionOptions]);

  // School year options from academic history
  const schoolYearOptions = useMemo(() => {
    const years = new Set();
    historyRecords.forEach((row) => {
      if (row.school_year) years.add(row.school_year);
    });
    return [...years].sort((a, b) => b.localeCompare(a)); // Newest first
  }, [historyRecords]);

  // Reset section filter when grade filter changes so stale section selection doesn't ghost-filter.
  useEffect(() => {
    setFilterSection('all');
  }, [filterGrade]);

  const filteredStudents = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const students = Array.isArray(gradeMonitoring?.students) ? gradeMonitoring.students : [];
    
    return students.filter((student) => {
      const matchesSearch = !query || [
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
  }, [filterGrade, filterSection, filterStatus, gradeMonitoring, searchTerm]);

  const filteredHistory = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const records = Array.isArray(historyRecords) ? historyRecords : [];
    
    return records.filter((record) => {
      if (!record || typeof record !== 'object') return false;
      
      const matchesSearch = !query || [
        record.student_name,
        record.student_username,
        record.student_number,
        record.subject_name,
        record.subject_code,
        record.school_year,
        record.teacher_name,
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
      const matchesSchoolYear = filterSchoolYear === 'all' || record.school_year === filterSchoolYear;
      const matchesStatus = filterStatus === 'all' || String(record.remarks || '').toLowerCase() === filterStatus;
      return matchesSearch && matchesGrade && matchesSection && matchesSchoolYear && matchesStatus;
    });
  }, [filterGrade, filterSection, filterSchoolYear, filterStatus, historyRecords, searchTerm]);

  // Group academic history records by student for accordion display
  const groupedHistoryStudents = useMemo(() => {
    const grouped = new Map();
    const records = Array.isArray(filteredHistory) ? filteredHistory : [];
    
    records.forEach((record) => {
      if (!record || typeof record !== 'object') return;
      
      const studentId = record.student;
      if (!studentId) return;
      
      if (!grouped.has(studentId)) {
        grouped.set(studentId, {
          student_id: studentId,
          student_name: record.student_name || '—',
          student_username: record.student_username || '',
          student_number: record.student_number || '',
          grade_level: record.grade_level,
          section_name: record.section_name || '—',
          records: [],
        });
      }
      grouped.get(studentId).records.push(record);
    });

    return [...grouped.values()]
      .map((student) => {
        const finalGrades = student.records
          .map((r) => Number(r.final_grade))
          .filter((g) => !Number.isNaN(g));
        const averageFinal = finalGrades.length
          ? (finalGrades.reduce((sum, g) => sum + g, 0) / finalGrades.length).toFixed(2)
          : null;
        
        return {
          ...student,
          total_records: student.records.length,
          average_final: averageFinal,
          school_years: [...new Set(student.records.map((r) => r.school_year).filter(Boolean))].sort((a, b) => b.localeCompare(a)),
        };
      })
      .sort((a, b) => String(a.student_name || '').localeCompare(String(b.student_name || '')));
  }, [filteredHistory]);

  const filteredAttendanceRecords = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    const records = Array.isArray(attendanceRecords) ? attendanceRecords : [];
    
    return records.filter((record) => {
      if (!record || typeof record !== 'object') return false;
      
      const matchesSearch = !query || [
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
  }, [attendanceRecords, filterGrade, filterSection, searchTerm]);

  const filteredAttendanceStudents = useMemo(() => {
    const grouped = new Map();
    const records = Array.isArray(filteredAttendanceRecords) ? filteredAttendanceRecords : [];

    records.forEach((record) => {
      if (!record || typeof record !== 'object') return;
      
      const studentId = record.student;
      if (!studentId) return;
      
      if (!grouped.has(studentId)) {
        grouped.set(studentId, {
          student: studentId,
          student_name: record.student_name || '—',
          student_username: record.student_username || '',
          student_number: record.student_number || '',
          grade_level: record.grade_level,
          section_name: record.section_name || '—',
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
      ? groupedHistoryStudents
      : filteredAttendanceStudents;

  const totalPages = Math.ceil(activeRows.length / ITEMS_PER_PAGE);
  const paginatedRows = activeRows.slice((page - 1) * ITEMS_PER_PAGE, page * ITEMS_PER_PAGE);

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
          'Section': row.section_name,
          'Graded Subjects': `${row.graded_subjects}/${row.total_subjects}`,
          'Average Grade': row.average_grade ?? '—',
          'Status': row.status,
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
          'Section': row.section_name || '—',
          'Subject': row.subject_name,
          'Subject Code': row.subject_code || '—',
          'Final Grade': row.final_grade ?? '—',
          'Remarks': row.remarks || '—',
          'Teacher': row.teacher_name || '—',
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
          'Date': selectedDate,
          'Student Number': row.student_number || '—',
          'Student Name': row.student_name,
          'Grade Level': toGradeLabel(row.grade_level),
          'Section': row.section_name || '—',
          'Overall Status': row.overall_status,
          'Present': row.present,
          'Late': row.late,
          'Excused': row.excused,
          'Absent': row.absent,
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
                <option key={section.value} value={section.value}>{section.label}</option>
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

          {activeTab === 'history' && (
            <div className="gr-filter-group">
              <Filter size={20} />
              <select value={filterSchoolYear} onChange={(e) => setFilterSchoolYear(e.target.value)} className="gr-filter-select">
                <option value="all">All School Years</option>
                {schoolYearOptions.map((year) => (
                  <option key={year} value={year}>{year}</option>
                ))}
              </select>
            </div>
          )}
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
                  <th>Student #</th>
                  <th>Student</th>
                  <th>Grade Level</th>
                  <th>Section</th>
                  <th>Total Records</th>
                  <th>Average Final</th>
                  <th>School Years</th>
                  <th>Details</th>
                </tr>
              </thead>
              <tbody>
                {paginatedRows.map((student) => {
                  const expanded = expandedHistoryStudentId === student.student_id;
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
                        <td data-label="Grade Level">{toGradeLabel(student.grade_level)}</td>
                        <td data-label="Section">{student.section_name || '—'}</td>
                        <td data-label="Total Records">{student.total_records}</td>
                        <td data-label="Average Final">
                          {student.average_final !== null ? (
                            <span className={gradeChipClass(student.average_final)}>{student.average_final}</span>
                          ) : (
                            <span className="gr-muted">—</span>
                          )}
                        </td>
                        <td data-label="School Years">
                          <div className="gr-stack">
                            <span>{student.school_years.length} year{student.school_years.length === 1 ? '' : 's'}</span>
                            <span className="gr-muted">{student.school_years[0] || '—'}</span>
                          </div>
                        </td>
                        <td data-label="Details">
                          <button className="gr-btn-icon" onClick={() => setExpandedHistoryStudentId(expanded ? null : student.student_id)} title="Toggle academic records">
                            {expanded ? <ChevronUp size={16} /> : <ChevronDown size={16} />}
                          </button>
                        </td>
                      </tr>
                      {expanded && (
                        <tr className="gr-expand-row">
                          <td colSpan={8}>
                            <div className="gr-subject-list">
                              {student.records.map((record) => (
                                <div key={record.id} className="gr-subject-card">
                                  <div className="gr-subject-top">
                                    <strong>{record.subject_name}</strong>
                                    <span className="gr-subject-code">{record.subject_code || '—'}</span>
                                  </div>
                                  <div className="gr-stack">
                                    <span className="gr-muted">{record.school_year}</span>
                                    {record.final_grade !== null ? (
                                      <span className={gradeChipClass(record.final_grade)}>{record.final_grade}</span>
                                    ) : (
                                      <span className="gr-grade gr-grade-pending">—</span>
                                    )}
                                  </div>
                                  <div className="gr-stack">
                                    <span className="gr-muted">Teacher: {record.teacher_name || '—'}</span>
                                    <span className={`gr-status-badge gr-status-${String(record.remarks || '').toLowerCase() || 'pending'}`}>
                                      {record.remarks || '—'}
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
                            {record.overall_status}
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
                                    <span className={`gr-attendance-badge gr-att-${subject.status}`}>{subject.status}</span>
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